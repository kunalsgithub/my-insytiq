import { defineString } from "firebase-functions/params";

/**
 * String parameters loaded from `functions/.env` at deploy time (and emulator).
 *
 * Names use a `CFG_` prefix on purpose: if these functions were ever deployed with
 * `defineSecret`, Cloud Run still has those keys as *secret* env vars. Redeploying
 * with plain `defineString("OPENAI_API_KEY")` causes:
 * "Secret environment variable overlaps non secret environment variable".
 * Different names avoid the collision; migrate values from old Secret Manager / .env keys.
 */
export const openaiApiKeyParam = defineString("CFG_OPENAI_API_KEY", { default: "" });
export const sbClientIdParam = defineString("CFG_SB_CLIENT_ID", { default: "" });
export const sbApiTokenParam = defineString("CFG_SB_API_TOKEN", { default: "" });
/** Profile analytics, competitors, brand score — not trending Explore sync */
export const apifyApiTokenParam = defineString("CFG_APIFY_API_TOKEN", { default: "" });
/** Trending reels + carousels only (agentx~instagram-trending-scraper) */
export const apifyTrendingApiTokenParam = defineString("CFG_APIFY_TRENDING_API_TOKEN", {
  default: "",
});
/** agentx~instagram-trending-scraper: none | image | all */
export const trendingDownloadMediasParam = defineString("CFG_TRENDING_DOWNLOAD_MEDIAS", {
  default: "none",
});
/** agentx~instagram-trending-scraper required country */
export const trendingCountryParam = defineString("CFG_TRENDING_COUNTRY", {
  default: "India",
});
export const paddleWebhookSecretParam = defineString("CFG_PADDLE_WEBHOOK_SECRET", {
  default: "",
});
export const sendgridApiKeyParam = defineString("CFG_SENDGRID_API_KEY", {
  default: "",
});
