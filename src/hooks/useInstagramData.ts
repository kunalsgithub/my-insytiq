import { useState, useCallback } from 'react';
import { getSocialBladeAnalytics } from '../api/getSocialBladeAnalytics';

interface InstagramData {
  profile: {
    username: string;
    profile_picture_url?: string;
    media_count: number;
    followers_count: number;
    follows_count: number;
  };
  insights: {
    followers: {
      growth: Array<{ date: string; count: number }>;
    };
    engagement: {
      likes: number;
      comments: number;
      rate: number;
    };
    dailyMetrics: Array<{ date: string; likes: number; comments: number }>;
  };
  dataSource: string;
  currentFollowerCount: number;
  followerProjections: Array<{ date: string; count: number }>;
}

const defaultData: InstagramData = {
  profile: {
    username: '',
    media_count: 0,
    followers_count: 0,
    follows_count: 0,
  },
  insights: {
    followers: {
      growth: [],
    },
    engagement: {
      likes: 0,
      comments: 0,
      rate: 0,
    },
    dailyMetrics: [],
  },
  dataSource: 'socialblade',
  currentFollowerCount: 0,
  followerProjections: [],
};

export function useInstagramData() {
  const [data, setData] = useState<InstagramData & { username: string; loading: boolean; error: string | null }>({
    ...defaultData,
    username: '',
    loading: false,
    error: null,
  });

  // Allow setting data directly from Firestore (for cached data)
  // This ensures data persists when component remounts after tab switch
  const setDataFromFirestore = useCallback((username: string, firestoreData: {
    followers: number;
    engagementRate: number;
    avgLikes: number;
    avgComments: number;
    profilePictureUrl?: string;
    mediaCount?: number;
    following?: number; // Optional: from Social Blade if available
  }) => {
    setData({
      ...defaultData, // Start with default structure
      username,
      loading: false,
      error: null,
      profile: {
        username,
        profile_picture_url: firestoreData.profilePictureUrl,
        media_count: firestoreData.mediaCount || 0,
        followers_count: firestoreData.followers,
        follows_count: firestoreData.following || 0,
      },
      insights: {
        followers: {
          growth: [], // Can be populated later if needed
        },
        engagement: {
          likes: firestoreData.avgLikes,
          comments: firestoreData.avgComments,
          rate: firestoreData.engagementRate,
        },
        dailyMetrics: [],
      },
      currentFollowerCount: firestoreData.followers,
      followerProjections: [],
      dataSource: 'apify',
    });
  }, []);

  const analyzeUsername = useCallback(async (username: string) => {
    if (!username || username === 'demo_user') {
      // Don't fetch for demo user
      setData((prev) => ({ ...prev, loading: false, error: 'Please enter a valid Instagram username', username }));
      return;
    }

    setData((prev) => ({ ...prev, loading: true, error: null, username }));

    try {
      console.log(`Fetching Social Blade data for: ${username}`);
      const sbData = await getSocialBladeAnalytics(username);
      console.log('Social Blade data received:', sbData);
      console.log('Projections from API:', sbData.projections);

      // Transform Social Blade data to match our UI structure
      const transformedData: InstagramData = {
        profile: {
          username: username,
          profile_picture_url: sbData.profilePictureUrl || undefined,
          media_count: sbData.media || 0,
          followers_count: sbData.followers || 0,
          follows_count: sbData.following || 0,
        },
        insights: {
          followers: {
            growth: sbData.dailyHistory.map((item) => ({
              date: item.date,
              count: item.followers,
            })),
          },
          engagement: {
            likes: sbData.averageLikes || 0,
            comments: sbData.averageComments || 0,
            rate: sbData.engagementRate || 0,
          },
          dailyMetrics: [], // Social Blade doesn't provide daily likes/comments history
        },
        dataSource: 'socialblade',
        currentFollowerCount: sbData.followers || 0,
        followerProjections: (sbData.projections || []).map((item) => ({
          date: item.date,
          count: item.followers || 0,
        })),
      };

      setData({
        ...transformedData,
        username,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      console.error('Error fetching Social Blade data:', error);
      // Provide user-friendly error messages
      let errorMessage = 'Unable to fetch analytics data. Please try again.';
      
      if (error.message) {
        const msg = error.message.toLowerCase();
        if (msg.includes('permission') || msg.includes('auth') || msg.includes('unauthorized')) {
          errorMessage = 'Please login to fetch analytics data';
        } else if (msg.includes('not found') || msg.includes('404')) {
          errorMessage = 'Username not found. Please check the username and try again.';
        } else if (msg.includes('rate limit') || msg.includes('too many')) {
          errorMessage = 'Too many requests. Please wait a moment and try again.';
        } else if (msg.includes('network') || msg.includes('timeout')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        }
      }
      
      setData((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, []);

  return [data, analyzeUsername, setDataFromFirestore] as const;
} 