import { onSchedule } from "firebase-functions/v2/scheduler";
import { getApps, initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
  Timestamp,
} from "firebase-admin/firestore";
import {
  CREATOR_ACTIVE_CLICK_THRESHOLD,
  CREATOR_ACTIVE_CONVERSION_THRESHOLD,
  CREATOR_DASHBOARD_URL,
  CREATOR_PRICING_URL,
  type CreatorStatus,
} from "./creatorTypes";
import { queueCreatorEmail } from "./creatorMail";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

function thirtyDaysAgo(): Timestamp {
  return Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

async function countClicksSince(creatorUid: string, since: Timestamp): Promise<number> {
  const snap = await db
    .collection("referralClicks")
    .where("creatorUid", "==", creatorUid)
    .where("clickedAt", ">=", since)
    .count()
    .get();
  return snap.data().count;
}

async function countConversionsSince(creatorUid: string, since: Timestamp): Promise<number> {
  const snap = await db
    .collection("referralConversions")
    .where("creatorUid", "==", creatorUid)
    .where("convertedAt", ">=", since)
    .count()
    .get();
  return snap.data().count;
}

async function evaluateActiveOrPausedCreators(now: Timestamp): Promise<void> {
  const since = thirtyDaysAgo();
  const statuses: CreatorStatus[] = ["active", "paused"];
  const creatorsSnap = await db
    .collection("creators")
    .where("status", "in", statuses)
    .get();

  for (const doc of creatorsSnap.docs) {
    const uid = doc.id;
    const data = doc.data();
    const previousStatus = (data.status as CreatorStatus) || "paused";
    const creatorName = String(data.name || "Creator");
    const creatorEmail = String(data.email || "");

    const clicksLast30Days = await countClicksSince(uid, since);
    const conversionsLast30Days = await countConversionsSince(uid, since);
    const metThreshold =
      conversionsLast30Days >= CREATOR_ACTIVE_CONVERSION_THRESHOLD ||
      clicksLast30Days >= CREATOR_ACTIVE_CLICK_THRESHOLD;
    const newStatus: CreatorStatus = metThreshold ? "active" : "paused";

    await db.runTransaction(async (tx) => {
      tx.update(doc.ref, {
        status: newStatus,
        planAccessActive: metThreshold,
        updatedAt: FieldValue.serverTimestamp(),
      });
      const logRef = db.collection("creatorAccessLog").doc();
      tx.set(logRef, {
        creatorUid: uid,
        evaluatedAt: now,
        clicksLast30Days,
        conversionsLast30Days,
        metThreshold,
        previousStatus,
        newStatus,
      });
    });

    const templateName = metThreshold ? "access_renewed" : "access_paused";
    await queueCreatorEmail(creatorEmail, templateName, {
      creatorName,
      clicksLast30: clicksLast30Days,
      conversionsLast30: conversionsLast30Days,
      dashboardUrl: CREATOR_DASHBOARD_URL,
      pricingUrl: CREATOR_PRICING_URL,
    });
  }
}

async function evaluateGraceCreators(now: Timestamp): Promise<void> {
  const graceSnap = await db.collection("creators").where("status", "==", "grace").get();

  for (const doc of graceSnap.docs) {
    const data = doc.data();
    const graceEndsAt = data.graceEndsAt as Timestamp | undefined;
    if (!graceEndsAt || graceEndsAt.toMillis() > now.toMillis()) continue;

    const creatorName = String(data.name || "Creator");
    const creatorEmail = String(data.email || "");

    await doc.ref.update({
      status: "active",
      planAccessActive: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await queueCreatorEmail(creatorEmail, "grace_ended", {
      creatorName,
      dashboardUrl: CREATOR_DASHBOARD_URL,
    });
  }
}

/**
 * Monthly cron: midnight IST on the 1st — evaluate creator plan access.
 */
export const evaluateCreatorAccess = onSchedule(
  {
    schedule: "0 18 1 * *",
    timeZone: "UTC",
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async () => {
    const now = Timestamp.now();
    await evaluateGraceCreators(now);
    await evaluateActiveOrPausedCreators(now);
  }
);

/**
 * Daily cron: clear pending earnings after the 30-day hold.
 */
export const clearPendingEarnings = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "UTC",
    memory: "256MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const now = Timestamp.now();
    const pendingSnap = await db
      .collection("referralConversions")
      .where("status", "==", "pending")
      .where("holdUntil", "<=", now)
      .get();

    if (pendingSnap.empty) return;

    for (const convDoc of pendingSnap.docs) {
      const data = convDoc.data();
      const creatorUid = String(data.creatorUid || "");
      const commissionAmount = Number(data.commissionAmount || 0);
      if (!creatorUid) continue;

      await db.runTransaction(async (tx) => {
        tx.update(convDoc.ref, { status: "cleared" });
        const creatorRef = db.collection("creators").doc(creatorUid);
        tx.update(creatorRef, {
          pendingEarnings: FieldValue.increment(-commissionAmount),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    }
  }
);
