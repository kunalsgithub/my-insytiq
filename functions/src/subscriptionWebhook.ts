import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as crypto from "crypto";

if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

const paddleWebhookSecret = defineSecret("PADDLE_WEBHOOK_SECRET");

/**
 * Paddle Billing webhook: verifies signature and activates plan server-side.
 * Configure in Paddle Dashboard: Notifications → Add endpoint → URL = this function's URL.
 * Set secret in Firebase: firebase functions:secrets:set PADDLE_WEBHOOK_SECRET
 *
 * Events we handle: subscription.created, transaction.completed
 * custom_data (userId, email, selectedPlan) is sent from checkout and copied to subscription/transaction.
 */
export const subscriptionWebhook = onRequest(
  { secrets: [paddleWebhookSecret], cors: false },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    // Use rawBody for signature verification when available (Firebase may expose it)
    const rawBody: Buffer =
      typeof (req as any).rawBody === "object" && Buffer.isBuffer((req as any).rawBody)
        ? (req as any).rawBody
        : Buffer.from(JSON.stringify(req.body || {}), "utf8");
    const bodyStr = rawBody.toString("utf8");
    const signature = req.headers["paddle-signature"] as string | undefined;

    if (!signature || !bodyStr) {
      res.status(400).send("Missing signature or body");
      return;
    }

    try {
      const secret = paddleWebhookSecret.value();
      if (!secret) {
        console.error("PADDLE_WEBHOOK_SECRET not set");
        res.status(500).send("Webhook not configured");
        return;
      }

      // Paddle sends ts=timestamp;h1=hmac_sha256_hex(ts:body)
      const parts = signature.split(";").reduce((acc, part) => {
        const [k, v] = part.split("=");
        if (k && v) acc[k.trim()] = v.trim();
        return acc;
      }, {} as Record<string, string>);
      const ts = parts.ts;
      const h1 = parts.h1;
      if (!ts || !h1) {
        res.status(400).send("Invalid Paddle-Signature format");
        return;
      }
      const signedPayload = `${ts}:${bodyStr}`;
      const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
      if (expected !== h1) {
        console.warn("Webhook signature mismatch");
        res.status(401).send("Invalid signature");
        return;
      }

      const payload = JSON.parse(bodyStr) as {
        event_type?: string;
        data?: {
          id?: string;
          custom_data?: Record<string, string>;
          subscription_id?: string;
          transaction_id?: string;
          status?: string;
          items?: Array<{ price?: { custom_data?: Record<string, string> }; custom_data?: Record<string, string> }>;
        };
      };

      const eventType = payload.event_type || "";
      const data = payload.data || {};
      const isSubscriptionCreated = eventType === "subscription.created";
      const isTransactionCompleted = eventType === "transaction.completed";

      if (!isSubscriptionCreated && !isTransactionCompleted) {
        res.status(200).send("OK");
        return;
      }

      let customData: Record<string, string> | undefined = (data as any).custom_data;
      if (!customData && data.items?.[0]) {
        customData = (data.items[0] as any).custom_data ?? (data.items[0] as any).price?.custom_data;
      }
      const userId = customData?.userId;
      const selectedPlan = customData?.selectedPlan;

      if (!userId || !selectedPlan) {
        console.warn("Webhook missing userId or selectedPlan in custom_data", { eventType, customData });
        res.status(200).send("OK");
        return;
      }

      const planValue = selectedPlan === "Trends+" || selectedPlan === "Analytics+" ? selectedPlan : "Trends+";
      const subscriptionId = (data as any).subscription_id ?? (data as any).id ?? data.transaction_id ?? "";

      await db.collection("users").doc(userId).set(
        {
          currentPlan: planValue,
          subscriptionStatus: "active",
          subscriptionStartDate: FieldValue.serverTimestamp(),
          ...(subscriptionId ? { subscriptionId } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      console.log(`Plan activated for user ${userId}: ${planValue}, subscriptionId: ${subscriptionId}`);
      res.status(200).send("OK");
    } catch (err) {
      console.error("Subscription webhook error:", err);
      res.status(500).send("Internal Server Error");
    }
  }
);
