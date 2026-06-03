import { onRequest } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Records a click for a promotional link slug and returns redirect metadata for the SPA.
 */
export const trackAffiliateClick = onRequest(
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
      const body =
        typeof req.body === "object" && req.body !== null
          ? req.body
          : req.body
            ? JSON.parse(String(req.body))
            : {};
      const slug = normalizeSlug(String(body.slug || ""));
      if (!slug) {
        res.status(400).json({ error: { message: "slug is required." } });
        return;
      }

      const slugRef = db.collection("affiliateLinksBySlug").doc(slug);
      const slugSnap = await slugRef.get();
      if (!slugSnap.exists) {
        res.status(404).json({ error: { message: "Link not found." } });
        return;
      }

      const data = slugSnap.data() as {
        affiliateUserId: string;
        linkId: string;
        destinationPath: string;
        refCode: string;
      };

      const affiliateRef = db.collection("affiliates").doc(data.affiliateUserId);
      const linkRef = affiliateRef.collection("links").doc(data.linkId);

      await db.runTransaction(async (tx) => {
        tx.update(linkRef, {
          clicks: FieldValue.increment(1),
          lastClickAt: FieldValue.serverTimestamp(),
        });
        tx.update(affiliateRef, {
          totalClicks: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      res.status(200).json({
        slug,
        destinationPath: data.destinationPath || "/",
        refCode: data.refCode,
        affiliateUserId: data.affiliateUserId,
        linkId: data.linkId,
      });
    })().catch((err: unknown) => {
      console.error("trackAffiliateClick error:", err);
      setCorsHeaders(req, res);
      res.status(500).json({ error: { message: "Failed to track click." } });
    });
  }
);
