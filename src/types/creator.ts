import type { Timestamp } from "firebase/firestore";

export type CreatorStatus =
  | "pending"
  | "grace"
  | "active"
  | "paused"
  | "rejected";

export type ConversionStatus = "pending" | "cleared" | "reversed";

export type PayoutRequestStatus = "requested" | "paid" | "rejected";

export interface CreatorBankDetails {
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  panNumber: string;
}

export interface CreatorProfile {
  uid: string;
  name: string;
  email: string;
  instagramHandle: string;
  audienceSize: string;
  niche: string;
  whyJoin?: string;
  referralCode: string;
  referralLink: string;
  status: CreatorStatus;
  approvedAt?: Timestamp | null;
  graceEndsAt?: Timestamp | null;
  planAccessActive: boolean;
  totalClicks: number;
  totalSignups: number;
  totalConversions: number;
  totalEarnings: number;
  pendingEarnings: number;
  paidEarnings: number;
  payoutRequested: boolean;
  bankDetails: CreatorBankDetails | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ReferralConversion {
  id: string;
  referralCode: string;
  creatorUid: string;
  convertedUserUid: string;
  planType: "pro" | "growth";
  planPrice: number;
  commissionRate: number;
  commissionAmount: number;
  convertedAt: Timestamp;
  holdUntil: Timestamp;
  status: ConversionStatus;
}

export interface PayoutRequest {
  id: string;
  creatorUid: string;
  creatorName: string;
  creatorEmail: string;
  amount: number;
  amountInr: number;
  requestedAt: Timestamp;
  status: PayoutRequestStatus;
  paidAt?: Timestamp | null;
  bankDetails?: CreatorBankDetails;
}
