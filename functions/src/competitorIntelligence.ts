import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { fetchAndStoreCompetitorData } from "./fetchAndStoreCompetitorData";
import { apifyApiTokenParam } from "./configParams";
import axios from "axios";
import { resolveSocialBladeCredentials } from "./socialBladeCredentials";
import { sbApiTokenParam, sbClientIdParam } from "./configParams";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

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

/** Plans that unlock Growth Comparison (must match frontend isProPlan). */
function hasGrowthComparisonAccess(plan: PlanKey): boolean {
  return plan === "Analytics+" || plan === "Pro Combo";
}

export const addCompetitor = onCall(
  {
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
    const userData = userSnap.data() || {};
    const rawPlan = (userData.currentPlan as string | undefined) || "Free";
    const currentPlan = normalizePlan(rawPlan);

    // Base competitor limit from plan tier
    let limit = COMPETITOR_LIMITS[currentPlan] ?? COMPETITOR_LIMITS["Analytics+"];

    // Yearly subscription bonus: allow more competitors for Creator / Pro yearly users.
    const sub = (userData.subscription || {}) as { plan?: string; billingCycle?: string };
    const billingCycle = (sub.billingCycle || "").toLowerCase();
    const isYearly = billingCycle === "yearly";
    if (isYearly) {
      if (currentPlan === "Trends+") {
        // Creator yearly: up to 5 competitors
        limit = 5;
      } else if (currentPlan === "Analytics+") {
        // Pro yearly: up to 8 competitors
        limit = 8;
      }
    }
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

    const apifyApiToken = apifyApiTokenParam.value();
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

    const apifyApiToken = apifyApiTokenParam.value();
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
  { timeoutSeconds: 120, cors: true },
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

    if (!hasGrowthComparisonAccess(currentPlan)) {
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

    type HistoryPoint = { date: string; followers: number };

    const dedupeByDay = (points: HistoryPoint[]): HistoryPoint[] => {
      const byDay = new Map<string, HistoryPoint>();
      points.forEach((p) => {
        const day = new Date(p.date).toISOString().slice(0, 10);
        byDay.set(day, { date: new Date(day).toISOString(), followers: p.followers });
      });
      return [...byDay.values()].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    };

    Object.keys(result).forEach((u) => {
      result[u] = dedupeByDay(result[u] || []);
    });

    const MIN_USEFUL_POINTS = 7;

    const hasFlatOrSparseHistory = (points: HistoryPoint[]): boolean => {
      if (points.length < MIN_USEFUL_POINTS) return true;
      const uniqueFollowers = new Set(points.map((p) => p.followers));
      return uniqueFollowers.size <= 1;
    };

    const toLast30DaySeries = (sbDaily: HistoryPoint[], sinceDate: Date): HistoryPoint[] => {
      const normalized = sbDaily
        .map((p) => {
          const dt = new Date(p.date);
          if (Number.isNaN(dt.getTime())) return null;
          return { date: dt.toISOString(), followers: p.followers };
        })
        .filter(Boolean) as HistoryPoint[];

      const sorted = dedupeByDay(normalized);
      const inWindow = sorted.filter((p) => new Date(p.date).getTime() >= sinceDate.getTime());
      if (inWindow.length >= 2) return inWindow;
      // Fallback: last ~30 data points when date window is empty (timezone / sparse API)
      if (sorted.length >= 2) return sorted.slice(-31);
      return [];
    };

    const { clientId, apiToken } = resolveSocialBladeCredentials(
      sbClientIdParam.value(),
      sbApiTokenParam.value()
    );
    const canUseSb = Boolean(clientId && apiToken);

    const loadFromCacheOrApi = async (username: string): Promise<HistoryPoint[] | null> => {
        const cacheKey = `socialblade_${username}`;
        const cacheDoc = await db.collection("socialblade_cache").doc(cacheKey).get();
        const cached = cacheDoc.exists ? (cacheDoc.data() as any) : null;
        const cachedDaily = cached?.data?.dailyHistory;
        if (Array.isArray(cachedDaily) && cachedDaily.length > 0) {
          return cachedDaily
            .filter((d: any) => d && d.date && typeof d.followers === "number")
            .map((d: any) => ({ date: String(d.date), followers: Number(d.followers) || 0 }));
        }
        if (!canUseSb) return null;

        const url = `https://matrix.sbapis.com/b/instagram/statistics?query=${encodeURIComponent(username)}`;
        const headers: Record<string, string> = {
          clientid: clientId,
          token: apiToken,
          "Content-Type": "application/json",
        };

        const resp = await axios.get(url, {
          headers,
          timeout: 20000,
          validateStatus: (s) => s < 600,
        });
        if (resp.status >= 400 || !resp.data?.status?.success) return null;

        const apiData: any = resp.data;
        const daily: any[] = Array.isArray(apiData?.data?.daily) ? apiData.data.daily : [];
        if (!daily.length) return null;

        const mapped = daily
          .filter((d) => d && d.date && typeof d.followers === "number")
          .map((d) => ({ date: String(d.date), followers: Number(d.followers) || 0 }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Cache for future requests (same shape as getSocialBladeAnalytics)
        try {
          const stats = apiData?.data?.statistics?.total || {};
          await db.collection("socialblade_cache").doc(cacheKey).set(
            {
              data: {
                followers: stats.followers || mapped[mapped.length - 1]?.followers || 0,
                dailyHistory: mapped.map((p) => ({ date: p.date, followers: p.followers })),
              },
              cachedAt: new Date(),
              username,
            },
            { merge: true }
          );
        } catch {
          // Non-fatal if cache write fails
        }

        return mapped;
    };

    // Enrich every username from Social Blade when Firestore history is sparse.
    await Promise.all(
      limited.map(async (username) => {
        try {
          const firestoreSeries = result[username] || [];
          if (firestoreSeries.length >= 14 && !hasFlatOrSparseHistory(firestoreSeries)) {
            return;
          }

          const sbDaily = await loadFromCacheOrApi(username);
          if (!sbDaily || sbDaily.length === 0) return;

          const sbSeries = toLast30DaySeries(sbDaily, since);
          if (sbSeries.length < 2) return;

          if (
            sbSeries.length > firestoreSeries.length ||
            hasFlatOrSparseHistory(firestoreSeries)
          ) {
            result[username] = sbSeries;
          }
        } catch (e) {
          console.warn("[getFollowerHistory] SB backfill failed for", username, e);
        }
      })
    );

    return { data: result };
  }
);

