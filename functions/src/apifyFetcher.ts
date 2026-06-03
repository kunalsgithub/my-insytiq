import fetch from "node-fetch";
import { apifyStartFailureMessage } from "./apifyErrors";

// New Apify actors (use canonical IDs from Apify docs):
// - Profile-level metrics: followers, total posts, public/private, etc.
// - Post-level data: captions, likes, comments, timestamps for recent posts.
// Apify actor IDs for API calls (username~actor-name)
const PROFILE_ACTOR_ID = "apify~instagram-profile-scraper";
const POSTS_ACTOR_ID   = "apify~instagram-post-scraper";

/** Instagram Explore trending (reels, carousels, posts) — agentx/instagram-trending-scraper */
export const TRENDING_EXPLORE_ACTOR_ID = "agentx~instagram-trending-scraper";

/** Actor-required: "none" | "image" | "all" — "none" keeps CDN URLs only (no extra Apify storage cost). */
export type TrendingDownloadMedias = "none" | "image" | "all";

type RunApifyOptions = {
  /** Apify API waitForFinish (max 300s). Server holds connection until done or limit. */
  waitForFinishSec?: number;
  pollIntervalMs?: number;
  maxPolls?: number;
};

async function fetchApifyRun(
  runId: string,
  apifyApiToken: string
): Promise<{ status: string; data: Record<string, unknown> }> {
  const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
    headers: { Authorization: `Bearer ${apifyApiToken}` },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error("   Error checking run status:", res.status, errorData);
  }
  const runResult: { data?: { status?: string } & Record<string, unknown> } =
    await res.json();
  return {
    status: String(runResult.data?.status || "UNKNOWN"),
    data: (runResult.data || {}) as Record<string, unknown>,
  };
}

export async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>,
  apifyApiToken: string,
  options: RunApifyOptions = {}
): Promise<any[]> {
  const maxPolls = options.maxPolls ?? 0;
  const pollIntervalMs = options.pollIntervalMs ?? 5000;
  const waitForFinishSec = Math.min(
    Math.max(options.waitForFinishSec ?? 0, 0),
    300
  );

  const actorInput = { ...input };
  delete actorInput.maxPolls;

  console.log("🚀 Starting Apify actor:", actorId, "for input:", actorInput);

  const waitQuery =
    waitForFinishSec > 0 ? `?waitForFinish=${waitForFinishSec}` : "";
  const url = `https://api.apify.com/v2/acts/${actorId}/runs${waitQuery}`;
  const runResponse = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apifyApiToken}`,
    },
    body: JSON.stringify(actorInput),
  });

  console.log("   Run status:", runResponse.status, runResponse.statusText);
  const runJson: { data?: { id?: string; status?: string } & Record<string, unknown> } =
    await runResponse.json();

  if (!runJson?.data?.id) {
    console.error("❌ Apify run start failed for actor:", actorId, runJson);
    throw new Error(apifyStartFailureMessage(runJson));
  }

  const runId = runJson.data.id;
  let status = String(runJson.data.status || "RUNNING");
  let runData = runJson.data as Record<string, unknown>;
  console.log("🟢 Apify run started:", runId, "initial status:", status);

  let pollCount = 0;
  while (status === "RUNNING" || status === "READY") {
    pollCount += 1;
    if (maxPolls > 0 && pollCount > maxPolls) {
      const final = await fetchApifyRun(runId, apifyApiToken);
      if (final.status === "SUCCEEDED") {
        status = final.status;
        runData = final.data;
        break;
      }
      const waitedSec =
        waitForFinishSec + Math.round((maxPolls * pollIntervalMs) / 1000);
      throw new Error(
        `Apify run timed out after ~${waitedSec}s (run ${runId}). Try again after the daily sync or reduce CFG_TRENDING_MAX_RESULTS.`
      );
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    const polled = await fetchApifyRun(runId, apifyApiToken);
    status = polled.status;
    runData = polled.data;
    console.log("⏳ Apify status:", status);
  }

  if (status !== "SUCCEEDED") {
    console.error("❌ Apify run failed for actor:", actorId, status, runData);
    throw new Error(`Apify task did not succeed (status: ${status})`);
  }

  const datasetId = runData.defaultDatasetId as string | undefined;
  if (!datasetId) {
    throw new Error("Apify run succeeded but no dataset id was returned");
  }
  const datasetRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items`,
    {
      headers: {
        "Authorization": `Bearer ${apifyApiToken}`,
      },
    }
  );

  const dataset = await datasetRes.json();
  console.log("✅ Apify dataset length for", actorId, ":", Array.isArray(dataset) ? dataset.length : 0);

  if (!Array.isArray(dataset) || dataset.length === 0) {
    return [];
  }
  return dataset;
}

/** Default number of posts to fetch when not specified */
export const DEFAULT_POSTS_LIMIT = 30;

export async function fetchInstagramData(
  username: string,
  apifyApiToken: string,
  resultsLimit: number = DEFAULT_POSTS_LIMIT,
  onlyPostsNewerThan?: string
) {
  if (!apifyApiToken) {
    throw new Error("APIFY_API_TOKEN missing");
  }

  const normalizedUsername = username.trim();
  console.log("🚀 Fetching Instagram data via Apify for:", normalizedUsername, "| posts limit:", resultsLimit, "| time range:", onlyPostsNewerThan || "none");
  console.log("   PROFILE_ACTOR_ID:", PROFILE_ACTOR_ID);
  console.log("   POSTS_ACTOR_ID:", POSTS_ACTOR_ID);

  const postsInput: Record<string, unknown> = {
    username: [normalizedUsername],
    usernames: [normalizedUsername],
    resultsLimit,
  };
  if (onlyPostsNewerThan && onlyPostsNewerThan.trim()) {
    postsInput.onlyPostsNewerThan = onlyPostsNewerThan.trim();
  }

  // Run profile + posts actors in parallel
  const [profileItems, postItems] = await Promise.all([
    runApifyActor(
      PROFILE_ACTOR_ID,
      {
        usernames: [normalizedUsername],
      },
      apifyApiToken
    ),
    runApifyActor(
      POSTS_ACTOR_ID,
      postsInput,
      apifyApiToken
    ),
  ]);

  if (!profileItems.length && !postItems.length) {
    throw new Error("Apify returned no data from either profile or post scrapers");
  }

  const rawProfile = profileItems[0] || {};
  const rawPosts = Array.isArray(postItems) ? postItems : [];

  // Try to normalize follower count from multiple possible field names
  const followersCount =
    rawProfile.followersCount ??
    rawProfile.followerCount ??
    rawProfile.followers ??
    rawProfile.userFollowers ??
    0;

  // Attach posts as media so downstream code can keep using profile.media
  const profileData: any = {
    ...rawProfile,
    followersCount,
    media: rawPosts,
  };

  console.log("✅ Combined profile + posts from Apify. Followers:", followersCount, "Posts:", rawPosts.length);

  return profileData;
}

/** Fetch Instagram Explore trending posts (global feed, not per-profile). */
export async function fetchInstagramTrendingExplore(
  apifyApiToken: string,
  maxResults: number = 200,
  downloadMedias: TrendingDownloadMedias = "none",
  country: string = "India"
): Promise<any[]> {
  if (!apifyApiToken) {
    throw new Error("APIFY_API_TOKEN missing");
  }
  // Small batch: we only publish top 10 reels + 10 posts; smaller runs finish faster.
  const capped = Math.min(Math.max(maxResults, 10), 30);
  return runApifyActor(
    TRENDING_EXPLORE_ACTOR_ID,
    {
      max_results: capped,
      download_medias: downloadMedias,
      country,
    },
    apifyApiToken,
    {
      waitForFinishSec: 300,
      pollIntervalMs: 5000,
      maxPolls: 48,
    }
  );
}
