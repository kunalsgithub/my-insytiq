import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { fetchInstagramData } from "./apifyFetcher";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Only initialize if not already initialized
if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

// Define Apify API token secret
const apifyApiTokenSecret = defineSecret("APIFY_API_TOKEN");

export const fetchAndStoreInstagramData = onCall(
  {
    secrets: [apifyApiTokenSecret],
    timeoutSeconds: 540, // 9 minutes (Apify can take time)
  },
  async (req) => {
    const { userId, username, resultsLimit, onlyPostsNewerThan } = req.data;

    if (!userId || !username) {
      throw new Error("Missing userId or username");
    }

    const postsLimit = typeof resultsLimit === "number" && resultsLimit > 0 && resultsLimit <= 200
      ? Math.round(resultsLimit)
      : 30;

    const timeRange =
      typeof onlyPostsNewerThan === "string" && onlyPostsNewerThan.trim()
        ? onlyPostsNewerThan.trim()
        : undefined;

    try {
      // Access the secret value
      const apifyApiToken = apifyApiTokenSecret.value();
      const profileData = await fetchInstagramData(username, apifyApiToken, postsLimit, timeRange);

      // Extract analytics data from profileData (raw write happens later with size cap)
      const followers = profileData.followersCount || profileData.followerCount || 0;
      
      // Calculate engagement rate and averages from posts
      let totalLikes = 0;
      let totalComments = 0;
      let postCount = 0;
      const hashtagCounts: Record<string, number> = {};
      const simplifiedPosts: {
        likesCount: number;
        commentsCount: number;
        caption: string;
        timestamp: number | null;
        type?: string;
        isVideo?: boolean;
        url?: string | null;
      }[] = [];

      /** Build Instagram post URL from shortcode or use url/permalink if present */
      const getPostUrl = (post: any): string | null => {
        const url = post.url || post.permalink || post.link;
        if (url && typeof url === "string" && url.startsWith("http")) return url;
        const shortcode = post.shortcode || post.code;
        if (shortcode && typeof shortcode === "string") {
          return `https://www.instagram.com/p/${shortcode}/`;
        }
        return null;
      };

      /** Extract Unix seconds from any common timestamp field (Apify/Instagram scrapers vary) */
      const parsePostTimestamp = (post: any): number | null => {
        const v = post.timestamp ?? post.takenAtTimestamp ?? post.taken_at_timestamp ?? post.taken_at;
        if (typeof v === "number" && v > 0) return v;
        if (typeof v === "string" && /^\d+$/.test(v)) return parseInt(v, 10);
        if (v && typeof v === "object" && typeof (v as any)._seconds === "number") return (v as any)._seconds;
        return null;
      };

      if (profileData.media && Array.isArray(profileData.media)) {
        postCount = profileData.media.length;
        profileData.media.forEach((post: any) => {
          const likes = post.likesCount || post.likeCount || 0;
          const comments = post.commentsCount || post.commentCount || 0;

          totalLikes += likes;
          totalComments += comments;

          // Extract hashtags
          if (post.caption) {
            const hashtags = post.caption.match(/#\w+/g) || [];
            hashtags.forEach((tag: string) => {
              const normalizedTag = tag.toLowerCase();
              hashtagCounts[normalizedTag] = (hashtagCounts[normalizedTag] || 0) + 1;
            });
          }

          // Store a lightweight version of each post for analytics consumers (Smart Chat, etc.)
          simplifiedPosts.push({
            likesCount: likes,
            commentsCount: comments,
            caption: post.caption || "",
            timestamp: parsePostTimestamp(post),
            // Firestore does not allow undefined – normalize to explicit values
            type: typeof post.type === "string" ? post.type : null,
            isVideo: !!post.isVideo,
            url: getPostUrl(post) || null,
          });
        });
      }
      
      const avgLikes = postCount > 0 ? Math.round(totalLikes / postCount) : 0;
      const avgComments = postCount > 0 ? Math.round(totalComments / postCount) : 0;
      const engagementRate = followers > 0 && postCount > 0
        ? parseFloat(((totalLikes + totalComments) / (followers * postCount) * 100).toFixed(2))
        : 0;
      
      // Get top 10 hashtags
      const topHashtags = Object.entries(hashtagCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 10)
        .map(([tag]) => tag);
      
      // Calculate posting frequency (posts per week, approximate)
      let postingFrequency = 0;
      if (profileData.media && Array.isArray(profileData.media) && profileData.media.length > 1) {
        const firstPost = profileData.media[0];
        const lastPost = profileData.media[profileData.media.length - 1];
        const firstTs = parsePostTimestamp(firstPost);
        const lastTs = parsePostTimestamp(lastPost);
        if (firstTs != null && lastTs != null) {
          const firstDate = new Date(firstTs * 1000);
          const lastDate = new Date(lastTs * 1000);
          const daysDiff = (firstDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
          postingFrequency = daysDiff > 0 ? parseFloat((postCount / daysDiff * 7).toFixed(2)) : 0;
        }
      }

      // Work out the window of data we just analyzed so Smart Chat / Analytics
      // can describe it accurately (posts vs days-based range).
      // - When timeRange is provided (e.g. "30 days"), treat this as a days-based window.
      // - Otherwise, it's simply "last N posts".
      const dataWindowMode: "days" | "posts" =
        typeof timeRange === "string" && timeRange.trim().length > 0 ? "days" : "posts";
      const dataWindowLabel: string | null =
        dataWindowMode === "days"
          ? timeRange!
          : postCount > 0
          ? String(postCount)
          : null;

      // Store a size-capped copy in rawInstagramData (Firestore doc limit 1 MB).
      // Smart Chat prefers instagramAnalytics; raw is fallback. Store only what we need.
      const MAX_RAW_MEDIA = 100;
      const rawProfileForStorage = {
        followersCount: profileData.followersCount ?? profileData.followerCount ?? 0,
        followerCount: profileData.followersCount ?? profileData.followerCount ?? 0,
        media: simplifiedPosts.slice(0, MAX_RAW_MEDIA),
      };
      await db
        .collection("users")
        .doc(userId)
        .collection("rawInstagramData")
        .doc(username)
        .set({
          profile: rawProfileForStorage,
          fetchedAt: new Date().toISOString(),
        });

      // Create/update instagramAnalytics/{username} document
      // Normalize username to lowercase for consistent document IDs (case-sensitive in Firestore)
      const normalizedUsername = username.toLowerCase().trim();
      const analyticsDocRef = db.collection("instagramAnalytics").doc(normalizedUsername);
      console.log(`Saving analytics to: instagramAnalytics/${normalizedUsername}`);
      await analyticsDocRef.set(
        {
          followers: followers,
          engagementRate: engagementRate,
          avgLikes: avgLikes,
          avgComments: avgComments,
          postingFrequency: postingFrequency,
          topHashtags: topHashtags,
          // Store lightweight post-level analytics for Smart Chat
          posts: simplifiedPosts,
          // Window metadata so responses can say "last 30 days" vs "last N posts"
          dataWindowMode,
          dataWindowLabel,
          dataWindowPostCount: postCount,
          lastUpdated: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      console.log(`✅ Instagram analytics saved for ${username}`);

      // Update users/{uid} to set analyticsReady: true
      const userDocRef = db.collection("users").doc(userId);
      await userDocRef.set(
        {
          analyticsReady: true,
        },
        { merge: true }
      );

      console.log(`✅ User ${userId} analyticsReady set to true`);

      // Append a daily followerHistory snapshot for growth comparison
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayKey = today.toISOString().slice(0, 10); // e.g. "2026-02-12"
      const historyDocId = `${normalizedUsername}_${dayKey}`;
      const historyRef = db.collection("followerHistory").doc(historyDocId);
      await historyRef.set(
        {
          username: normalizedUsername,
          date: FieldValue.serverTimestamp(),
          followers,
        },
        { merge: true }
      );

      return {
        success: true,
        message: "Instagram data fetched and stored",
        profile: profileData,
      };
    } catch (err: any) {
      console.error("Apify fetch error:", err.message);
      console.error("Apify fetch error stack:", err.stack);
      
      // Throw HttpsError so frontend can catch it properly
      throw new HttpsError(
        "internal",
        `Failed to fetch Instagram data: ${err.message || "Unknown error"}`
      );
    }
  }
);
