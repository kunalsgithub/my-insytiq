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

// Profile analyses per month by plan (must match subscription.tsx usageLimit)
const PROFILE_ANALYSES_LIMIT: Record<string, number> = {
  Free: 2,
  "Trends+": 12,
  "Analytics+": 50,
};

function normalizePlan(raw: string | null | undefined): keyof typeof PROFILE_ANALYSES_LIMIT {
  const s = (raw && typeof raw === "string" ? raw.trim() : "") || "Free";
  if (s === "Free" || s.toLowerCase() === "free") return "Free";
  if (s === "Trends+") return "Trends+";
  if (s === "Analytics+" || s === "Pro" || s.toLowerCase() === "pro") return "Analytics+";
  if (s === "Creator") return "Trends+";
  return "Free";
}

// Define Apify API token secret
const apifyApiTokenSecret = defineSecret("APIFY_API_TOKEN");

export const fetchAndStoreInstagramData = onCall(
  {
    secrets: [apifyApiTokenSecret],
    timeoutSeconds: 540, // 9 minutes (Apify can take time)
  },
  async (req) => {
    const authUid = req.auth?.uid;
    if (!authUid) {
      throw new HttpsError("unauthenticated", "You must be signed in to analyze Instagram accounts.");
    }
    const { userId, username, resultsLimit, onlyPostsNewerThan } = req.data;
    const effectiveUserId = (typeof userId === "string" && userId) ? userId : authUid;
    if (effectiveUserId !== authUid) {
      throw new HttpsError("permission-denied", "User ID does not match authenticated user.");
    }

    if (!username || typeof username !== "string" || !username.trim()) {
      throw new HttpsError("invalid-argument", "Missing or invalid username.");
    }

    const postsLimit = typeof resultsLimit === "number" && resultsLimit > 0 && resultsLimit <= 200
      ? Math.round(resultsLimit)
      : 30;

    const timeRange =
      typeof onlyPostsNewerThan === "string" && onlyPostsNewerThan.trim()
        ? onlyPostsNewerThan.trim()
        : undefined;

    // Enforce profile analyses limit per plan (monthly) – reserve slot atomically
    const userRef = db.collection("users").doc(effectiveUserId);
    const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (for followerHistory)

    const reserveResult = await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const data = userSnap.exists ? userSnap.data() : null;
      const currentPlan = normalizePlan(data?.currentPlan as string | undefined);
      const limit = PROFILE_ANALYSES_LIMIT[currentPlan];
      const usage = (data as any)?.profileAnalysisUsage || {};
      const usageMonth: string | null = typeof usage.month === "string" ? usage.month : null;
      const usageCount: number = typeof usage.count === "number" ? usage.count : 0;
      const isSameMonth = usageMonth === thisMonth;
      if (isSameMonth && usageCount >= limit) {
        return { allowed: false as const, limit };
      }
      const newCount = isSameMonth ? usageCount + 1 : 1;
      transaction.set(userRef, { profileAnalysisUsage: { month: thisMonth, count: newCount } }, { merge: true });
      return { allowed: true as const };
    });

    if (!reserveResult.allowed) {
      throw new HttpsError(
        "resource-exhausted",
        `Your plan allows ${reserveResult.limit} profile analyses per month. You've reached that limit this month. Upgrade your plan to analyze more accounts.`
      );
    }

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
        type?: string | null;
        isVideo?: boolean;
        url?: string | null;
        // Optional post-level metrics; kept lightweight for SmartChat analytics
        reach?: number | null;
        impressions?: number | null;
        savesCount?: number | null;
        sharesCount?: number | null;
        // For Reels/videos: public views metric (not reliable for non-video)
        viewsCount?: number | null;
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
        const v =
          post.timestamp ?? post.takenAtTimestamp ?? post.taken_at_timestamp ?? post.taken_at
          ?? post.createdAt ?? post.created_at ?? post.postedAt ?? post.posted_at ?? post.date
          ?? post.node?.taken_at_timestamp ?? post.node?.timestamp ?? (post.node && (post.node as any).takenAtTimestamp);
        if (typeof v === "number" && v > 0) {
          return v > 1e12 ? Math.floor(v / 1000) : v;
        }
        if (typeof v === "string") {
          if (/^\d+$/.test(v)) {
            const n = parseInt(v, 10);
            return n > 1e12 ? Math.floor(n / 1000) : n;
          }
          const parsed = Date.parse(v);
          if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);
        }
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
          const reach =
            typeof post.reach === "number"
              ? post.reach
              : typeof post.reachCount === "number"
              ? post.reachCount
              : typeof post.impressions === "number"
              ? post.impressions
              : null;
          const saves =
            typeof post.savesCount === "number"
              ? post.savesCount
              : typeof post.saveCount === "number"
              ? post.saveCount
              : typeof post.saved === "number"
              ? post.saved
              : typeof post.saves === "number"
              ? post.saves
              : null;
          const shares =
            typeof post.sharesCount === "number"
              ? post.sharesCount
              : typeof post.shareCount === "number"
              ? post.shareCount
              : null;
          // For Reels/videos, Apify exposes public views; try multiple common keys
          const views =
            typeof post.videoViewCount === "number"
              ? post.videoViewCount
              : typeof post.viewCount === "number"
              ? post.viewCount
              : typeof post.playCount === "number"
              ? post.playCount
              : typeof post.videoPlayCount === "number"
              ? post.videoPlayCount
              : typeof post.plays === "number"
              ? post.plays
              : typeof post.views === "number"
              ? post.views
              : null;

          simplifiedPosts.push({
            likesCount: likes,
            commentsCount: comments,
            caption: post.caption || "",
            timestamp: parsePostTimestamp(post),
            // Firestore does not allow undefined – normalize to explicit values
            type: typeof post.type === "string" ? post.type : null,
            isVideo: !!post.isVideo,
            url: getPostUrl(post) || null,
            reach,
            impressions: reach,
            savesCount: saves,
            sharesCount: shares,
            viewsCount: views,
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

      // Normalize username once for consistent document IDs (Smart Chat and Analytics both look up by lowercase)
      const normalizedUsername = username.toLowerCase().trim();

      // Store a size-capped copy in rawInstagramData (Firestore doc limit 1 MB).
      // Use normalizedUsername so Smart Chat's getDataSnapshot finds it whether user doc has "User" or "user".
      const MAX_RAW_MEDIA = 100;
      const rawProfileForStorage = {
        followersCount: profileData.followersCount ?? profileData.followerCount ?? 0,
        followerCount: profileData.followersCount ?? profileData.followerCount ?? 0,
        media: simplifiedPosts.slice(0, MAX_RAW_MEDIA),
      };
      await db
        .collection("users")
        .doc(effectiveUserId)
        .collection("rawInstagramData")
        .doc(normalizedUsername)
        .set({
          profile: rawProfileForStorage,
          fetchedAt: new Date().toISOString(),
        });

      // Create/update instagramAnalytics/{username} document
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

      // Update users/{uid}: analyticsReady (usage already reserved in transaction)
      await userRef.set({ analyticsReady: true }, { merge: true });

      console.log(`✅ User ${effectiveUserId} analyticsReady set to true`);

      // Append a daily followerHistory snapshot for growth comparison
      const dayKey = today; // already YYYY-MM-DD from plan check
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
