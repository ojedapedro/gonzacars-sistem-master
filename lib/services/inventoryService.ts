import { db } from '../firebase';
import { cleanForFirestore } from '../firebase';
import { doc, updateDoc, addDoc, collection, setDoc, deleteDoc } from 'firebase/firestore';
import { Product } from '../../types';
import { addAuditLog } from './auditService';
import { roundTo } from '../utils/finance';

export interface UserContext {
  id: string;
  name: string;
}

/**
 * Creates a new product in inventory and records an audit log.
 */
export const createProduct = async (product: Omit<Product, 'id'>, user: UserContext): Promise<Product> => {
  const roundedProduct = {
    ...product,
    cost: roundTo(product.cost, 4),
    price: roundTo(product.price, 4)
  };
  
  const cleanRoundedProduct = cleanForFirestore(roundedProduct);
  const docRef = await addDoc(collection(db, 'Inventory'), cleanRoundedProduct);
  const newProduct: Product = { id: docRef.id, ...roundedProduct };
  const cleanNewProduct = cleanForFirestore(newProduct);
  await setDoc(docRef, cleanNewProduct);

  await addAuditLog({
    resModel: 'Inventory',
    resId: docRef.id,
    userId: user.id,
    userName: user.name,
    action: 'create',
    changes: {
      product: [null, newProduct]
    }
  });

  return newProduct;
};

/**
 * Updates a product in inventory, calculating and logging exact modifications.
 */
export const updateProduct = async (
  productId: string,
  updatedFields: Partial<Product>,
  currentProduct: Product,
  user: UserContext
): Promise<void> => {
  const ref = doc(db, 'Inventory', productId);
  
  // Format numeric values
  if (updatedFields.cost !== undefined) updatedFields.cost = roundTo(updatedFields.cost, 4);
  if (updatedFields.price !== undefined) updatedFields.price = roundTo(updatedFields.price, 4);
  
  // Calculate differences for auditing
  const changes: Record<string, [any, any]> = {};
  Object.keys(updatedFields).forEach((key) => {
    const valKey = key as keyof Product;
    if (updatedFields[valKey] !== currentProduct[valKey]) {
      changes[key] = [currentProduct[valKey], updatedFields[valKey]];
    }
  });

  if (Object.keys(changes).length === 0) return;

  const cleanUpdatedFields = cleanForFirestore(updatedFields);
  await updateDoc(ref, cleanUpdatedFields);

  await addAuditLog({
    resModel: 'Inventory',
    resId: productId,
    userId: user.id,
    userName: user.name,
    action: 'write',
    changes
  });
};

/**
 * Deletes a product from the database and logs the audit information.
 */
export const deleteProduct = async (productId: string, currentProduct: Product, user: UserContext): Promise<void> => {
  await deleteDoc(doc(db, 'Inventory', productId));
  
  await addAuditLog({
    resModel: 'Inventory',
    resId: productId,
    userId: user.id,
    userName: user.name,
    action: 'delete',
    changes: {
      product: [currentProduct, null]
    }
  });
};
