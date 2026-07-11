import { db } from '../firebase';
import { runTransaction, doc, collection, setDoc, writeBatch } from 'firebase/firestore';
import { Sale, Purchase, Product } from '../../types';
import { addAuditLog } from './auditService';
import { roundTo } from '../utils/finance';

export interface UserContext {
  id: string;
  name: string;
}

/**
 * Processes a Sale transaction.
 * Reads stock, verifies availability, deducts stock, and registers the sale inside a Firestore Transaction.
 */
export const processSaleTransaction = async (
  sale: Omit<Sale, 'id'>,
  user: UserContext
): Promise<Sale> => {
  const saleId = Math.random().toString(36).substr(2, 9);
  
  // Apply financial rounding
  const roundedSale: Sale = {
    ...sale,
    id: saleId,
    total: roundTo(sale.total, 4),
    items: sale.items.map(item => ({
      ...item,
      price: roundTo(item.price, 4)
    }))
  };

  await runTransaction(db, async (transaction) => {
    // Read and verify stock
    const productRefs = roundedSale.items.map(item => doc(db, 'Inventory', item.productId));
    const productSnaps = await Promise.all(
      productRefs.map(ref => transaction.get(ref))
    );

    productSnaps.forEach((snap, idx) => {
      const saleItem = roundedSale.items[idx];
      if (!snap.exists()) {
        throw new Error(`El producto con ID ${saleItem.productId} no existe.`);
      }

      const currentQty = snap.data().quantity || 0;
      if (currentQty < saleItem.quantity) {
        throw new Error(`Stock insuficiente para "${saleItem.name}". Stock disponible: ${currentQty}`);
      }

      // Update inventory stock inside the transaction
      transaction.update(snap.ref, {
        quantity: currentQty - saleItem.quantity
      });
    });

    // Save the sale
    const saleRef = doc(db, 'Sales', saleId);
    transaction.set(saleRef, roundedSale);
  });

  // Log audit
  await addAuditLog({
    resModel: 'Sales',
    resId: saleId,
    userId: user.id,
    userName: user.name,
    action: 'create',
    changes: {
      sale: [null, roundedSale]
    }
  });

  return roundedSale;
};

/**
 * Registers a batch of purchases inside a Firestore writeBatch.
 */
export const registerPurchaseBatchService = async (
  newPurchases: Purchase[],
  inventoryList: Product[],
  user: UserContext
): Promise<Purchase[]> => {
  const processedPurchases: Purchase[] = [];

  await runTransaction(db, async (transaction) => {
    // 1. First, fetch all existing products that might need updates
    const productsToFetch = newPurchases.map(p => {
      return p.productId || (inventoryList.find(i => i.name.toLowerCase() === p.productName.toLowerCase())?.id);
    }).filter(id => id); // Remove undefined/empty
    
    const productRefs = productsToFetch.map(id => doc(db, 'Inventory', id as string));
    const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));
    
    // Create a map for quick lookup of existing products by ID or Name
    const existingProductsMap = new Map();
    productSnaps.forEach(snap => {
      if (snap.exists()) {
        const data = snap.data();
        existingProductsMap.set(snap.id, data);
        existingProductsMap.set(data.name.toLowerCase(), data);
      }
    });
    
    // Also add inventoryList to map to fallback if transaction get missed it due to no ID
    inventoryList.forEach(p => {
      if (!existingProductsMap.has(p.id)) existingProductsMap.set(p.id, p);
      if (!existingProductsMap.has(p.name.toLowerCase())) existingProductsMap.set(p.name.toLowerCase(), p);
    });

    // 2. Process purchases and update inventory
    newPurchases.forEach(p => {
      const purchaseRef = doc(collection(db, 'Purchases'));
      const purchaseId = purchaseRef.id;
      
      let productId = p.productId;
      let existingProduct = productId ? existingProductsMap.get(productId) : existingProductsMap.get(p.productName.toLowerCase());
      
      if (!existingProduct && !productId) {
        // Create new product
        const newProductRef = doc(collection(db, 'Inventory'));
        productId = newProductRef.id;
        const newProduct: Product = {
          id: productId,
          name: p.productName,
          category: p.category,
          quantity: p.quantity,
          cost: roundTo(p.price, 4),
          price: roundTo(p.price * 1.3, 4), // Suggested 30% margin
          barcode: Math.floor(100000000000 + Math.random() * 900000000000).toString()
        };
        transaction.set(newProductRef, newProduct);
        existingProductsMap.set(productId, newProduct);
        existingProductsMap.set(p.productName.toLowerCase(), newProduct);
      } else {
        // Update existing product
        productId = existingProduct.id;
        const currentQty = existingProduct.quantity || 0;
        const productRef = doc(db, 'Inventory', productId as string);
        transaction.update(productRef, {
          quantity: currentQty + p.quantity,
          cost: roundTo(p.price, 4) // Update latest cost
        });
        existingProductsMap.set(productId, { ...existingProduct, quantity: currentQty + p.quantity });
      }

      const roundedPurchase: Purchase = {
        ...p,
        id: purchaseId,
        productId,
        price: roundTo(p.price, 4),
        total: roundTo(p.total, 4)
      };

      transaction.set(purchaseRef, roundedPurchase);
      processedPurchases.push(roundedPurchase);
    });
  });

  // No need for batch.commit() since runTransaction handles it automatically

  // Audit log for the purchase batch
  await addAuditLog({
    resModel: 'Purchases',
    resId: processedPurchases[0]?.invoiceNumber || 'batch',
    userId: user.id,
    userName: user.name,
    action: 'create',
    changes: {
      purchasesCount: [0, processedPurchases.length]
    }
  });

  return processedPurchases;
};

/**
 * Marks invoices under a specific invoice number as 'Pagada' (paid).
 */
export const payCreditInvoiceService = async (
  invoiceNumber: string,
  currentPurchases: Purchase[],
  user: UserContext
): Promise<void> => {
  const itemsToUpdate = currentPurchases.filter(
    p => p.invoiceNumber === invoiceNumber && p.type === 'Crédito' && p.status !== 'Pagada'
  );
  
  if (itemsToUpdate.length === 0) return;

  const batch = writeBatch(db);
  itemsToUpdate.forEach(item => {
    if (item.id) {
      const ref = doc(db, 'Purchases', item.id);
      batch.update(ref, { status: 'Pagada' });
    }
  });

  await batch.commit();

  await addAuditLog({
    resModel: 'Purchases',
    resId: invoiceNumber,
    userId: user.id,
    userName: user.name,
    action: 'write',
    changes: {
      status: ['Crédito/Pendiente', 'Pagada']
    }
  });
};
