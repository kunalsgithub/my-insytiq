import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import axios from "axios";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

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
  type?: string;
  isVideo?: boolean;
  url?: string | null;
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
    const posts: Post[] = rawPosts.map((p: any) => ({
      likesCount: p.likesCount ?? p.likeCount,
      commentsCount: p.commentsCount ?? p.commentCount,
      caption: p.caption ?? "",
      timestamp: parsePostTimestamp(p),
      type: p.type,
      isVideo: p.isVideo,
      url: p.url ?? null,
    }));
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
    const posts: Post[] = media.map((p: any) => ({
      likesCount: p.likesCount ?? p.likeCount,
      commentsCount: p.commentsCount ?? p.commentCount,
      caption: p.caption ?? "",
      timestamp: parsePostTimestamp(p),
      type: p.type,
      isVideo: p.isVideo,
      url: getPostUrl(p) || null,
    }));

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

// ─── 2. MODE DECISION (NO OpenAI) ────────────────────────────────────────

const ANALYTICS_POST_THRESHOLD = 5;
const POSTING_TIME_THRESHOLD = 10;

function classifyIntent(message: string): string {
  const m = message.toLowerCase();
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
  // Posts per month / posting frequency / average posts
  if (
    m.includes("posts per month") || m.includes("post per month") || m.includes("posting frequency") ||
    m.includes("average number of posts") || m.includes("how many posts") && (m.includes("month") || m.includes("monthly")) ||
    m.includes("monthly average") || m.includes("posts in monthly") || m.includes("analyze") && m.includes("posts") && m.includes("month")
  ) return "POSTING_FREQUENCY";
  // Follower growth / followers this month (we only have current count, not history)
  if (
    m.includes("followers did i get") || m.includes("followers i got") || m.includes("follower growth") ||
    m.includes("followers this month") || m.includes("gained this month") || m.includes("new followers")
  ) return "FOLLOWERS_GROWTH";
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
  if (intent === "GENERATION" || intent === "DIAGNOSIS") return "STRATEGY";
  if (intent === "POSTING_TIME" || intent === "BEST_POST" || intent === "HASHTAGS" || intent === "WHY_ABOUT_POSTS" || intent === "CAPTIONS_OR_PAID_POSTS") {
    if (snapshot.postCount === 0) return "LIMITATION";
    const threshold = intent === "POSTING_TIME" ? POSTING_TIME_THRESHOLD : intent === "WHY_ABOUT_POSTS" ? 3 : ANALYTICS_POST_THRESHOLD;
    if (intent === "CAPTIONS_OR_PAID_POSTS" || snapshot.postCount >= threshold) return "ANALYTICS";
    return "LIMITATION";
  }
  return "STRATEGY";
}

// ─── 3. RESPONSE OUTPUT ──────────────────────────────────────────────────

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
    "RESPONSE FORMAT (required — use these section headers WITHOUT numbers):",
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

      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        throw new HttpsError("failed-precondition", "Please add an Instagram account in Analytics to use Smart Chat.");
      }

      const selectedAccount = userDoc.data()?.selectedInstagramAccount;
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

      if (mode === "LIMITATION") {
        return {
          success: true,
          reply: buildLimitationReply(intent, snapshot, selectedAccount),
        };
      }

      const apiKey = openaiApiKeySecret.value();
      if (!apiKey) throw new HttpsError("failed-precondition", "OpenAI API key is not configured.");

      if (mode === "STRATEGY") {
        const dataBlock = buildStrategyDataBlock(snapshot, selectedAccount);
        const systemPrompt = `You are Smart Chat, an Instagram growth advisor. Answer with ideas, how-to, and strategy. Be specific and actionable.

${dataBlock}

CRITICAL: When account data is provided above, USE IT. Reference their actual followers, engagement rate, and post count. Tailor advice to their scale. Do NOT give generic advice when you have their numbers.
When no data is provided, give concrete steps anyway—but never say "run analytics" as the main answer.

NEVER use: typically, usually, generally, best practices, your content isn't compelling, motivational filler.
ALWAYS use: concrete steps, specific tactics, testable actions.

CONVERSATIONAL: Use prior messages for context. If the user refers to "these", "those", "among these", answer directly from what you previously said—do NOT give generic how-to instructions.`;
        const reply = await callOpenAI(
          systemPrompt,
          `User question: "${message}"`,
          apiKey,
          conversationHistory
        );
        return { success: true, reply };
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
      const systemPrompt = `You are Smart Chat, a data analyst for Instagram. Explain facts from the data. Do NOT diagnose, judge, or invent problems.

${context}

CRITICAL: We HAVE the user's data above. NEVER reply with "to find this, do X" or "you can do this by..." or "follow these steps to...". Always answer FROM THE DATA. If the data is above, use it and give the direct answer (numbers, list of posts, averages). Do NOT give generic instructions.

CONVERSATIONAL: Use prior messages for context. If the user refers to "these", "those", "among these", "from above", they mean data YOU provided. Answer directly from your previous response—do NOT give "how to find" instructions.

WHY QUESTIONS (when user asks why posts are top): Use ONLY the numbers in the data. Explain using: (1) engagement breakdown—e.g. "Post 2 had the most comments (1,030)—suggesting it drove discussion"; (2) content type if available; (3) posting time if available.
BANNED (never use): "Content Appeal", "Effective Captions", "engaging content", "captivating visuals", "compelling narratives", "visually stunning", "resonated with your audience", "high engagement" (as a reason—circular). If you cannot explain from data, say: "We couldn't determine the exact reasons—we only have engagement numbers. From the numbers: [list specific facts]."`;
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
      const reply = await callOpenAI(systemPrompt, userContent, apiKey, conversationHistory);
      return { success: true, reply };
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
