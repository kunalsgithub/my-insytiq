import type { Timestamp } from "firebase-admin/firestore";

export type CreatorStatus = "pending" | "grace" | "active" | "paused" | "rejected";

export type CreatorPlanType = "pro" | "growth";

export type ConversionStatus = "pending" | "cleared" | "reversed";

export type PayoutRequestStatus = "requested" | "paid" | "rejected";

export interface CreatorBankDetails {
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  panNumber: string;
}

export interface CreatorDoc {
  uid: string;
  name: string;
  email: string;
  instagramHandle: string;
  audienceSize: number;
  niche: string;
  referralCode: string;
  referralLink: string;
  status: CreatorStatus;
  approvedAt: Timestamp | null;
  graceEndsAt: Timestamp | null;
  planAccessActive: boolean;
  totalClicks: number;
  totalSignups: number;
  totalConversions: number;
  totalEarnings: number;
  pendingEarnings: number;
  paidEarnings: number;
  payoutRequested: boolean;
  bankDetails: CreatorBankDetails | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const CREATOR_COMMISSION_RATE = 0.4;
export const CREATOR_HOLD_DAYS = 30;
export const CREATOR_GRACE_DAYS = 30;
export const CREATOR_ACTIVE_CONVERSION_THRESHOLD = 3;
export const CREATOR_ACTIVE_CLICK_THRESHOLD = 100;
export const USD_TO_INR_RATE = 83;

export const CREATOR_DASHBOARD_URL = "https://www.insytiq.ai/creators/dashboard";
export const CREATOR_PRICING_URL = "https://www.insytiq.ai/subscription";
