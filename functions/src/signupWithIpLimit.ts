import { onRequest } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp();
}

const auth = getAuth();
const db = getFirestore();

const PRODUCTION_ORIGINS = [
  "https://insytiq.ai",
  "https://www.insytiq.ai",
];

/** True if hostname is a private/LAN IPv4 (10.x, 172.16–31.x, 192.168.x). */
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

const BODY_READ_TIMEOUT_MS = 15000;

function getRequestBody(req: any): Promise<string> {
  if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
    return Promise.resolve(req.rawBody.toString("utf8"));
  }
  if (req.body && typeof req.body === "object") {
    return Promise.resolve(JSON.stringify(req.body));
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Request body timeout")), BODY_READ_TIMEOUT_MS);
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | undefined) => {
      if (chunk) chunks.push(chunk);
    });
    req.on("error", (e: Error) => {
      clearTimeout(timeout);
      reject(e);
    });
    req.on("end", () => {
      clearTimeout(timeout);
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
  });
}

/**
 * Create an email/password user but enforce an IP-based limit.
 * CORS: only https://insytiq.ai, https://www.insytiq.ai, http://localhost:5173
 */
export const signupWithIpLimit = onRequest(
  { timeoutSeconds: 60, memory: "256MiB" },
  (req, res) => {
    setCorsHeaders(req, res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: { code: "method-not-allowed", message: "Method not allowed." } });
      return;
    }

    return (async () => {
    try {
      const rawBody = await getRequestBody(req);
      const body = rawBody ? JSON.parse(rawBody) : {};
      const email = (body.email || "").trim().toLowerCase();
      const password = (body.password || "").trim();

      if (!email || !password) {
        res.status(400).json({
          error: { code: "invalid-argument", message: "Email and password are required." },
        });
        return;
      }

      const rawIp =
        (req.headers["x-forwarded-for"] as string | undefined) ||
        (req.headers["x-real-ip"] as string | undefined) ||
        "";
      const ipAddress = rawIp.split(",")[0].trim() || "unknown";

      const origin = req.headers.origin || req.headers.Origin;
      const originStr = typeof origin === "string" ? origin : Array.isArray(origin) ? origin[0] : "";
      const isDevOrigin = originStr ? isAllowedOrigin(originStr) && !PRODUCTION_ORIGINS.includes(originStr) : false;

      if (!isDevOrigin && ipAddress !== "unknown") {
        const existingSnap = await db
          .collection("users")
          .where("ipAddress", "==", ipAddress)
          .get();

        if (existingSnap.size >= 3) {
          res.status(429).json({
            error: {
              code: "resource-exhausted",
              message: "Too many accounts created from this network.",
            },
          });
          return;
        }
      }

      const userRecord = await auth.createUser({
        email,
        password,
        emailVerified: false,
        disabled: false,
      });

      await db
        .collection("users")
        .doc(userRecord.uid)
        .set(
          {
            email,
            ipAddress,
            createdAt: Timestamp.now(),
          },
          { merge: true }
        );

      res.status(200).json({ uid: userRecord.uid, email });
    } catch (err: any) {
      console.error("signupWithIpLimit error:", err);

      if (err?.code === "auth/email-already-exists") {
        res.status(409).json({
          error: {
            code: "already-exists",
            message: "An account with this email already exists. Please sign in instead.",
          },
        });
        return;
      }

      if (err instanceof SyntaxError) {
        res.status(400).json({
          error: { code: "invalid-argument", message: "Invalid JSON body." },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: "internal",
          message: err?.message || "Failed to create account. Please try again.",
        },
      });
    }
    })().catch((err: any) => {
      console.error("signupWithIpLimit unhandled:", err);
      try {
        setCorsHeaders(req, res);
        (res as any).status(500).json({ error: { code: "internal", message: "Server error." } });
      } catch (_) {}
    });
  }
);
