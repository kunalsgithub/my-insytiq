/**
 * On user creation (signup): initialize users/{uid} with planType and usage.
 * Ensures usage is never undefined for new users. Auth triggers are v1 only.
 */

import * as functions from "firebase-functions/v1";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getDefaultUsage } from "./planLimits";

if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

export const onAuthUserCreated = functions.auth.user().onCreate(async (user) => {
  const uid = user.uid;
  const usage = getDefaultUsage();
  await db.collection("users").doc(uid).set(
    {
      planType: "free",
      usage,
    },
    { merge: true }
  );
});
