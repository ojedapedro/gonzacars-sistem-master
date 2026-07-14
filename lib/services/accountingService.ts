import { db } from '../firebase';
import { runTransaction, doc, collection, setDoc, writeBatch, getDoc, getDocs, query, where } from 'firebase/firestore';
import { Sale, Purchase, Product } from '../../types';
import { addAuditLog } from './auditService';
import { roundTo } from '../utils/finance';

export interface UserContext {
  id: string;
  name: string;
}

const getWarehouseStock = (productData: any): Record<string, number> => {
  const stock = productData.warehouseStock || {};
  return {
    gonzacars: stock.gonzacars !== undefined ? stock.gonzacars : (productData.quantity || 0),
    externo_1: stock.externo_1 || 0,
    externo_2: stock.externo_2 || 0,
    externo_3: stock.externo_3 || 0,
    externo_4: stock.externo_4 || 0
  };
};

const deductStockFromWarehouseStock = (wStock: Record<string, number>, qty: number): Record<string, number> => {
  const updatedStock = { ...wStock };
  const order = ['gonzacars', 'externo_1', 'externo_2', 'externo_3', 'externo_4'];
  let remaining = qty;
  for (const wId of order) {
    if (remaining <= 0) break;
    const current = updatedStock[wId] || 0;
    if (current > 0) {
      const sub = Math.min(remaining, current);
      updatedStock[wId] = current - sub;
      remaining -= sub;
    }
  }
  return updatedStock;
};

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

  // 1. Fetch sold products snaps to check their type (consignment or own)
  const productRefs = roundedSale.items.map(item => doc(db, 'Inventory', item.productId));
  const productSnaps = await Promise.all(productRefs.map(ref => getDoc(ref)));

  // 2. Fetch all general (own) products to find consignment matches
  const generalInventorySnap = await getDocs(query(collection(db, 'Inventory'), where('isConsignment', '!=', true)));
  const generalProducts = generalInventorySnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

  // 3. Map consignment product IDs to their matching general product ID (if one exists)
  const generalProductsToRead: string[] = [];
  const consignmentProductMap = new Map<string, string>(); // consignmentId -> generalId

  productSnaps.forEach((snap, idx) => {
    const data = snap.data();
    if (data && data.isConsignment) {
      const match = generalProducts.find(gp => 
        (data.barcode && gp.barcode === data.barcode) || 
        (gp.name.toLowerCase() === data.name.toLowerCase())
      );
      if (match) {
        generalProductsToRead.push(match.id);
        consignmentProductMap.set(snap.id, match.id);
      }
    }
  });

  await runTransaction(db, async (transaction) => {
    // Transaction Reads
    const soldSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));
    const generalSnaps = await Promise.all(
      generalProductsToRead.map(id => transaction.get(doc(db, 'Inventory', id)))
    );

    const generalSnapsMap = new Map<string, any>();
    generalSnaps.forEach(snap => {
      generalSnapsMap.set(snap.id, snap);
    });

    // Transaction Writes
    soldSnaps.forEach((snap, idx) => {
      const saleItem = roundedSale.items[idx];
      if (!snap.exists()) {
        throw new Error(`El producto con ID ${saleItem.productId} no existe.`);
      }

      const productData = snap.data();
      const currentQty = productData.quantity || 0;
      if (currentQty < saleItem.quantity) {
        throw new Error(`Stock insuficiente para "${saleItem.name}". Stock disponible: ${currentQty}`);
      }

      const saleQty = saleItem.quantity;

      if (productData.isConsignment) {
        // 1. Deduct stock from the consignment product
        const wStockConsignment = getWarehouseStock(productData);
        const updatedWStockConsignment = deductStockFromWarehouseStock(wStockConsignment, saleQty);
        const newTotalQtyConsignment = Object.values(updatedWStockConsignment).reduce((a, b) => a + b, 0);

        transaction.update(snap.ref, {
          quantity: newTotalQtyConsignment,
          warehouseStock: updatedWStockConsignment
        });

        // 2. Transfer stock to the general (Gonzacars) inventory
        const matchId = consignmentProductMap.get(snap.id);
        if (matchId) {
          // Update existing general product: add sold stock to Gonzacars warehouse then deduct it for sale
          const genSnap = generalSnapsMap.get(matchId);
          const genData = genSnap.data();
          const genWStock = getWarehouseStock(genData);

          // Add to Gonzacars principal
          genWStock.gonzacars += saleQty;
          
          // Deduct from Gonzacars principal for the sale
          genWStock.gonzacars -= saleQty;

          const finalTotalQtyGen = Object.values(genWStock).reduce((a, b) => a + b, 0);

          transaction.update(genSnap.ref, {
            quantity: finalTotalQtyGen,
            warehouseStock: genWStock
          });
        } else {
          // Create new general product with 0 quantity (was created with saleQty then sold immediately)
          const newGenRef = doc(collection(db, 'Inventory'));
          const genWStock = {
            gonzacars: 0,
            externo_1: 0,
            externo_2: 0,
            externo_3: 0,
            externo_4: 0
          };
          const newGenProduct: Product = {
            id: newGenRef.id,
            name: productData.name,
            category: productData.category,
            quantity: 0,
            cost: productData.cost,
            price: productData.price,
            barcode: productData.barcode || Math.floor(100000000000 + Math.random() * 900000000000).toString(),
            lastEntry: new Date().toISOString().split('T')[0],
            warehouseStock: genWStock
          };
          transaction.set(newGenRef, newGenProduct);
        }
      } else {
        // Normal own product sale: deduct stock from warehouses
        const wStock = getWarehouseStock(productData);

        if (wStock.gonzacars < saleQty) {
          let need = saleQty - wStock.gonzacars;
          const externalWarehouses = ['externo_1', 'externo_2', 'externo_3', 'externo_4'];
          
          for (const extId of externalWarehouses) {
            if (need <= 0) break;
            const extStock = wStock[extId] || 0;
            if (extStock > 0) {
              const transferQty = Math.min(need, extStock);
              wStock[extId] -= transferQty;
              wStock.gonzacars += transferQty;
              need -= transferQty;
            }
          }
          
          if (need > 0) {
            throw new Error(`Stock insuficiente en almacenes para "${saleItem.name}".`);
          }
        }

        // Deduct from main warehouse
        wStock.gonzacars -= saleQty;

        // Recalculate total quantity
        const newTotalQty = Object.values(wStock).reduce((a, b) => a + b, 0);

        // Update inventory stock inside the transaction
        transaction.update(snap.ref, {
          quantity: newTotalQty,
          warehouseStock: wStock
        });
      }
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
      
      const selectedWarehouse = p.warehouseId || 'gonzacars';

      if (!existingProduct && !productId) {
        // Create new product
        const newProductRef = doc(collection(db, 'Inventory'));
        productId = newProductRef.id;
        const wStock = {
          gonzacars: selectedWarehouse === 'gonzacars' ? p.quantity : 0,
          externo_1: selectedWarehouse === 'externo_1' ? p.quantity : 0,
          externo_2: selectedWarehouse === 'externo_2' ? p.quantity : 0,
          externo_3: selectedWarehouse === 'externo_3' ? p.quantity : 0,
          externo_4: selectedWarehouse === 'externo_4' ? p.quantity : 0
        };
        const newProduct: Product = {
          id: productId,
          name: p.productName,
          category: p.category,
          quantity: p.quantity,
          cost: roundTo(p.price, 4),
          price: roundTo(p.price * 1.3, 4), // Suggested 30% margin
          barcode: Math.floor(100000000000 + Math.random() * 900000000000).toString(),
          warehouseStock: wStock,
          lastEntry: new Date().toISOString().split('T')[0]
        };
        transaction.set(newProductRef, newProduct);
        existingProductsMap.set(productId, newProduct);
        existingProductsMap.set(p.productName.toLowerCase(), newProduct);
      } else {
        // Update existing product
        productId = existingProduct.id;
        const wStock = getWarehouseStock(existingProduct);
        wStock[selectedWarehouse] = (wStock[selectedWarehouse] || 0) + p.quantity;
        
        const newTotalQty = Object.values(wStock).reduce((a, b) => a + b, 0);
        const productRef = doc(db, 'Inventory', productId as string);
        transaction.update(productRef, {
          quantity: newTotalQty,
          cost: roundTo(p.price, 4), // Update latest cost
          warehouseStock: wStock
        });
        existingProductsMap.set(productId, { ...existingProduct, quantity: newTotalQty, warehouseStock: wStock });
      }

      const roundedPurchase: Purchase = {
        ...p,
        id: purchaseId,
        productId,
        price: roundTo(p.price, 4),
        total: roundTo(p.total, 4),
        warehouseId: selectedWarehouse
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
