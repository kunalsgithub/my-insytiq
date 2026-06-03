const STORAGE_KEY = "insytiq_affiliate_attribution";

export type AffiliateAttribution = {
  slug: string;
  refCode: string;
  affiliateUserId: string;
  linkId?: string;
  trackedAt: number;
};

export function saveAffiliateAttribution(data: Omit<AffiliateAttribution, "trackedAt">): void {
  if (typeof window === "undefined") return;
  const payload: AffiliateAttribution = { ...data, trackedAt: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function readAffiliateAttribution(): AffiliateAttribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AffiliateAttribution;
    if (!parsed?.slug || !parsed?.affiliateUserId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAffiliateAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
