import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

/** Client-side cache to reduce API credits: same username within 30 min returns cached result */
const CACHE_TTL_MS = 30 * 60 * 1000;
const memoryCache: { key: string; data: SocialBladeAnalytics; at: number }[] = [];
const MAX_CACHE_ENTRIES = 20;

function getCached(key: string): SocialBladeAnalytics | null {
  const now = Date.now();
  const entry = memoryCache.find((e) => e.key === key);
  if (entry && now - entry.at < CACHE_TTL_MS) return entry.data;
  if (entry) memoryCache.splice(memoryCache.indexOf(entry), 1);
  return null;
}

function setCached(key: string, data: SocialBladeAnalytics) {
  const now = Date.now();
  memoryCache.push({ key, data, at: now });
  while (memoryCache.length > MAX_CACHE_ENTRIES) memoryCache.shift();
}

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
  const key = username.trim().toLowerCase();
  const cached = getCached(key);
  if (cached) return cached;

  const getAnalytics = httpsCallable<{ username: string }, SocialBladeResponse>(
    functions,
    "getSocialBladeAnalytics"
  );

  try {
    const result = await getAnalytics({ username: key });
    const response = result.data;

    if (!response.success || !response.data) {
      throw new Error("Unable to fetch analytics data. Please try again.");
    }

    setCached(key, response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error fetching Social Blade analytics:", error);

    let errorMessage = "Unable to fetch analytics data. Please try again.";

    if (error.code === "unauthenticated" || error.code === "permission-denied") {
      errorMessage = "Please sign in to fetch analytics data.";
    } else if (error.code === "not-found") {
      errorMessage = "Username not found. Please check the username and try again.";
    } else if (error.code === "internal" || error.code === "unavailable" || error.code === "failed-precondition") {
      const serverMsg = error.message && !error.message.includes("internal") ? error.message : "";
      errorMessage =
        serverMsg ||
        "Service temporarily unavailable. If this continues, check your Firebase/Google Cloud billing and that your project is in good standing.";
    } else if (error.code === "resource-exhausted") {
      errorMessage = "Social Blade rate limit or credits exhausted. Try again later or add credits at Social Blade. Reusing the same username uses cached data for 30 min.";
    } else if (error.message) {
      const msg = String(error.message).toLowerCase();
      if (msg.includes("permission") || msg.includes("auth") || msg.includes("unauthorized")) {
        errorMessage = "Please sign in to fetch analytics data.";
      } else if (msg.includes("not found") || msg.includes("404")) {
        errorMessage = "Username not found. Please check the username and try again.";
      } else if (msg.includes("rate limit") || msg.includes("too many")) {
        errorMessage = "Too many requests. Please wait a moment and try again.";
      } else if (msg.includes("network") || msg.includes("timeout") || msg.includes("cors") || msg.includes("failed to fetch")) {
        errorMessage = "Network or connection error. Check your connection and that your live domain is added in Firebase Console → Authentication → Authorized domains.";
      } else {
        errorMessage = error.message;
      }
    }

    throw new Error(errorMessage);
  }
}

