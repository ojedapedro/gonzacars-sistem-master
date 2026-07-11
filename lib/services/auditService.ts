import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

export interface AuditLog {
  id?: string;
  resModel: string; // e.g., 'Inventory', 'Sales', 'Repairs'
  resId: string;
  userId: string;
  userName: string;
  action: 'create' | 'write' | 'delete';
  changes: Record<string, [any, any]>; // field: [oldValue, newValue]
  timestamp: string;
}

/**
 * Adds an audit log record into the Firestore 'AuditLogs' collection.
 */
export const addAuditLog = async (log: Omit<AuditLog, 'timestamp'>) => {
  try {
    const fullLog: AuditLog = {
      ...log,
      timestamp: new Date().toISOString()
    };
    await addDoc(collection(db, 'AuditLogs'), fullLog);
  } catch (error) {
    console.error('Error logging audit data:', error);
  }
};
