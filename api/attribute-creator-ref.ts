/**
 * POST /api/attribute-creator-ref
 * Reads httpOnly insytiq_ref cookie server-side and stores on the user doc.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "./lib/firebaseAdmin.js";

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(";").reduce<Record<string, string>>((acc, part) => {
    const [k, ...rest] = part.trim().split("=");
    if (k) acc[k] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    const match = typeof authHeader === "string" ? authHeader.match(/^Bearer\s+(.+)$/i) : null;
    if (!match) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const decoded = await getAuth().verifyIdToken(match[1]);
    const uid = decoded.uid;
    const cookies = parseCookies(req.headers.cookie);
    const refCode = String(cookies.insytiq_ref || "").trim().toLowerCase();

    if (!refCode) {
      res.status(200).json({ attributed: false, reason: "no-cookie" });
      return;
    }

    const db = getAdminDb();
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const existing = userSnap.data()?.creatorReferralCode as string | undefined;
    if (existing) {
      res.status(200).json({ attributed: false, reason: "already-attributed" });
      return;
    }

    const creatorsSnap = await db
      .collection("creators")
      .where("referralCode", "==", refCode)
      .where("status", "in", ["grace", "active"])
      .limit(1)
      .get();

    if (creatorsSnap.empty) {
      res.status(200).json({ attributed: false, reason: "invalid-ref" });
      return;
    }

    const creatorUid = creatorsSnap.docs[0].id;
    if (creatorUid === uid) {
      res.status(200).json({ attributed: false, reason: "self-referral" });
      return;
    }

    await db.runTransaction(async (tx) => {
      tx.set(
        userRef,
        {
          creatorReferralCode: refCode,
          creatorUid,
          creatorReferredAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      tx.update(creatorsSnap.docs[0].ref, {
        totalSignups: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    res.status(200).json({ attributed: true, refCode });
  } catch (err) {
    console.error("api/attribute-creator-ref error:", err);
    res.status(500).json({ error: "Failed to attribute referral" });
  }
}
