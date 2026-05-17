/**
 * Central plan config — single source of truth for ALL feature limits.
 * Backend only; frontend must never enforce limits.
 */

export type PlanKey = "free" | "creator" | "pro";

/**
 * Base limits per logical plan tier. These are adjusted at runtime for
 * yearly subscribers via computeEffectivePlanLimits.
 */
export const PLAN_LIMITS: Record<
  PlanKey,
  {
    profileAnalysis: number;
    brandCollabScore: { lifetime: number; monthly: number };
    smartChat: number;
  }
> = {
  free: {
    profileAnalysis: 1,
    // Free: 1 lifetime Brand Collab demo (no monthly reset)
    brandCollabScore: { lifetime: 1, monthly: 0 },
    smartChat: 150,
  },
  creator: {
    profileAnalysis: 6,
    // Creator: no Brand Collab access
    brandCollabScore: { lifetime: 0, monthly: 0 },
    smartChat: 600,
  },
  pro: {
    profileAnalysis: 15,
    // Pro: 15 Brand Collab scores per month
    brandCollabScore: { lifetime: 0, monthly: 15 },
    smartChat: 1200,
  },
};

/** Display plan (Firestore currentPlan) to internal plan key */
export function normalizePlanKey(raw: string | null | undefined): PlanKey {
  const s = (raw && typeof raw === "string" ? raw.trim() : "") || "Free";
  if (s === "Free" || s.toLowerCase() === "free") return "free";
  if (s === "Trends+" || s === "Creator" || s.toLowerCase() === "creator") return "creator";
  if (s === "Analytics+" || s === "Pro" || s.toLowerCase() === "pro") return "pro";
  return "free";
}

/**
 * Compute effective limits for a user based on their plan tier AND billing cycle.
 *
 * - Creator monthly: 6 analyses / 600 SmartChat (base creator limits)
 * - Creator yearly:  8 analyses / 900 SmartChat
 * - Pro monthly:    15 analyses / 1200 SmartChat (base pro limits)
 * - Pro yearly:     20 analyses / 1500 SmartChat
 *
 * Free is unaffected by billing cycle.
 */
export function computeEffectivePlanLimits(
  planKey: PlanKey,
  userData?: FirebaseFirestore.DocumentData | undefined
): (typeof PLAN_LIMITS)[PlanKey] {
  const base = PLAN_LIMITS[planKey];

  // Free users always use base limits.
  if (planKey === "free") return base;

  const sub = (userData?.subscription || {}) as { plan?: string; billingCycle?: string };
  const cycle = (sub.billingCycle || "monthly").toLowerCase() === "yearly" ? "yearly" : "monthly";

  if (planKey === "creator") {
    if (cycle === "yearly") {
      return {
        ...base,
        profileAnalysis: 8,
        smartChat: 900,
      };
    }
    return base;
  }

  if (planKey === "pro") {
    if (cycle === "yearly") {
      return {
        ...base,
        profileAnalysis: 20,
        smartChat: 1500,
      };
    }
    return base;
  }

  return base;
}

export function firstDayOfNextMonthISO(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export interface FeatureUsage {
  monthlyUsed: number;
  monthlyLimit: number;
  resetDate: string;
}

export interface BrandCollabUsage extends FeatureUsage {
  lifetimeUsed: number;
}

export interface UserUsage {
  profileAnalysis: FeatureUsage;
  brandCollabScore: BrandCollabUsage;
  smartChat: FeatureUsage;
}

/** Default usage object — never allow usage to be undefined. */
export function getDefaultUsage(): UserUsage {
  const resetDate = firstDayOfNextMonthISO();
  return {
    profileAnalysis: {
      monthlyUsed: 0,
      monthlyLimit: PLAN_LIMITS.free.profileAnalysis,
      resetDate,
    },
    brandCollabScore: {
      lifetimeUsed: 0,
      monthlyUsed: 0,
      monthlyLimit: 0,
      resetDate,
    },
    smartChat: {
      monthlyUsed: 0,
      monthlyLimit: PLAN_LIMITS.free.smartChat,
      resetDate,
    },
  };
}
