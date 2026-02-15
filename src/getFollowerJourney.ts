import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase"; // same folder

// Initialize Cloud Functions
const functions = getFunctions(app);

/**
 * Fetches Follower Journey data for a given Instagram username
 * by calling the deployed Firebase Cloud Function.
 */
export async function getFollowerJourneyData(username: string) {
  try {
    // Reference your deployed cloud function name exactly as in your backend
    const getFollowerJourney = httpsCallable(functions, "getFollowerJourney");

    // Call the function with username
    const response = await getFollowerJourney({ username });

    console.log("✅ Follower Journey Data:", response.data);

    // Return the result to your frontend components
    return response.data;
  } catch (error: any) {
    console.error("❌ Error fetching follower journey:", error.message || error);
    throw error;
  }
}
