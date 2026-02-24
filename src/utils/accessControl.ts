// Access control utility for subscription plans
export const PLAN = {
  FREE: 'Free',
  TRENDS_PLUS: 'Trends+',
  ANALYTICS_PLUS: 'Analytics+',
  PRO_COMBO: 'Pro Combo',
};

/** Max growth tracking / analytics days allowed per plan (e.g. "Last 30 Days" dropdown) */
export const PLAN_MAX_GROWTH_DAYS: Record<string, number> = {
  [PLAN.FREE]: 7,
  [PLAN.TRENDS_PLUS]: 30,
  [PLAN.ANALYTICS_PLUS]: 90,
  [PLAN.PRO_COMBO]: 365,
};

/** Max competitors allowed per plan */
export const PLAN_MAX_COMPETITORS: Record<string, number> = {
  [PLAN.FREE]: 0,
  [PLAN.TRENDS_PLUS]: 2,
  [PLAN.ANALYTICS_PLUS]: 5,
  [PLAN.PRO_COMBO]: 10,
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
    return `Your current plan includes up to ${maxDays}-day growth tracking. Upgrade to PRO or ELITE for up to 90 or 365 days.`;
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
    [PLAN.PRO_COMBO]: {
      trendingContentLimit: 50,
      topInfluencerLimit: 50,
      analytics: true,
    },
  };
  return accessMatrix[plan]?.[feature];
}; 