import { onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { fetchInstagramData } from "./apifyFetcher";

if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();
const apifyApiTokenSecret = defineSecret("APIFY_API_TOKEN");

/** Allow only safe Instagram username characters (prevent injection) */
const USERNAME_REGEX = /^[a-z0-9._]{1,30}$/;
function isValidUsername(s: string): boolean {
  return USERNAME_REGEX.test(s);
}

function getLikes(post: any): number {
  return (
    post.likesCount ??
    post.likeCount ??
    post.likes ??
    (typeof post.like_count === "number" ? post.like_count : 0)
  ) || 0;
}

function getComments(post: any): number {
  return (
    post.commentsCount ??
    post.commentCount ??
    post.comments ??
    (typeof post.comment_count === "number" ? post.comment_count : 0)
  ) || 0;
}

function getReelViews(post: any): number | null {
  const v =
    post.videoViewCount ??
    post.viewCount ??
    post.playCount ??
    post.videoPlayCount ??
    post.plays ??
    post.views;
  return typeof v === "number" && v >= 0 ? v : null;
}

function isReel(post: any): boolean {
  const t = (post.type ?? post.mediaType ?? post.__typename ?? "").toString().toLowerCase();
  return t === "reel" || t === "video" || t === "reels";
}

function getTimestamp(post: any): number | null {
  const v =
    post.timestamp ??
    post.takenAtTimestamp ??
    post.taken_at_timestamp ??
    post.createdAt ??
    post.postedAt ??
    0;
  if (typeof v === "number" && v > 0) return v > 1e12 ? Math.floor(v / 1000) : v;
  if (typeof v === "string") {
    const parsed = Date.parse(v);
    if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);
  }
  return null;
}

export type PlanType = "free" | "creator" | "pro";

export interface BrandCollabScoreResponse {
  success: true;
  totalScore: number;
  status: string;
  breakdown: {
    engagement: number;
    consistency: number;
    reelImpact: number;
    community: number;
    professionalism: number;
  };
  followers: number;
  avgLikes: number;
  avgComments: number;
  avgReelViews: number;
  dealEstimate?: { min: number; max: number };
  recommendations: string[];
  expectedEngagementRange?: string;
  actualEngagementRate?: number;
  riskFlags?: string[];
  enableExport?: boolean;
}

export interface BrandCollabScoreError {
  success: false;
  code: string;
  message: string;
}

const RATE_LIMIT_SEC = 15;
const PRO_MONTHLY_LIMIT = 50;

function normalizePlanType(rawPlan: string | undefined): PlanType {
  const p = (rawPlan || "").trim().toLowerCase();
  if (p === "free" || !p) return "free";
  if (p === "analytics+" || p === "pro" || p.includes("pro")) return "pro";
  if (p === "trends+" || p === "creator" || p.includes("creator")) return "creator";
  return "free";
}

function firstDayOfNextMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function getStatus(totalScore: number): string {
  if (totalScore >= 80) return "Brand Ready";
  if (totalScore >= 60) return "Strong";
  if (totalScore >= 40) return "Developing";
  return "Weak";
}

/** Industry benchmark: expected engagement range by follower tier */
function getExpectedEngagement(followers: number): { expectedEngagementRange: string; expectedMid: number } {
  if (followers < 10_000) return { expectedEngagementRange: "3–5%", expectedMid: 4 };
  if (followers < 100_000) return { expectedEngagementRange: "2–3%", expectedMid: 2.5 };
  if (followers < 500_000) return { expectedEngagementRange: "1.5–2%", expectedMid: 1.75 };
  if (followers < 1_000_000) return { expectedEngagementRange: "1–1.5%", expectedMid: 1.25 };
  return { expectedEngagementRange: "0.8–1.2%", expectedMid: 1 };
}

function getDealEstimate(
  followers: number,
  engagementRatePercent: number,
  expectedMid: number
): { min: number; max: number } {
  let min: number;
  let max: number;
  if (followers < 50_000) {
    min = 100;
    max = 300;
  } else if (followers < 250_000) {
    min = 300;
    max = 1500;
  } else if (followers < 1_000_000) {
    min = 1500;
    max = 5000;
  } else {
    min = 5000;
    max = 15000;
  }
  if (engagementRatePercent < 0.5) {
    min = Math.round(min * 0.2);
    max = Math.round(max * 0.2);
  } else if (engagementRatePercent < 1) {
    min = Math.round(min * 0.4);
    max = Math.round(max * 0.4);
  } else if (engagementRatePercent > expectedMid) {
    min = Math.round(min * 1.25);
    max = Math.round(max * 1.25);
  }
  return { min: Math.max(50, min), max: Math.max(min + 50, max) };
}

function getRecommendations(
  breakdown: { engagement: number; consistency: number; reelImpact: number; community: number; professionalism: number }
): string[] {
  const pillars: { key: keyof typeof breakdown; label: string }[] = [
    { key: "engagement", label: "Engagement Quality" },
    { key: "consistency", label: "Consistency" },
    { key: "reelImpact", label: "Reel Impact" },
    { key: "community", label: "Community Strength" },
    { key: "professionalism", label: "Profile Professionalism" },
  ];
  const sorted = [...pillars].sort((a, b) => breakdown[a.key] - breakdown[b.key]);
  const lowest = sorted[0];
  const recs: string[] = [];
  switch (lowest.key) {
    case "consistency":
      recs.push("Post 3–4 times per week to build a consistent presence.");
      recs.push("Use a content calendar to plan ahead.");
      break;
    case "engagement":
      recs.push("Use stronger hooks in the first line of captions and Reels.");
      recs.push("Post when your audience is most active.");
      break;
    case "reelImpact":
      recs.push("Increase Reel output; they tend to reach more non-followers.");
      recs.push("Keep the first 3 seconds strong to reduce drop-off.");
      break;
    case "community":
      recs.push("Ask questions in captions to encourage comments.");
      recs.push("Reply to comments to boost conversation.");
      break;
    case "professionalism":
      recs.push("Write a clear bio (50+ characters) that states your niche.");
      recs.push("Add a link in bio so brands can reach you.");
      break;
  }
  return recs.slice(0, 3);
}

function computeScore(profileData: any): BrandCollabScoreResponse {
  const followers =
    profileData.followersCount ?? profileData.followerCount ?? profileData.followers ?? 0;
  const bio = (profileData.biography ?? profileData.bio ?? "").toString();
  const externalUrl = (profileData.externalUrl ?? profileData.websiteUrl ?? profileData.external_url ?? "").toString();
  const media = Array.isArray(profileData.media) ? profileData.media : [];

  type PostRow = {
    likes: number;
    comments: number;
    isReel: boolean;
    ts: number | null;
    reelViews: number | null;
  };
  const posts: PostRow[] = media.map((p: any) => ({
    likes: getLikes(p),
    comments: getComments(p),
    isReel: isReel(p),
    ts: getTimestamp(p),
    reelViews: isReel(p) ? getReelViews(p) : null,
  }));

  const postCount = posts.length;
  const safeFollowers = Math.max(1, followers);

  if (postCount === 0) {
    throw new Error("NO_POSTS");
  }

  const totalLikes = posts.reduce((s: number, p: PostRow) => s + p.likes, 0);
  const totalComments = posts.reduce((s: number, p: PostRow) => s + p.comments, 0);
  const avgLikes = totalLikes / postCount;
  const avgComments = totalComments / postCount;
  const engagementRate = ((avgLikes + avgComments) / safeFollowers) * 100;

  // --- 1. Engagement Quality (40 pts) — stricter bands
  let engagement: number;
  if (engagementRate >= 5) engagement = 40;
  else if (engagementRate >= 3) engagement = 32;
  else if (engagementRate >= 2) engagement = 24;
  else if (engagementRate >= 1) engagement = 16;
  else if (engagementRate >= 0.5) engagement = 8;
  else engagement = 4;

  // --- 2. Consistency (20 pts)
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - 30 * 24 * 3600;
  const postsLast30Days = posts.filter((p: PostRow) => p.ts != null && p.ts >= thirtyDaysAgo).length;
  let consistency: number;
  if (postsLast30Days >= 12) consistency = 20;
  else if (postsLast30Days >= 8) consistency = 15;
  else if (postsLast30Days >= 4) consistency = 10;
  else if (postsLast30Days >= 1) consistency = 5;
  else consistency = 0;

  // --- 3. Reel Impact (20 pts)
  const reels = posts.filter((p: PostRow) => p.isReel && p.reelViews != null);
  let reelImpact: number;
  let avgReelViews = 0;
  if (reels.length > 0) {
    const totalReelViews = reels.reduce((s: number, p: PostRow) => s + (p.reelViews ?? 0), 0);
    avgReelViews = totalReelViews / reels.length;
    const reelViewRatio = avgReelViews / safeFollowers;
    if (reelViewRatio > 0.5) reelImpact = 20;
    else if (reelViewRatio >= 0.3) reelImpact = 15;
    else if (reelViewRatio >= 0.1) reelImpact = 10;
    else reelImpact = 5;
  } else {
    reelImpact = 10; // max 10 if no reels
  }

  // --- 4. Community Strength (10 pts)
  const commentLikeRatio = avgLikes > 0 ? avgComments / avgLikes : 0;
  let community: number;
  if (commentLikeRatio > 0.1) community = 10;
  else if (commentLikeRatio >= 0.05) community = 7;
  else community = 4;

  // --- Industry benchmark & risk flags
  const { expectedEngagementRange, expectedMid } = getExpectedEngagement(followers);
  const riskFlags: string[] = [];
  if (engagementRate < 0.5) riskFlags.push("Low engagement for follower size");
  if (commentLikeRatio < 0.03) riskFlags.push("Low conversation depth");
  if (postsLast30Days < 4) riskFlags.push("Inconsistent posting");

  // --- 5. Profile Professionalism (10 pts)
  const bioLen = bio.length;
  const hasBio = bioLen > 50;
  const hasLink = externalUrl.length > 10 && (externalUrl.startsWith("http") || externalUrl.startsWith("https"));
  const hasNiche = bioLen > 20 && /creator|blogger|content|brand|collab|influencer|fashion|travel|food|fitness|beauty|photo|artist/i.test(bio);
  let professionalism = 0;
  if (hasBio) professionalism += 4;
  if (hasNiche) professionalism += 3;
  if (hasLink) professionalism += 3;
  professionalism = Math.min(10, professionalism);

  const totalScore = Math.min(100, Math.max(0, engagement + consistency + reelImpact + community + professionalism));
  const status = getStatus(totalScore);
  const dealEstimate = getDealEstimate(followers, engagementRate, expectedMid);
  const recommendations = getRecommendations({
    engagement,
    consistency,
    reelImpact,
    community,
    professionalism,
  });

  return {
    success: true,
    totalScore,
    status,
    breakdown: {
      engagement,
      consistency,
      reelImpact,
      community,
      professionalism,
    },
    followers,
    avgLikes: Math.round(avgLikes),
    avgComments: Math.round(avgComments),
    avgReelViews: Math.round(avgReelViews),
    dealEstimate,
    recommendations,
    expectedEngagementRange,
    actualEngagementRate: Math.round(engagementRate * 100) / 100,
    riskFlags,
  };
}

/** Full score result from computeScore; we strip PRO-only fields for non-PRO in handler */
type FullScoreResult = ReturnType<typeof computeScore>;

export const getBrandCollabScore = onCall(
  {
    secrets: [apifyApiTokenSecret],
    timeoutSeconds: 300,
    cors: true,
  },
  async (request): Promise<BrandCollabScoreResponse | BrandCollabScoreError> => {
    try {
      const userId = request.auth?.uid;
      if (!userId) {
        return {
          success: false,
          code: "UNAUTHENTICATED",
          message: "You must be signed in to use Brand Collab Readiness Score.",
        };
      }

      const rawUsername = (request.data?.username as string | undefined) || "";
      const username = rawUsername.trim().toLowerCase();
      if (!username || !isValidUsername(username)) {
        return {
          success: false,
          code: "INVALID_USERNAME",
          message: "Please enter a valid Instagram username (letters, numbers, dots, underscores only).",
        };
      }

      const userRef = db.collection("users").doc(userId);
      const userSnap = await userRef.get();
      const userData = userSnap.data() || {};
      const planType = normalizePlanType(userData.currentPlan as string | undefined);

      const usage = (userData.brandCollabUsage as Record<string, unknown>) || {};
      let lifetimeUsed = typeof usage.lifetimeUsed === "number" ? usage.lifetimeUsed : 0;
      let monthlyUsed = typeof usage.monthlyUsed === "number" ? usage.monthlyUsed : 0;
      let monthlyResetDate = typeof usage.monthlyResetDate === "string" ? usage.monthlyResetDate : null as string | null;
      const lastCallAt = userData.lastBrandCollabCallAt as { toDate?: () => Date } | undefined;
      const lastCallMs = lastCallAt?.toDate?.()?.getTime();
      if (lastCallMs && Date.now() - lastCallMs < RATE_LIMIT_SEC * 1000) {
        return {
          success: false,
          code: "RATE_LIMITED",
          message: "Please wait a moment before calculating again.",
        };
      }

      if (planType === "creator") {
        return {
          success: false,
          code: "PRO_ONLY_FEATURE",
          message: "Brand Collab Score is available in PRO plan only.",
        };
      }

      if (planType === "free") {
        if (lifetimeUsed >= 1) {
          return {
            success: false,
            code: "BRAND_SCORE_LOCKED",
            message: "Free plan includes 1 lifetime Brand Collab Score. Upgrade to PRO for more.",
          };
        }
      }

      if (planType === "pro") {
        const now = new Date();
        const resetDate = monthlyResetDate ? new Date(monthlyResetDate) : null;
        if (!resetDate || now > resetDate) {
          monthlyUsed = 0;
          monthlyResetDate = firstDayOfNextMonth();
        }
        if (monthlyUsed >= PRO_MONTHLY_LIMIT) {
          return {
            success: false,
            code: "MONTHLY_LIMIT_REACHED",
            message: "You've reached your 50 monthly Brand Collab Score limit.",
          };
        }
      }

      const apifyApiToken = apifyApiTokenSecret.value();
      const profileData = await fetchInstagramData(username, apifyApiToken, 30);

      const followers = profileData.followersCount ?? profileData.followerCount ?? profileData.followers ?? 0;
      const media = Array.isArray(profileData.media) ? profileData.media : [];
      const isPrivate = (profileData.isPrivate ?? profileData.private) === true || (followers === 0 && media.length === 0);
      if (isPrivate) {
        return {
          success: false,
          code: "PRIVATE_PROFILE",
          message: "This profile appears to be private. We can only analyze public profiles.",
        };
      }
      if (!media.length) {
        return {
          success: false,
          code: "NO_POSTS",
          message: "No posts found for this profile. We need at least some public posts to calculate the score.",
        };
      }

      const full = computeScore(profileData) as FullScoreResult;

      const updates: Record<string, unknown> = {
        lastBrandCollabCallAt: FieldValue.serverTimestamp(),
      };

      if (planType === "free") {
        updates.brandCollabUsage = {
          lifetimeUsed: lifetimeUsed + 1,
          monthlyUsed: 0,
          monthlyResetDate: null,
        };
      } else if (planType === "pro") {
        updates.brandCollabUsage = {
          ...usage,
          lifetimeUsed: usage.lifetimeUsed ?? 0,
          monthlyUsed: monthlyUsed + 1,
          monthlyResetDate,
        };
      }

      await userRef.set(updates, { merge: true });

      if (planType === "pro") {
        return {
          ...full,
          dealEstimate: full.dealEstimate,
          expectedEngagementRange: full.expectedEngagementRange,
          actualEngagementRate: full.actualEngagementRate,
          riskFlags: full.riskFlags,
          enableExport: true,
        };
      }

      return {
        success: true,
        totalScore: full.totalScore,
        status: full.status,
        breakdown: full.breakdown,
        followers: full.followers,
        avgLikes: full.avgLikes,
        avgComments: full.avgComments,
        avgReelViews: full.avgReelViews,
        recommendations: full.recommendations,
        enableExport: false,
      };
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("NO_POSTS") || msg === "NO_POSTS") {
        return {
          success: false,
          code: "NO_POSTS",
          message: "No posts found for this profile. We need at least some public posts to calculate the score.",
        };
      }
      if (msg.includes("private") || msg.includes("Private")) {
        return {
          success: false,
          code: "PRIVATE_PROFILE",
          message: "This profile appears to be private. We can only analyze public profiles.",
        };
      }
      console.error("getBrandCollabScore error:", err?.message || err);
      return {
        success: false,
        code: "CALCULATION_FAILED",
        message: "Unable to calculate score. Please try again later.",
      };
    }
  }
);
