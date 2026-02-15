import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, getDocs, DocumentData, where, doc, setDoc, getDoc } from 'firebase/firestore';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { getAuth, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut as firebaseSignOut, onAuthStateChanged, User, getRedirectResult } from 'firebase/auth';
import checkEnvVariables from '@/scripts/checkEnv';

// Check environment variables before initializing Firebase
if (!checkEnvVariables()) {
  throw new Error('Missing required environment variables for Firebase configuration');
}

// Your Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Debug log Firebase config (without sensitive data)
console.log('Firebase Config Status:', {
  hasApiKey: !!firebaseConfig.apiKey,
  hasAuthDomain: !!firebaseConfig.authDomain,
  hasProjectId: !!firebaseConfig.projectId,
  hasStorageBucket: !!firebaseConfig.storageBucket,
  hasMessagingSenderId: !!firebaseConfig.messagingSenderId,
  hasAppId: !!firebaseConfig.appId
});

console.log('FIREBASE CONFIG:', firebaseConfig);

// Initialize Firebase
let app;
let db;
let storage;
let auth;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
  auth = getAuth(app);
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase:', error);
  throw new Error('Failed to initialize Firebase. Check your configuration.');
}

export interface TrendingContent {
  id: string;
  contentId: string;
  title: string;
  creator: string;
  type: 'post' | 'reel' | 'audio';
  thumbnailUrl: string;
  mediaUrl: string;
  originalUrl: string;
  categories: string[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// Convert Firestore document to TrendingContent
const convertToTrendingContent = (doc: DocumentData): TrendingContent => {
  const data = doc.data();
  return {
    id: doc.id,
    contentId: data.contentId || doc.id,
    title: data.title || '',
    creator: data.creator || '',
    type: data.type || 'post',
    thumbnailUrl: data.thumbnailUrl || '',
    mediaUrl: data.mediaUrl || '',
    originalUrl: data.originalUrl || '',
    categories: data.categories || [],
    order: data.order || 0,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date()
  };
};

// Fetch trending content from Firestore
export const fetchTrendingContent = async (searchTerm: string = '', category: string = 'all'): Promise<TrendingContent[]> => {
  try {
    console.log('Fetching trending content:', { searchTerm, category });
    
    const contentRef = collection(db, 'trendingContent');
    console.log('Collection reference created');
    
    let q = query(contentRef, orderBy('order', 'asc'));
    console.log('Base query created');

    // If category is specified and not 'all', filter by category
    if (category !== 'all') {
      console.log('Applying category filter:', category);
      q = query(q, where('categories', 'array-contains', category));
    }

    console.log('Executing Firestore query...');
    const querySnapshot = await getDocs(q);
    console.log('Query results received:', {
      totalDocs: querySnapshot.size,
      empty: querySnapshot.empty
    });

    let content = querySnapshot.docs.map(doc => {
      const data = doc.data();
      console.log('Document data:', { id: doc.id, ...data });
      return convertToTrendingContent(doc);
    });

    // If search term is provided, filter content
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      content = content.filter(item => 
        item.title.toLowerCase().includes(searchLower) ||
        item.creator.toLowerCase().includes(searchLower)
      );
      console.log('Filtered by search term:', { 
        searchTerm, 
        resultCount: content.length 
      });
    }

    console.log('Final content count:', content.length);
    return content;
  } catch (error) {
    console.error('Error fetching trending content:', error);
    throw error;
  }
};

// Get download URL for a Firebase Storage image
export const getImageUrl = async (path: string): Promise<string> => {
  try {
    if (!path) return '';
    
    // If it's already a full URL, return it
    if (path.startsWith('http')) {
      return path;
    }

    // Get the download URL from Firebase Storage
    const imageRef = ref(storage, path);
    return await getDownloadURL(imageRef);
  } catch (error) {
    console.error('Error getting image URL:', error);
    return '';
  }
};

// Fetch live engagement data (you can implement this based on your needs)
export const fetchLiveEngagement = async (contentId: string) => {
  try {
    const engagementRef = collection(db, 'engagement');
    const q = query(engagementRef, where('contentId', '==', contentId));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return {
        likes: '0',
        comments: '0',
        shares: '0',
        saves: '0'
      };
    }

    const data = querySnapshot.docs[0].data();
    return {
      likes: data.likes?.toString() || '0',
      comments: data.comments?.toString() || '0',
      shares: data.shares?.toString() || '0',
      saves: data.saves?.toString() || '0'
    };
  } catch (error) {
    console.error('Error fetching engagement data:', error);
    throw error;
  }
};

// --- GOOGLE AUTH LOGIC ---
const provider = new GoogleAuthProvider();

// Configure Google Auth Provider
provider.setCustomParameters({
  prompt: 'select_account'
});

export const signInWithGoogle = async () => {
  try {
    // Check if Firebase is properly initialized
    if (!auth) {
      throw new Error('Firebase Auth not initialized');
    }

    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      throw new Error('Google sign-in requires a browser environment');
    }

    const currentHost = window.location.host;
    const currentOrigin = window.location.origin;
    
    console.log('🔐 Attempting Google sign-in with popup...');
    console.log('   Current domain:', currentHost);
    console.log('   Current origin:', currentOrigin);
    
    const result = await signInWithPopup(auth, provider);
    
    // The signed-in user info.
    const user = result.user;
    console.log('✅ Google sign-in successful:', user.email);
    
    // You can also get user.accessToken if needed
    return user;
  } catch (error: any) {
    console.error('❌ Google sign-in popup error:', error);
    console.error('   Error code:', error?.code);
    console.error('   Error message:', error?.message);
    
    // Handle specific error cases
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in was cancelled. Please try again.');
    } else if (error.code === 'auth/popup-blocked') {
      throw new Error('Pop-up was blocked by your browser. Please allow pop-ups for this site and try again.');
    } else if (error.code === 'auth/unauthorized-domain') {
      const currentDomain = window.location.hostname; // Get just the hostname without port
      const firebaseConsoleUrl = `https://console.firebase.google.com/project/social-trends-29ac2/authentication/settings`;
      const errorMsg = `Domain "${currentDomain}" is not authorized. 
      
QUICK FIX:
1. Open: ${firebaseConsoleUrl}
2. Scroll to "Authorized domains"
3. Click "Add domain"
4. Enter: ${currentDomain}
5. Click "Add"

OR use localhost instead: http://localhost:${window.location.port || '8090'}`;
      
      console.error('🔴 UNAUTHORIZED DOMAIN ERROR:');
      console.error('   Current domain:', currentDomain);
      console.error('   Fix URL:', firebaseConsoleUrl);
      
      throw new Error(errorMsg);
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your internet connection and try again.');
    } else {
      throw new Error(`Sign-in failed: ${error.message || 'Unknown error occurred'}`);
    }
  }
};

// Fallback method using redirect instead of popup
export const signInWithGoogleRedirect = async () => {
  try {
    if (!auth) {
      throw new Error('Firebase Auth not initialized');
    }

    console.log('🔐 Attempting Google sign-in with redirect...');
    await signInWithRedirect(auth, provider);
  } catch (error: any) {
    console.error('❌ Google sign-in redirect error:', error);
    throw new Error(`Redirect sign-in failed: ${error.message || 'Unknown error occurred'}`);
  }
};

// Handle redirect result (call this when the page loads after redirect)
export const handleRedirectResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      console.log('✅ Google sign-in redirect successful:', result.user.email);
      return result.user;
    }
    return null;
  } catch (error: any) {
    console.error('❌ Error handling redirect result:', error);
    throw error;
  }
};

export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const onAuthStateChangedListener = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Export Firebase instances
export { db, auth, storage };

 