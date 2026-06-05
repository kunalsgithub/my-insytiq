import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "./firebaseAdmin.js";

const COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60;
const TRACKABLE_STATUSES = ["grace", "active"];

export type RefHandlerInput = {
  refCode: string;
  clientIp: string;
  userAgent: string;
  isSecure: boolean;
};

export type RefHandlerResult = {
  tracked: boolean;
  redirectUrl: string;
  setCookie?: string;
};

function normalizeRefCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function hashIp(ip: string): string {
  return crypto.createHash("md5").update(ip).digest("hex");
}

function resolveClientIp(forwardedFor: string | undefined, remoteAddress: string | undefined): string {
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return remoteAddress || "unknown";
}

export function resolveSiteHomeUrl(): string {
  return process.env.SITE_URL || "https://www.insytiq.ai";
}

export function buildRefHandlerInput(params: {
  refQuery: string | string[] | undefined;
  forwardedFor?: string;
  remoteAddress?: string;
  userAgent?: string;
  isSecure?: boolean;
}): RefHandlerInput {
  const rawRef = Array.isArray(params.refQuery) ? params.refQuery[0] : params.refQuery;
  return {
    refCode: normalizeRefCode(String(rawRef || "")),
    clientIp: resolveClientIp(params.forwardedFor, params.remoteAddress),
    userAgent: String(params.userAgent || "").slice(0, 512),
    isSecure: params.isSecure ?? true,
  };
}

/**
 * Creator referral click tracking (Next.js app/api/ref/route.ts equivalent).
 * Sets httpOnly cookie and redirects to homepage.
 */
export async function handleCreatorReferralClick(
  input: RefHandlerInput
): Promise<RefHandlerResult> {
  const homeUrl = resolveSiteHomeUrl();
  const refCode = input.refCode;

  if (!refCode) {
    return { tracked: false, redirectUrl: homeUrl };
  }

  const db = getAdminDb();
  const creatorsSnap = await db
    .collection("creators")
    .where("referralCode", "==", refCode)
    .where("status", "in", TRACKABLE_STATUSES)
    .limit(1)
    .get();

  if (creatorsSnap.empty) {
    return { tracked: false, redirectUrl: homeUrl };
  }

  const creatorDoc = creatorsSnap.docs[0];
  const creatorUid = creatorDoc.id;
  const ipHash = hashIp(input.clientIp);

  await db.runTransaction(async (tx) => {
    const clickRef = db.collection("referralClicks").doc();
    tx.set(clickRef, {
      referralCode: refCode,
      creatorUid,
      ipHash,
      userAgent: input.userAgent,
      clickedAt: FieldValue.serverTimestamp(),
      converted: false,
    });
    tx.update(creatorDoc.ref, {
      totalClicks: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  const secureFlag = input.isSecure ? "; Secure" : "";
  const setCookie = `insytiq_ref=${encodeURIComponent(refCode)}; Max-Age=${COOKIE_MAX_AGE_SEC}; Path=/; HttpOnly; SameSite=Lax${secureFlag}`;

  return {
    tracked: true,
    redirectUrl: homeUrl,
    setCookie,
  };
}
