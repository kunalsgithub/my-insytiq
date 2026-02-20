// src/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

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

// Auth & Functions
export const auth = getAuth(app);

// Initialize Functions with explicit region (us-central1 is default for v2 functions)
export const functions = getFunctions(app, 'us-central1');

// Callable functions
export const fetchAndStoreInstagramData = httpsCallable(
  functions,
  "fetchAndStoreInstagramData"
);
