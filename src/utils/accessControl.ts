// Access control utility for subscription plans
export const PLAN = {
  FREE: 'Free',
  TRENDS_PLUS: 'Trends+',
  ANALYTICS_PLUS: 'Analytics+',
};

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
  [PLAN.FREE]: 2,
  [PLAN.TRENDS_PLUS]: 12,
  [PLAN.ANALYTICS_PLUS]: 50,
};

export function getMaxGrowthTrackingDays(plan: string | null): number {
  if (!plan) return PLAN_MAX_GROWTH_DAYS[PLAN.FREE];
  const normalized = plan.trim();
  return PLAN_MAX_GROWTH_DAYS[normalized] ?? PLAN_MAX_GROWTH_DAYS[PLAN.FREE];
}

export function getMaxCompetitors(plan: string | null): number {
  if (!plan) return PLAN_MAX_COMPETITORS[PLAN.FREE];
  const normalized = plan.trim();
  return PLAN_MAX_COMPETITORS[normalized] ?? PLAN_MAX_COMPETITORS[PLAN.FREE];
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
  return accessMatrix[plan]?.[feature];
}; 