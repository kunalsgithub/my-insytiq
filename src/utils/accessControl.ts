// Access control utility for subscription plans
export const PLAN = {
  FREE: 'Free',
  TRENDS_PLUS: 'Trends+',
  ANALYTICS_PLUS: 'Analytics+',
};

/**
 * Normalize arbitrary plan labels (e.g. "Pro – Growth Accelerator", "Creator – Content Explorer")
 * into the three internal tiers used by the app and backend.
 *
 * This is important because Firestore / billing may store verbose names,
 * while limits logic (growth days, competitors, profile analyses) is keyed
 * on these canonical plan IDs.
 */
export function normalizePlan(plan: string | null | undefined): string {
  if (!plan) return PLAN.FREE;
  const raw = plan.trim().toLowerCase();

  // Exact matches
  if (raw === PLAN.FREE.toLowerCase()) return PLAN.FREE;
  if (raw === PLAN.TRENDS_PLUS.toLowerCase()) return PLAN.TRENDS_PLUS;
  if (raw === PLAN.ANALYTICS_PLUS.toLowerCase()) return PLAN.ANALYTICS_PLUS;

  // Creator / Trends-style plans → Trends+
  if (raw.includes('creator') || raw.includes('trends+')) {
    return PLAN.TRENDS_PLUS;
  }

  // Pro / Analytics-style plans → Analytics+
  if (raw.includes('pro') || raw.includes('analytics')) {
    return PLAN.ANALYTICS_PLUS;
  }

  // Fallback
  return PLAN.FREE;
}

/** Max growth tracking / analytics days allowed per plan (e.g. "Last 30 Days" dropdown) */
export const PLAN_MAX_GROWTH_DAYS: Record<string, number> = {
  [PLAN.FREE]: 7,
  [PLAN.TRENDS_PLUS]: 30,
  [PLAN.ANALYTICS_PLUS]: 90,
};

/** Max competitors allowed per plan (Free: 1 = Overview only; paid: full comparison) */
export const PLAN_MAX_COMPETITORS: Record<string, number> = {
  [PLAN.FREE]: 1,
  [PLAN.TRENDS_PLUS]: 3,
  [PLAN.ANALYTICS_PLUS]: 5,
};

/** Profile analyses per month (must match backend PROFILE_ANALYSES_LIMIT) */
export const PLAN_PROFILE_ANALYSES_LIMIT: Record<string, number> = {
  [PLAN.FREE]: 1,
  [PLAN.TRENDS_PLUS]: 6,
  [PLAN.ANALYTICS_PLUS]: 15,
};

export function getMaxGrowthTrackingDays(plan: string | null): number {
  const key = normalizePlan(plan);
  return PLAN_MAX_GROWTH_DAYS[key] ?? PLAN_MAX_GROWTH_DAYS[PLAN.FREE];
}

export function getMaxCompetitors(plan: string | null): number {
  const key = normalizePlan(plan);
  return PLAN_MAX_COMPETITORS[key] ?? PLAN_MAX_COMPETITORS[PLAN.FREE];
}

/** Returns upgrade message when a feature is not allowed for the plan */
export function getUpgradeMessageForFeature(
  feature: 'growth_days' | 'competitors',
  requestedValue: number,
  plan: string | null
): string | null {
  const maxDays = getMaxGrowthTrackingDays(plan);
  const maxCompetitors = getMaxCompetitors(plan);
  if (feature === 'growth_days' && requestedValue > maxDays) {
    return `Your current plan includes up to ${maxDays}-day growth tracking. Upgrade to PRO – Growth Accelerator for longer history.`;
  }
  if (feature === 'competitors' && requestedValue > maxCompetitors) {
    return `Your current plan allows up to ${maxCompetitors} competitor(s). Upgrade to add more.`;
  }
  return null;
}

export const hasAccess = (feature: string, plan: string) => {
  const key = normalizePlan(plan);
  const accessMatrix = {
    [PLAN.FREE]: {
      trendingContentLimit: 5,
      topInfluencerLimit: 10,
      analytics: false,
    },
    [PLAN.TRENDS_PLUS]: {
      trendingContentLimit: 20,
      topInfluencerLimit: 20,
      analytics: false,
    },
    [PLAN.ANALYTICS_PLUS]: {
      trendingContentLimit: 0,
      topInfluencerLimit: 0,
      analytics: true,
    },
  };
  return accessMatrix[key]?.[feature];
}; 