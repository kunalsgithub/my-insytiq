import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getStorage, ref, listAll } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

console.log('FIREBASE CONFIG:', firebaseConfig);

export const testFirebaseConnection = async () => {
  console.log('Testing Firebase connection...');
  
  try {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    console.log('✅ Firebase app initialized');

    // Test Firestore
    const db = getFirestore(app);
    const contentRef = collection(db, 'trendingContent');
    const snapshot = await getDocs(contentRef);
    console.log('✅ Firestore connected');
    console.log(`Found ${snapshot.size} documents in trendingContent collection`);
    
    if (snapshot.empty) {
      console.warn('⚠️ No documents found in trendingContent collection');
    } else {
      // Log the first document as a sample
      const firstDoc = snapshot.docs[0].data();
      console.log('Sample document:', {
        id: snapshot.docs[0].id,
        ...firstDoc
      });
    }

    // Test Storage
    const storage = getStorage(app);
    const storageRef = ref(storage);
    const result = await listAll(storageRef);
    console.log('✅ Storage connected');
    console.log(`Found ${result.items.length} files in root storage`);
    console.log(`Found ${result.prefixes.length} folders in root storage`);

    return {
      success: true,
      firestoreDocCount: snapshot.size,
      storageItemCount: result.items.length,
      storageFolderCount: result.prefixes.length
    };
  } catch (error) {
    console.error('❌ Firebase connection test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Add a function to test a specific document
export const testSpecificDocument = async (documentId: string) => {
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const contentRef = collection(db, 'trendingContent');
    const snapshot = await getDocs(contentRef);
    
    const doc = snapshot.docs.find(d => d.id === documentId);
    if (doc) {
      console.log('Document found:', {
        id: doc.id,
        data: doc.data()
      });
      return { success: true, data: doc.data() };
    } else {
      console.warn(`Document ${documentId} not found`);
      return { success: false, error: 'Document not found' };
    }
  } catch (error) {
    console.error('Error testing specific document:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}; 