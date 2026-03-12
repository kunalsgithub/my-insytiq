import { PLAN_LIMITS, type FrontendPlanKey } from "@/config/planLimits";

type BillingCycle = "monthly" | "yearly";

export function getUserPlanLimits(user: any | null | undefined) {
  const sub = (user?.subscription || {}) as { plan?: string; billingCycle?: string };
  const planRaw =
    (sub.plan as string | undefined) ||
    (user?.currentPlan as string | undefined) ||
    (user?.planType as string | undefined) ||
    "free";

  const cycleRaw = (sub.billingCycle as string | undefined) || "monthly";
  const cycle: BillingCycle = cycleRaw.toLowerCase() === "yearly" ? "yearly" : "monthly";

  const lowerPlan = planRaw.trim().toLowerCase();

  let key: FrontendPlanKey = "free";
  if (lowerPlan.includes("pro") || lowerPlan.includes("analytics")) {
    key = cycle === "yearly" ? "pro_yearly" : "pro_monthly";
  } else if (lowerPlan.includes("creator") || lowerPlan.includes("trends")) {
    key = cycle === "yearly" ? "creator_yearly" : "creator_monthly";
  }

  const limits = PLAN_LIMITS[key] ?? PLAN_LIMITS.free;
  return { key, ...limits };
}

