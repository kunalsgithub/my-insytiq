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

  // Fetch latest ~30 posts (30-day window where possible)
  const profileData = await fetchInstagramData(normalizedUsername, apifyApiToken, 30, "30 days");
  const media: any[] = Array.isArray(profileData.media) ? profileData.media : [];

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

  media.slice(0, 30).forEach((item: any) => {
    const likes = item.likesCount || item.likeCount || 0;
    const comments = item.commentsCount || item.commentCount || 0;
    const engagement = likes + comments;

    totalLikes += likes;
    totalComments += comments;

    const ts =
      typeof item.timestamp === "number"
        ? item.timestamp
        : typeof item.takenAtTimestamp === "number"
        ? item.takenAtTimestamp
        : Math.floor(Date.now() / 1000);

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

    posts.push({
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
    });
  });

  const postCount = posts.length;
  const avgLikes = postCount > 0 ? Math.round(totalLikes / postCount) : 0;
  const avgComments = postCount > 0 ? Math.round(totalComments / postCount) : 0;
  const engagementRate =
    followers > 0 && postCount > 0
      ? parseFloat(((totalLikes + totalComments) / (followers * postCount) * 100).toFixed(2))
      : 0;

  // Approximate posting frequency (posts/week) over last 30 days
  let postingFrequency = 0;
  if (posts.length > 1) {
    const sorted = [...posts].sort((a, b) => b.timestamp - a.timestamp);
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

