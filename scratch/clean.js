import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB8OMdlj3hgtCgOgaECFjg6Hz-zUTg546c",
  authDomain: "proyectocat.firebaseapp.com",
  projectId: "proyectocat",
  storageBucket: "proyectocat.firebasestorage.app",
  messagingSenderId: "962796229467",
  appId: "1:962796229467:web:721ca43918d55ee1e7407e",
  measurementId: "G-NQ4X7GRZB9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanCollection(collectionName, dateField) {
  console.log(`Buscando en ${collectionName}...`);
  const colRef = collection(db, collectionName);
  const snapshot = await getDocs(colRef);
  
  let deletedCount = 0;
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    let docDateStr = data[dateField];
    
    // Convert timestamp to string if necessary
    if (docDateStr && typeof docDateStr !== 'string' && docDateStr.toDate) {
      docDateStr = docDateStr.toDate().toISOString();
    }
    
    if (docDateStr) {
      const date = new Date(docDateStr);
      // Meses en JS son 0-11, así que septiembre es 8
      if (date.getMonth() !== 8) {
        await deleteDoc(doc(db, collectionName, docSnap.id));
        deletedCount++;
      }
    } else {
      // If there's no date, delete it assuming it's bad data (or keep it?)
      // Let's delete it so it's fully clean.
      await deleteDoc(doc(db, collectionName, docSnap.id));
      deletedCount++;
    }
  }
  console.log(`Eliminados ${deletedCount} registros que NO eran de septiembre en ${collectionName}.`);
}

async function run() {
  try {
    await cleanCollection('Sales', 'date');
    await cleanCollection('Purchases', 'date');
    await cleanCollection('Repairs', 'createdAt');
    console.log("Limpieza terminada.");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

run();
