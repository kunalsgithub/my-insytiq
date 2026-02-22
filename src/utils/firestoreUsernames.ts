import { doc, setDoc, getDoc, collection, getDocs, query, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebaseService';

export interface AnalyzedUsername {
  username: string;
  createdAt: Date;
  updatedAt: Date;
  lastAnalyzedAt?: Date;
  analysisCount?: number;
}



/**
 * Get all analyzed usernames for a user
 * @param userId - The user's Firebase UID
 * @returns Promise<AnalyzedUsername[]> - Array of analyzed usernames
 */
export const getAnalyzedUsernames = async (userId: string): Promise<AnalyzedUsername[]> => {
  try {
    const usernamesRef = collection(db, "users", userId, "analyzedUsernames");
    const q = query(usernamesRef, orderBy("lastAnalyzedAt", "desc"));
    const querySnapshot = await getDocs(q);
    
    const usernames: AnalyzedUsername[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      usernames.push({
        username: data.username,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        lastAnalyzedAt: data.lastAnalyzedAt?.toDate(),
        analysisCount: data.analysisCount || 1
      });
    });
    
    return usernames;
  } catch (error) {
    console.error('❌ Error getting analyzed usernames:', error);
    throw error;
  }
};

/**
 * Get the most recently analyzed username for a user
 * @param userId - The user's Firebase UID
 * @returns Promise<string | null> - The most recent username or null
 */
export const getLastAnalyzedUsername = async (userId: string): Promise<string | null> => {
  try {
    const usernames = await getAnalyzedUsernames(userId);
    return usernames.length > 0 ? usernames[0].username : null;
  } catch (error) {
    console.error('❌ Error getting last analyzed username:', error);
    throw error;
  }
};

/**
 * Save an analyzed username to the user's subcollection
 * Supports multiple usernames by properly handling existing documents
 * Also updates users/{uid} with selectedInstagramAccount and analyticsReady: false
 * @param userId - The user's Firebase UID
 * @param username - The Instagram username to save
 * @returns Promise<boolean> - Success status
 */
export const saveAnalyzedUsername = async (userId: string, username: string): Promise<boolean> => {
  try {
    const usernameDocRef = doc(db, "users", userId, "analyzedUsernames", username);
    const userDocRef = doc(db, "users", userId);
    const now = new Date();

    // Check if the username document already exists
    const existingDoc = await getDoc(usernameDocRef);
    const isNewUsername = !existingDoc.exists();
    
    // Get existing data if document exists
    const existingData = existingDoc.exists() ? existingDoc.data() : {};
    
    // Preserve original createdAt if document exists, otherwise use current time
    const createdAt = isNewUsername ? now : (existingData.createdAt || now);
    
    // Get current analysis count and increment it
    const currentCount = existingData.analysisCount || 0;
    const newCount = currentCount + 1;

    // Prepare document data for subcollection
    const documentData = {
      username,
      createdAt,
      updatedAt: now,
      lastAnalyzedAt: now,
      analysisCount: newCount
    };

    // Prepare user document data for Smart Chat personalization
    const userDocumentData = {
      selectedInstagramAccount: username,
      analyticsReady: false,
      updatedAt: now
    };

    // Save to Firestore (both subcollection and user document)
    await Promise.all([
      setDoc(usernameDocRef, documentData, { merge: true }),
      setDoc(userDocRef, userDocumentData, { merge: true })
    ]);

    // Log appropriate message based on whether it's a new or existing username
    if (isNewUsername) {
      console.log('✅ New username saved successfully:', username);
    } else {
      console.log('✅ Existing username updated successfully:', username, `(analysis #${newCount})`);
    }
    console.log('✅ User document updated with selectedInstagramAccount and analyticsReady: false');
    
    return true;
  } catch (error) {
    console.error('❌ Error saving/updating username:', error);
    throw error;
  }
};

/**
 * Update the last analyzed timestamp for a username
 * @param userId - The user's Firebase UID
 * @param username - The Instagram username to update
 * @returns Promise<boolean> - Success status
 */
export const updateUsernameAnalysis = async (userId: string, username: string): Promise<boolean> => {
  try {
    const usernameDocRef = doc(db, "users", userId, "analyzedUsernames", username);
    const now = new Date();
    
    // Get existing data to increment analysis count
    const existingDoc = await getDoc(usernameDocRef);
    const currentCount = existingDoc.exists() ? (existingDoc.data().analysisCount || 0) : 0;
    
    await setDoc(usernameDocRef, {
      username,
      updatedAt: now,
      lastAnalyzedAt: now,
      analysisCount: currentCount + 1
    }, { merge: true });
    
    console.log('✅ Username analysis updated:', username);
    return true;
  } catch (error) {
    console.error('❌ Error updating username analysis:', error);
    throw error;
  }
};
  

/**
 * Delete an analyzed username
 * @param userId - The user's Firebase UID
 * @param username - The Instagram username to delete
 * @returns Promise<boolean> - Success status
 */
export const deleteAnalyzedUsername = async (userId: string, username: string): Promise<boolean> => {
  try {
    const usernameDocRef = doc(db, "users", userId, "analyzedUsernames", username);
    await deleteDoc(usernameDocRef);
    
    console.log('✅ Username deleted successfully:', username);
    return true;
  } catch (error) {
    console.error('❌ Error deleting username:', error);
    throw error;
  }
};

/**
 * Check if a username exists for a user
 * @param userId - The user's Firebase UID
 * @param username - The Instagram username to check
 * @returns Promise<boolean> - Whether the username exists
 */
export const usernameExists = async (userId: string, username: string): Promise<boolean> => {
  try {
    const usernameDocRef = doc(db, "users", userId, "analyzedUsernames", username);
    const docSnap = await getDoc(usernameDocRef);
    return docSnap.exists();
  } catch (error) {
    console.error('❌ Error checking username existence:', error);
    throw error;
  }
};
