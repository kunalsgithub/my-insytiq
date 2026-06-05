import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
  Timestamp,
} from "firebase-admin/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";
import {
  CREATOR_DASHBOARD_URL,
  CREATOR_GRACE_DAYS,
  USD_TO_INR_RATE,
} from "./creatorTypes";
import { queueCreatorEmail } from "./creatorMail";
import { creatorAdminEmailParam, sendgridApiKeyParam } from "./configParams";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

function assertCreatorAdmin(request: CallableRequest): void {
  const email = request.auth?.token?.email;
  if (!email) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const adminEmail = creatorAdminEmailParam.value().trim().toLowerCase();
  if (email.toLowerCase() !== adminEmail) {
    throw new HttpsError("permission-denied", "Admin access only.");
  }
}

async function sendAdminHtmlEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const apiKey = sendgridApiKeyParam.value();
  if (!apiKey) {
    console.warn("SendGrid not configured — skipping admin email.");
    return;
  }

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: "no-reply@insytiq.ai", name: "Insytiq Creator Economy" },
      subject,
      content: [{ type: "text/html", value: html }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Admin email failed:", res.status, text);
    throw new HttpsError("internal", "Could not notify admin.");
  }
}

export const approveCreator = onCall({ memory: "256MiB" }, async (request) => {
  assertCreatorAdmin(request);
  const creatorUid = String(request.data?.creatorUid || "").trim();
  if (!creatorUid) {
    throw new HttpsError("invalid-argument", "creatorUid is required.");
  }

  const creatorRef = db.collection("creators").doc(creatorUid);
  const snap = await creatorRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Creator not found.");
  }

  const data = snap.data()!;
  if (data.status !== "pending") {
    throw new HttpsError("failed-precondition", "Creator is not pending.");
  }

  const now = Timestamp.now();
  const graceEndsAt = Timestamp.fromMillis(
    now.toMillis() + CREATOR_GRACE_DAYS * 24 * 60 * 60 * 1000
  );

  await creatorRef.update({
    status: "grace",
    planAccessActive: true,
    approvedAt: now,
    graceEndsAt,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const creatorName = String(data.name || "Creator");
  const referralLink = String(data.referralLink || "");

  await queueCreatorEmail(String(data.email || ""), "welcome_creator", {
    creatorName,
    referralLink,
    dashboardUrl: CREATOR_DASHBOARD_URL,
  });

  return { success: true };
});

export const rejectCreator = onCall({ memory: "256MiB" }, async (request) => {
  assertCreatorAdmin(request);
  const creatorUid = String(request.data?.creatorUid || "").trim();
  if (!creatorUid) {
    throw new HttpsError("invalid-argument", "creatorUid is required.");
  }

  const creatorRef = db.collection("creators").doc(creatorUid);
  const snap = await creatorRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Creator not found.");
  }

  if (snap.data()?.status !== "pending") {
    throw new HttpsError("failed-precondition", "Creator is not pending.");
  }

  await creatorRef.update({
    status: "rejected",
    planAccessActive: false,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { success: true };
});

export const markPayoutPaid = onCall({ memory: "256MiB" }, async (request) => {
  assertCreatorAdmin(request);
  const payoutId = String(request.data?.payoutId || "").trim();
  if (!payoutId) {
    throw new HttpsError("invalid-argument", "payoutId is required.");
  }

  const payoutRef = db.collection("payoutRequests").doc(payoutId);
  const payoutSnap = await payoutRef.get();
  if (!payoutSnap.exists) {
    throw new HttpsError("not-found", "Payout request not found.");
  }

  const payout = payoutSnap.data()!;
  if (payout.status !== "requested") {
    throw new HttpsError("failed-precondition", "Payout is not in requested status.");
  }

  const creatorUid = String(payout.creatorUid || "");
  const amount = Number(payout.amount || 0);
  const creatorRef = db.collection("creators").doc(creatorUid);

  await db.runTransaction(async (tx) => {
    tx.update(payoutRef, {
      status: "paid",
      paidAt: FieldValue.serverTimestamp(),
    });
    tx.update(creatorRef, {
      paidEarnings: FieldValue.increment(amount),
      payoutRequested: false,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { success: true };
});

export const submitCreatorPayout = onCall({ memory: "256MiB" }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const uid = request.auth.uid;
  const bankDetails = request.data?.bankDetails as {
    accountName?: string;
    accountNumber?: string;
    ifscCode?: string;
    panNumber?: string;
  };

  const accountName = String(bankDetails?.accountName || "").trim();
  const accountNumber = String(bankDetails?.accountNumber || "").trim();
  const ifscCode = String(bankDetails?.ifscCode || "").trim().toUpperCase();
  const panNumber = String(bankDetails?.panNumber || "").trim().toUpperCase();

  if (!accountName || !accountNumber || !ifscCode || !panNumber) {
    throw new HttpsError("invalid-argument", "All bank fields are required.");
  }

  const creatorRef = db.collection("creators").doc(uid);
  const creatorSnap = await creatorRef.get();
  if (!creatorSnap.exists) {
    throw new HttpsError("not-found", "Creator profile not found.");
  }

  const creator = creatorSnap.data()!;
  if (creator.payoutRequested) {
    throw new HttpsError("failed-precondition", "Payout already requested.");
  }

  const cleared =
    Math.round(
      ((Number(creator.totalEarnings) || 0) -
        (Number(creator.pendingEarnings) || 0) -
        (Number(creator.paidEarnings) || 0)) *
        100
    ) / 100;

  if (cleared < 10) {
    throw new HttpsError(
      "failed-precondition",
      "Minimum $10 cleared earnings required for payout."
    );
  }

  const amountInr = Math.round(cleared * USD_TO_INR_RATE * 100) / 100;
  const details = { accountName, accountNumber, ifscCode, panNumber };

  const payoutRef = db.collection("payoutRequests").doc();

  await db.runTransaction(async (tx) => {
    tx.set(payoutRef, {
      creatorUid: uid,
      creatorName: String(creator.name || ""),
      creatorEmail: String(creator.email || ""),
      amount: cleared,
      amountInr,
      requestedAt: FieldValue.serverTimestamp(),
      status: "requested",
      bankDetails: details,
    });
    tx.update(creatorRef, {
      bankDetails: details,
      payoutRequested: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  const adminEmail = creatorAdminEmailParam.value().trim();
  const creatorName = String(creator.name || "Creator");
  const creatorEmail = String(creator.email || "");

  await sendAdminHtmlEmail(
    adminEmail,
    `Payout request — ${creatorName} — $${cleared.toFixed(2)}`,
    `
      <h2>Creator payout request</h2>
      <p><strong>Creator:</strong> ${creatorName} (${creatorEmail})</p>
      <p><strong>Amount:</strong> $${cleared.toFixed(2)} USD / ₹${amountInr.toFixed(2)} INR</p>
      <p><strong>Account holder:</strong> ${accountName}</p>
      <p><strong>Account number:</strong> ${accountNumber}</p>
      <p><strong>IFSC:</strong> ${ifscCode}</p>
      <p><strong>PAN:</strong> ${panNumber}</p>
      <p><em>Pay via NEFT and mark as paid in admin panel.</em></p>
    `
  );

  return { success: true, amount: cleared, amountInr };
});
