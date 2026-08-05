import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyB8OMdlj3hgtCgOgaECFjg6Hz-zUTg546c",
  authDomain: "proyectocat.firebaseapp.com",
  projectId: "proyectocat",
  storageBucket: "proyectocat.firebasestorage.app",
  messagingSenderId: "962796229467",
  appId: "1:962796229467:web:721ca43918d55ee1e7407e",
  measurementId: "G-NQ4X7GRZB9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics (Measurement ID support)
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

// Initialize Cloud Firestore, Auth and Storage
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
export { app, analytics };

/**
 * Removes undefined properties from an object (or arrays) recursively.
 * Firestore will throw an error if undefined is passed to setDoc or updateDoc.
 */
export const cleanForFirestore = <T>(obj: T): T => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => cleanForFirestore(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    // If it's a Date object, leave it as is
    if (obj instanceof Date) {
      return obj;
    }
    const cleanObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (value !== undefined) {
          cleanObj[key] = cleanForFirestore(value);
        }
      }
    }
    return cleanObj;
  }

  return obj;
};

