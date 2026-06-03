import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/firebase";

export type AffiliateDestination =
  | "/"
  | "/subscription"
  | "/features"
  | "/referral-program";

export const AFFILIATE_DESTINATIONS: { path: AffiliateDestination; label: string }[] = [
  { path: "/", label: "Home" },
  { path: "/subscription", label: "Pricing / subscription" },
  { path: "/features", label: "Features" },
  { path: "/referral-program", label: "Referral program page" },
];

export type AffiliateProfile = {
  email: string;
  displayName: string;
  refCode: string;
  status: "active";
  totalClicks: number;
  totalSignups: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type AffiliateLink = {
  id: string;
  slug: string;
  label: string;
  destinationPath: AffiliateDestination;
  clicks: number;
  signups: number;
  isDefault?: boolean;
  createdAt?: Timestamp;
};

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;

export function isValidAffiliateSlug(slug: string): boolean {
  return SLUG_RE.test(slug.trim().toLowerCase());
}

function randomSuffix(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function buildDefaultRefCode(email: string | null | undefined, uid: string): string {
  const base = (email?.split("@")[0] || "partner")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);
  const suffix = uid.replace(/[^a-z0-9]/gi, "").slice(-4).toLowerCase() || randomSuffix(4);
  const candidate = `${base || "partner"}${suffix}`.slice(0, 20);
  return candidate.replace(/^-+|-+$/g, "") || `insytiq${randomSuffix(6)}`;
}

export function promotionalUrl(slug: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.insytiq.ai";
  return `${origin}/r/${slug}`;
}

async function slugTaken(slug: string): Promise<boolean> {
  const snap = await getDoc(doc(db, "affiliateLinksBySlug", slug));
  return snap.exists();
}

export async function ensureAffiliateProfile(
  uid: string,
  email: string,
  displayName: string
): Promise<AffiliateProfile> {
  const affiliateRef = doc(db, "affiliates", uid);
  const existing = await getDoc(affiliateRef);
  if (existing.exists()) {
    return existing.data() as AffiliateProfile;
  }

  let refCode = buildDefaultRefCode(email, uid);
  for (let attempt = 0; attempt < 5; attempt++) {
    if (!(await slugTaken(refCode))) break;
    refCode = `${buildDefaultRefCode(email, uid)}${randomSuffix(2)}`.slice(0, 24);
  }

  const profile: AffiliateProfile = {
    email,
    displayName: displayName || email.split("@")[0] || "Partner",
    refCode,
    status: "active",
    totalClicks: 0,
    totalSignups: 0,
  };

  const batch = writeBatch(db);
  batch.set(affiliateRef, {
    ...profile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const defaultLinkId = "default";
  const linkRef = doc(db, "affiliates", uid, "links", defaultLinkId);
  batch.set(linkRef, {
    slug: refCode,
    label: "Main promotional link",
    destinationPath: "/subscription",
    clicks: 0,
    signups: 0,
    isDefault: true,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, "affiliateLinksBySlug", refCode), {
    affiliateUserId: uid,
    linkId: defaultLinkId,
    destinationPath: "/subscription",
    refCode,
  });

  await batch.commit();
  return profile;
}

export async function listAffiliateLinks(uid: string): Promise<AffiliateLink[]> {
  const snap = await getDocs(collection(db, "affiliates", uid, "links"));
  const links = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      slug: String(data.slug || ""),
      label: String(data.label || "Link"),
      destinationPath: (data.destinationPath || "/") as AffiliateDestination,
      clicks: Number(data.clicks || 0),
      signups: Number(data.signups || 0),
      isDefault: Boolean(data.isDefault),
      createdAt: data.createdAt,
    } satisfies AffiliateLink;
  });
  return links.sort(
    (a, b) =>
      (a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1) ||
      a.label.localeCompare(b.label)
  );
}

export async function createAffiliateLink(
  uid: string,
  refCode: string,
  input: { label: string; slug: string; destinationPath: AffiliateDestination }
): Promise<AffiliateLink> {
  const slug = input.slug.trim().toLowerCase();
  const label = input.label.trim() || "Campaign link";

  if (!isValidAffiliateSlug(slug)) {
    throw new Error("Slug must be 3–40 characters: lowercase letters, numbers, and hyphens.");
  }
  if (await slugTaken(slug)) {
    throw new Error("This link slug is already taken. Try another.");
  }

  const linkId = `link_${Date.now()}_${randomSuffix(4)}`;
  const batch = writeBatch(db);
  const linkRef = doc(db, "affiliates", uid, "links", linkId);
  batch.set(linkRef, {
    slug,
    label,
    destinationPath: input.destinationPath,
    clicks: 0,
    signups: 0,
    isDefault: false,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, "affiliateLinksBySlug", slug), {
    affiliateUserId: uid,
    linkId,
    destinationPath: input.destinationPath,
    refCode,
  });
  batch.update(doc(db, "affiliates", uid), { updatedAt: serverTimestamp() });
  await batch.commit();

  return {
    id: linkId,
    slug,
    label,
    destinationPath: input.destinationPath,
    clicks: 0,
    signups: 0,
    isDefault: false,
  };
}

export async function getAffiliateProfile(uid: string): Promise<AffiliateProfile | null> {
  const snap = await getDoc(doc(db, "affiliates", uid));
  if (!snap.exists()) return null;
  return snap.data() as AffiliateProfile;
}
