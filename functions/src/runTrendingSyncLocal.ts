/**
 * Local CLI: populate Firestore trending from Apify.
 * Run: npm run trending:sync-local (from functions/)
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeApp, getApps } from "firebase-admin/app";
import { runTrendingSync } from "./syncTrendingFromApify";

function loadLocalEnv(): void {
  const candidates = [
    resolve(__dirname, "..", ".env"),
    resolve(__dirname, "..", ".env.local"),
    resolve(__dirname, "..", ".env.social-trends-29ac2"),
  ];
  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    for (const line of readFileSync(filePath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadLocalEnv();

if (!process.env.CFG_APIFY_TRENDING_API_TOKEN && process.env.CFG_APIFY_API_TOKEN) {
  console.warn(
    "CFG_APIFY_TRENDING_API_TOKEN not set; falling back to CFG_APIFY_API_TOKEN for local sync only."
  );
  process.env.CFG_APIFY_TRENDING_API_TOKEN = process.env.CFG_APIFY_API_TOKEN;
}

if (getApps().length === 0) {
  initializeApp({ projectId: "social-trends-29ac2" });
}

runTrendingSync()
  .then((result) => {
    console.log("Trending sync complete:", JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error("Trending sync failed:", err);
    process.exit(1);
  });
