import { onRequest } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();

const PRODUCTION_ORIGINS = [
  "https://insytiq.ai",
  "https://www.insytiq.ai",
];

function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4) return false;
  if (parts.some((n) => n !== n || n < 0 || n > 255)) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return false;
}

function isAllowedOrigin(origin: string): boolean {
  if (PRODUCTION_ORIGINS.includes(origin)) return true;
  if (!origin) return false;
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (isPrivateIPv4(host)) return true;
    return false;
  } catch {
    return false;
  }
}

type Req = { method?: string; headers: Record<string, string | string[] | undefined> };
type Res = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => { send: (body?: string) => void; json: (body: object) => void };
};

function setCorsHeaders(req: Req, res: Res): void {
  const origin = req.headers.origin || req.headers.Origin;
  const originStr = typeof origin === "string" ? origin : Array.isArray(origin) ? origin[0] : "";
  const allowed = originStr && isAllowedOrigin(originStr);
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", originStr);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

/**
 * One-time attribution: ties a new user to an affiliate from their tracked link visit.
 */
export const attributeAffiliateSignup = onRequest(
  { timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => {
    setCorsHeaders(req, res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: { message: "Method not allowed." } });
      return;
    }

    return (async () => {
      const authHeader = req.headers.authorization || req.headers.Authorization;
      const tokenStr =
        typeof authHeader === "string"
          ? authHeader
          : Array.isArray(authHeader)
            ? authHeader[0]
            : "";
      const match = tokenStr.match(/^Bearer\s+(.+)$/i);
      if (!match) {
        res.status(401).json({ error: { message: "Unauthorized." } });
        return;
      }

      const decoded = await auth.verifyIdToken(match[1]);
      const uid = decoded.uid;

      const body =
        typeof req.body === "object" && req.body !== null
          ? req.body
          : req.body
            ? JSON.parse(String(req.body))
            : {};

      const affiliateUserId = String(body.affiliateUserId || "").trim();
      const slug = String(body.slug || "").trim().toLowerCase();
      const refCode = String(body.refCode || "").trim();

      if (!affiliateUserId || !slug) {
        res.status(400).json({ error: { message: "affiliateUserId and slug are required." } });
        return;
      }

      if (affiliateUserId === uid) {
        res.status(200).json({ attributed: false, reason: "self-referral" });
        return;
      }

      const userRef = db.collection("users").doc(uid);
      const userSnap = await userRef.get();
      const existing = userSnap.data()?.referredByAffiliate as string | undefined;
      if (existing) {
        res.status(200).json({ attributed: false, reason: "already-attributed" });
        return;
      }

      const slugRef = db.collection("affiliateLinksBySlug").doc(slug);
      const slugSnap = await slugRef.get();
      if (!slugSnap.exists) {
        res.status(404).json({ error: { message: "Affiliate link not found." } });
        return;
      }

      const slugData = slugSnap.data() as { affiliateUserId: string; linkId: string };
      if (slugData.affiliateUserId !== affiliateUserId) {
        res.status(400).json({ error: { message: "Affiliate mismatch." } });
        return;
      }

      const affiliateRef = db.collection("affiliates").doc(affiliateUserId);
      const linkRef = affiliateRef.collection("links").doc(slugData.linkId);

      await db.runTransaction(async (tx) => {
        tx.set(
          userRef,
          {
            referredByAffiliate: affiliateUserId,
            referredBySlug: slug,
            referredByRefCode: refCode || null,
            referredAt: Timestamp.now(),
          },
          { merge: true }
        );
        tx.update(linkRef, { signups: FieldValue.increment(1) });
        tx.update(affiliateRef, { totalSignups: FieldValue.increment(1) });
      });

      res.status(200).json({ attributed: true });
    })().catch((err: unknown) => {
      console.error("attributeAffiliateSignup error:", err);
      setCorsHeaders(req, res);
      res.status(500).json({ error: { message: "Failed to attribute signup." } });
    });
  }
);
