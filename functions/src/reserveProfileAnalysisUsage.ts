import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { checkAndIncrementUsage, LIMIT_REACHED_CODE } from "./usageEnforcement";
import { normalizePlanKey, type PlanKey } from "./planLimits";

if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

// Cooldown configuration in milliseconds
const PROFILE_ANALYSIS_COOLDOWN: Record<PlanKey, number> = {
  free: 10 * 60 * 1000, // 10 minutes
  creator: 5 * 60 * 1000, // 5 minutes
  pro: 2 * 60 * 1000, // 2 minutes
};

/**
 * Lightweight callable to reserve ONE profile analysis usage.
 * Must be called for every profile analysis attempt, regardless of cache.
 */
export const reserveProfileAnalysisUsage = onCall(
  {
    timeoutSeconds: 10,
  },
  async (req) => {
    const authUid = req.auth?.uid;
    if (!authUid) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to analyze Instagram accounts."
      );
    }

    const { userId } = (req.data || {}) as { userId?: string };
    const effectiveUserId =
      typeof userId === "string" && userId ? userId : authUid;
    if (effectiveUserId !== authUid) {
      throw new HttpsError(
        "permission-denied",
        "User ID does not match authenticated user."
      );
    }

    try {
      // Enforce cooldown based on plan and last analysis timestamp
      const userRef = db.collection("users").doc(effectiveUserId);
      const snap = await userRef.get();
      const data = snap.exists ? snap.data() : undefined;

      const planKey = normalizePlanKey(
        (data?.planType ?? data?.currentPlan) as string | undefined
      );
      const cooldown = PROFILE_ANALYSIS_COOLDOWN[planKey] ?? PROFILE_ANALYSIS_COOLDOWN.free;

      const now = Date.now();
      const lastTs = data?.lastProfileAnalysisAt as Timestamp | undefined;
      if (lastTs) {
        const lastMillis = lastTs.toMillis();
        const diff = now - lastMillis;
        if (diff < cooldown) {
          const remainingMinutes = Math.ceil((cooldown - diff) / 60000);
          throw new HttpsError(
            "resource-exhausted",
            `Please wait ${remainingMinutes} minutes before analyzing another profile.`,
            { cooldown: true, remainingMinutes }
          );
        }
      }

      // Update timestamp immediately so cooldown starts at request time
      await userRef.set(
        {
          lastProfileAnalysisAt: Timestamp.now(),
          planType: planKey,
        },
        { merge: true }
      );

      await checkAndIncrementUsage(db, effectiveUserId, "profileAnalysis");
      return {
        success: true,
      };
    } catch (err: any) {
      if (err?.message === LIMIT_REACHED_CODE) {
        throw new HttpsError(
          "resource-exhausted",
          "You've reached your limit for this feature.",
          { code: LIMIT_REACHED_CODE, upgradeRequired: true }
        );
      }
      throw err;
    }
  }
);

