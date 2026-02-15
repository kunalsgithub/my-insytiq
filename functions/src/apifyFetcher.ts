import fetch from "node-fetch";

// New Apify actors (use canonical IDs from Apify docs):
// - Profile-level metrics: followers, total posts, public/private, etc.
// - Post-level data: captions, likes, comments, timestamps for recent posts.
// Apify actor IDs for API calls (username~actor-name)
const PROFILE_ACTOR_ID = "apify~instagram-profile-scraper";
const POSTS_ACTOR_ID   = "apify~instagram-post-scraper";

async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>,
  apifyApiToken: string
): Promise<any[]> {
  console.log("🚀 Starting Apify actor:", actorId, "for input:", input);

  const url = `https://api.apify.com/v2/acts/${actorId}/runs`;
// For /runs endpoint, the POST body IS the input object itself.
const body = input;

const runResponse = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apifyApiToken}`,
  },
  body: JSON.stringify(body),
});

  console.log("   Run status:", runResponse.status, runResponse.statusText);
  const runJson: any = await runResponse.json();
  console.log("   Run response JSON:", JSON.stringify(runJson, null, 2));

  if (!runJson?.data?.id) {
    console.error("❌ Apify run start failed for actor:", actorId);
    if (runJson?.error?.type === "record-not-found") {
      throw new Error(`Apify actor "${actorId}" was not found. Please verify the actor ID is correct.`);
    }
    const errorMessage = runJson?.error?.message || runJson?.message || "Apify task failed to start";
    throw new Error(`Apify task failed to start: ${errorMessage}. Response: ${JSON.stringify(runJson)}`);
  }

  const runId = runJson.data.id;
  console.log("🟢 Apify run started:", runId);

  // Poll until finished
  let status = "RUNNING";
  let runResult: any;

  while (status === "RUNNING" || status === "READY") {
    await new Promise((r) => setTimeout(r, 3000));

    const res = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}`,
      {
        headers: {
          "Authorization": `Bearer ${apifyApiToken}`,
        },
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error("   Error checking run status:", res.status, errorData);
    }

    runResult = await res.json();
    status = runResult.data.status;

    console.log("⏳ Apify status:", status);
  }

  if (status !== "SUCCEEDED") {
    console.error("❌ Apify run failed for actor:", actorId, runResult);
    throw new Error("Apify task did not succeed");
  }

  const datasetId = runResult.data.defaultDatasetId;
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
