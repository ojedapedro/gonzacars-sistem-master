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

