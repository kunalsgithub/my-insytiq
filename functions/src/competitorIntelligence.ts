import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { fetchAndStoreCompetitorData } from "./fetchAndStoreCompetitorData";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const apifyApiTokenSecret = defineSecret("APIFY_API_TOKEN");

type PlanKey = "Free" | "Trends+" | "Analytics+" | "Pro Combo";

const COMPETITOR_LIMITS: Record<PlanKey, number> = {
  Free: 0,
  // CREATOR – Growth Builder: compare up to 2 usernames
  "Trends+": 2,
  // PRO – Growth Accelerator: compare up to 5 usernames
  "Analytics+": 5,
  // ELITE – Agency: higher ceiling for agencies
  "Pro Combo": 25,
};

export const addCompetitor = onCall(
  {
    secrets: [apifyApiTokenSecret],
    timeoutSeconds: 300,
  },
  async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "You must be signed in to add competitors.");
    }

    const rawUsername = (request.data?.username as string | undefined) || "";
    const username = rawUsername.toLowerCase().trim();
    if (!username) {
      throw new HttpsError("invalid-argument", "Competitor username is required.");
    }

    // Read user's subscription to enforce plan limits
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const rawPlan = (userSnap.data()?.currentPlan as string | undefined) || "Free";

    // Normalize currentPlan to one of our internal PlanKey values.
    let currentPlan: PlanKey = "Free";
    if (rawPlan === "Free" || rawPlan === "Trends+" || rawPlan === "Analytics+" || rawPlan === "Pro Combo") {
      currentPlan = rawPlan;
    } else if (rawPlan.toLowerCase().includes("creator")) {
      currentPlan = "Trends+";
    } else if (rawPlan.toLowerCase().includes("pro") && rawPlan.toLowerCase().includes("combo")) {
      currentPlan = "Pro Combo";
    } else if (rawPlan.toLowerCase().includes("pro")) {
      // Treat unknown "PRO" labels as Analytics+ internally
      currentPlan = "Analytics+";
    }

    const limit = COMPETITOR_LIMITS[currentPlan] ?? COMPETITOR_LIMITS["Analytics+"];
    if (limit <= 0) {
      throw new HttpsError(
        "failed-precondition",
        "Upgrade your plan to track competitors."
      );
    }

    // Count existing competitors
    const competitorsSnap = await userRef.collection("competitors").get();
    const existing = competitorsSnap.docs.map((d) => d.id);

    if (existing.includes(username)) {
      // Already tracked – treat as success (idempotent) or trigger refresh.
      return { success: true, message: "Competitor is already being tracked." };
    }

    if (existing.length >= limit) {
      throw new HttpsError(
        "failed-precondition",
        "Upgrade your plan to track more competitors."
      );
    }

    const apifyApiToken = apifyApiTokenSecret.value();
    try {
      await fetchAndStoreCompetitorData(username, userId, apifyApiToken, db);
      return { success: true };
    } catch (err: any) {
      console.error("addCompetitor error:", err?.message || err);
      throw new HttpsError(
        "internal",
        err?.message || "Failed to fetch competitor data. Please try again."
      );
    }
  }
);

export const updateCompetitorAnalytics = onCall(
  {
    secrets: [apifyApiTokenSecret],
    timeoutSeconds: 540,
  },
  async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "You must be signed in to refresh competitors.");
    }

    const userRef = db.collection("users").doc(userId);
    const competitorsSnap = await userRef.collection("competitors").get();
    if (competitorsSnap.empty) {
      return { success: true, updated: 0 };
    }

    const apifyApiToken = apifyApiTokenSecret.value();
    let updated = 0;

    for (const docSnap of competitorsSnap.docs) {
      const username = docSnap.id;
      try {
        await fetchAndStoreCompetitorData(username, userId, apifyApiToken, db);
        updated++;
      } catch (err: any) {
        console.error(
          "updateCompetitorAnalytics error for",
          username,
          ":",
          err?.message || err
        );
      }
    }

    return { success: true, updated };
  }
);

