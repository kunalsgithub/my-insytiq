// src/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";

// Your Firebase config from the Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyAigHZtOY0Aa5i1bOzCHLgSTYjhcL7L-Mc",
  authDomain: "social-trends-29ac2.firebaseapp.com",
  projectId: "social-trends-29ac2",
  storageBucket: "social-trends-29ac2.firebasestorage.app",
  messagingSenderId: "829824264022",
  appId: "1:829824264022:web:569589e8538e04dc3a58f7"
};

// Initialize Firebase - check if already initialized
let app;
const existingApps = getApps();

if (existingApps.length > 0) {
  app = existingApps[0];
} else {
  app = initializeApp(firebaseConfig);
}

// Auth, Firestore & Functions
export const auth = getAuth(app);
export const db = getFirestore(app);

// Initialize Functions with explicit region (us-central1 is default for v2 functions)
export const functions = getFunctions(app, 'us-central1');

// HTTP URL for signupWithIpLimit (onRequest with CORS; not callable)
const FUNCTIONS_REGION = 'us-central1';
export const signupWithIpLimitUrl = `https://${FUNCTIONS_REGION}-${firebaseConfig.projectId}.cloudfunctions.net/signupWithIpLimit`;

export const trackAffiliateClickUrl = `https://${FUNCTIONS_REGION}-${firebaseConfig.projectId}.cloudfunctions.net/trackAffiliateClick`;

export const attributeAffiliateSignupUrl = `https://${FUNCTIONS_REGION}-${firebaseConfig.projectId}.cloudfunctions.net/attributeAffiliateSignup`;

// HTTP URL for profile image proxy (avoids Instagram CDN 403 when loading in browser)
export const proxyProfileImageBaseUrl = `https://${FUNCTIONS_REGION}-${firebaseConfig.projectId}.cloudfunctions.net/proxyProfileImage`;

// Emulator ONLY when VITE_USE_FIREBASE_EMULATORS=true (never auto-connect on localhost).
const useFunctionsEmulator =
  typeof window !== "undefined" &&
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";

if (useFunctionsEmulator) {
  connectFunctionsEmulator(functions, "127.0.0.1", 5002);
}

// Callable functions (respect emulator only when flag is set)
export const fetchAndStoreInstagramData = httpsCallable(
  functions,
  "fetchAndStoreInstagramData"
);

const productionCallableUrl = (name: string) =>
  `https://${FUNCTIONS_REGION}-${firebaseConfig.projectId}.cloudfunctions.net/${name}`;

type CallableEnvelope<T> = { result?: T; error?: { message?: string; status?: string } };

/**
 * Calls a deployed Cloud Function by HTTPS URL so it never routes to 127.0.0.1:5002
 * (stale preview builds used to auto-connect the emulator on localhost).
 */
export async function callProductionCallable<T>(
  functionName: string,
  data: Record<string, unknown> = {},
  options?: { signal?: AbortSignal }
): Promise<T> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be signed in.");
  }
  const token = await user.getIdToken();
  const response = await fetch(productionCallableUrl(functionName), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data }),
    signal: options?.signal,
  });

  let payload: CallableEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as CallableEnvelope<T>;
  } catch {
    /* non-JSON body */
  }

  if (!response.ok) {
    const msg =
      payload?.error?.message ||
      `Request failed (${response.status}). Is ${functionName} deployed?`;
    throw new Error(msg);
  }

  if (payload?.error) {
    throw new Error(payload.error.message || "Cloud Function returned an error.");
  }

  return payload?.result as T;
}

export type SyncTrendingNowResult = {
  success: boolean;
  inProgress?: boolean;
  dateKey: string;
  sourceItems: number;
  reels: number;
  posts: number;
  audio: number;
  hashtags: number;
};

/** Trending cache status (shared feed). Pass `{ force: true }` only for admin bootstrap. */
export async function syncTrendingNow(
  data: { force?: boolean } = {},
  signal?: AbortSignal
): Promise<SyncTrendingNowResult> {
  return callProductionCallable<SyncTrendingNowResult>("syncTrendingNow", data, { signal });
}
