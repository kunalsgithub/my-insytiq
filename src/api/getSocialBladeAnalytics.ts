import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

export interface SocialBladeAnalytics {
  followers: number;
  following: number;
  media: number;
  averageLikes: number;
  averageComments: number;
  engagementRate: number;
  dailyHistory: Array<{ date: string; followers: number }>;
  projections: Array<{ date: string; followers: number }>;
  profilePictureUrl?: string | null;
}

export interface SocialBladeResponse {
  success: boolean;
  data: SocialBladeAnalytics;
  cached?: boolean;
  warning?: string;
}

export async function getSocialBladeAnalytics(
  username: string
): Promise<SocialBladeAnalytics> {
  const getAnalytics = httpsCallable<{ username: string }, SocialBladeResponse>(
    functions,
    "getSocialBladeAnalytics"
  );

  try {
    const result = await getAnalytics({ username });
    const response = result.data;

    if (!response.success || !response.data) {
      throw new Error("Unable to fetch analytics data. Please try again.");
    }

    return response.data;
  } catch (error: any) {
    console.error("Error fetching Social Blade analytics:", error);
    
    // Provide user-friendly error messages based on error type
    let errorMessage = "Unable to fetch analytics data. Please try again.";
    
    if (error.code === 'unauthenticated' || error.code === 'permission-denied') {
      errorMessage = "Please login to fetch analytics data";
    } else if (error.message) {
      const msg = error.message.toLowerCase();
      if (msg.includes('permission') || msg.includes('auth') || msg.includes('unauthorized')) {
        errorMessage = "Please login to fetch analytics data";
      } else if (msg.includes('not found') || msg.includes('404')) {
        errorMessage = "Username not found. Please check the username and try again.";
      } else if (msg.includes('rate limit') || msg.includes('too many')) {
        errorMessage = "Too many requests. Please wait a moment and try again.";
      } else if (msg.includes('network') || msg.includes('timeout')) {
        errorMessage = "Network error. Please check your connection and try again.";
      } else {
        errorMessage = error.message;
      }
    }
    
    throw new Error(errorMessage);
  }
}

