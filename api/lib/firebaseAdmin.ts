import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | undefined;
let db: Firestore | undefined;

export function getAdminDb(): Firestore {
  if (db) return db;

  if (getApps().length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (raw) {
      const serviceAccount = JSON.parse(raw) as {
        project_id: string;
        client_email: string;
        private_key: string;
      };
      app = initializeApp({
        credential: cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
        }),
      });
    } else {
      app = initializeApp();
    }
  }

  db = getFirestore();
  return db;
}
