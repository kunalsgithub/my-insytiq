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
  // Free: 1 competitor = Overview only (Trending Posts blurred on frontend)
  Free: 1,
  // CREATOR – Growth Builder: compare up to 3 profiles (matches subscription page)
  "Trends+": 3,
  // PRO – Growth Accelerator: compare up to 5 usernames
  "Analytics+": 5,
  // ELITE – Agency: higher ceiling for agencies
  "Pro Combo": 25,
};

function normalizePlan(rawPlan: string): PlanKey {
  if (rawPlan === "Free" || rawPlan === "Trends+" || rawPlan === "Analytics+" || rawPlan === "Pro Combo") {
    return rawPlan;
  }
  if (rawPlan.toLowerCase().includes("creator")) return "Trends+";
  if (rawPlan.toLowerCase().includes("pro") && rawPlan.toLowerCase().includes("combo")) return "Pro Combo";
  if (rawPlan.toLowerCase().includes("pro")) return "Analytics+";
  return "Free";
}

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
    const currentPlan = normalizePlan(rawPlan);
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

/** Growth Comparison chart data – Pro (Analytics+) only. Returns empty data for other plans. */
export const getFollowerHistory = onCall(
  { timeoutSeconds: 30, cors: true },
  async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "You must be signed in to load growth data.");
    }

    const raw = request.data?.usernames;
    const usernames = Array.isArray(raw)
      ? (raw as string[]).map((u) => String(u).toLowerCase().trim()).filter(Boolean)
      : [];
    if (usernames.length === 0) {
      return { data: {} };
    }
    // Cap to avoid large queries (self + 5 competitors = 6)
    const limited = usernames.slice(0, 10);

    const userSnap = await db.collection("users").doc(userId).get();
    const rawPlan = (userSnap.data()?.currentPlan as string | undefined) || "Free";
    const currentPlan = normalizePlan(rawPlan);

    if (currentPlan !== "Analytics+") {
      return { data: {} };
    }

    const historyCol = db.collection("followerHistory");
    const since = new Date();
    since.setDate(since.getDate() - 29);
    since.setHours(0, 0, 0, 0);

    const result: Record<string, Array<{ date: string; followers: number }>> = {};
    limited.forEach((u) => {
      result[u] = [];
    });

    // Firestore 'in' supports up to 10 values
    const snap = await historyCol.where("username", "in", limited).get();
    snap.docs.forEach((docSnap) => {
      const d = docSnap.data();
      const username = (d.username as string)?.toLowerCase?.();
      if (!username || !result[username]) return;
      const ts = d.date;
      const date = ts && typeof (ts as any).toDate === "function" ? (ts as any).toDate() : new Date();
      if (date.getTime() < since.getTime()) return;
      const followers = typeof d.followers === "number" ? d.followers : 0;
      result[username].push({ date: date.toISOString(), followers });
    });

    // Sort each array by date ascending and dedupe by date
    Object.keys(result).forEach((u) => {
      result[u].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });

    return { data: result };
  }
);

