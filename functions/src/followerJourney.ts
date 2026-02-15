import { onCall, HttpsError } from "firebase-functions/v2/https";
import axios from "axios";

export const followerJourney = onCall(async (request) => {
  const { username } = request.data;

  // Get Apify token and actor task ID from environment variables
  const apifyToken =
    process.env.APIFY_API_TOKEN ||
    process.env.APIFY_TOKEN ||
    "";
  const actorTaskId = process.env.APIFY_ACTOR_TASK_ID || "";

  if (!apifyToken || !actorTaskId) {
    throw new HttpsError(
      "failed-precondition",
      "Apify API token and APIFY_ACTOR_TASK_ID are required. Set them in Firebase config."
    );
  }

  try {
    const runResponse = await axios.post(
      `https://api.apify.com/v2/actor-tasks/${actorTaskId}/run-sync-get-dataset-items?token=${apifyToken}`,
      { username } // You can send username or other params
    );

    const result = runResponse.data;

    // Example: Log and return the response
    console.log("Follower journey result:", result);

    return {
      success: true,
      username,
      result,
    };
  } catch (error: any) {
    console.error("Follower journey error:", error.message);

    throw new HttpsError(
      "internal",
      "Failed to fetch data from Apify.",
      error.message
    );
  }
});
