/**
 * Creator referral conversion types (Part 1 spec).
 * Runtime implementation: functions/src/trackReferralConversion.ts
 * Called from subscriptionWebhook after Paddle payment success.
 */

export type CreatorPlanType = "pro" | "growth";

export type TrackReferralConversionInput = {
  convertedUserUid: string;
  planType: CreatorPlanType;
  planPrice: number;
  refCode: string;
};

export const CREATOR_COMMISSION_RATE = 0.4;
