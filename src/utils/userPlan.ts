// Helpers to normalize user plans across Firestore, billing, and UI.
// We only care about three external labels for UX:
// - "free"
// - "creator"
// - "pro"
//
// Internally, accessControl.ts uses PLAN keys:
// - Free
// - Trends+
// - Analytics+

import { PLAN } from "./accessControl";

type NormalizedPlan = "free" | "creator" | "pro";

/** Derive a simple, lowercased plan label from a user doc. */
export function getUserPlan(user: any | null | undefined): NormalizedPlan {
  const raw =
    (user?.currentPlan as string | undefined) ||
    (user?.planType as string | undefined) ||
    "free";

  const lower = raw.trim().toLowerCase();

  if (lower.includes("pro") || lower.includes("analytics")) return "pro";
  if (lower.includes("creator") || lower.includes("trends")) return "creator";

  return "free";
}

/** Map the user doc to the internal PLAN key used by accessControl / hasAccess. */
export function getUserPlanKey(user: any | null | undefined): string {
  const normalized = getUserPlan(user);
  if (normalized === "pro") return PLAN.ANALYTICS_PLUS;
  if (normalized === "creator") return PLAN.TRENDS_PLUS;
  return PLAN.FREE;
}

