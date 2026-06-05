import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  CREATOR_COMMISSION_RATE,
  CREATOR_DASHBOARD_URL,
  CREATOR_HOLD_DAYS,
  type CreatorPlanType,
} from "./creatorTypes";
import { queueCreatorEmail } from "./creatorMail";

const db = getFirestore();

export type TrackReferralConversionInput = {
  convertedUserUid: string;
  planType: CreatorPlanType;
  planPrice: number;
  refCode: string;
};

export function mapSubscriptionPlanToCreator(
  selectedPlan: string
): { planType: CreatorPlanType; planPrice: number } | null {
  if (selectedPlan === "Analytics+") {
    return { planType: "pro", planPrice: 69 };
  }
  if (selectedPlan === "Trends+") {
    return { planType: "growth", planPrice: 39 };
  }
  return null;
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

async function findActiveCreatorByRefCode(refCode: string) {
  const normalized = refCode.trim().toLowerCase();
  if (!normalized) return null;

  const snap = await db
    .collection("creators")
    .where("referralCode", "==", normalized)
    .where("status", "in", ["grace", "active"])
    .limit(1)
    .get();

  if (snap.empty) return null;
  return { uid: snap.docs[0].id, data: snap.docs[0].data() };
}

/**
 * Records a paid referral conversion and updates creator earnings.
 * Call from the payment success handler (subscriptionWebhook).
 */
export async function trackReferralConversion(
  input: TrackReferralConversionInput
): Promise<{ tracked: boolean; reason?: string }> {
  const { convertedUserUid, planType, planPrice, refCode } = input;

  if (!convertedUserUid || !refCode || planPrice <= 0) {
    return { tracked: false, reason: "invalid-input" };
  }

  const userRef = db.collection("users").doc(convertedUserUid);
  const userSnap = await userRef.get();
  if (userSnap.data()?.creatorConversionTracked) {
    return { tracked: false, reason: "already-converted" };
  }

  const creator = await findActiveCreatorByRefCode(refCode);
  if (!creator) {
    return { tracked: false, reason: "creator-not-found" };
  }

  if (creator.uid === convertedUserUid) {
    return { tracked: false, reason: "self-referral" };
  }

  const commissionRate = CREATOR_COMMISSION_RATE;
  const commissionAmount = roundMoney(planPrice * commissionRate);
  const convertedAt = Timestamp.now();
  const holdUntil = Timestamp.fromMillis(
    convertedAt.toMillis() + CREATOR_HOLD_DAYS * 24 * 60 * 60 * 1000
  );

  const creatorRef = db.collection("creators").doc(creator.uid);
  const conversionRef = db.collection("referralConversions").doc();

  await db.runTransaction(async (tx) => {
    tx.set(conversionRef, {
      referralCode: refCode.trim().toLowerCase(),
      creatorUid: creator.uid,
      convertedUserUid,
      planType,
      planPrice,
      commissionRate,
      commissionAmount,
      convertedAt,
      holdUntil,
      status: "pending",
    });

    tx.update(creatorRef, {
      totalConversions: FieldValue.increment(1),
      totalEarnings: FieldValue.increment(commissionAmount),
      pendingEarnings: FieldValue.increment(commissionAmount),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(
      userRef,
      {
        creatorConversionTracked: true,
        creatorConversionAt: FieldValue.serverTimestamp(),
        creatorConversionId: conversionRef.id,
      },
      { merge: true }
    );
  });

  const creatorName = String(creator.data.name || "Creator");
  const creatorEmail = String(creator.data.email || "");

  await queueCreatorEmail(creatorEmail, "conversion_alert", {
    creatorName,
    commissionAmount,
    planType,
    dashboardUrl: CREATOR_DASHBOARD_URL,
  });

  return { tracked: true };
}
