import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebaseService';
import { fetchAndStoreInstagramData } from '@/api/fetchAndStoreInstagramData';

export interface CachedAnalyticsData {
  profile: any;
  fetchedAt: string;
}

export interface InstagramAnalyticsData {
  followers: number;
  engagementRate: number;
  avgLikes: number;
  avgComments: number;
  postingFrequency: number; 
  topHashtags: string[];
  lastUpdated: any;
}

export interface UserAnalyticsState {
  selectedInstagramAccount: string | null;
  analyticsReady: boolean;
}

/**
 * Check Firestore for cached analytics data and user state
 * @param userId - The user's Firebase UID
 * @param username - Instagram username to check
 * @returns Object with cached data (if available) and whether fetch is needed
 */
export async function checkCachedAnalytics(
  userId: string,
  username: string
): Promise<{
  hasCachedData: boolean;
  cachedData: CachedAnalyticsData | null;
  needsFetch: boolean;
  userState: UserAnalyticsState | null;
}> {
  try {
    // 1. Check user document for selectedInstagramAccount and analyticsReady
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    let userState: UserAnalyticsState | null = null;
    if (userDoc.exists()) {
      const userData = userDoc.data();
      userState = {
        selectedInstagramAccount: userData.selectedInstagramAccount || null,
        analyticsReady: userData.analyticsReady === true,
      };
    }

    // 2. If analyticsReady is true and username matches, try to load cached data
    if (userState?.analyticsReady && userState.selectedInstagramAccount === username) {
      const cachedDataRef = doc(db, 'users', userId, 'rawInstagramData', username);
      const cachedDataDoc = await getDoc(cachedDataRef);
      
      if (cachedDataDoc.exists()) {
        const data = cachedDataDoc.data();
        return {
          hasCachedData: true,
          cachedData: {
            profile: data.profile || null,
            fetchedAt: data.fetchedAt || '',
          },
          needsFetch: false,
          userState,
        };
      }
    }

    // 3. If analyticsReady is false or data doesn't exist, fetch is needed
    return {
      hasCachedData: false,
      cachedData: null,
      needsFetch: !userState?.analyticsReady || userState.selectedInstagramAccount !== username,
      userState,
    };
  } catch (error) {
    console.error('Error checking cached analytics:', error);
    // On error, assume we need to fetch
    return {
      hasCachedData: false,
      cachedData: null,
      needsFetch: true,
      userState: null,
    };
  }
}

/**
 * Load cached analytics data from Firestore
 * @param userId - The user's Firebase UID
 * @param username - Instagram username
 * @returns Cached analytics data or null
 */
export async function loadCachedAnalytics(
  userId: string,
  username: string
): Promise<CachedAnalyticsData | null> {
  try {
    const cachedDataRef = doc(db, 'users', userId, 'rawInstagramData', username);
    const cachedDataDoc = await getDoc(cachedDataRef);
    
    if (cachedDataDoc.exists()) {
      const data = cachedDataDoc.data();
      return {
        profile: data.profile || null,
        fetchedAt: data.fetchedAt || '',
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error loading cached analytics:', error);
    return null;
  }
}

/**
 * Load Instagram analytics data from instagramAnalytics collection
 * @param username - Instagram username
 * @returns Analytics data or null
 */
export async function loadInstagramAnalytics(
  username: string
): Promise<InstagramAnalyticsData | null> {
  try {
    // Normalize username to lowercase for consistent document lookup
    // This matches how fetchAndStoreInstagramData stores it
    const normalizedUsername = username.toLowerCase().trim();
    const analyticsDocRef = doc(db, 'instagramAnalytics', normalizedUsername);
    const analyticsDoc = await getDoc(analyticsDocRef);
    
    if (analyticsDoc.exists()) {
      const data = analyticsDoc.data();
      return {
        followers: data.followers || 0,
        engagementRate: data.engagementRate || 0,
        avgLikes: data.avgLikes || 0,
        avgComments: data.avgComments || 0,
        postingFrequency: data.postingFrequency || 0,
        topHashtags: data.topHashtags || [],
        lastUpdated: data.lastUpdated || null,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error loading Instagram analytics:', error);
    return null;
  }
}

/**
 * Check if analytics are ready and load from Firestore
 * @param userId - The user's Firebase UID
 * @param username - Instagram username
 * @returns Object with user state and analytics data (if available)
 */
export async function checkAndLoadAnalytics(
  userId: string,
  username: string
): Promise<{
  userState: UserAnalyticsState | null;
  analyticsData: InstagramAnalyticsData | null;
  needsFetch: boolean;
}> {
  try {
    // 1. Check user document for selectedInstagramAccount and analyticsReady
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    let userState: UserAnalyticsState | null = null;
    if (userDoc.exists()) {
      const userData = userDoc.data();
      userState = {
        selectedInstagramAccount: userData.selectedInstagramAccount || null,
        analyticsReady: userData.analyticsReady === true,
      };
    }
    
    // 2. Always check global instagramAnalytics cache (cross-user cache)
    const analyticsData = await loadInstagramAnalytics(username);
    if (analyticsData) {
      const normalizedUsername = username.toLowerCase().trim();
      const nextState: UserAnalyticsState = {
        selectedInstagramAccount: normalizedUsername,
        analyticsReady: true,
      };

      // Keep the user's document in sync with the cached analytics
      if (
        !userState ||
        userState.selectedInstagramAccount !== normalizedUsername ||
        !userState.analyticsReady
      ) {
        await setDoc(
          userDocRef,
          {
            selectedInstagramAccount: normalizedUsername,
            analyticsReady: true,
          },
          { merge: true }
        );
        userState = nextState;
      } else {
        userState = nextState;
      }

      // Analytics already exist globally – no need to fetch again.
      return {
        userState,
        analyticsData,
        needsFetch: false,
      };
    }

    // 3. No global analytics yet – need to fetch
    return {
      userState,
      analyticsData: null,
      needsFetch: true,
    };
  } catch (error) {
    console.error('Error checking and loading analytics:', error);
    return {
      userState: null,
      analyticsData: null,
      needsFetch: true,
    };
  }
}

/**
 * Fetch and store analytics data only if needed
 * @param userId - The user's Firebase UID
 * @param username - Instagram username
 * @returns Whether fetch was triggered
 */
export async function fetchAnalyticsIfNeeded(
  userId: string,
  username: string
): Promise<boolean> {
  try {
    const checkResult = await checkAndLoadAnalytics(userId, username);
    
    if (!checkResult.needsFetch) {
      console.log('✅ Using cached analytics data for', username);
      return false;
    }
    
    console.log('🔄 Fetching fresh analytics data for', username);
    console.log('   User ID:', userId);
    console.log('   Username:', username);
    
    try {
      await fetchAndStoreInstagramData(userId, username);
      console.log('✅ fetchAndStoreInstagramData completed successfully');
      return true;
    } catch (error: any) {
      console.error('❌ fetchAndStoreInstagramData failed:', error);
      console.error('   Error code:', error?.code);
      console.error('   Error message:', error?.message);
      throw error;
    }
  } catch (error) {
    console.error('Error fetching analytics:', error);
    throw error;
  }
}
