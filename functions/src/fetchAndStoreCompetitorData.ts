import { getFirestore, FieldValue, Firestore, WriteBatch } from "firebase-admin/firestore";
import { fetchInstagramData } from "./apifyFetcher";

/**
 * Reusable helper to fetch competitor data via Apify and store a normalized
 * snapshot under users/{userId}/competitors/{competitorUsername}.
 *
 * This is intentionally isolated from the main instagramAnalytics logic.
 */
export async function fetchAndStoreCompetitorData(
  username: string,
  userId: string,
  apifyApiToken: string,
  db?: Firestore
): Promise<void> {
  if (!apifyApiToken) {
    throw new Error("APIFY_API_TOKEN missing for competitor fetch");
  }

  const firestore = db || getFirestore();
  const normalizedUsername = username.toLowerCase().trim();

  // Fetch posts within the last 30 days and compute an accurate post count.
  // We fetch a higher cap to avoid "all competitors show ~30 posts" when someone posts > 30 times/month.
  const POSTS_IN_30D_FETCH_LIMIT = 200;
  const profileData = await fetchInstagramData(
    normalizedUsername,
    apifyApiToken,
    POSTS_IN_30D_FETCH_LIMIT,
    "30 days"
  );
  const media: any[] = Array.isArray(profileData.media) ? profileData.media : [];
  const postsCount30d = media.length;

  const followers =
    profileData.followersCount ||
    profileData.followerCount ||
    profileData.followers ||
    0;

  let totalLikes = 0;
  let totalComments = 0;
  const posts: {
    postId: string;
    type: "Reel" | "Post";
    likes: number;
    comments: number;
    engagement: number;
    timestamp: number;
    caption: string;
    thumbnailUrl: string | null;
    url: string | null;
  }[] = [];

  /** Determine URL-like identifier and basic type from Apify item */
  const getPostId = (item: any): string => {
    // Prefer Instagram shortcodes/codes that map cleanly to /p/{shortcode}/ URLs
    return (
      item.shortcode ||
      item.code ||
      item.id ||
      String(item.takenAtTimestamp || item.timestamp || Date.now())
    );
  };

  const isVideoLike = (item: any): boolean =>
    item.type === "Video" ||
    item.isVideo === true ||
    !!item.videoUrl ||
    !!item.videoCodec;

  // Map all fetched posts, but only store the top subset for UI responsiveness.
  // Counts/averages are computed from the full fetched list.
  const mappedAllPosts: typeof posts = media.map((item: any) => {
    const likes = item.likesCount || item.likeCount || 0;
    const comments = item.commentsCount || item.commentCount || 0;
    const engagement = likes + comments;

    totalLikes += likes;
    totalComments += comments;

    const tsRaw =
      typeof item.timestamp === "number"
        ? item.timestamp
        : typeof item.takenAtTimestamp === "number"
          ? item.takenAtTimestamp
          : Math.floor(Date.now() / 1000);

    // Normalize to unix seconds (some sources return milliseconds)
    const ts =
      typeof tsRaw === "number" && tsRaw > 1e12 ? Math.floor(tsRaw / 1000) : tsRaw;

    // Prefer a full URL when available; fallback to null.
    const postUrl: string | null = (() => {
      const url = item.url || item.permalink || item.link;
      if (url && typeof url === "string" && url.startsWith("http")) return url;
      const shortcode = item.shortcode || item.code;
      if (shortcode && typeof shortcode === "string") {
        return `https://www.instagram.com/p/${shortcode}/`;
      }
      return null;
    })();

    return {
      postId: getPostId(item),
      type: isVideoLike(item) ? "Reel" : "Post",
      likes,
      comments,
      engagement,
      timestamp: ts,
      caption: item.caption || "",
      // Prefer fields that hold actual image URLs
      thumbnailUrl: item.displayUrl || item.thumbnailUrl || null,
      url: postUrl,
    };
  });

  // Store top posts only (used for "Trending Competitor Posts")
  posts.push(...mappedAllPosts.sort((a, b) => b.engagement - a.engagement).slice(0, 30));

  const postCount = postsCount30d;
  const avgLikes = postCount > 0 ? Math.round(totalLikes / postCount) : 0;
  const avgComments = postCount > 0 ? Math.round(totalComments / postCount) : 0;
  const engagementRate =
    followers > 0 && postCount > 0
      ? parseFloat(((totalLikes + totalComments) / (followers * postCount) * 100).toFixed(2))
      : 0;

  // Approximate posting frequency (posts/week) over last 30 days
  let postingFrequency = 0;
  if (mappedAllPosts.length > 1) {
    const sorted = [...mappedAllPosts].sort((a, b) => b.timestamp - a.timestamp);
    const newest = sorted[0].timestamp;
    const oldest = sorted[sorted.length - 1].timestamp;
    const daysDiff = (newest - oldest) / (60 * 60 * 24);
    const windowDays = Math.max(1, Math.min(30, daysDiff || 30));
    postingFrequency = parseFloat(((postCount / windowDays) * 7).toFixed(2));
  }

  const batch: WriteBatch = firestore.batch();

  // Competitor snapshot under the user's document
  const ref = firestore
    .collection("users")
    .doc(userId)
    .collection("competitors")
    .doc(normalizedUsername);

  batch.set(ref, {
    username: normalizedUsername,
    followers,
    engagementRate,
    avgLikes,
    avgComments,
    postingFrequency,
    // Accurate count of posts within the last 30 days window.
    // UI should use this instead of `posts.length` (which is capped for storage size).
    postsCount30d,
    lastUpdated: FieldValue.serverTimestamp(),
    posts,
  });

  // Daily followerHistory snapshot for competitor
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayKey = today.toISOString().slice(0, 10);
  const historyDocId = `${normalizedUsername}_${dayKey}`;
  const historyRef = firestore.collection("followerHistory").doc(historyDocId);

  batch.set(historyRef, {
    username: normalizedUsername,
    date: FieldValue.serverTimestamp(),
    followers,
  });

  await batch.commit();
}

