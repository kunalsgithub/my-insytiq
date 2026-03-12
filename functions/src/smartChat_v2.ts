import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import axios from "axios";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { checkAndIncrementUsage, LIMIT_REACHED_CODE } from "./usageEnforcement";
import { normalizePlanKey } from "./planLimits";

if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

const openaiApiKeySecret = defineSecret("OPENAI_API_KEY");
const sbClientId = defineSecret("SB_CLIENT_ID");
const sbApiToken = defineSecret("SB_API_TOKEN");

// ─── TYPES ───────────────────────────────────────────────────────────────

interface Post {
  likesCount?: number;
  commentsCount?: number;
  caption?: string;
  timestamp?: number | null;
  type?: string | null;
  isVideo?: boolean;
  url?: string | null;
  // Optional post-level metrics (may be absent for older data)
  reach?: number | null;
  impressions?: number | null;
  savesCount?: number | null;
  sharesCount?: number | null;
  // For Reels/videos: public views metric when available
  viewsCount?: number | null;
}

interface DataSnapshot {
  hasPosts: boolean;
  postCount: number;
  hasAccountMetrics: boolean;
  engagementRate?: number;
  followers?: number;
  avgLikes?: number;
  avgComments?: number;
  posts?: Post[];
  // Optional description of the data window (e.g. "30 days" vs "last 30 posts")
  dataWindowMode?: "days" | "posts";
  dataWindowLabel?: string;
}

type ResponseMode = "ANALYTICS" | "STRATEGY" | "LIMITATION";

// ─── 1. DATA SNAPSHOT (pure function) ────────────────────────────────────

/** Extract Unix seconds from any common timestamp field (Apify/Firestore vary) */
function parsePostTimestamp(p: any): number | null {
  const v =
    p?.timestamp ?? p?.takenAtTimestamp ?? p?.taken_at_timestamp ?? p?.taken_at
    ?? p?.createdAt ?? p?.created_at ?? p?.postedAt ?? p?.posted_at ?? p?.date
    ?? p?.node?.taken_at_timestamp ?? p?.node?.timestamp ?? (p?.node && (p.node as any).takenAtTimestamp);
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
}

/** Time-slot analysis for best-time-to-post: Morning 6–12, Afternoon 12–18, Evening 18–24, Night 0–6. */
function analyzeTimeSlots(posts: Post[] | undefined): Record<string, { total: number; posts: number; avgEngagement: number }> | null {
  if (!posts || posts.length === 0) return null;

  const buckets: Record<string, { total: number; posts: number; avgEngagement: number }> = {
    Morning: { total: 0, posts: 0, avgEngagement: 0 },
    Afternoon: { total: 0, posts: 0, avgEngagement: 0 },
    Evening: { total: 0, posts: 0, avgEngagement: 0 },
    Night: { total: 0, posts: 0, avgEngagement: 0 },
  };

  posts.forEach((post) => {
    const ts = parsePostTimestamp(post);
    if (ts == null) return;
    const date = new Date(ts * 1000);
    const hour = date.getHours();
    const engagement = (post.likesCount ?? 0) + (post.commentsCount ?? 0);

    let slot: keyof typeof buckets;
    if (hour >= 6 && hour < 12) slot = "Morning";
    else if (hour >= 12 && hour < 18) slot = "Afternoon";
    else if (hour >= 18 && hour < 24) slot = "Evening";
    else slot = "Night";

    buckets[slot].total += engagement;
    buckets[slot].posts += 1;
  });

  (Object.keys(buckets) as (keyof typeof buckets)[]).forEach((slot) => {
    if (buckets[slot].posts > 0) {
      buckets[slot].avgEngagement = buckets[slot].total / buckets[slot].posts;
    }
  });

  return buckets;
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Engagement by weekday (0=Sunday .. 6=Saturday). For "which weekday gives highest engagement". */
function analyzeByWeekday(posts: Post[] | undefined): Record<string, { total: number; posts: number; avgEngagement: number }> | null {
  if (!posts || posts.length === 0) return null;
  const buckets: Record<string, { total: number; posts: number; avgEngagement: number }> = {};
  WEEKDAY_NAMES.forEach((d) => { buckets[d] = { total: 0, posts: 0, avgEngagement: 0 }; });

  posts.forEach((post) => {
    const ts = parsePostTimestamp(post);
    if (ts == null) return;
    const date = new Date(ts * 1000);
    const dayName = WEEKDAY_NAMES[date.getDay()];
    const engagement = (post.likesCount ?? 0) + (post.commentsCount ?? 0);
    buckets[dayName].total += engagement;
    buckets[dayName].posts += 1;
  });

  WEEKDAY_NAMES.forEach((d) => {
    if (buckets[d].posts > 0) buckets[d].avgEngagement = buckets[d].total / buckets[d].posts;
  });
  return buckets;
}

/** Engagement by hour (0–23). For "6PM underperforming", "statistically significant hour". */
function analyzeByHour(posts: Post[] | undefined): Record<string, { total: number; posts: number; avgEngagement: number }> | null {
  if (!posts || posts.length === 0) return null;
  const buckets: Record<string, { total: number; posts: number; avgEngagement: number }> = {};
  for (let h = 0; h < 24; h++) buckets[String(h)] = { total: 0, posts: 0, avgEngagement: 0 };

  posts.forEach((post) => {
    const ts = parsePostTimestamp(post);
    if (ts == null) return;
    const hour = new Date(ts * 1000).getHours();
    const key = String(hour);
    const engagement = (post.likesCount ?? 0) + (post.commentsCount ?? 0);
    buckets[key].total += engagement;
    buckets[key].posts += 1;
  });

  for (let h = 0; h < 24; h++) {
    const key = String(h);
    if (buckets[key].posts > 0) buckets[key].avgEngagement = buckets[key].total / buckets[key].posts;
  }
  return buckets;
}

/** Weekday (Mon–Fri) vs Weekend (Sat–Sun). For "do weekend posts perform worse". */
function analyzeWeekdayVsWeekend(posts: Post[] | undefined): Record<string, { total: number; posts: number; avgEngagement: number }> | null {
  if (!posts || posts.length === 0) return null;
  const weekday = { total: 0, posts: 0, avgEngagement: 0 };
  const weekend = { total: 0, posts: 0, avgEngagement: 0 };

  posts.forEach((post) => {
    const ts = parsePostTimestamp(post);
    if (ts == null) return;
    const day = new Date(ts * 1000).getDay();
    const engagement = (post.likesCount ?? 0) + (post.commentsCount ?? 0);
    if (day === 0 || day === 6) {
      weekend.total += engagement;
      weekend.posts += 1;
    } else {
      weekday.total += engagement;
      weekday.posts += 1;
    }
  });

  if (weekday.posts > 0) weekday.avgEngagement = weekday.total / weekday.posts;
  if (weekend.posts > 0) weekend.avgEngagement = weekend.total / weekend.posts;
  return { weekday, weekend };
}

async function getDataSnapshot(
  db: Firestore,
  userId: string,
  selectedAccount: string,
  sbClientIdVal?: string,
  sbApiTokenVal?: string
): Promise<DataSnapshot> {
  const norm = selectedAccount.toLowerCase().trim();
  const empty: DataSnapshot = {
    hasPosts: false,
    postCount: 0,
    hasAccountMetrics: false,
  };

  // 1. Try instagramAnalytics first (only use it when it has posts, so "analyze N posts" data is used)
  const analyticsDoc = await db.collection("instagramAnalytics").doc(norm).get();
  if (analyticsDoc.exists) {
    const d = analyticsDoc.data();
    const er = d?.engagementRate ?? d?.engagement_rate ?? 0;
    const fl = d?.followers ?? d?.followerCount ?? d?.followersCount ?? 0;
    const al = d?.avgLikes ?? d?.avg_likes ?? 0;
    const ac = d?.avgComments ?? d?.avg_comments ?? 0;
    const postsList = (d as any)?.posts;
    const rawPosts = Array.isArray(postsList) ? postsList : [];
    // Normalize so every post has .timestamp (from any common field) for POSTING_FREQUENCY / dates
    const posts: Post[] = rawPosts.map((p: any) => {
      const reach =
        typeof p.reach === "number"
          ? p.reach
          : typeof p.reachCount === "number"
          ? p.reachCount
          : typeof p.impressions === "number"
          ? p.impressions
          : null;
      const saves =
        typeof p.savesCount === "number"
          ? p.savesCount
          : typeof p.saveCount === "number"
          ? p.saveCount
          : typeof p.saved === "number"
          ? p.saved
          : typeof p.saves === "number"
          ? p.saves
          : null;
      const shares =
        typeof p.sharesCount === "number"
          ? p.sharesCount
          : typeof p.shareCount === "number"
          ? p.shareCount
          : null;
      const views =
        typeof p.viewsCount === "number"
          ? p.viewsCount
          : typeof p.videoViewCount === "number"
          ? p.videoViewCount
          : typeof p.viewCount === "number"
          ? p.viewCount
          : typeof p.playCount === "number"
          ? p.playCount
          : typeof p.videoPlayCount === "number"
          ? p.videoPlayCount
          : typeof p.plays === "number"
          ? p.plays
          : typeof p.views === "number"
          ? p.views
          : null;
      return {
        likesCount: p.likesCount ?? p.likeCount,
        commentsCount: p.commentsCount ?? p.commentCount,
        caption: p.caption ?? "",
        timestamp: parsePostTimestamp(p),
        type: typeof p.type === "string" ? p.type : null,
        isVideo: !!p.isVideo,
        url: p.url ?? null,
        reach,
        impressions: reach,
        savesCount: saves,
        sharesCount: shares,
        viewsCount: views,
      };
    });
    const postCount = posts.length;
    const dataWindowMode = (d as any)?.dataWindowMode as "days" | "posts" | undefined;
    const dataWindowLabel = (d as any)?.dataWindowLabel as string | undefined;

    // Only return from analytics when we have posts; otherwise fall through to rawInstagramData
    // so that "analyze 30 posts" (which writes to rawInstagramData) is used for best-time etc.
    if (postCount > 0) {
      return {
        hasPosts: true,
        postCount,
        hasAccountMetrics: er > 0 || fl > 0 || al > 0 || ac > 0,
        engagementRate: er,
        followers: fl,
        avgLikes: al,
        avgComments: ac,
        posts,
        dataWindowMode,
        dataWindowLabel,
      };
    }
  }

  // 2. Fallback to APIFY raw data (users/.../rawInstagramData — written by "analyze N posts")
  let rawDoc = await db.collection("users").doc(userId).collection("rawInstagramData").doc(selectedAccount).get();
  if (!rawDoc.exists && norm !== selectedAccount) {
    rawDoc = await db.collection("users").doc(userId).collection("rawInstagramData").doc(norm).get();
  }
  if (rawDoc.exists) {
    const profile = rawDoc.data()?.profile;
    const media = Array.isArray(profile?.media) ? profile.media : [];
    const postCount = media.length;
    let engagementRate = 0;
    let followers = profile?.followersCount ?? profile?.followerCount ?? 0;
    let avgLikes = 0;
    let avgComments = 0;

    if (postCount > 0) {
      let totalLikes = 0;
      let totalComments = 0;
      media.forEach((p: any) => {
        totalLikes += p.likesCount ?? p.likeCount ?? 0;
        totalComments += p.commentsCount ?? p.commentCount ?? 0;
      });
      avgLikes = Math.round(totalLikes / postCount);
      avgComments = Math.round(totalComments / postCount);
      if (followers > 0) {
        engagementRate = parseFloat(((totalLikes + totalComments) / (followers * postCount) * 100).toFixed(2));
      }
    }

    const getPostUrl = (p: any): string | null => {
      const url = p.url || p.permalink || p.link;
      if (url && typeof url === "string" && url.startsWith("http")) return url;
      const shortcode = p.shortcode || p.code;
      if (shortcode && typeof shortcode === "string") return `https://www.instagram.com/p/${shortcode}/`;
      return null;
    };
    const posts: Post[] = media.map((p: any) => {
      const reach =
        typeof p.reach === "number"
          ? p.reach
          : typeof p.reachCount === "number"
          ? p.reachCount
          : typeof p.impressions === "number"
          ? p.impressions
          : null;
      const saves =
        typeof p.savesCount === "number"
          ? p.savesCount
          : typeof p.saveCount === "number"
          ? p.saveCount
          : typeof p.saved === "number"
          ? p.saved
          : typeof p.saves === "number"
          ? p.saves
          : null;
      const shares =
        typeof p.sharesCount === "number"
          ? p.sharesCount
          : typeof p.shareCount === "number"
          ? p.shareCount
          : null;
      const views =
        typeof p.viewsCount === "number"
          ? p.viewsCount
          : typeof p.videoViewCount === "number"
          ? p.videoViewCount
          : typeof p.viewCount === "number"
          ? p.viewCount
          : typeof p.playCount === "number"
          ? p.playCount
          : typeof p.videoPlayCount === "number"
          ? p.videoPlayCount
          : typeof p.plays === "number"
          ? p.plays
          : typeof p.views === "number"
          ? p.views
          : null;
      return {
        likesCount: p.likesCount ?? p.likeCount,
        commentsCount: p.commentsCount ?? p.commentCount,
        caption: p.caption ?? "",
        timestamp: parsePostTimestamp(p),
        type: typeof p.type === "string" ? p.type : null,
        isVideo: !!p.isVideo,
        url: getPostUrl(p) || null,
        reach,
        impressions: reach,
        savesCount: saves,
        sharesCount: shares,
        viewsCount: views,
      };
    });

    return {
      hasPosts: postCount > 0,
      postCount,
      hasAccountMetrics: engagementRate > 0 || followers > 0 || avgLikes > 0 || avgComments > 0,
      engagementRate: engagementRate || undefined,
      followers: followers || undefined,
      avgLikes: avgLikes || undefined,
      avgComments: avgComments || undefined,
      posts: postCount > 0 ? posts : undefined,
    };
  }

  // 3. Fallback to Social Blade only if both above fail
  if (sbClientIdVal && sbApiTokenVal) {
    try {
      const url = `https://matrix.sbapis.com/b/instagram/statistics?query=${encodeURIComponent(selectedAccount)}`;
      const res = await axios.get(url, {
        headers: { clientid: sbClientIdVal, token: sbApiTokenVal, "Content-Type": "application/json" },
        timeout: 10000,
      });
      if (res.data?.status?.success && res.data?.data?.statistics?.total) {
        const t = res.data.data.statistics.total;
        const erDecimal = t.engagement_rate ?? 0;
        const er = erDecimal > 0 ? parseFloat((erDecimal * 100).toFixed(2)) : 0;
        const fl = t.followers ?? 0;
        const daily = res.data.data.daily ?? [];
        let al = 0;
        let ac = 0;
        if (daily.length > 0) {
          al = Math.round(daily.reduce((s: number, d: any) => s + (d.avg_likes || 0), 0) / daily.length);
          ac = parseFloat((daily.reduce((s: number, d: any) => s + (d.avg_comments || 0), 0) / daily.length).toFixed(1));
        }
        return {
          hasPosts: false,
          postCount: 0,
          hasAccountMetrics: er > 0 || fl > 0,
          engagementRate: er || undefined,
          followers: fl || undefined,
          avgLikes: al || undefined,
          avgComments: ac || undefined,
        };
      }
    } catch {
      // Continue with empty snapshot
    }
  }

  return empty;
}

// ─── 2. LOGGING & MODE DECISION (NO OpenAI) ─────────────────────────────

async function logSmartChatQuestion(
  db: Firestore,
  params: { userId: string; question: string; detectedIntent: string }
) {
  try {
    await db.collection("smartchat_questions").add({
      question: params.question,
      detected_intent: params.detectedIntent,
      user_id: params.userId,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("smartChatV2: failed to log question", (err as any)?.message || err);
  }
}

async function logSmartChatFailure(
  db: Firestore,
  params: {
    userId: string;
    question: string;
    detectedIntent: string;
    confidenceScore: number;
    responseGenerated: boolean;
  }
) {
  try {
    await db.collection("smartchat_logs").add({
      question: params.question,
      detected_intent: params.detectedIntent,
      confidence_score: params.confidenceScore,
      response_generated: params.responseGenerated,
      user_id: params.userId,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("smartChatV2: failed to log failure", (err as any)?.message || err);
  }
}

const ANALYTICS_POST_THRESHOLD = 5;
const POSTING_TIME_THRESHOLD = 10;

function classifyIntent(message: string): string {
  const m = message.toLowerCase();
  // ─── Community / analytics-knowledge intents (answer from factual block + optional user data) ───
  if (/\breach\s+vs\.?\s+impressions?\b|\bimpressions?\s+vs\.?\s+reach\b|what does reach vs impressions tell|interpret reach and impressions/.test(m)) return "REACH_VS_IMPRESSIONS";
  if (/\bstory\s+analytics\b|story metrics|taps.*exits|exits.*navigation|interpret.*story|story exit rate/.test(m)) return "STORY_ANALYTICS";
  if (/\bsaves?\s+and\s+profile\s+visits?\b|focus on saves|saves vs likes|saves or likes|profile visits vs likes|enough.*likes.*or.*saves/.test(m)) return "SAVES_VS_LIKES";
  if (/\bmetrics?\s+to\s+measure\s+business\b|measure business growth|business growth.*instagram|tie.*engagement.*business|lead signups|outcomes/.test(m)) return "BUSINESS_METRICS";
  if (/\bwhich\s+hashtags?\s+help\b|hashtags?.*help.*reach|hashtags?.*actually\s+help/.test(m)) return "HASHTAG_REACH";
  if (/\bengagement\s+patterns?\s+weekday|weekday.*weekend|weekend.*engagement|different.*weekday/.test(m) && !m.includes("best time")) return "WEEKDAY_WEEKEND";
  if (/\balgorithm\s+changes?\b|content quality|growth slowing|algorithm or content/.test(m)) return "ALGORITHM_VS_CONTENT";
  if (/\buse\s+analytics\s+to\s+test\s+posting\s+times?\b|optimize posting times? using analytics|test posting times/.test(m)) return "POSTING_TIME_TEST";
  if (/\bengagement\s+trends?\s+suggest\b|what do my engagement trends|content strategy.*engagement/.test(m)) return "ENGAGEMENT_TRENDS";
  if (/\breal\s+audience\s+vs\b|random users|real vs random|measure.*real.*audience|interactions.*from\s+real/.test(m)) return "REAL_VS_RANDOM";
  if (/\bgraph\s+api\b|pull.*analytics.*api|instagram.*api.*analytics/.test(m)) return "GRAPH_API";
  if (/\binstagram\s+insights\s+give\b|what metrics.*insights|insights.*actually\s+give/.test(m)) return "INSIGHTS_METRICS";
  if (/\bthird[- ]?party\s+analytics\b|third-party.*vs.*native|compare.*insights.*tools/.test(m)) return "THIRD_PARTY_TOOLS";
  if (/\bhigh\s+engagement\s+but\s+no\s+profile\s+visits\b|why.*profile visits|engagement.*no profile visits/.test(m)) return "PROFILE_VISITS_WHY";

  if (
    m.includes("hashtag") || m.includes("hashtags") || m.includes("tag suggestions") ||
    /\bhashtags?\b/.test(m) || /\btags?\b/.test(m)
  ) return "HASHTAGS";
  // All posting-time / time-slot / weekday / weekend / hour questions → POSTING_TIME
  if (
    m.includes("best time") || m.includes("when to post") ||
    /\bbest\s+time\s+(based|from|for)\b/.test(m) || /\blast\s+\d+\s+posts\b/.test(m) && (m.includes("time") || m.includes("post")) ||
    /night\s+(vs|versus|or)\s*morning|morning\s+(vs|versus|or)\s*night|posting at night|post at night|post at morning/.test(m) ||
    /\bweekday\b/.test(m) && (m.includes("engagement") || m.includes("post") || m.includes("best")) ||
    /\bweekend\b/.test(m) && (m.includes("post") || m.includes("engagement") || m.includes("perform")) ||
    /\bstatistically\s+significant\b/.test(m) || /\bbest\s+posting\s+hour\b/.test(m) ||
    /\blowest\s+engagement\b/.test(m) && (m.includes("slot") || m.includes("time")) ||
    /\b\d+\s*(pm|am)\s+posts?\b/.test(m) || /\bunderperform/.test(m) && (m.includes("post") || m.includes("pm") || m.includes("hour")) ||
    /\bbest\s+posting\s+time\s+changed\b/.test(m) || /\blast\s+\d+\s+months?\b/.test(m) && (m.includes("time") || m.includes("post")) ||
    /\benough\s+data\b/.test(m) && (m.includes("best time") || m.includes("posting time")) ||
    /\bpost\s+more\s+in\s+(the\s+)?afternoon\b/.test(m) || /\btime\s+slot\s+has\s+(the\s+)?lowest\b/.test(m) ||
    m.includes("which weekday") || m.includes("which day") && m.includes("engagement")
  ) return "POSTING_TIME";
  // Content format / post types questions: Reels vs carousels vs static, "what types of posts work best"
  if (
    /\b(types?\s+of\s+posts?|post\s+types?|content\s+types?|content\s+formats?)\b/.test(m) ||
    m.includes("reels vs") ||
    m.includes("reels versus") ||
    m.includes("reel vs") ||
    m.includes("carousel vs") ||
    m.includes("carousel versus") ||
    m.includes("static vs") ||
    m.includes("photo vs") ||
    (m.includes("reels") && (m.includes("carousels") || m.includes("static") || m.includes("photos"))) ||
    (m.includes("which") && m.includes("posts") && m.includes("work best"))
  ) return "CONTENT_FORMAT";
  // Posts per month / posting frequency / average posts
  if (
    m.includes("posts per month") || m.includes("post per month") || m.includes("posting frequency") ||
    m.includes("average number of posts") ||
    (m.includes("how many posts") && (m.includes("month") || m.includes("monthly"))) ||
    m.includes("monthly average") || m.includes("posts in monthly") ||
    (m.includes("analyze") && m.includes("posts") && m.includes("month")) ||
    (m.includes("how often") && m.includes("post")) ||
    (m.includes("how frequently") && m.includes("post")) ||
    (m.includes("how often") && m.includes("should i post")) ||
    (m.includes("how frequently") && m.includes("should i post"))
  ) return "POSTING_FREQUENCY";
  // Follower growth / followers this month (we only have current count, not history)
  if (
    m.includes("followers did i get") || m.includes("followers i got") || m.includes("follower growth") ||
    m.includes("followers this month") || m.includes("gained this month") || m.includes("new followers")
  ) return "FOLLOWERS_GROWTH";
  if (
    /\bwhich\s+posts\s+should\s+i\s+replicate\b/.test(m) ||
    m.includes("which posts should i replicate")
  ) return "REPLICATE_POSTS";
  if (
    m.includes("best post") || m.includes("top post") || m.includes("best performing") ||
    m.includes("top performing") || m.includes("which posts perform") || m.includes("top 10") || m.includes("top 15") ||
    /\btop\s+\d+\s+(post|performing)/.test(m) || /\bbest\s+\d+\s+(post|performing)/.test(m) ||
    m.includes("url of") || m.includes("url for") || m.includes("link to") || m.includes("link of") ||
    (m.includes("url") && (m.includes("post") || m.includes("content")))
  ) return "BEST_POST";
  if (
    m.includes("why") &&
    (m.includes("these") || m.includes("those") || m.includes("top") || m.includes("post") || m.includes("best") || m.includes("performing"))
  ) return "WHY_ABOUT_POSTS";
  if (m.includes("why") || m.includes("not working") || m.includes("not growing") || m.includes("low")) return "DIAGNOSIS";
  if (
    m.includes("grow") || m.includes("increase") || m.includes("improve") ||
    m.includes("ideas") || m.includes("idea") || m.includes("strategy") ||
    m.includes("tips") || m.includes("advice") || m.includes("how to") || m.includes("content ideas")
  ) return "GENERATION";
  if (
    (m.includes("what is my") || m.includes("whats my") || m.includes("my engagement") ||
     m.includes("my followers") || m.includes("how many followers") || m.includes("follower count") ||
     /\bmy\s+(engagement|followers|metrics|stats|numbers)\b/.test(m)) &&
    !m.includes("how to") && !m.includes("increase") && !m.includes("improve")
  ) return "ACCOUNT_METRICS";
  if (
    m.includes("caption") || m.includes("captions") ||
    m.includes("paid post") || m.includes("partnership post") || m.includes("sponsored post") ||
    m.includes("how many paid") || m.includes("how many partnership") || m.includes("how many sponsored") ||
    m.includes("partnership posts") || m.includes("paid posts") || m.includes("sponsored posts") ||
    /\b(caption|captions)\s+(used|in|from)\b/.test(m) || /\bwhat\s+(are|is)\s+the\s+caption/.test(m)
  ) return "CAPTIONS_OR_PAID_POSTS";
  return "GENERATION";
}

/** Extract requested "top N" from message (e.g. "top 15 posts" -> 15). Default 10. */
function parseTopN(message: string): number {
  const m = message.toLowerCase();
  const match = m.match(/\b(?:top|best)\s*(\d+)\s*(?:post|performing)?/i) || m.match(/\b(\d+)\s*(?:best|top)\s*post/i);
  if (match) {
    const n = parseInt(match[1], 10);
    if (n >= 1 && n <= 50) return n;
  }
  return 10;
}

function decideResponseMode(intent: string, snapshot: DataSnapshot): ResponseMode {
  if (intent === "ACCOUNT_METRICS") {
    return snapshot.hasAccountMetrics ? "ANALYTICS" : "LIMITATION";
  }
  if (intent === "FOLLOWERS_GROWTH") return "LIMITATION"; // we only have current follower count, not monthly delta
  if (intent === "POSTING_FREQUENCY") {
    const hasTimestamps = snapshot.posts?.some((p) => p.timestamp != null) ?? false;
    return snapshot.postCount >= 3 && hasTimestamps ? "ANALYTICS" : "LIMITATION";
  }
  if (intent === "CONTENT_FORMAT") {
    const hasPosts = snapshot.posts?.length && snapshot.posts.length >= ANALYTICS_POST_THRESHOLD;
    return hasPosts ? "ANALYTICS" : "LIMITATION";
  }
  const analyticsKnowledgeIntents = [
    "REACH_VS_IMPRESSIONS", "STORY_ANALYTICS", "SAVES_VS_LIKES", "BUSINESS_METRICS", "HASHTAG_REACH",
    "WEEKDAY_WEEKEND", "ALGORITHM_VS_CONTENT", "POSTING_TIME_TEST", "ENGAGEMENT_TRENDS", "REAL_VS_RANDOM",
    "GRAPH_API", "INSIGHTS_METRICS", "THIRD_PARTY_TOOLS", "PROFILE_VISITS_WHY",
  ];
  if (analyticsKnowledgeIntents.includes(intent)) return "STRATEGY";
  if (intent === "GENERATION" || intent === "DIAGNOSIS") return "STRATEGY";
  if (intent === "POSTING_TIME" || intent === "BEST_POST" || intent === "REPLICATE_POSTS" || intent === "HASHTAGS" || intent === "WHY_ABOUT_POSTS" || intent === "CAPTIONS_OR_PAID_POSTS") {
    if (snapshot.postCount === 0) return "LIMITATION";
    const threshold =
      intent === "POSTING_TIME"
        ? POSTING_TIME_THRESHOLD
        : intent === "WHY_ABOUT_POSTS"
        ? 3
        : ANALYTICS_POST_THRESHOLD;
    if (intent === "CAPTIONS_OR_PAID_POSTS" || snapshot.postCount >= threshold) return "ANALYTICS";
    return "LIMITATION";
  }
  return "STRATEGY";
}

// ─── 3. RESPONSE OUTPUT & METADATA ──────────────────────────────────────

function buildLimitationReply(intent: string, snapshot: DataSnapshot, selectedAccount: string): string {
  const count = snapshot.postCount;
  const threshold = intent === "POSTING_TIME" ? POSTING_TIME_THRESHOLD : ANALYTICS_POST_THRESHOLD;
  const shortfall = count > 0 ? `We have ${count} posts but need at least ${threshold} to compare. ` : "";
  const atAccount = selectedAccount ? ` for @${selectedAccount}` : "";
  const stepAnalytics = selectedAccount
    ? `Go to **Instagram Analytics**, enter **@${selectedAccount}**, click **Analyze**, then come back and ask again.`
    : "Go to **Instagram Analytics**, add your Instagram username, click **Analyze**, then come back and ask again.";
  const stepChat = " Or in this chat you can say **analyze 30 posts** (or **analyze 50 posts**) to fetch and store posts, then ask again.";

  const lines: string[] = [];
  if (intent === "POSTING_TIME") {
    lines.push("We checked posting times across your recent posts.");
    lines.push("");
    lines.push(`${shortfall}We couldn't determine best time because we ${count === 0 ? "have no posts with timestamps to compare" : "don't have enough varied time slots yet"}.`);
    lines.push("");
    lines.push(`To get this answer: ${stepAnalytics}${stepChat}`);
  } else if (intent === "BEST_POST" || intent === "WHY_ABOUT_POSTS") {
    lines.push("We checked your posts for likes and comments.");
    lines.push("");
    lines.push(`${shortfall}We couldn't determine which content performs best because we ${count === 0 ? "have no posts stored yet" : "need more posts to compare"}.`);
    lines.push("");
    lines.push(`To get this answer: ${stepAnalytics}${stepChat}`);
  } else if (intent === "HASHTAGS") {
    lines.push("We checked your posts for captions and hashtags.");
    lines.push("");
    lines.push(`${shortfall}We couldn't analyze hashtags because we ${count === 0 ? "have no posts with captions yet" : "need more posts with hashtags to compare"}.`);
    lines.push("");
    lines.push(`To get this answer: ${stepAnalytics} Add hashtags to your captions, run the analysis again, then ask again.`);
  } else if (intent === "ACCOUNT_METRICS") {
    lines.push("We checked your account for engagement and follower data.");
    lines.push("");
    lines.push(`We couldn't find metrics${atAccount} yet.`);
    lines.push("");
    lines.push(`To get this answer: ${stepAnalytics}`);
  } else if (intent === "CAPTIONS_OR_PAID_POSTS") {
    lines.push("We checked your stored posts for captions and partnership/paid indicators.");
    lines.push("");
    lines.push(`${shortfall}We couldn't answer because we ${count === 0 ? "have no posts stored yet" : "need posts with captions"}.`);
    lines.push("");
    lines.push(`To get this answer: ${stepAnalytics}`);
  } else if (intent === "POSTING_FREQUENCY") {
    lines.push("We checked your posts for timestamps to compute monthly averages.");
    lines.push("");
    if (count === 0) {
      lines.push("We have no posts stored yet, so we can't compute a monthly average.");
    } else if (count <= 2) {
      lines.push(`We only have ${count} post${count === 1 ? "" : "s"} in your analyzed data—not enough to compute a monthly average.`);
      lines.push("");
      lines.push("Try asking me to **analyze 50 posts** (or **analyze 30 posts**) in this chat. That will fetch and store more posts; then ask again for your average posts per month.");
    } else {
      lines.push("We don't have enough posts with dates in the data we have to compute a reliable monthly average.");
      lines.push("");
      lines.push(`We have ${count} posts; once more posts with dates are available in your analyzed data, we can give you the exact average.`);
    }
  } else if (intent === "FOLLOWERS_GROWTH") {
    const current = snapshot.followers != null ? ` Your current follower count is ${snapshot.followers.toLocaleString()}.` : "";
    lines.push("We only store your current follower count, not day-by-day or month-by-month history.");
    lines.push("");
    lines.push(`So we can't tell you how many followers you gained this month.${current}`);
    lines.push("");
    lines.push("To track follower growth over time, use Instagram Insights or a tool that stores historical follower data.");
  } else {
    lines.push("We checked your account.");
    lines.push("");
    lines.push(`We couldn't answer your question because the required data is missing${atAccount}.`);
    lines.push("");
    lines.push(`To get this answer: ${stepAnalytics}${stepChat}`);
  }
  return lines.join("\n");
}

type ConfidenceLevel = "High" | "Medium" | "Low";

function computeConfidence(snapshot: DataSnapshot): {
  postsAnalyzed: number;
  score: number;
  level: ConfidenceLevel;
} {
  const postsAnalyzed = snapshot.postCount || 0;
  const scoreRaw = Math.max(0, Math.min(1, postsAnalyzed / 50));
  let level: ConfidenceLevel = "Low";
  if (scoreRaw > 0.7) level = "High";
  else if (scoreRaw >= 0.4) level = "Medium";
  return { postsAnalyzed, score: scoreRaw, level };
}

const QUESTION_POOLS: Record<string, string[]> = {
  HASHTAGS: [
    "Which hashtags appear most often in my top posts?",
    "Which hashtag sets drive the highest engagement?",
    "How many hashtags work best in my top posts?",
    "Do posts with more hashtags perform better?",
    "Which hashtags should I reuse?",
  ],
  POSTING_TIME: [
    "Which posting hour gives me the highest engagement?",
    "Do weekend posts perform differently than weekday posts?",
    "Which time slots should I avoid based on low engagement?",
    "What is the best time window for Reels?",
    "Are evening posts performing better than morning posts for me?",
  ],
  BEST_POST: [
    "Which posts had the highest engagement in the last 30 posts?",
    "Which reels drove the most engagement recently?",
    "What patterns exist in my top performing posts?",
    "Which posts should I replicate based on performance?",
    "Which formats appear most often in my top posts?",
  ],
  CONTENT_FORMAT: [
    "Do Reels, carousels, or static posts work best for me?",
    "How do carousels perform compared to Reels?",
    "What posting mix should I use between Reels and carousels?",
    "Are Reels driving more reach than other formats?",
    "Which format brings the most saves per post?",
  ],
  POSTING_FREQUENCY: [
    "How many posts per week do I publish on average?",
    "Does posting more often increase or decrease engagement per post?",
    "What weekly posting cadence should I test next?",
    "What happens to engagement when I post less frequently?",
    "How many posts per month do my best weeks include?",
  ],
  ACCOUNT_METRICS: [
    "What is my engagement rate and average likes per post?",
    "How many posts were analyzed in my recent data?",
    "How does my engagement compare across different content formats?",
    "How does my current engagement compare to my past average?",
    "Which metric should I focus on improving first?",
  ],
  WHY_ABOUT_POSTS: [
    "Which posts should I replicate based on performance?",
    "Which hashtags appear in those top posts?",
    "Do those top posts share a common posting time window?",
    "Do my top posts share a similar caption style?",
    "How does engagement on those posts compare to my account average?",
  ],
  REPLICATE_POSTS: [
    "Why did those top posts perform well based on the numbers?",
    "Which hashtags are common across the posts I should replicate?",
    "Which posting time window is most common among those posts?",
    "What caption length do those posts tend to use?",
    "Which content format is most common among the posts to replicate?",
  ],
  DEFAULT: [
    "Which posts performed best in my recent analytics?",
    "Which reels drove the most engagement recently?",
    "Which hashtags appear most often in my highest engagement posts?",
    "What is the best time to post based on my data?",
    "Which content format is performing best for me?",
  ],
};

function normalizeQuestionText(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSuggestionsForIntent(
  intent: string,
  currentQuestion: string,
  conversationHistory?: Array<{ role: string; content: string }>
): string[] {
  const pool = QUESTION_POOLS[intent] || QUESTION_POOLS.DEFAULT;
  const normalizedCurrent = normalizeQuestionText(currentQuestion);

  const recentUserQuestions: string[] = conversationHistory
    ? conversationHistory
        .filter((m) => m && typeof m.role === "string" && m.role === "user" && typeof m.content === "string")
        .map((m) => String(m.content))
        .slice(-5)
    : [];

  const recentSet = new Set(recentUserQuestions.map((q) => normalizeQuestionText(q)));

  let filtered = pool.filter((q) => {
    const n = normalizeQuestionText(q);
    if (!n) return false;
    if (n === normalizedCurrent) return false;
    if (recentSet.has(n)) return false;
    return true;
  });

  if (filtered.length < 3) {
    filtered = pool.filter((q) => normalizeQuestionText(q) !== normalizedCurrent);
    if (filtered.length === 0) filtered = pool;
  }

  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

function buildInsightForIntent(intent: string, snapshot: DataSnapshot): string {
  const posts = snapshot.postCount || 0;
  const er = snapshot.engagementRate;
  if (intent === "CONTENT_FORMAT") {
    return "Prioritize your strongest-performing content format from this analysis and post 2–3 more pieces in that format this week to compare engagement.";
  }
  if (intent === "POSTING_TIME") {
    return "Use the best-performing posting window from this analysis for your next 3–5 posts and compare saves and profile visits against other time slots.";
  }
  if (intent === "BEST_POST" || intent === "REPLICATE_POSTS") {
    return "Create 2–3 new posts modeled closely on your top performers from this analysis and compare engagement and saves against your average.";
  }
  if (intent === "HASHTAGS") {
    return "Reuse the hashtag combinations that appear in your top-performing posts for your next few uploads and compare reach and saves.";
  }
  if (intent === "ACCOUNT_METRICS") {
    if (er != null && posts > 0) {
      return `Use your current engagement rate of ${er}% as a baseline and track how it moves as you test new formats and posting times over the next ${Math.min(
        30,
        posts
      )} posts.`;
    }
    return "Run a fresh Instagram Analytics scan so future SmartChat answers can tie metrics like engagement rate and reach directly to your recent posts.";
  }
  if (intent === "POSTING_FREQUENCY") {
    return "Stick to the suggested weekly posting cadence for the next few weeks and compare total weekly engagement versus your current average.";
  }
  if (intent === "WHY_ABOUT_POSTS") {
    return "Take the numeric differences SmartChat highlighted between your top posts and test at least two new posts that copy those patterns to see if results repeat.";
  }
  return "Use the specific metrics in this answer to design a small, 3–5 post experiment and compare engagement before changing your entire content strategy.";
}

function buildStrategyDataBlock(snapshot: DataSnapshot, selectedAccount: string): string {
  if (!snapshot.hasAccountMetrics) {
    return "Account data: Not available. User has not run Instagram Analytics yet.";
  }
  const parts: string[] = [
    `Account: @${selectedAccount}`,
    `Followers: ${snapshot.followers ?? "unknown"}`,
    `Engagement rate: ${snapshot.engagementRate ?? "unknown"}%`,
    `Posts analyzed: ${snapshot.postCount}`,
    `Avg likes per post: ${snapshot.avgLikes ?? "unknown"}`,
    `Avg comments per post: ${snapshot.avgComments ?? "unknown"}`,
  ];
  return "Account data (use these numbers to tailor your advice):\n" + parts.join("\n");
}

/** Factual, data-based answers for community-style analytics questions. Used to keep SmartChat accurate and consistent. */
function getAnalyticsKnowledgeBlock(intent: string): string {
  const blocks: Record<string, string> = {
    REACH_VS_IMPRESSIONS:
      "Reach = unique accounts that saw the post. Impressions = total number of times it was seen (repeat views count). If impressions are much higher than reach, the same people are seeing it multiple times (good for recall; can mean you are not reaching new people). Compare reach and impressions per format (Reels vs carousels vs single image) to see which expands audience vs which gets repeat views.",
    STORY_ANALYTICS:
      "Taps forward = next (people skipping). Exits = left Stories. Replies = direct engagement. High exit rate on a specific Story = drop-off point; test different content or length there. Compare exit rate by position (e.g. Story 1 vs 5) to see where you lose people; use that to decide length and order.",
    SAVES_VS_LIKES:
      "Likes and comments = engagement signal. Saves = intent to return or perceived value. Profile visits = interest in you, not just one post. For growth and algorithm, saves and profile visits often correlate more with reach over time than likes alone. Compare in your own data: posts with high saves vs high likes; if high-save posts get more reach in the next days, prioritize content that gets saved.",
    BUSINESS_METRICS:
      "Awareness: reach, impressions, non-follower reach. Consideration: profile visits, website clicks, DMs, saves. Conversion: track link clicks, promo codes, or UTM to sales or signups. Tie to business by defining one primary outcome (e.g. link clicks or signups) and see which content types and time windows drive that metric in Insights.",
    HASHTAG_REACH:
      "In Insights, check Reach or Accounts reached by post; note which posts used which hashtags. Compare same format and similar content with different hashtag sets: which had higher reach? Repeating the same hashtags across many posts and comparing reach over time shows if they are still working or saturated.",
    WEEKDAY_WEEKEND:
      "Audiences behave differently on weekdays vs weekends. Use your data: group posts by weekday vs weekend and compare avg engagement (or reach) per post. If weekend posts consistently underperform, that is a data-backed pattern; then test content type or time on weekends. If you have analyzed posts, we can compare weekday vs weekend from your stored data.",
    ALGORITHM_VS_CONTENT:
      "You cannot isolate algorithm directly; you can test content and consistency. Compare: (1) your posting frequency and format mix over the last 3 months, (2) reach and engagement trends. If you posted less or changed format mix when growth slowed, that is a candidate cause. Run controlled tests: same format and style, different times or hashtags, and see if reach or engagement change.",
    POSTING_TIME_TEST:
      "Export or use last 30+ posts with timestamps; group by hour or time slot (e.g. morning, afternoon, evening). For each slot compute avg engagement (or reach) per post and number of posts. Best time = slot with highest avg performance and enough posts (e.g. 5+) to be meaningful. In this chat you can ask for best posting time and we use your analyzed posts to compute time slots.",
    ENGAGEMENT_TRENDS:
      "Plot engagement rate (or reach) over time by week. If rising: keep format and posting rhythm. If falling: check frequency, format mix, and whether recent posts underperform by format. Compare engagement by format over time to see if one format is trending up or down.",
    REAL_VS_RANDOM:
      "Follower vs non-follower: in Insights, Accounts reached often breaks down followers vs non-followers. Quality of engagement: profile visits and saves are stronger intent than one-off likes from Explore. Compare % of reach from followers and ratio of saves (or profile visits) to likes; if many likes but few saves or profile visits, a larger share may be casual viewers.",
    GRAPH_API:
      "Instagram Graph API is only available for Business or Creator accounts connected to a Facebook App. Metrics (e.g. insights on reach, impressions, engagement) depend on the endpoint and permissions (e.g. instagram_business_insights). Official docs: developers.facebook.com/docs/instagram-api; use the Insights endpoints for the metrics you need.",
    INSIGHTS_METRICS:
      "Account: reach, impressions, profile visits, website clicks, follower count and growth. Per post: reach, impressions, likes, comments, saves, shares, profile visits, follows (for some surfaces). Stories: reach, impressions, exits, replies, navigation (forward/back). Reels: plays (views), reach, likes, comments, saves, shares. Native Insights does not give unlimited historical export; third-party tools often aggregate and retain history.",
    THIRD_PARTY_TOOLS:
      "Native Insights: free, official, but limited history and no cross-account comparison. Third-party: often longer history, benchmarking, scheduling, and sometimes estimated or scraped metrics (e.g. reach when API does not expose it). Compare on: (1) which metrics they show, (2) whether data is from API vs scraping, (3) retention and export. For strict accuracy, prefer tools that use the official API where possible.",
    PROFILE_VISITS_WHY:
      "High engagement (likes, comments) with low profile visits usually means the content was engaging in-feed but did not create a who is this moment. Common pattern: entertaining Reels get lots of engagement from non-followers; educational or clearly you content gets more profile visits. In your analytics, compare profile visits per post type and caption style to see what drives visits.",
  };
  return blocks[intent] || "";
}

function buildAnalyticsContext(snapshot: DataSnapshot, selectedAccount: string, requestedTopN: number = 10): string {
  // Prefer a days-based label when available (from analytics metadata), otherwise
  // fall back to a simple "last N posts" description.
  const windowLabel =
    snapshot.dataWindowMode === "days" && snapshot.dataWindowLabel
      ? `posts from the last ${snapshot.dataWindowLabel}`
      : `your last ${snapshot.postCount} posts`;

  const parts: string[] = [
    `Account: @${selectedAccount}`,
    `Data analyzed: ${windowLabel}.`,
    "",
    "FACTS (numbers only):",
    `- Followers: ${snapshot.followers ?? "unknown"}`,
    `- Engagement rate: ${snapshot.engagementRate ?? "unknown"}%`,
    `- Avg likes per post: ${snapshot.avgLikes ?? "unknown"}`,
    `- Avg comments per post: ${snapshot.avgComments ?? "unknown"}`,
  ];
  if (snapshot.posts && snapshot.posts.length > 0) {
    const truncate = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max) + "...");
    const summaries = snapshot.posts.map((p, i) => {
      const likes = p.likesCount ?? 0;
      const comments = p.commentsCount ?? 0;
      const hour = p.timestamp ? new Date(p.timestamp * 1000).getUTCHours() : null;
      const caption = p.caption ?? "";
      const tags = caption.match(/#\w+/g) || [];
      const dateStr = p.timestamp ? new Date(p.timestamp * 1000).toISOString().slice(0, 10) : null;
      return {
        n: i + 1,
        likes,
        comments,
        engagement: likes + comments,
        hour,
        hashtags: tags.slice(0, 5),
        url: p.url || null,
        caption: truncate(caption, 400),
        date: dateStr,
      };
    });
    // Pre-sort by engagement; include up to requestedTopN (e.g. 15 when user asks "top 15")
    const topN = Math.min(requestedTopN, summaries.length);
    const topByEngagement = [...summaries].sort((a, b) => b.engagement - a.engagement).slice(0, topN)
      .map((p, i) => ({ rank: i + 1, ...p }));
    parts.push("", `TOP_POSTS_BY_ENGAGEMENT (use this exact order for 'top N' lists—already sorted by engagement; we have ${topByEngagement.length} here, list all when user asks for top N):`);
    parts.push(JSON.stringify(topByEngagement, null, 2));
    // Posts per month (for POSTING_FREQUENCY intent)
    const withDate = summaries.filter((s) => s.date);
    if (withDate.length >= 3) {
      const byMonth: Record<string, number> = {};
      withDate.forEach((s) => {
        const month = (s.date as string).slice(0, 7);
        byMonth[month] = (byMonth[month] || 0) + 1;
      });
      const months = Object.keys(byMonth).sort();
      const totalPosts = withDate.length;
      const numMonths = months.length || 1;
      const avgPerMonth = (totalPosts / numMonths).toFixed(1);
      parts.push("", "POSTS_PER_MONTH (for posting frequency / monthly average questions):");
      parts.push(JSON.stringify({ byMonth: byMonth, totalPostsWithDate: totalPosts, monthsCovered: numMonths, averagePostsPerMonth: avgPerMonth }, null, 2));
    }
    parts.push("", "Post-level data (POSTING_TIME: use hour; HASHTAGS: use hashtags; CAPTIONS/PAID: use caption and date). When listing top posts, use TOP_POSTS_BY_ENGAGEMENT order. For 'how many paid/partnership posts': count posts where caption contains words like 'sponsored', 'paid', 'partnership', 'collab', '#ad', 'ad', 'paid partnership'. For 'what captions in last N days': filter by date and list the caption text.");
    parts.push(JSON.stringify(summaries, null, 0));
  }
  parts.push(
    "",
    "LOCK: Use ONLY these numbers. Never invent, diagnose, or guess.",
    "RESPONSE FORMAT (required — use these section headers WITHOUT numbers and WITHOUT any leading '#', '##', or '###' markdown):",
    "DATA ANALYZED: [what we checked]",
    "FACTS (numbers only): [metrics; when referencing specific posts, use the post format below]",
    "WHAT CANNOT BE CONCLUDED: [limitations if any]",
    "NEXT STEP: [clear and testable]",
    "",
    "POST LIST FORMAT (required when listing individual posts — use this EXACT structure for EACH post):",
    "For every post you list, output exactly 5 lines in this order:",
    "  Line 1: [View Content](POST_URL) — the ONLY link for this post; link text must be exactly 'View Content'.",
    "  Line 2: Likes: [number]",
    "  Line 3: Comments: [number]",
    "  Line 4: Engagement: [number]",
    "  Line 5: Caption: [caption as plain text only — no link, no markdown link around the caption]",
    "Example for one post (copy this structure):",
    "1. [View Content](https://www.instagram.com/p/ABC123/)",
    "Likes: 1000",
    "Comments: 50",
    "Engagement: 1050",
    "Caption: The gradient on Mount Nuptse was unreal, the best sunset I've ever seen!",
    "BANNED: Never write the caption as a link. Never output [caption text](url) or [post description](url). The caption must appear only after 'Caption:' as plain text. There must be a separate 'View Content' link; Caption is a 4th metric line (like Likes, Comments, Engagement), not a link.",
    "",
    "CRITICAL: Do NOT put numbers before DATA ANALYZED, FACTS, WHAT CANNOT BE CONCLUDED, or NEXT STEP. For sub-lists (e.g. top posts), number each post in order: 1., 2., 3., ... up to N. If user asked for 30 posts, output 1. through 30. Never repeat 1. for every post.",
    "COMPLETENESS: Always finish your response. If listing posts, either list every one OR cap at 10 and say 'Top 10 of X posts'. Never truncate mid-list.",
    "We analyze 30 posts by default. In NEXT STEP, add: 'Want more posts? Just say e.g. analyze 50 posts or analyze 100 posts—it will take longer but we will fetch and analyze them.'",
    "NEVER use: typically, usually, generally, best practices, your content isn't compelling.",
    "ALWAYS use: Based on your last X posts, Your data shows, We couldn't determine X because, To validate this, do Y."
  );
  return parts.join("\n");
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** Strip markdown heading hashes (# ## ###) from the start of lines so they never appear in the UI. */
function stripMarkdownHeadings(text: string): string {
  if (!text || typeof text !== "string") return text;
  // Strip leading #+ at line start (e.g. "### 2. Carousels" -> "2. Carousels")
  let out = text.replace(/^\s*#+\s*/gm, "");
  // Strip #+ that appears after leading ** (e.g. "**### 2. Carousels**" -> "**2. Carousels**")
  out = out.replace(/^(\s*\*\*)#+\s*/gm, "$1");
  return out.trim();
}

// ─── 4. FORMAT & FREQUENCY ANALYSIS HELPERS (DETERMINISTIC, NO OPENAI) ─────

type NormalizedFormat = "Reels" | "Carousels" | "Static";

interface FormatAggregate {
  format: NormalizedFormat;
  count: number;
  avgReach: number | null;
  avgEngagementRate: number | null;
  avgSaves: number | null;
   // For Reels: average views; null for others
  avgViews: number | null;
}

function classifyPostFormat(post: Post): NormalizedFormat {
  const t = (post.type || "").toLowerCase();
  // Carousel/sidecar/album first (multi-slide content)
  if (t.includes("carousel") || t.includes("sidecar") || t.includes("album")) return "Carousels";
  // Reels: explicit reel type, any video type (Video, GraphVideo, etc.), or isVideo flag from scraper
  if (t.includes("reel") || t.includes("video") || t.includes("graphvideo") || post.isVideo === true) return "Reels";
  return "Static";
}

function pctDiff(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || b === 0) return null;
  return parseFloat((((a - b) / b) * 100).toFixed(1));
}

function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "N/A";
  return Math.round(value).toLocaleString();
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "N/A";
  return `${parseFloat(value.toFixed(1))}%`;
}

function analyzeFormats(snapshot: DataSnapshot): { formats: FormatAggregate[]; baseFormat: NormalizedFormat | null; totalPosts: number } | null {
  const posts = snapshot.posts;
  if (!posts || posts.length < 5) return null;

  // Use last 30 posts (or fewer if less available)
  const sorted = [...posts].sort((a, b) => {
    const ta = a.timestamp ?? 0;
    const tb = b.timestamp ?? 0;
    return ta - tb;
  });
  const window = sorted.slice(-30);
  if (window.length < 5) return null;

  const totals: Record<NormalizedFormat, { posts: number; reachSum: number; reachCount: number; erSum: number; erCount: number; savesSum: number; savesCount: number; viewsSum: number; viewsCount: number }> = {
    Reels: { posts: 0, reachSum: 0, reachCount: 0, erSum: 0, erCount: 0, savesSum: 0, savesCount: 0, viewsSum: 0, viewsCount: 0 },
    Carousels: { posts: 0, reachSum: 0, reachCount: 0, erSum: 0, erCount: 0, savesSum: 0, savesCount: 0, viewsSum: 0, viewsCount: 0 },
    Static: { posts: 0, reachSum: 0, reachCount: 0, erSum: 0, erCount: 0, savesSum: 0, savesCount: 0, viewsSum: 0, viewsCount: 0 },
  };

  const followers = snapshot.followers && snapshot.followers > 0 ? snapshot.followers : null;

  window.forEach((p) => {
    const format = classifyPostFormat(p);
    const likes = p.likesCount ?? 0;
    const comments = p.commentsCount ?? 0;
    const engagement = likes + comments;
    const reach = typeof p.reach === "number" && p.reach > 0 ? p.reach : typeof p.impressions === "number" && p.impressions > 0 ? p.impressions : null;
    const saves = typeof p.savesCount === "number" && p.savesCount >= 0 ? p.savesCount : null;
    const views = typeof p.viewsCount === "number" && p.viewsCount > 0 ? p.viewsCount : null;

    totals[format].posts += 1;
    if (reach != null) {
      totals[format].reachSum += reach;
      totals[format].reachCount += 1;
    }
    if (followers && followers > 0 && engagement > 0) {
      const er = (engagement / followers) * 100;
      totals[format].erSum += er;
      totals[format].erCount += 1;
    }
    if (saves != null) {
      totals[format].savesSum += saves;
      totals[format].savesCount += 1;
    }
    if (views != null) {
      totals[format].viewsSum += views;
      totals[format].viewsCount += 1;
    }
  });

  // Always return all three formats (include 0-post formats so Reels/Carousels/Static always appear)
  const formats: FormatAggregate[] = (["Reels", "Carousels", "Static"] as NormalizedFormat[]).map((f) => {
    const t = totals[f];
    const avgReach = t.reachCount > 0 ? t.reachSum / t.reachCount : null;
    const avgEng =
      t.posts > 0 && followers && followers > 0
        ? t.erCount > 0
          ? t.erSum / t.erCount
          : 0
        : null;
    const avgSaves = t.savesCount > 0 ? t.savesSum / t.savesCount : null;
    const avgViews = t.viewsCount > 0 ? t.viewsSum / t.viewsCount : null;
    return {
      format: f,
      count: t.posts,
      avgReach,
      avgEngagementRate: avgEng,
      avgSaves,
      avgViews,
    };
  });

  const base = formats.find((f) => f.format === "Static" && f.count > 0) ? "Static" : formats.find((f) => f.count > 0)?.format ?? "Static";
  return { formats, baseFormat: base, totalPosts: window.length };
}

function buildFormatPerformanceReply(snapshot: DataSnapshot): string {
  const analysis = analyzeFormats(snapshot);
  if (!analysis) {
    return "Insufficient historical data to compute reliable recommendation.";
  }
  const { formats, baseFormat, totalPosts } = analysis;

  const base = baseFormat ? formats.find((f) => f.format === baseFormat) || null : null;

  const lines: string[] = [];
  lines.push(`Format Performance Analysis (Last ${totalPosts} Posts)`);
  lines.push("");

  formats.forEach((f) => {
    const reachAdv =
      base && f.format !== base.format && f.avgReach != null && base.avgReach != null
        ? pctDiff(f.avgReach, base.avgReach)
        : null;
    lines.push(`${f.format}${f.count === 0 ? " (0 posts in sample)" : ""}:`);
    lines.push(`- Posts in sample: ${f.count}`);
    // For Reels, use views when available instead of reach
    if (f.format === "Reels") {
      if (f.avgViews != null) {
        lines.push(`- Avg Views: ${formatNumber(f.avgViews)}`);
      }
    } else {
      lines.push(`- Avg Reach: ${formatNumber(f.avgReach)}`);
    }
    lines.push(`- Avg Engagement Rate: ${formatPercent(f.avgEngagementRate)}`);
    lines.push(`- Avg Saves: ${formatNumber(f.avgSaves)}`);
    if (f.format === "Static" || reachAdv == null) {
      lines.push(`- % Advantage vs Static: N/A`);
    } else {
      const sign = reachAdv >= 0 ? "+" : "";
      lines.push(`- % Advantage vs Static: ${sign}${reachAdv}%`);
    }
    lines.push("");
  });

  // Rankings (use engagement rate when reach/saves missing)
  const byReach = [...formats].filter((f) => f.avgReach != null && f.count > 0).sort((a, b) => (b.avgReach! - a.avgReach!));
  const bySaves = [...formats].filter((f) => f.avgSaves != null && f.count > 0).sort((a, b) => (b.avgSaves! - a.avgSaves!));
  const byEr = [...formats].filter((f) => f.count > 0 && (f.avgEngagementRate != null || f.avgEngagementRate === 0)).sort((a, b) => (b.avgEngagementRate ?? -1) - (a.avgEngagementRate ?? -1));

  function orderToString(list: FormatAggregate[]): string {
    if (list.length === 0) return "No data in dataset.";
    return list.map((f, idx) => `${idx + 1}. ${f.format}`).join("  ");
  }

  const hasReachOrSaves = byReach.length > 0 || bySaves.length > 0;

  lines.push("Recommendation");
  if (!hasReachOrSaves && byEr.length > 0) {
    lines.push("(Reach and saves are not in the analyzed dataset; ranking uses engagement rate only.)");
  }
  lines.push(`- Growth (reach): ${orderToString(byReach)}`);
  lines.push(`- Retention (saves): ${orderToString(bySaves)}`);
  lines.push(`- Engagement rate: ${orderToString(byEr)}`);

  // Allocation: use engagement-rate order when reach/saves missing; only allocate among formats that have posts
  const formatsWithPosts = formats.filter((f) => f.count > 0);
  const alloc: Record<NormalizedFormat, number> = { Reels: 0, Carousels: 0, Static: 0 };
  if (formatsWithPosts.length === 1) {
    alloc[formatsWithPosts[0].format] = 100;
  } else if (formatsWithPosts.length === 2) {
    const primary = byEr[0]?.format ?? formatsWithPosts[0].format;
    const secondary = formatsWithPosts.find((f) => f.format !== primary)!.format;
    alloc[primary] = 70;
    alloc[secondary] = 30;
  } else if (formatsWithPosts.length === 3) {
    const primary = byEr[0]?.format ?? "Reels";
    const secondary = byEr[1]?.format ?? "Carousels";
    const tertiary = (["Reels", "Carousels", "Static"] as NormalizedFormat[]).find((f) => f !== primary && f !== secondary)!;
    alloc[primary] = 60;
    alloc[secondary] = 30;
    alloc[tertiary] = 10;
  }
  // If a format has 0 posts, show 0% and note it
  const reelsNote = formats.find((f) => f.format === "Reels")?.count === 0 ? " (0% — no Reels in sample)" : "";
  const carouselsNote = formats.find((f) => f.format === "Carousels")?.count === 0 ? " (0% — no Carousels in sample)" : "";
  const staticNote = formats.find((f) => f.format === "Static")?.count === 0 ? " (0% — no Static in sample)" : "";

  lines.push("");
  lines.push(
    `- If goal = Growth → ${alloc.Reels}% Reels${reelsNote}, ${alloc.Carousels}% Carousels${carouselsNote}, ${alloc.Static}% Static${staticNote}`
  );
  lines.push(
    `- If goal = Authority → ${alloc.Carousels}% Carousels, ${alloc.Reels}% Reels, keep Static at ${alloc.Static}%.`
  );
  lines.push(`- Static limited to ${alloc.Static}% of total output.`);

  return lines.join("\n");
}

// ─── 5. PATTERN ANALYSIS FOR REPLICATION (TOP POSTS) ────────────────────────

type PostTypeBucket = "reel" | "image" | "carousel" | "other";

interface ReplicationPostSummary {
  url: string | null;
  type: PostTypeBucket;
  captionPreview: string;
  engagement: number;
  likes: number;
  comments: number;
  engagementRate?: number | null;
}

interface ReplicationPatterns {
  top_content_type: PostTypeBucket | null;
  reels_share_pct: number | null;
  best_posting_time_range: string | null;
  average_caption_length_words: number | null;
  average_hashtag_count: number | null;
  explanation: string;
}

interface ReplicationInsight {
  top_posts: ReplicationPostSummary[];
  patterns: ReplicationPatterns;
  recommendation: string;
}

function normalizePostType(p: Post): PostTypeBucket {
  const t = (p.type || "").toLowerCase();
  if (t.includes("reel") || p.isVideo) return "reel";
  if (t.includes("carousel") || t.includes("sidecar") || t.includes("album")) return "carousel";
  if (t.includes("image") || t.includes("photo")) return "image";
  return "other";
}

function bucketHourToRange(hour: number | null): string | null {
  if (hour == null || Number.isNaN(hour)) return null;
  if (hour >= 6 && hour < 12) return "6–12 (Morning)";
  if (hour >= 12 && hour < 18) return "12–18 (Afternoon)";
  if (hour >= 18 && hour < 22) return "18–22 (Evening)";
  if (hour >= 22 || hour < 2) return "22–2 (Late Night)";
  return "2–6 (Night)";
}

function buildReplicationInsight(snapshot: DataSnapshot): ReplicationInsight | null {
  if (!snapshot.posts || snapshot.posts.length === 0) return null;

  const followers = snapshot.followers && snapshot.followers > 0 ? snapshot.followers : null;

  const postsWithEngagement = snapshot.posts.map((p) => {
    const likes = p.likesCount ?? 0;
    const comments = p.commentsCount ?? 0;
    const engagement = likes + comments;
    const hour = p.timestamp != null ? new Date(p.timestamp * 1000).getHours() : null;
    const caption = (p.caption || "").trim();
    const hashtags = caption.match(/#\w+/g) || [];
    const words = caption.length ? caption.split(/\s+/).filter(Boolean) : [];
    const engagementRate =
      followers && followers > 0 && engagement > 0
        ? parseFloat(((engagement / followers) * 100).toFixed(2))
        : null;
    return {
      raw: p,
      likes,
      comments,
      engagement,
      hour,
      caption,
      hashtagsCount: hashtags.length,
      wordsCount: words.length,
      engagementRate,
    };
  });

  if (postsWithEngagement.length === 0) return null;

  const sortedByRate = [...postsWithEngagement].sort((a, b) => {
    const erA = a.engagementRate ?? 0;
    const erB = b.engagementRate ?? 0;
    if (erA === erB) return b.engagement - a.engagement;
    return erB - erA;
  });

  const top10 = sortedByRate.slice(0, 10);
  const top3 = top10.slice(0, 3);

  const summarizeCaption = (caption: string): string => {
    if (!caption) return "";
    const clean = caption.replace(/\s+/g, " ").trim();
    if (clean.length <= 120) return clean;
    return clean.slice(0, 117) + "...";
  };

  const topPosts: ReplicationPostSummary[] = top3.map((p) => ({
    url: p.raw.url || null,
    type: normalizePostType(p.raw),
    captionPreview: summarizeCaption(p.caption),
    engagement: p.engagement,
    likes: p.likes,
    comments: p.comments,
    engagementRate: p.engagementRate,
  }));

  const typeCounts: Record<PostTypeBucket, number> = { reel: 0, image: 0, carousel: 0, other: 0 };
  const hourRangeCounts: Record<string, number> = {};
  let captionWordsSum = 0;
  let captionCount = 0;
  let hashtagSum = 0;
  let hashtagCount = 0;

  top10.forEach((p) => {
    const t = normalizePostType(p.raw);
    typeCounts[t] += 1;
    const range = bucketHourToRange(p.hour);
    if (range) {
      hourRangeCounts[range] = (hourRangeCounts[range] || 0) + 1;
    }
    if (p.wordsCount > 0) {
      captionWordsSum += p.wordsCount;
      captionCount += 1;
    }
    hashtagSum += p.hashtagsCount;
    hashtagCount += 1;
  });

  const reelsSharePct =
    top10.length > 0 ? parseFloat(((typeCounts.reel / top10.length) * 100).toFixed(1)) : null;

  const topContentType: PostTypeBucket | null = (Object.entries(typeCounts) as [PostTypeBucket, number][])
    .sort((a, b) => b[1] - a[1])[0]?.[1]
    ? (Object.entries(typeCounts) as [PostTypeBucket, number][]).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  const bestTimeRange =
    Object.keys(hourRangeCounts).length > 0
      ? Object.entries(hourRangeCounts).sort((a, b) => b[1] - a[1])[0][0]
      : null;

  const avgCaptionWords =
    captionCount > 0 ? parseFloat((captionWordsSum / captionCount).toFixed(1)) : null;
  const avgHashtags =
    hashtagCount > 0 ? parseFloat((hashtagSum / hashtagCount).toFixed(1)) : null;

  const patternLines: string[] = [];
  if (topContentType) {
    const label =
      topContentType === "reel"
        ? "Reels"
        : topContentType === "carousel"
        ? "carousels"
        : topContentType === "image"
        ? "image posts"
        : "posts";
    patternLines.push(`Most of your top posts are ${label}.`);
  }
  if (reelsSharePct != null && reelsSharePct >= 60) {
    patternLines.push(`About ${reelsSharePct}% of your top posts are Reels.`);
  }
  if (bestTimeRange) {
    patternLines.push(`Top posts cluster around the ${bestTimeRange} window.`);
  }
  if (avgCaptionWords != null) {
    const captionStyle =
      avgCaptionWords <= 12
        ? "short"
        : avgCaptionWords <= 25
        ? "medium-length"
        : "longer";
    patternLines.push(
      `Your best posts tend to have ${captionStyle} captions (about ${avgCaptionWords} words on average).`
    );
  }
  if (avgHashtags != null) {
    patternLines.push(
      `Top posts use around ${avgHashtags} hashtags on average.`
    );
  }

  const patterns: ReplicationPatterns = {
    top_content_type: topContentType,
    reels_share_pct: reelsSharePct,
    best_posting_time_range: bestTimeRange,
    average_caption_length_words: avgCaptionWords,
    average_hashtag_count: avgHashtags,
    explanation: patternLines.join(" "),
  };

  let recommendation = "Replicate the structure of your top posts.";
  if (topContentType === "reel" && bestTimeRange) {
    recommendation = `Focus on short-form Reels published during the ${bestTimeRange} window. Keep captions ${patterns.average_caption_length_words && patterns.average_caption_length_words <= 12 ? "short and focused" : "tight and clear"}, and reuse the hashtag volume that already works for you.`;
  } else if (topContentType === "carousel" && bestTimeRange) {
    recommendation = `Lean into educational carousels posted around ${bestTimeRange}. Use concise captions and a similar number of hashtags as your top posts.`;
  } else if (bestTimeRange) {
    recommendation = `Publish more of your strongest format in the ${bestTimeRange} range, keeping captions and hashtag counts close to what works in your top posts.`;
  }

  return {
    top_posts: topPosts,
    patterns,
    recommendation,
  };
}

function buildPostingFrequencyReply(snapshot: DataSnapshot, selectedAccount: string): string {
  const posts = snapshot.posts?.filter((p) => p.timestamp != null) ?? [];
  if (posts.length < 5) {
    return "Insufficient historical data to compute reliable recommendation.";
  }
  const sorted = [...posts].sort((a, b) => (a.timestamp! - b.timestamp!));
  const lastTs = sorted[sorted.length - 1].timestamp!;
  const cutoff = lastTs - 90 * 24 * 60 * 60; // last 90 days
  const window = sorted.filter((p) => (p.timestamp as number) >= cutoff);
  if (window.length < 5) {
    return "Insufficient historical data to compute reliable recommendation.";
  }

  const firstTs = window[0].timestamp!;
  const daysRange = Math.max((lastTs - firstTs) / (24 * 60 * 60), 1);
  const postsPerWeek = (window.length / daysRange) * 7;

  // Weekly buckets from firstTs
  const weekStats: Record<string, { posts: number; totalEngagement: number }> = {};
  window.forEach((p) => {
    const ts = p.timestamp as number;
    const weekIndex = Math.floor((ts - firstTs) / (7 * 24 * 60 * 60));
    const key = String(weekIndex);
    if (!weekStats[key]) weekStats[key] = { posts: 0, totalEngagement: 0 };
    const eng = (p.likesCount ?? 0) + (p.commentsCount ?? 0);
    weekStats[key].posts += 1;
    weekStats[key].totalEngagement += eng;
  });

  const weeks = Object.values(weekStats);
  if (weeks.length < 2) {
    return "Insufficient historical data to compute reliable recommendation.";
  }

  const lowWeeks = weeks.filter((w) => w.posts <= 2);
  const highWeeks = weeks.filter((w) => w.posts >= 4);

  const avgEngPerPost = (arr: { posts: number; totalEngagement: number }[]): number | null => {
    const totalPosts = arr.reduce((s, w) => s + w.posts, 0);
    if (totalPosts === 0) return null;
    const totalEng = arr.reduce((s, w) => s + w.totalEngagement, 0);
    return totalEng / totalPosts;
  };

  const lowEng = avgEngPerPost(lowWeeks);
  const highEng = avgEngPerPost(highWeeks);
  const impact =
    lowEng != null && highEng != null && lowEng > 0
      ? parseFloat((((highEng - lowEng) / lowEng) * 100).toFixed(1))
      : null;

  const overallEng = avgEngPerPost(weeks);
  const suggestedPostsPerWeek = Math.max(3, Math.min(7, Math.round(postsPerWeek)));
  const baselineWeeklyEng =
    overallEng != null ? overallEng * postsPerWeek : null;
  const projectedWeeklyEng =
    overallEng != null ? overallEng * suggestedPostsPerWeek : null;
  const projectedIncrease =
    baselineWeeklyEng != null && projectedWeeklyEng != null && baselineWeeklyEng > 0
      ? parseFloat((((projectedWeeklyEng - baselineWeeklyEng) / baselineWeeklyEng) * 100).toFixed(1))
      : null;

  const lines: string[] = [];
  lines.push(
    `Posting Frequency Analysis (Last ${Math.round(daysRange)} Days for @${selectedAccount})`
  );
  lines.push("");
  lines.push(`- Posts analyzed: ${window.length}`);
  lines.push(`- Average posts per week: ${postsPerWeek.toFixed(1)}`);
  if (lowEng != null) {
    lines.push(`- Avg engagement/post in low-frequency weeks (0–2 posts): ${Math.round(lowEng).toLocaleString()}`);
  }
  if (highEng != null) {
    lines.push(`- Avg engagement/post in higher-frequency weeks (4+ posts): ${Math.round(highEng).toLocaleString()}`);
  }
  if (impact != null) {
    const sign = impact >= 0 ? "+" : "";
    lines.push(`- Engagement per post change from low → high frequency weeks: ${sign}${impact}%`);
  } else {
    lines.push(`- Engagement trend vs posting density: not enough variance in weekly posting to estimate a pattern.`);
  }

  lines.push("");
  lines.push("Recommendation");
  lines.push(`- Suggested baseline: ${suggestedPostsPerWeek} posts per week.`);
  if (baselineWeeklyEng != null && projectedWeeklyEng != null && projectedIncrease != null) {
    const sign = projectedIncrease >= 0 ? "+" : "";
    lines.push(
      `- If you move from ~${postsPerWeek.toFixed(
        1
      )} → ${suggestedPostsPerWeek} posts/week and engagement per post stays similar, total weekly engagement would scale from ~${Math.round(
        baselineWeeklyEng
      ).toLocaleString()} → ~${Math.round(projectedWeeklyEng).toLocaleString()} (${sign}${projectedIncrease}%).`
    );
  } else {
    lines.push(
      "- Data does not show a strong pattern between posting more or less often and engagement per post. Use the baseline above as a starting point and monitor changes."
    );
  }

  return lines.join("\n");
}

async function callOpenAI(
  systemPrompt: string,
  userContent: string,
  apiKey: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<string> {
  const validHistory: ChatMessage[] = conversationHistory
    ? conversationHistory
        .filter((m) => m && typeof m.role === "string" && typeof m.content === "string")
        .slice(-8)
        .map((m) => ({
          role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
          content: String(m.content).slice(0, 4000),
        }))
    : [];

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...validHistory,
    { role: "user", content: userContent },
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.4,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${err}`);
  }
  const data: any = await res.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply || typeof reply !== "string") throw new Error("OpenAI returned empty response");
  return reply.trim();
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────

export const smartChatV2 = onCall(
  {
    region: "us-central1",
    secrets: [openaiApiKeySecret, sbClientId, sbApiToken],
    timeoutSeconds: 60,
    memory: "512MiB",
    cors: true,
  },
  async (request) => {
    try {
      const data = request.data as Record<string, unknown> | undefined;
      const message = data?.message;
      const conversationHistory = Array.isArray(data?.conversationHistory) ? data.conversationHistory : undefined;
      if (!message || typeof message !== "string" || !String(message).trim()) {
        throw new HttpsError("invalid-argument", "Message is required");
      }

      const userId = request.auth?.uid;
      if (!userId) {
        throw new HttpsError("unauthenticated", "You must be signed in to use Smart Chat");
      }

      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        throw new HttpsError(
          "failed-precondition",
          "Please add an Instagram account in Analytics to use Smart Chat."
        );
      }

      const userData = userDoc.data() || {};

      // 1️⃣ Per-day guard for Free plan: 5 Smart Chat queries per calendar day
      try {
        const rawPlan =
          (userData?.planType as string | undefined) ??
          (userData?.currentPlan as string | undefined);
        const planKey = normalizePlanKey(rawPlan);
        const usage = (userData as any)?.smartChatUsage || {};
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        let usageDate: string | null =
          typeof usage.date === "string" ? usage.date : null;
        let usageCount: number =
          typeof usage.count === "number" ? usage.count : 0;

        if (usageDate !== today) {
          usageDate = today;
          usageCount = 0;
        }

        const dailyFreeLimit = 5;
        if (planKey === "free" && usageCount >= dailyFreeLimit) {
          throw new HttpsError(
            "resource-exhausted",
            "You have used your 5 free Smart Chat queries for today on the FREE – Explorer plan. Upgrade your plan to unlock more daily Smart Chat questions.",
            { code: "SMARTCHAT_DAILY_LIMIT", upgradeRequired: true }
          );
        }

        // Best-effort update of per-day usage (non-blocking if it fails)
        try {
          await userRef.set(
            {
              smartChatUsage: {
                date: today,
                count: usageCount + 1,
              },
            },
            { merge: true }
          );
        } catch (err) {
          console.error(
            "Failed to update smartChatUsage for user",
            userId,
            err
          );
        }
      } catch (err) {
        if (err instanceof HttpsError) {
          throw err;
        }
        console.error(
          "SmartChatV2 daily usage guard error:",
          (err as any)?.message || err
        );
      }

      // 2️⃣ Global monthly enforcement (server-side only, all plans)
      try {
        await checkAndIncrementUsage(db, userId, "smartChat");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "";
        if (message === LIMIT_REACHED_CODE) {
          throw new HttpsError(
            "resource-exhausted",
            "You've reached your limit for this feature.",
            {
              code: LIMIT_REACHED_CODE,
              upgradeRequired: true,
            }
          );
        }
        throw err;
      }
      const selectedAccount = (userData as any)?.selectedInstagramAccount;
      if (!selectedAccount) {
        throw new HttpsError("failed-precondition", "Please add an Instagram account in Analytics to use Smart Chat.");
      }

      let sbClientIdVal: string | undefined;
      let sbApiTokenVal: string | undefined;
      try {
        sbClientIdVal = sbClientId.value();
        sbApiTokenVal = sbApiToken.value();
      } catch {
        sbClientIdVal = undefined;
        sbApiTokenVal = undefined;
      }
      const snapshot = await getDataSnapshot(db, userId, selectedAccount, sbClientIdVal, sbApiTokenVal);

      const intent = classifyIntent(message);
      const mode = decideResponseMode(intent, snapshot);

      // Log all real user questions for later analysis
      await logSmartChatQuestion(db, {
        userId,
        question: message,
        detectedIntent: intent,
      });

      // Deterministic, data-only handlers for format, posting frequency, and replication questions
      if (intent === "CONTENT_FORMAT") {
        const baseAnswer = stripMarkdownHeadings(buildFormatPerformanceReply(snapshot));
        const confidenceMeta = computeConfidence(snapshot);
        const insight = buildInsightForIntent(intent, snapshot);
        const suggestions = buildSuggestionsForIntent(intent, String(message), conversationHistory as any[]);
        if (confidenceMeta.level === "Low") {
          await logSmartChatFailure(db, {
            userId,
            question: message,
            detectedIntent: intent,
            confidenceScore: confidenceMeta.score,
            responseGenerated: true,
          });
        }
        const confidenceLine = `Confidence: ${confidenceMeta.level} (based on analysis of ${confidenceMeta.postsAnalyzed} posts).`;
        const answer = baseAnswer;
        const reply = [answer, "", `Insight: ${insight}`, "", confidenceLine].join("\n");
        return {
          success: true,
          answer,
          insight,
          confidence: confidenceMeta.level,
          suggestions,
          reply,
        };
      }
      if (intent === "POSTING_FREQUENCY") {
        const baseAnswer = stripMarkdownHeadings(buildPostingFrequencyReply(snapshot, selectedAccount));
        const confidenceMeta = computeConfidence(snapshot);
        const insight = buildInsightForIntent(intent, snapshot);
        const suggestions = buildSuggestionsForIntent(intent, String(message), conversationHistory as any[]);
        if (confidenceMeta.level === "Low") {
          await logSmartChatFailure(db, {
            userId,
            question: message,
            detectedIntent: intent,
            confidenceScore: confidenceMeta.score,
            responseGenerated: true,
          });
        }
        const confidenceLine = `Confidence: ${confidenceMeta.level} (based on analysis of ${confidenceMeta.postsAnalyzed} posts).`;
        const answer = baseAnswer;
        const reply = [answer, "", `Insight: ${insight}`, "", confidenceLine].join("\n");
        return {
          success: true,
          answer,
          insight,
          confidence: confidenceMeta.level,
          suggestions,
          reply,
        };
      }
      if (intent === "REPLICATE_POSTS") {
        const insight = buildReplicationInsight(snapshot);
        if (!insight) {
          const limitationAnswer = stripMarkdownHeadings(buildLimitationReply("BEST_POST", snapshot, selectedAccount));
          const confidenceMeta = computeConfidence(snapshot);
          const fallbackSuggestions = buildSuggestionsForIntent("BEST_POST", String(message), conversationHistory as any[]);
          await logSmartChatFailure(db, {
            userId,
            question: message,
            detectedIntent: intent,
            confidenceScore: confidenceMeta.score,
            responseGenerated: false,
          });
          const fallbackInsight =
            "I couldn't find a strong pattern in your recent analytics yet. Try one of the suggested analytics-based questions to narrow down what you want to analyze.";
          const confidenceLine = `Confidence: Low (no usable post-level dataset for this question).`;
          const answer = [
            limitationAnswer,
            "",
            "I couldn't find a strong pattern in your recent analytics yet.",
            "Try asking:",
            "• Which posts performed best this month?",
            "• Which reels drove the most engagement?",
            "• Which hashtags appear in my top posts?",
          ].join("\n");
          const reply = [answer, "", `Insight: ${fallbackInsight}`, "", confidenceLine].join("\n");
          return {
            success: true,
            answer,
            insight: fallbackInsight,
            confidence: "Low" as ConfidenceLevel,
            suggestions: fallbackSuggestions,
            reply,
          };
        }
        const jsonBlock = JSON.stringify(insight, null, 2);
        const confidenceMeta = computeConfidence(snapshot);
        const suggestions = buildSuggestionsForIntent(intent, String(message), conversationHistory as any[]);
        if (confidenceMeta.level === "Low") {
          await logSmartChatFailure(db, {
            userId,
            question: message,
            detectedIntent: intent,
            confidenceScore: confidenceMeta.score,
            responseGenerated: true,
          });
        }
        const confidenceLine = `Confidence: ${confidenceMeta.level} (based on analysis of ${confidenceMeta.postsAnalyzed} posts).`;
        const answerLines: string[] = [];
        answerLines.push("DATA ANALYZED: We looked at your top posts by engagement rate and total interactions.");
        answerLines.push("");
        answerLines.push("FACTS (numbers only):");
        answerLines.push(`- We selected the top 3 posts to replicate from your highest-engagement content.`);
        if (insight.patterns.top_content_type) {
          answerLines.push(`- Top content type: ${insight.patterns.top_content_type}.`);
        }
        if (insight.patterns.reels_share_pct != null) {
          answerLines.push(`- Reels share among top posts: ${insight.patterns.reels_share_pct}%.`);
        }
        if (insight.patterns.best_posting_time_range) {
          answerLines.push(`- Best performing posting window: ${insight.patterns.best_posting_time_range}.`);
        }
        if (insight.patterns.average_caption_length_words != null) {
          answerLines.push(`- Avg caption length (top posts): ${insight.patterns.average_caption_length_words} words.`);
        }
        if (insight.patterns.average_hashtag_count != null) {
          answerLines.push(`- Avg hashtags per top post: ${insight.patterns.average_hashtag_count}.`);
        }
        answerLines.push("");
        answerLines.push("WHAT CANNOT BE CONCLUDED: We only see engagement, time, and caption metrics—no content or creative details, so we can't tell why a specific idea or visual worked.");
        answerLines.push("");
        answerLines.push(`NEXT STEP: ${insight.recommendation} Want more data? Say 'analyze 50 posts' or 'analyze 90 posts'—it will take longer but we'll fetch and analyze them.`);
        answerLines.push("");
        answerLines.push("STRUCTURED_INSIGHTS (for builders/tools):");
        answerLines.push(jsonBlock);

        const baseAnswer = stripMarkdownHeadings(answerLines.join("\n"));
        const reply = [baseAnswer, "", `Insight: ${insight.recommendation}`, "", confidenceLine].join("\n");
        return {
          success: true,
          answer: baseAnswer,
          insight: insight.recommendation,
          confidence: confidenceMeta.level,
          suggestions,
          reply,
        };
      }

      if (mode === "LIMITATION") {
        const limitationAnswer = stripMarkdownHeadings(buildLimitationReply(intent, snapshot, selectedAccount));
        const confidenceMeta = computeConfidence(snapshot);
        const suggestions = buildSuggestionsForIntent(intent, String(message), conversationHistory as any[]);
        await logSmartChatFailure(db, {
          userId,
          question: message,
          detectedIntent: intent,
          confidenceScore: confidenceMeta.score,
          responseGenerated: false,
        });
        const fallbackInsight =
          "Your current analytics sample is too small for a confident answer. Run a fresh Instagram Analytics scan, then try one of the suggested analytics-based questions.";
        const confidenceLine = `Confidence: Low (no or minimal post-level data for this question).`;
        const answer = [
          limitationAnswer,
          "",
          "I couldn't find a strong pattern in your recent analytics yet.",
          "Try asking:",
          "• Which posts performed best this month?",
          "• Which reels drove the most engagement?",
          "• Which hashtags appear in my top posts?",
        ].join("\n");
        const reply = [answer, "", `Insight: ${fallbackInsight}`, "", confidenceLine].join("\n");
        return {
          success: true,
          answer,
          insight: fallbackInsight,
          confidence: "Low" as ConfidenceLevel,
          suggestions,
          reply,
        };
      }

      const apiKey = openaiApiKeySecret.value();
      if (!apiKey) throw new HttpsError("failed-precondition", "OpenAI API key is not configured.");

      if (mode === "STRATEGY") {
        const dataBlock = buildStrategyDataBlock(snapshot, selectedAccount);
        const knowledgeBlock = getAnalyticsKnowledgeBlock(intent);
        const hasKnowledge = knowledgeBlock.length > 0;
        const hasUserData = snapshot.hasAccountMetrics && snapshot.postCount > 0;
        const dataDisclaimer = hasKnowledge && !hasUserData
          ? "\nCRITICAL: We do NOT have this user's data for this question. You MUST say clearly at the start: \"This answer is not based on your account data\" or \"We don't have your data for this; here's the general explanation.\" Then give the knowledge-based answer. Do not imply we analyzed their account for this."
          : hasKnowledge && hasUserData
          ? "\nWe have some account data above. You may add one short line tying it in if relevant (e.g. \"For your account, from your last N posts...\"). If the question is not about something we have data for (e.g. Stories, reach/impressions breakdown), still say clearly: \"We don't have your data for this metric; below is the general explanation.\""
          : "";
        const systemPrompt = `You are Smart Chat. We are a DATA AND ANALYTICS ONLY AI system. We do not give opinions, motivational advice, or generic growth tips. We answer only from: (1) the user's actual account or post data when we have it, or (2) factual analytics definitions and metrics explanations when we don't have their data—and we always say clearly when we don't have their data.

${dataBlock}
${hasKnowledge ? `

ANALYTICS KNOWLEDGE (answer from this; do not invent or contradict):
${knowledgeBlock}${dataDisclaimer}` : ""}
${!hasKnowledge ? `
When we have NO analytics knowledge block for this question and no or minimal user data: Say clearly "We don't have data to answer this in a data-based way." or "This is not something we can answer from your analytics data." Then briefly suggest they run Instagram Analytics (or ask a question we can answer from their data, e.g. best posting time, format performance, top posts). Do NOT invent strategies or generic advice.` : ""}

CRITICAL: When account data is provided above, USE IT. Reference their actual followers, engagement rate, and post count. Do NOT give generic advice when you have their numbers.
When we have no data for the question, say so first; then only give the factual knowledge if we have it, or tell them we cannot answer from data.

NEVER use: typically, usually, generally, best practices, your content isn't compelling, motivational filler, or any advice not grounded in data or the provided knowledge.
ALWAYS: be data-led or explicitly disclaim that we don't have data.

CONVERSATIONAL: Use prior messages for context. If the user refers to "these", "those", "among these", answer directly from what you previously said.
FORMATTING: Do NOT prefix headings or section titles with '#', '##', or '###'. Output headings as plain text lines without markdown hashes.`;
        const baseReply = stripMarkdownHeadings(
          await callOpenAI(
            systemPrompt,
            `User question: "${message}"`,
            apiKey,
            conversationHistory
          )
        );
        const confidenceMeta = computeConfidence(snapshot);
        const insight = buildInsightForIntent(intent, snapshot);
        const suggestions = buildSuggestionsForIntent(intent, String(message), conversationHistory as any[]);
        if (confidenceMeta.level === "Low") {
          await logSmartChatFailure(db, {
            userId,
            question: message,
            detectedIntent: intent,
            confidenceScore: confidenceMeta.score,
            responseGenerated: true,
          });
        }
        const confidenceLine = `Confidence: ${confidenceMeta.level} (based on analysis of ${confidenceMeta.postsAnalyzed} posts).`;
        const answer = baseReply;
        const reply = [answer, "", `Insight: ${insight}`, "", confidenceLine].join("\n");
        return {
          success: true,
          answer,
          insight,
          confidence: confidenceMeta.level,
          suggestions,
          reply,
        };
      }

      // mode === "ANALYTICS"
      const requestedTopN = parseTopN(message);
      let context = buildAnalyticsContext(snapshot, selectedAccount, requestedTopN);
      if (intent === "POSTING_TIME" && snapshot.posts?.length) {
        const timeSlots = analyzeTimeSlots(snapshot.posts);
        const byWeekday = analyzeByWeekday(snapshot.posts);
        const byHour = analyzeByHour(snapshot.posts);
        const weekdayVsWeekend = analyzeWeekdayVsWeekend(snapshot.posts);
        const postsWithTs = snapshot.posts.filter((p) => parsePostTimestamp(p) != null).length;
        const slotCounts = timeSlots ? Object.values(timeSlots).map((s) => s.posts) : [];
        const slotsWithAtLeast5 = slotCounts.filter((c) => c >= 5).length;

        if (timeSlots) {
          context += "\n\nTIME_SLOTS (Morning 6–12, Afternoon 12–18, Evening 18–24, Night 0–6 — use these numbers only):\n" + JSON.stringify(timeSlots, null, 2);
        }
        if (byWeekday) {
          context += "\n\nBY_WEEKDAY (engagement by day — for 'which weekday' / 'which day'):\n" + JSON.stringify(byWeekday, null, 2);
        }
        if (byHour) {
          context += "\n\nBY_HOUR (hour 0–23; 18 = 6PM — for '6PM posts', 'best posting hour', 'statistically significant'):\n" + JSON.stringify(byHour, null, 2);
        }
        if (weekdayVsWeekend) {
          context += "\n\nWEEKDAY_VS_WEEKEND (weekday = Mon–Fri, weekend = Sat–Sun — for 'weekend posts perform worse'):\n" + JSON.stringify(weekdayVsWeekend, null, 2);
        }
        context += `\n\nDATA_SUFFICIENCY: postsWithTimestamps=${postsWithTs}, totalPosts=${snapshot.postCount}, timeSlotsWithAtLeast5Posts=${slotsWithAtLeast5}. Use this for 'enough data to determine best time' or 'is there enough data'.`;
      }
      const systemPrompt = `You are Smart Chat. We are a DATA AND ANALYTICS ONLY AI system. We answer only from the user's actual data. We do not give opinions, generic advice, or non-data-based recommendations.

${context}

CRITICAL: We HAVE the user's data above. Answer ONLY from that data. Give the direct answer (numbers, list of posts, averages). Do NOT say "to find this, do X" or give generic instructions. Do NOT diagnose, judge, or invent reasons not in the data.

CONVERSATIONAL: Use prior messages for context. If the user refers to "these", "those", "among these", "from above", they mean data YOU provided. Answer directly from your previous response—do NOT give "how to find" instructions.

WHY QUESTIONS (when user asks why posts are top): Use ONLY the numbers in the data. Explain using: (1) engagement breakdown—e.g. "Post 2 had the most comments (1,030)—suggesting it drove discussion"; (2) content type if available; (3) posting time if available.
BANNED (never use): "Content Appeal", "Effective Captions", "engaging content", "captivating visuals", "compelling narratives", "visually stunning", "resonated with your audience", "high engagement" (as a reason—circular). If you cannot explain from data, say: "We couldn't determine the exact reasons—we only have engagement numbers. From the numbers: [list specific facts]."
FORMATTING: Do NOT prefix headings or section titles with '#', '##', or '###'. Output headings as plain text lines without markdown hashes.`;
      const intentHint = intent === "ACCOUNT_METRICS"
        ? "User asked for their metrics. Lead with the numbers. Answer directly: e.g. 'Your engagement rate is X%. You have Y followers.'"
        : intent === "WHY_ABOUT_POSTS"
        ? "User asked WHY these posts are top. Use ONLY TOP_POSTS_BY_ENGAGEMENT data. Compare likes vs comments, content type, posting time. Do NOT use generic reasons like 'Content Appeal' or 'Effective Captions'. If data is insufficient, say so and list only data-driven facts."
        : intent === "CAPTIONS_OR_PAID_POSTS"
        ? "User asked about captions used and/or paid/partnership/sponsored posts. Use the post-level data: each post has 'caption' and 'date'. Count paid/partnership posts by checking captions for words like sponsored, paid, partnership, collab, #ad, paid partnership. For 'what captions in last N days' filter posts by date and list the captions. Answer from the data only; do NOT give manual 'how to find' steps."
        : intent === "BEST_POST"
        ? `User asked for top/best performing posts (possibly "top N" e.g. top 15). Use TOP_POSTS_BY_ENGAGEMENT. List exactly what we have (up to the number they asked for). If they asked for 15 and we have 15 or more, list 15. If we have 10, list 10 and say "Here are the top 10 from your last X posts." ALWAYS include each post's URL. Do NOT give instructions like "to find top posts, sort by engagement"—we already did that; give the list.`
        : intent === "POSTING_FREQUENCY"
        ? "User asked for posts per month or monthly average. Use POSTS_PER_MONTH data. Give the exact average (averagePostsPerMonth) and optionally byMonth breakdown. Answer in one short paragraph with numbers. Do NOT give steps like 'count your posts' or 'divide by 12'—we already computed it."
        : intent === "POSTING_TIME"
        ? `User asked a posting-time or time-slot question. Use ONLY the data above (TIME_SLOTS, BY_WEEKDAY, BY_HOUR, WEEKDAY_VS_WEEKEND, DATA_SUFFICIENCY). Answer from these numbers only.
- Best time / last 30 posts: Use TIME_SLOTS; recommend slot(s) with highest avgEngagement. If they ask "last 30 posts", use the same data (we have N posts analyzed).
- Night vs morning: Compare TIME_SLOTS Night vs Morning (avgEngagement and post count).
- Which weekday: Use BY_WEEKDAY; name the day(s) with highest avgEngagement or total engagement.
- Statistically significant hour: Use BY_HOUR; note that with limited posts per hour, significance is limited; say what the data shows (e.g. hour 14 has highest avg) and whether sample size is enough.
- Weekend worse: Use WEEKDAY_VS_WEEKEND; compare weekend.avgEngagement vs weekday.avgEngagement.
- Lowest engagement slot: Use TIME_SLOTS; name the slot with lowest avgEngagement (or fewest posts if ties).
- 6PM / specific hour: BY_HOUR hour 18 = 6PM; compare that hour's avgEngagement to overall or other hours.
- Best time changed in last 3 months: We only have current analyzed window (no historical windows); say so and give best time from current data.
- Enough data: Use DATA_SUFFICIENCY; if postsWithTimestamps is low or timeSlotsWithAtLeast5Posts < 2, say more data would help.
- Post more in afternoon: Use TIME_SLOTS Afternoon; say whether data supports it (e.g. if Afternoon has highest avgEngagement, yes).`
        : `Intent: ${intent}`;
      const userContent = `${intentHint}\n\nUser question: "${message}"`;
      const baseReply = stripMarkdownHeadings(
        await callOpenAI(systemPrompt, userContent, apiKey, conversationHistory)
      );
      const confidenceMeta = computeConfidence(snapshot);
      const insight = buildInsightForIntent(intent, snapshot);
      const suggestions = buildSuggestionsForIntent(intent, String(message), conversationHistory as any[]);
      if (confidenceMeta.level === "Low") {
        await logSmartChatFailure(db, {
          userId,
          question: message,
          detectedIntent: intent,
          confidenceScore: confidenceMeta.score,
          responseGenerated: true,
        });
      }
      const confidenceLine = `Confidence: ${confidenceMeta.level} (based on analysis of ${confidenceMeta.postsAnalyzed} posts).`;
      const answer = baseReply;
      const reply = [answer, "", `Insight: ${insight}`, "", confidenceLine].join("\n");
      return {
        success: true,
        answer,
        insight,
        confidence: confidenceMeta.level,
        suggestions,
        reply,
      };
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      const msg = e instanceof Error ? e.message : "An unexpected error occurred.";
      console.error("smartChatV2 error:", msg, e instanceof Error ? e.stack : "");
      if (msg.includes("OpenAI") || msg.includes("429") || msg.includes("rate limit")) {
        throw new HttpsError("resource-exhausted", "The AI service is busy. Please try again in a moment.");
      }
      if (msg.includes("fetch") || msg.includes("network") || msg.includes("ECONNREFUSED")) {
        throw new HttpsError("unavailable", "The service is temporarily unavailable. Please try again.");
      }
      throw new HttpsError("internal", "Something went wrong. Please try again.");
    }
  }
);
