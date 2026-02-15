// Access control utility for subscription plans
export const PLAN = {
  FREE: 'Free',
  TRENDS_PLUS: 'Trends+',
  ANALYTICS_PLUS: 'Analytics+',
  PRO_COMBO: 'Pro Combo',
};

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