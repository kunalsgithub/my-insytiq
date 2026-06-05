/** Creator's Economy brand + thresholds (Part 2). */
export const CREATOR_BRAND = "#7c1d5c";

export const CREATOR_ADMIN_EMAIL =
  import.meta.env.VITE_CREATOR_ADMIN_EMAIL || "official@insytiq.ai";

export const CREATOR_MIN_PAYOUT_USD = 10;
export const CREATOR_USD_TO_INR = 83;

export const CREATOR_CONVERSION_THRESHOLD = 3;
export const CREATOR_CLICK_THRESHOLD = 100;

export const AUDIENCE_SIZE_OPTIONS = [
  "Under 1K",
  "1K-10K",
  "10K-50K",
  "50K-100K",
  "100K+",
] as const;

export const NICHE_OPTIONS = [
  "Fitness",
  "Fashion",
  "Food",
  "Tech",
  "Marketing",
  "Education",
  "Travel",
  "Other",
] as const;

export type AudienceSizeOption = (typeof AUDIENCE_SIZE_OPTIONS)[number];
export type NicheOption = (typeof NICHE_OPTIONS)[number];
