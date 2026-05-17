/**
 * Global usage validator — server-side only.
 * Call before executing any feature logic. Never trust frontend.
 */

import type { Firestore } from "firebase-admin/firestore";
import {
  PLAN_LIMITS,
  normalizePlanKey,
  computeEffectivePlanLimits,
  firstDayOfNextMonthISO,
  type PlanKey,
  type UserUsage,
  type FeatureUsage,
  type BrandCollabUsage,
} from "./planLimits";

export const LIMIT_REACHED_CODE = "LIMIT_REACHED";

export type FeatureName = "profileAnalysis" | "brandCollabScore" | "smartChat";

/** Ensure user doc has usage; initialize if missing (auto-fix). */
export async function ensureUserUsage(
  db: Firestore,
  userId: string
): Promise<{ usage: UserUsage; planKey: PlanKey; limits: (typeof PLAN_LIMITS)[PlanKey] }> {
  const userRef = db.collection("users").doc(userId);
  const snap = await userRef.get();
  const data = snap.exists ? snap.data() : undefined;
  const planKey = normalizePlanKey((data?.planType ?? data?.currentPlan) as string | undefined);
  const limits = computeEffectivePlanLimits(planKey, data);
  const resetDate = firstDayOfNextMonthISO();

  let usage = data?.usage as UserUsage | undefined;
  if (!usage || typeof usage !== "object") {
    const initial: UserUsage = {
      profileAnalysis: { monthlyUsed: 0, monthlyLimit: limits.profileAnalysis, resetDate },
      brandCollabScore: {
        lifetimeUsed: 0,
        monthlyUsed: 0,
        monthlyLimit: limits.brandCollabScore.monthly,
        resetDate,
      },
      smartChat: { monthlyUsed: 0, monthlyLimit: limits.smartChat, resetDate },
    };
    await userRef.set({ planType: planKey, usage: initial }, { merge: true });
    return { usage: initial, planKey, limits };
  }

  // Normalize shape and reset monthly if needed
  const now = new Date();
  const profileAnalysis = normalizeFeatureUsage(usage.profileAnalysis, limits.profileAnalysis, resetDate, now);
  const brandCollabScore = normalizeBrandCollabUsage(
    usage.brandCollabScore,
    limits.brandCollabScore,
    resetDate,
    now
  );
  const smartChat = normalizeFeatureUsage(usage.smartChat, limits.smartChat, resetDate, now);

  const normalized: UserUsage = {
    profileAnalysis,
    brandCollabScore,
    smartChat,
  };

  return { usage: normalized, planKey, limits };
}

function normalizeFeatureUsage(
  raw: unknown,
  limit: number,
  resetDate: string,
  now: Date
): FeatureUsage {
  const u = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  let monthlyUsed = typeof u.monthlyUsed === "number" ? u.monthlyUsed : 0;
  const existingReset = typeof u.resetDate === "string" ? u.resetDate : null;
  if (existingReset && now > new Date(existingReset)) {
    monthlyUsed = 0;
  }
  return {
    monthlyUsed,
    monthlyLimit: limit,
    resetDate,
  };
}

function normalizeBrandCollabUsage(
  raw: unknown,
  limits: { lifetime: number; monthly: number },
  resetDate: string,
  now: Date
): BrandCollabUsage {
  const u = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  let monthlyUsed = typeof u.monthlyUsed === "number" ? u.monthlyUsed : 0;
  const lifetimeUsed = typeof u.lifetimeUsed === "number" ? u.lifetimeUsed : 0;
  const existingReset = typeof u.resetDate === "string" ? u.resetDate : null;
  if (existingReset && now > new Date(existingReset)) {
    monthlyUsed = 0;
  }
  return {
    lifetimeUsed,
    monthlyUsed,
    monthlyLimit: limits.monthly,
    resetDate,
  };
}

/**
 * Check limit and increment usage for the feature. Call before executing feature logic.
 * Throws if limit reached. Saves updated usage on success.
 */
export async function checkAndIncrementUsage(
  db: Firestore,
  userId: string,
  featureName: FeatureName
): Promise<void> {
  const userRef = db.collection("users").doc(userId);
  const { usage, limits } = await ensureUserUsage(db, userId);
  const now = new Date();
  const resetDate = firstDayOfNextMonthISO();

  if (featureName === "profileAnalysis") {
    const fu = usage.profileAnalysis;
    const limit = limits.profileAnalysis;
    if (fu.resetDate && now > new Date(fu.resetDate)) {
      fu.monthlyUsed = 0;
      fu.resetDate = resetDate;
    }
    if (fu.monthlyUsed >= limit) {
      throw new Error(LIMIT_REACHED_CODE);
    }
    fu.monthlyUsed += 1;
    fu.monthlyLimit = limit;
    fu.resetDate = fu.resetDate || resetDate;
    await userRef.set(
      {
        usage: { ...usage, profileAnalysis: fu },
      },
      { merge: true }
    );
    return;
  }

  if (featureName === "brandCollabScore") {
    // For brandCollabScore we expose separate check + increment helpers.
    // This legacy entry point now just composes them for existing callers.
    await checkBrandCollabLimit(db, userId);
    await incrementBrandCollabUsage(db, userId);
    return;
  }

  if (featureName === "smartChat") {
    const fu = usage.smartChat;
    const limit = limits.smartChat;
    if (fu.resetDate && now > new Date(fu.resetDate)) {
      fu.monthlyUsed = 0;
      fu.resetDate = resetDate;
    }
    if (fu.monthlyUsed >= limit) {
      throw new Error(LIMIT_REACHED_CODE);
    }
    fu.monthlyUsed += 1;
    fu.monthlyLimit = limit;
    fu.resetDate = fu.resetDate || resetDate;
    await userRef.set({ usage: { ...usage, smartChat: fu } }, { merge: true });
    return;
  }

  throw new Error(`Unknown feature: ${featureName}`);
}

/**
 * Brand Collab helpers: allow \"check then increment\" flows so we only
 * consume usage after a successful calculation.
 */
export async function checkBrandCollabLimit(db: Firestore, userId: string): Promise<void> {
  const userRef = db.collection("users").doc(userId);
  const { usage, planKey, limits } = await ensureUserUsage(db, userId);
  const now = new Date();
  const resetDate = firstDayOfNextMonthISO();

  const bu = usage.brandCollabScore;
  const { lifetime, monthly } = limits.brandCollabScore;

  if (planKey === "creator") {
    throw new Error(LIMIT_REACHED_CODE);
  }

  // Reset monthly window if expired
  if (bu.resetDate && now > new Date(bu.resetDate)) {
    bu.monthlyUsed = 0;
    bu.resetDate = resetDate;
  }

  if (planKey === "free") {
    if (bu.lifetimeUsed >= lifetime) {
      throw new Error(LIMIT_REACHED_CODE);
    }
  } else {
    if (monthly > 0 && bu.monthlyUsed >= monthly) {
      throw new Error(LIMIT_REACHED_CODE);
    }
  }

  // Persist any reset changes but do not increment yet.
  await userRef.set({ usage: { ...usage, brandCollabScore: bu } }, { merge: true });
}

export async function incrementBrandCollabUsage(db: Firestore, userId: string): Promise<void> {
  const userRef = db.collection("users").doc(userId);
  const { usage, planKey, limits } = await ensureUserUsage(db, userId);
  const resetDate = firstDayOfNextMonthISO();

  const bu = usage.brandCollabScore;
  const { lifetime, monthly } = limits.brandCollabScore;

  if (planKey === "creator") {
    // Should not happen after a successful check, but guard defensively.
    throw new Error(LIMIT_REACHED_CODE);
  }

  if (planKey === "free") {
    // Lifetime quota only
    if (bu.lifetimeUsed >= lifetime) {
      throw new Error(LIMIT_REACHED_CODE);
    }
    bu.lifetimeUsed += 1;
    bu.monthlyLimit = 0;
  } else {
    // Monthly quota for paid plans
    if (monthly > 0 && bu.monthlyUsed >= monthly) {
      throw new Error(LIMIT_REACHED_CODE);
    }
    bu.monthlyUsed += 1;
    bu.monthlyLimit = monthly;
  }

  bu.resetDate = bu.resetDate || resetDate;
  await userRef.set({ usage: { ...usage, brandCollabScore: bu } }, { merge: true });
}

/** Standard response when limit is reached (for callable/HTTP). */
export function limitReachedResponse(message?: string) {
  return {
    success: false as const,
    code: LIMIT_REACHED_CODE,
    message: message || "You've reached your limit for this feature.",
    upgradeRequired: true,
  };
}
