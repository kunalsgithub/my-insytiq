export type FrontendPlanKey = "free" | "creator_monthly" | "creator_yearly" | "pro_monthly" | "pro_yearly";

export const PLAN_LIMITS: Record<
  FrontendPlanKey,
  {
    profileAnalyses: number;
    smartChatQueries: number;
  }
> = {
  free: {
    profileAnalyses: 1,
    smartChatQueries: 5,
  },
  creator_monthly: {
    profileAnalyses: 6,
    smartChatQueries: 600,
  },
  creator_yearly: {
    profileAnalyses: 8,
    smartChatQueries: 900,
  },
  pro_monthly: {
    profileAnalyses: 15,
    smartChatQueries: 1200,
  },
  pro_yearly: {
    profileAnalyses: 20,
    smartChatQueries: 1500,
  },
};

