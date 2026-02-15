// src/api/fetchAndStoreInstagramData.ts
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

/** Client timeout for long fetches (9 min) - Cloud Function has 540s */
const LONG_FETCH_TIMEOUT_MS = 540_000;

/**
 * Calls the Firebase Cloud Function "fetchAndStoreInstagramData"
 * @param userId - the unique user ID (for caching/tracking)
 * @param username - Instagram username to fetch data for
 * @param resultsLimit - optional number of posts to fetch (default 30, max 200)
 * @param onlyPostsNewerThan - optional e.g. "30 days", "90 days" for time-based limit
 * @returns Cloud Function response data
 */
export async function fetchAndStoreInstagramData(
  userId: string,
  username: string,
  resultsLimit?: number,
  onlyPostsNewerThan?: string
) {
  try {
    const payload: Record<string, unknown> = { userId, username };
    if (resultsLimit != null && resultsLimit > 0) {
      payload.resultsLimit = Math.min(200, Math.round(resultsLimit));
    }
    if (onlyPostsNewerThan != null && String(onlyPostsNewerThan).trim()) {
      payload.onlyPostsNewerThan = String(onlyPostsNewerThan).trim();
    }
    console.log("🔄 Calling fetchAndStoreInstagramData with:", payload);
    const callable = httpsCallable(functions, "fetchAndStoreInstagramData", {
      timeout: LONG_FETCH_TIMEOUT_MS,
    });

    const response: any = await callable(payload);

    console.log("✅ fetchAndStoreInstagramData Response:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("❌ Error calling fetchAndStoreInstagramData:", error);
    console.error("   Error details:", {
      code: error?.code,
      message: error?.message,
      name: error?.name,
      stack: error?.stack?.substring(0, 200)
    });
    throw error;
  }
}
