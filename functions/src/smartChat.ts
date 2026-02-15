import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import fetch from "node-fetch";
import axios from "axios";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Only initialize if not already initialized
if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

// Define OpenAI API key secret
const openaiApiKeySecret = defineSecret("OPENAI_API_KEY");

// Define Social Blade secrets (for fallback when instagramAnalytics is empty)
const sbClientId = defineSecret("SB_CLIENT_ID");
const sbApiToken = defineSecret("SB_API_TOKEN");

/**
 * Smart Chat AI
 * - Accepts any user question
 * - Uses analytics context if available
 * - Responds intelligently (not hardcoded)
 */
function classifyIntent(message: string) {
  const m = message.toLowerCase();

  // 1️⃣ DATA-DEPENDENT (needs analytics)
  if (
    m.includes("hashtag") ||
    m.includes("hashtags") ||
    m.includes("tag suggestions") ||
    m.includes("tag suggestion") ||
    m.includes(" tags ") ||
    /\btags?\b/.test(m) ||          // handles "tags", "tag"
    /\bhashtags?\b/.test(m) ||      // handles misspellings like "hastags"/"hastag"
    /\bhash tags?\b/.test(m)
  ) {
    return "HASHTAG_SUGGESTION";
  }

  if (
    m.includes("best time") ||
    m.includes("when to post")
  ) return "POSTING_TIME";

  if (
    m.includes("best post") ||
    m.includes("top post") ||
    m.includes("best performing") ||
    m.includes("top performing") ||
    m.includes("which posts perform best") ||
    m.includes("which post performs best") ||
    m.includes("top performing reel") ||
    m.includes("top reel") ||
    m.includes("best reel") ||
    m.includes("top performing content") ||
    m.includes("url of") ||
    m.includes("url for") ||
    m.includes("link to") ||
    m.includes("link of") ||
    (m.includes("url") && (m.includes("post") || m.includes("content")))
  ) return "CONTENT_PERFORMANCE";

  // 2️⃣ WHY ABOUT POSTS (data-driven: explain from numbers, not generic advice)
  if (
    m.includes("why") &&
    (m.includes("these") || m.includes("those") || m.includes("top") || m.includes("post") || m.includes("best") || m.includes("performing"))
  ) return "WHY_ABOUT_POSTS";

  // 3️⃣ DIAGNOSIS (zero data allowed)
  if (
    m.includes("why") ||
    m.includes("not working") ||
    m.includes("low")
  ) return "DIAGNOSIS";

  // 4️⃣ GENERATION / STRATEGY (zero data allowed)
  if (
    m.includes("grow") ||
    m.includes("increase") ||
    m.includes("improve") ||
    m.includes("ideas") ||
    m.includes("idea") ||
    m.includes("strategy") ||
    m.includes("strategies") ||
    m.includes("tips") ||
    m.includes("advice") ||
    m.includes("how to")
  ) return "GENERATION";

  // 5️⃣ SAFE DEFAULT
  return "GENERATION";
}

function hasEnoughData(intent: string, mediaCount: number) {
  if (intent === "HASHTAG_SUGGESTION") return true;
  if (intent === "HASHTAG_ANALYSIS") return mediaCount >= 10;
  if (intent === "CONTENT_PERFORMANCE") return mediaCount >= 5;
  if (intent === "POSTING_TIME") return mediaCount >= 15;
  if (intent === "WHY_ABOUT_POSTS") return mediaCount >= 3;
  if (intent === "DIAGNOSIS") return true;
  if (intent === "GENERATION") return true;
  return false;
}

// Classify which DATA CATEGORY a request belongs to, based on intent.
// This controls which data source is preferred and which fallbacks apply.
function classifyDataCategory(intent: string) {
  if (
    intent === "CONTENT_PERFORMANCE" ||
    intent === "TOP_PERFORMING_POST" ||
    intent === "TOP_PERFORMING_REEL" ||
    intent === "WHY_ABOUT_POSTS"
  ) {
    return "POST_LEVEL_DATA";
  }
  if (intent === "POSTING_TIME") {
    return "TIME_ANALYSIS";
  }
  if (intent === "HASHTAG_ANALYSIS" || intent === "HASHTAG_SUGGESTION") {
    return "HASHTAG_ANALYSIS";
  }
  // Default: account-level metrics (followers, averages, growth, etc.)
  return "ACCOUNT_LEVEL_DATA";
}

// Whether this query must be answered from APIFY post data only.
// APIFY_REQUIRED: never block due to missing Instagram Analytics; use APIFY post data.
function isApifyRequired(intent: string): boolean {
  const cat = classifyDataCategory(intent);
  return (
    cat === "POST_LEVEL_DATA" ||
    cat === "TIME_ANALYSIS" ||
    cat === "HASHTAG_ANALYSIS"
  );
}

// STRATEGY_ONLY: no data required; never check analytics/APIFY or return "not enough data".
const STRATEGY_ONLY_INTENTS = ["GENERATION", "DIAGNOSIS"];
function isStrategyOnly(intent: string): boolean {
  return STRATEGY_ONLY_INTENTS.includes(intent);
}

// ANALYTICS_REQUIRED: account metrics only; may show "post-level analytics not found" when data missing.
function isAnalyticsRequired(intent: string): boolean {
  const analyticsIntentsList = [
    "CONTENT_PERFORMANCE",
    "HASHTAG_ANALYSIS",
    "POSTING_TIME",
    "TOP_PERFORMING_POST",
    "TOP_PERFORMING_REEL",
    "BEST_HASHTAGS",
  ];
  return analyticsIntentsList.includes(intent) && !isApifyRequired(intent);
}

/** FINAL_DECISION: All interpretation in code. GPT may ONLY explain facts decided here. */
interface FinalDecision {
  intent: string;
  metrics: { engagementRate: number; followersCount: number; avgLikes: number; avgComments: number; totalMedia: number; postingTimeSpread?: number };
  verdict: string;
  facts: string[];
  limitations: string[];
  nextStep: string;
}

function buildFinalDecision(params: {
  intent: string;
  engagementRate: number;
  followersCount: number;
  avgLikes: number;
  avgComments: number;
  totalMedia: number;
  postingTimeSpread?: number;
  bestContentType?: string;
  reachTrend?: string;
}): FinalDecision {
  const { intent, engagementRate, followersCount, avgLikes, avgComments, totalMedia, postingTimeSpread, bestContentType, reachTrend } = params;
  const metrics = { engagementRate, followersCount, avgLikes, avgComments, totalMedia, postingTimeSpread };
  const facts: string[] = [];
  const limitations: string[] = [];
  let verdict = "HEALTHY_ENGAGEMENT";
  let nextStep = "Run Instagram Analytics to fetch more posts, then ask again.";

  // INSUFFICIENT_DATA: intent-specific limitation. Different questions → different responses.
  if (totalMedia === 0 || totalMedia < 10) {
    verdict = "INSUFFICIENT_DATA";
    let dataChecked = "We checked your account.";
    if (intent === "POSTING_TIME") {
      dataChecked = "We checked posting times across your recent posts.";
      limitations.push("Not enough posts in varied time slots to compare performance by hour.");
      nextStep = "Post at 2–3 different times this week, run Instagram Analytics, then ask again for best time.";
    } else if (intent === "CONTENT_PERFORMANCE" || intent === "TOP_PERFORMING_POST" || intent === "TOP_PERFORMING_REEL" || intent === "WHY_ABOUT_POSTS") {
      dataChecked = "We checked your posts for likes and comments.";
      limitations.push("Not enough posts to compare which content performs best.");
      nextStep = "Run Instagram Analytics to fetch your posts, then ask which posts perform best.";
    } else if (intent === "HASHTAG_ANALYSIS" || intent === "HASHTAG_SUGGESTION") {
      dataChecked = "We checked your posts for captions and hashtags.";
      limitations.push("Not enough posts with hashtags to analyze or suggest.");
      nextStep = "Add hashtags to your captions, run Instagram Analytics, then ask for hashtag insights.";
    } else if (intent === "DIAGNOSIS") {
      dataChecked = "We checked your account for engagement metrics.";
      limitations.push("Not enough post data to diagnose engagement issues.");
      nextStep = "Run Instagram Analytics to fetch your posts, then ask about engagement.";
    } else if (intent === "GENERATION") {
      dataChecked = "We checked your account for post data to tailor ideas.";
      limitations.push("No post data yet to personalize content ideas.");
      nextStep = "Run Instagram Analytics to fetch your posts, then ask for content ideas—we'll personalize based on your top content.";
    } else {
      limitations.push("Not enough posts to compare performance.");
      nextStep = "Run Instagram Analytics to fetch your posts, then ask again.";
    }
    facts.push(dataChecked);
    facts.push(`${totalMedia} posts available.`);
    if (totalMedia === 0 && (followersCount > 0 || engagementRate > 0)) {
      facts.push(`Account-level data (Social Blade): ${followersCount.toLocaleString()} followers, ${engagementRate}% engagement.`);
    }
    return { intent, metrics, verdict, facts, limitations, nextStep };
  }

  facts.push(`We analyzed your last ${totalMedia} posts.`);
  facts.push(`Followers: ${followersCount.toLocaleString()}.`);
  facts.push(`Engagement rate: ${engagementRate}%.`);
  facts.push(`Avg likes per post: ${avgLikes.toLocaleString()}.`);
  facts.push(`Avg comments per post: ${avgComments.toLocaleString()}.`);
  if (bestContentType) facts.push(`Best performing content type: ${bestContentType}.`);
  if (reachTrend && reachTrend !== "stable") facts.push(`Engagement trend: ${reachTrend}.`);

  if (engagementRate > 20) {
    verdict = "HIGH_ENGAGEMENT";
    facts.push("Your engagement is above average.");
    nextStep = "Post at two different time slots this week and compare saves.";
  } else if (engagementRate > 0 && engagementRate <= 5) {
    verdict = "LOW_ENGAGEMENT";
    nextStep = "Post 3 Reels in different formats this week and compare engagement.";
  }

  if (postingTimeSpread !== undefined && postingTimeSpread < 3) {
    limitations.push("Best time to post cannot be determined — most posts were in a narrow time window.");
    nextStep = "Post at 2–3 different time slots over the next week, then run Analytics again.";
  }
  if (totalMedia < 15) {
    limitations.push("Limited sample size — insights may change with more posts.");
  }

  return { intent, metrics, verdict, facts, limitations, nextStep };
}

function isValidResponse(reply: string, decision: FinalDecision): boolean {
  const forbidden = ["typically", "usually", "generally", "you should focus on", "analyze your insights", "your content isn't compelling", "best practices suggest"];
  const lower = reply.toLowerCase();
  if (forbidden.some((f) => lower.includes(f))) return false;
  const hasDataAnalyzed = /data\s+analyzed|we\s+analyzed|we\s+checked/i.test(reply);
  const hasFacts = /\d|followers|engagement|likes|comments|posts/i.test(reply);
  const hasNextStep = /post|run|compare|try|ask\s+again/i.test(reply);
  return hasDataAnalyzed && hasFacts && hasNextStep;
}

function buildResponseFromDecision(decision: FinalDecision): string {
  // Map FINAL_DECISION into a single, clean explanation.
  const dataAnalyzed = decision.facts[0] || "We analyzed your account.";
  const found = decision.facts.length > 1
    ? decision.facts.slice(1).join(" ")
    : decision.facts[0] || "No metrics available yet.";

  return buildAnalystResponse({
    dataAnalyzed,
    found,
    cannotConclude: decision.limitations.length > 0 ? decision.limitations.join(" ") : undefined,
    recommendation: decision.nextStep,
  });
}

const ANALYZE_MORE_SUGGESTION = " Want more data? Say 'analyze 50 posts', 'analyze 30 days', or 'analyze 90 days'—it will take longer but we'll fetch and analyze them.";

/** Response Contract helper: (1) What data was analyzed (2) What was found (numbers only) (3) What cannot be concluded (4) Clear, testable recommendation */

function buildAnalystResponse(params: {
  dataAnalyzed: string;
  found: string;
  cannotConclude?: string;
  recommendation: string;
}): string {
  const parts: string[] = [
    params.dataAnalyzed,
    "",
    params.found,
  ];

  if (params.cannotConclude) {
    parts.push("", params.cannotConclude);
  }

  parts.push("", params.recommendation + ANALYZE_MORE_SUGGESTION);
  return parts.join("\n");
}

function buildLimitationResponse(params: {
  dataChecked: string;
  reason: string;
  nextStep: string;
}): string {
  return buildAnalystResponse({
    dataAnalyzed: params.dataChecked,
    found: params.reason,
    cannotConclude: "Because of this, we can't confidently answer your question yet.",
    recommendation: params.nextStep,
  });
}

export const smartChat = onCall(
  {
    region: "us-central1",
    secrets: [openaiApiKeySecret, sbClientId, sbApiToken],
    timeoutSeconds: 60,
    memory: "512MiB",
    minInstances: 1,
  },
  async (request) => {
    try {
      const { message, username, analyticsContext, conversationHistory } = request.data;
      let intent = classifyIntent(message);
      const dataCategory = classifyDataCategory(intent);
      console.log("SmartChat - Detected intent and data category:", {
        intent,
        dataCategory,
      });

      // Log user message
      console.log("SmartChat - User message:", message);
      if (username) console.log("SmartChat - Username:", username);
      if (analyticsContext) console.log("SmartChat - Analytics context provided:", Object.keys(analyticsContext));

      // #region agent log
      const _hasCtx = !!analyticsContext;
      const _ctxKeys = analyticsContext ? Object.keys(analyticsContext) : [];
      const _ctxMedia = Array.isArray(analyticsContext?.media) ? analyticsContext.media.length : 0;
      const _ctxPosts = Array.isArray(analyticsContext?.posts) ? analyticsContext.posts.length : 0;
      const _ctxProfileMedia = Array.isArray(analyticsContext?.profile?.media) ? analyticsContext.profile.media.length : 0;
      fetch("http://127.0.0.1:7242/ingest/dcca6a12-25ed-423d-9a0e-4081990ce7f0",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({location:"smartChat.ts:entry",message:"Request data and analyticsContext",data:{hasAnalyticsContext:_hasCtx,ctxKeys:_ctxKeys,ctxMediaLen:_ctxMedia,ctxPostsLen:_ctxPosts,ctxProfileMediaLen:_ctxProfileMedia},timestamp:Date.now(),sessionId:"debug-session",hypothesisId:"H2"})}).catch(()=>{});
      // #endregion

      const analyticsMedia: any[] | null = Array.isArray(analyticsContext?.media)
        ? analyticsContext.media
        : Array.isArray(analyticsContext?.posts)
        ? analyticsContext.posts
        : Array.isArray(analyticsContext?.profile?.media)
        ? analyticsContext.profile.media
        : null;
      const hasAnalyticsMedia = Array.isArray(analyticsMedia) && analyticsMedia.length > 0;

      if (!message || typeof message !== "string" || message.trim().length === 0) {
        throw new HttpsError("invalid-argument", "Message is required and must be a non-empty string");
      }

      // Get authenticated user ID
      const userId = request.auth?.uid;
      console.log("SmartChat - User ID:", userId);
      if (!userId) {
        throw new HttpsError("unauthenticated", "User must be authenticated to use Smart Chat");
      }

      // Fetch user document from Firestore to check prerequisites
      const userDocRef = db.collection("users").doc(userId);
      const userDoc = await userDocRef.get();

      console.log("SmartChat - User document exists:", userDoc.exists);

      if (!userDoc.exists) {
        throw new HttpsError(
          "failed-precondition",
          "Please add an Instagram account in Analytics to use Smart Chat."
        );
      }

      const userData = userDoc.data();
      console.log("SmartChat - User data:", {
        hasSelectedAccount: !!userData?.selectedInstagramAccount,
        selectedAccount: userData?.selectedInstagramAccount,
        analyticsReady: userData?.analyticsReady,
        analyticsReadyType: typeof userData?.analyticsReady,
        analyticsReadyValue: userData?.analyticsReady
      });

      // Check if selectedInstagramAccount exists
      if (!userData?.selectedInstagramAccount) {
        console.log("SmartChat - ERROR: selectedInstagramAccount is missing");
        throw new HttpsError(
          "failed-precondition",
          "Please add an Instagram account in Analytics to use Smart Chat."
        );
      }

      const selectedAccount = userData.selectedInstagramAccount;
      const normalizedAccount = selectedAccount.toLowerCase().trim();
      console.log("SmartChat - Selected account:", selectedAccount);

      // Fetch raw Apify data from users/{userId}/rawInstagramData/{username}
      // Try exact selectedAccount first, then normalized (lowercase) for casing mismatch
      let rawDataDocRef = db.collection("users").doc(userId).collection("rawInstagramData").doc(selectedAccount);
      let rawDataDoc = await rawDataDocRef.get();
      if (!rawDataDoc.exists && normalizedAccount !== selectedAccount) {
        rawDataDocRef = db.collection("users").doc(userId).collection("rawInstagramData").doc(normalizedAccount);
        rawDataDoc = await rawDataDocRef.get();
        if (rawDataDoc.exists) console.log("SmartChat - Found raw data at normalized path:", normalizedAccount);
      }
      
      console.log("SmartChat - Raw data document exists:", rawDataDoc.exists);
      console.log("SmartChat - Raw data document path:", `users/${userId}/rawInstagramData/${selectedAccount}`);
      
      // #region agent log
      const _rawProfile = rawDataDoc.exists ? rawDataDoc.data()?.profile : null;
      const _rawMediaLen = Array.isArray(_rawProfile?.media) ? _rawProfile.media.length : 0;
      fetch("http://127.0.0.1:7242/ingest/dcca6a12-25ed-423d-9a0e-4081990ce7f0",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({location:"smartChat.ts:rawDataFetch",message:"Raw APIFY data availability",data:{rawDataExists:rawDataDoc.exists,selectedAccount,normalizedAccount,rawMediaCount:_rawMediaLen,pathTried:`users/${userId}/rawInstagramData/${selectedAccount}`},timestamp:Date.now(),sessionId:"debug-session",hypothesisId:"H1,H4"})}).catch(()=>{});
      // #endregion
      
      // STRATEGY_ONLY: never block on analytics/APIFY; skip data checks.
      const strategyOnly = isStrategyOnly(intent);
      if (!strategyOnly) {
        // Check if analytics data exists - if it does, allow Smart Chat even if flag isn't set
        if (!rawDataDoc.exists && !hasAnalyticsMedia) {
          console.log("SmartChat - Raw data does NOT exist. Checking analyticsReady flag...");
          if (userData.analyticsReady !== true) {
            console.log("SmartChat - Analytics still processing. Returning in-chat message.");
            return {
              success: true,
              reply: buildLimitationResponse({
                dataChecked: "We checked for your account data.",
                reason: "The analysis is still running.",
                nextStep: "Wait a minute, then ask again. If it's been a while, open the Analytics page and run the analysis once.",
              }),
            };
          }
          console.log("SmartChat - Raw data not ready. Returning in-chat message.");
          return {
            success: true,
            reply: buildLimitationResponse({
              dataChecked: "We looked for analytics for your account.",
              reason: "No data has been fetched yet.",
              nextStep: "Go to the Analytics section, add your Instagram account, and run the analysis. Once that's done, come back and ask your question again.",
            }),
          };
        }
      }
      if (!rawDataDoc.exists && hasAnalyticsMedia) {
        console.log("SmartChat - Raw data missing but analyticsContext provides media. Proceeding with analyticsContext as source of truth.");
      }

      // If data exists but flag isn't set, set it now (recovery mechanism)
      if (userData.analyticsReady !== true) {
        await userDocRef.set({
          analyticsReady: true,
        }, { merge: true });
        console.log(`SmartChat - Auto-set analyticsReady to true for user ${userId}`);
      }

      console.log(`SmartChat - User ${userId} passed guard checks. Selected account: ${selectedAccount}`);

      // Fetch Apify analytics data for personalized context
      let accountContextBlock = "";
      
      // ============================================
      // CRITICAL: Fetch pre-calculated analytics FIRST
      // This ensures Smart Chat uses the EXACT SAME data as the Analytics page
      // ============================================
      // Normalize username to lowercase (Firestore document IDs are case-sensitive)
      // IMPORTANT: This MUST match how fetchAndStoreInstagramData stores it
      const normalizedUsername = selectedAccount.toLowerCase().trim();
      
      console.log("SmartChat - ========================================");
      console.log("SmartChat - FETCHING ANALYTICS FOR SMART CHAT");
      console.log("SmartChat - Original selectedAccount:", selectedAccount);
      console.log("SmartChat - Normalized username:", normalizedUsername);
      console.log("SmartChat - Fetching from path: instagramAnalytics/" + normalizedUsername);
      console.log("SmartChat - ========================================");
      
      const analyticsDocRef = db.collection("instagramAnalytics").doc(normalizedUsername);
      const analyticsDoc = await analyticsDocRef.get();
      
      console.log("SmartChat - Document exists:", analyticsDoc.exists);
      // #region agent log
      const _anaData = analyticsDoc.exists ? analyticsDoc.data() : null;
      const _anaPostsLen = Array.isArray((_anaData as any)?.posts) ? (_anaData as any).posts.length : 0;
      fetch("http://127.0.0.1:7242/ingest/dcca6a12-25ed-423d-9a0e-4081990ce7f0",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({location:"smartChat.ts:analyticsDocFetch",message:"instagramAnalytics doc availability",data:{analyticsDocExists:analyticsDoc.exists,normalizedUsername,postsCount:_anaPostsLen,path:`instagramAnalytics/${normalizedUsername}`},timestamp:Date.now(),sessionId:"debug-session",hypothesisId:"H1,H3"})}).catch(()=>{});
      // #endregion
      
      // Initialize all metrics with defaults
      let engagementRate = 0;
      let followersCount = 0;
      let avgLikes = 0;
      let avgComments = 0;
      let postingFrequency = 0;
      let topHashtags: string[] = [];
      let hasPreCalculatedAnalytics = false;
      let analyticsPosts: any[] | null = null;
      let analyticsDocExistsForPosts = false;
      
      // If pre-calculated analytics exist, use them (same source as Analytics page)
      // This is the SINGLE SOURCE OF TRUTH for all metrics displayed in Analytics
      if (analyticsDoc.exists) {
        const analyticsData = analyticsDoc.data();
        hasPreCalculatedAnalytics = true;
        analyticsDocExistsForPosts = true;
        
        console.log("SmartChat - ✅✅✅ FOUND PRE-CALCULATED ANALYTICS ✅✅✅");
        console.log("SmartChat - Document path: instagramAnalytics/" + normalizedUsername);
        console.log("SmartChat - Raw document data (FULL):", JSON.stringify(analyticsData, null, 2));
        console.log("SmartChat - Document keys:", Object.keys(analyticsData || {}));
        console.log("SmartChat - Checking each field individually:");
        console.log("  - analyticsData?.engagementRate:", analyticsData?.engagementRate, "Type:", typeof analyticsData?.engagementRate);
        console.log("  - analyticsData?.followers:", analyticsData?.followers, "Type:", typeof analyticsData?.followers);
        console.log("  - analyticsData?.avgLikes:", analyticsData?.avgLikes, "Type:", typeof analyticsData?.avgLikes);
        console.log("  - analyticsData?.avgComments:", analyticsData?.avgComments, "Type:", typeof analyticsData?.avgComments);
        console.log("  - analyticsData?.postingFrequency:", analyticsData?.postingFrequency, "Type:", typeof analyticsData?.postingFrequency);
        console.log("  - analyticsData?.topHashtags:", analyticsData?.topHashtags, "Type:", typeof analyticsData?.topHashtags);
        console.log("  - analyticsData?.posts:", Array.isArray((analyticsData as any)?.posts) ? (analyticsData as any).posts.length : "none", "Type:", typeof (analyticsData as any)?.posts);
        
        // Use ALL pre-calculated metrics - these match what Analytics page shows
        // CRITICAL: Check for both camelCase and snake_case field names (in case of inconsistency)
        engagementRate = analyticsData?.engagementRate ?? analyticsData?.engagement_rate ?? 0;
        followersCount = analyticsData?.followers ?? analyticsData?.followerCount ?? analyticsData?.followersCount ?? 0;
        avgLikes = analyticsData?.avgLikes ?? analyticsData?.avg_likes ?? 0;
        avgComments = analyticsData?.avgComments ?? analyticsData?.avg_comments ?? 0;
        postingFrequency = analyticsData?.postingFrequency ?? analyticsData?.posting_frequency ?? 0;
        topHashtags = Array.isArray(analyticsData?.topHashtags) ? analyticsData.topHashtags : 
                     Array.isArray(analyticsData?.top_hashtags) ? analyticsData.top_hashtags : [];
        const postsFromAnalytics = (analyticsData as any)?.posts;
        const postsCount = Array.isArray(postsFromAnalytics)
          ? postsFromAnalytics.length
          : 0;
        console.log("SmartChat - Analytics posts field (primary doc):", {
          hasPostsField: Array.isArray(postsFromAnalytics),
          postsCount,
        });
        if (postsCount > 0) {
          analyticsPosts = postsFromAnalytics;
        }
        
        console.log("SmartChat - Extracted metrics (after field name fallback):", {
          engagementRate: engagementRate,
          engagementRateType: typeof engagementRate,
          followersCount: followersCount,
          avgLikes: avgLikes,
          avgComments: avgComments,
          postingFrequency: postingFrequency,
          topHashtagsCount: topHashtags.length,
        });
        
        // If all values are 0, this might indicate the document exists but has no data
        // In this case, we should calculate from raw data instead
        const hasValidData = engagementRate > 0 || followersCount > 0 || avgLikes > 0 || avgComments > 0;
        
        if (!hasValidData) {
          console.log("SmartChat - ⚠️ WARNING: Document exists but all metrics are 0!");
          console.log("SmartChat - This means the document was created but never populated with actual data");
          console.log("SmartChat - Falling back to calculating from raw data...");
          hasPreCalculatedAnalytics = false; // Mark as false so we calculate from raw data
        } else {
          console.log("SmartChat - ✅ Valid metrics found - these will be used in AI response (SAME as Analytics page)");
        }
      } else {
        console.log("SmartChat - ⚠️ Pre-calculated analytics not found at path:", `instagramAnalytics/${normalizedUsername}`);
        console.log("SmartChat - Trying alternative case variations...");
        
        // Try alternative case variations if document not found
        // Also try original case (in case it wasn't normalized when stored)
        const altVariations = [
          selectedAccount, // Original case (exact match)
          selectedAccount.toLowerCase().trim(), // Lowercase trimmed
          selectedAccount.toUpperCase().trim(), // Uppercase
        ].filter((v, index, self) => self.indexOf(v) === index); // Remove duplicates
        
        let foundAlt = false;
        for (const altUsername of altVariations) {
          if (altUsername === normalizedUsername) continue; // Skip already tried
          
          const altDocRef = db.collection("instagramAnalytics").doc(altUsername);
          const altDoc = await altDocRef.get();
          if (altDoc.exists) {
            console.log(`SmartChat - ✅ Found analytics at alternative path: instagramAnalytics/${altUsername}`);
            const altData = altDoc.data();
            engagementRate = altData?.engagementRate ?? 0;
            followersCount = altData?.followers ?? 0;
            avgLikes = altData?.avgLikes ?? 0;
            avgComments = altData?.avgComments ?? 0;
            postingFrequency = altData?.postingFrequency ?? 0;
            topHashtags = Array.isArray(altData?.topHashtags) ? altData.topHashtags : [];
            hasPreCalculatedAnalytics = true;
            foundAlt = true;
            analyticsDocExistsForPosts = true;
            const altPosts = (altData as any)?.posts;
            const altPostsCount = Array.isArray(altPosts) ? altPosts.length : 0;
            console.log("SmartChat - Analytics posts field (alternative doc):", {
              path: `instagramAnalytics/${altUsername}`,
              hasPostsField: Array.isArray(altPosts),
              postsCount: altPostsCount,
            });
            if (altPostsCount > 0) {
              analyticsPosts = altPosts;
            }
            console.log("SmartChat - Using alternative path metrics:", { 
              engagementRate, 
              followersCount,
              path: `instagramAnalytics/${altUsername}`
            });
            break;
          }
        }
        
        if (!foundAlt) {
          console.log("SmartChat - ⚠️ No analytics found in instagramAnalytics collection");
          console.log("SmartChat - Tried paths:", [
            `instagramAnalytics/${normalizedUsername}`,
            ...altVariations.map(v => `instagramAnalytics/${v}`)
          ]);
          console.log("SmartChat - Will calculate from raw data (fallback)");
          console.log("SmartChat - NOTE: This means analytics may not match Analytics page. Please re-analyze the account.");
        }
      }

      // Fetch raw data for additional metrics (content type performance, trends, etc.)
      // NOTE: We still need raw data for metrics NOT stored in instagramAnalytics
      // (e.g., reel vs post performance, growth trends, content type analysis)
      const rawData = rawDataDoc.exists ? rawDataDoc.data() : null;
      let profileData: any = rawData?.profile || null;

      if (hasAnalyticsMedia) {
        if (!profileData) {
          profileData = {};
        }
        profileData.media = analyticsMedia;
      }
      
      // Preferred post-level analytics source for SmartChat:
      // instagramAnalytics/{username}.posts (single source of truth for posts)
      const analyticsIntents = [
        "CONTENT_PERFORMANCE",
        "HASHTAG_ANALYSIS",
        "POSTING_TIME",
        "TOP_PERFORMING_POST",
        "TOP_PERFORMING_REEL",
        "BEST_HASHTAGS",
      ];

      const posts =
        Array.isArray(analyticsPosts) && analyticsPosts.length > 0
          ? analyticsPosts
          : null;

      if (analyticsIntents.includes(intent)) {
        const postsCount = Array.isArray(posts) ? posts.length : 0;
        const rawMedia = rawDataDoc.exists ? rawDataDoc.data()?.profile?.media : null;
        const apifyMediaCount = Array.isArray(rawMedia) ? rawMedia.length : 0;

        console.log("SmartChat - Analytics posts availability check:", {
          intent,
          dataCategory,
          isApifyRequired: isApifyRequired(intent),
          analyticsDocExists: analyticsDocExistsForPosts,
          postsDefined: Array.isArray(posts),
          postsCount,
          apifyMediaCount,
        });

        // "Post-level analytics not found" only for ANALYTICS_REQUIRED; never for STRATEGY_ONLY or APIFY_REQUIRED.
        if (isAnalyticsRequired(intent)) {
          if (
            analyticsDocExistsForPosts &&
            postsCount === 0 &&
            apifyMediaCount === 0
          ) {
            console.log(
              "SmartChat - Fallback triggered (ANALYTICS_REQUIRED): analytics doc exists but posts[] and APIFY media are empty."
            );
            return {
              success: true,
              reply: buildLimitationResponse({
                dataChecked: "We checked your account for post data.",
                reason: "We don't have any posts stored yet.",
                nextStep: "Open Analytics, pick this account, and run the analysis so we can fetch your posts. Then ask again.",
              }),
            };
          }
        }
      }
      
      // Only extract followers from raw data if we don't have pre-calculated analytics
      if (!hasPreCalculatedAnalytics && profileData) {
        followersCount = profileData.followersCount || profileData.followerCount || 0;
      }

      // Source of media for calculations:
      // - Prefer instagramAnalytics.posts when available
      // - Otherwise fall back to raw/profile media
      const mediaFromApify = Array.isArray(profileData?.media)
        ? profileData.media
        : [];
      const mediaFromAnalytics = Array.isArray(posts) ? posts : [];

      // DATA ROUTING (SCALABLE):
      // - POST_LEVEL_DATA / TIME_ANALYSIS / HASHTAG_ANALYSIS → prefer APIFY post-level data
      // - ACCOUNT_LEVEL_DATA → prefer instagramAnalytics.posts for consistency with Analytics page
      let media: any[] = [];
      if (
        dataCategory === "POST_LEVEL_DATA" ||
        dataCategory === "TIME_ANALYSIS" ||
        dataCategory === "HASHTAG_ANALYSIS"
      ) {
        media =
          mediaFromApify.length > 0
            ? mediaFromApify
            : mediaFromAnalytics.length > 0
            ? mediaFromAnalytics
            : [];
      } else {
        media =
          mediaFromAnalytics.length > 0
            ? mediaFromAnalytics
            : mediaFromApify.length > 0
            ? mediaFromApify
            : [];
      }

      if (!Array.isArray(media)) {
        media = [];
      }

      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/dcca6a12-25ed-423d-9a0e-4081990ce7f0",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({location:"smartChat.ts:mediaRouting",message:"Final media source after routing",data:{mediaFromApifyLen:mediaFromApify.length,mediaFromAnalyticsLen:mediaFromAnalytics.length,finalMediaLen:media.length,dataCategory,intent},timestamp:Date.now(),sessionId:"debug-session",hypothesisId:"H5"})}).catch(()=>{});
      // #endregion

      // Data sufficiency guard:
      // For post/time/hashtag analytics backed by APIFY, we ONLY block when there is truly zero data.
      // This keeps the system scalable and avoids over-blocking when some history exists.
      const mediaLength = Array.isArray(media) ? media.length : 0;

      // EARLY Social Blade fallback: when Apify has no media, try Social Blade for account-level metrics.
      // This ensures Smart Chat gets data when Instagram Analytics (Apify) has not run.
      if (mediaLength === 0) {
        try {
          const sbClientIdValue = sbClientId.value();
          const sbApiTokenValue = sbApiToken.value();
          if (sbClientIdValue && sbApiTokenValue) {
            const sbUrl = `https://matrix.sbapis.com/b/instagram/statistics?query=${encodeURIComponent(selectedAccount)}`;
            const sbHeaders: Record<string, string> = {
              "clientid": sbClientIdValue,
              "token": sbApiTokenValue,
              "Content-Type": "application/json",
            };
            const sbRes = await axios.get(sbUrl, { headers: sbHeaders, timeout: 10000 });
            if (sbRes.data?.status?.success && sbRes.data?.data?.statistics?.total) {
              const sbTotal = sbRes.data.data.statistics.total;
              const sbEngagementDecimal = sbTotal.engagement_rate || 0;
              const sbEngagement = sbEngagementDecimal > 0 ? parseFloat((sbEngagementDecimal * 100).toFixed(2)) : 0;
              const sbFollowers = sbTotal.followers || 0;
              if (sbEngagement > 0 || sbFollowers > 0) {
                engagementRate = sbEngagement;
                followersCount = sbFollowers;
                const sbDaily = sbRes.data.data.daily || [];
                if (sbDaily.length > 0) {
                  avgLikes = Math.round(sbDaily.reduce((s: number, d: any) => s + (d.avg_likes || 0), 0) / sbDaily.length);
                  avgComments = parseFloat((sbDaily.reduce((s: number, d: any) => s + (d.avg_comments || 0), 0) / sbDaily.length).toFixed(1));
                }
                console.log("SmartChat - Early Social Blade fallback: got account metrics (no Apify media)", {
                  engagementRate,
                  followersCount,
                  avgLikes,
                  avgComments,
                });
              }
            }
          }
        } catch (sbErr: any) {
          console.log("SmartChat - Early Social Blade fallback failed:", sbErr?.message);
        }
      }

      const shouldBlockNoData =
        !isStrategyOnly(intent) &&
        !isApifyRequired(intent) &&
        !hasEnoughData(intent, mediaLength) &&
        mediaLength === 0;
      if (shouldBlockNoData) {
        const sbContext = followersCount > 0 || engagementRate > 0
          ? ` We have account-level data (${followersCount.toLocaleString()} followers, ${engagementRate}% engagement) but no post-level data.`
          : "";
        return {
          success: true,
          reply: buildLimitationResponse({
            dataChecked: `We checked your recent posts.${sbContext}`,
            reason: "Right now we have no posts to work with (with likes, comments, or timestamps).",
            nextStep: "Run Instagram Analytics to fetch your posts, then ask your question again.",
          }),
        };
      }


      
      // Calculate metrics from raw data ONLY for:
      // 1. Content type analysis (reel vs post performance) - not stored in instagramAnalytics
      // 2. Growth trends - not stored in instagramAnalytics
      // 3. Fallback calculation if pre-calculated analytics don't exist
      let totalLikes = 0;
      let totalComments = 0;
      let reelCount = 0;
      let postCount = 0;
      let reelLikes = 0;
      let reelComments = 0;
      let postLikes = 0;
      let postComments = 0;
      const hashtagCounts: Record<string, number> = {};
      const mediaSummaries: {
        type: "Reel" | "Post";
        likes: number;
        comments: number;
        engagement: number;
        caption: string;
        timestamp: number;
        url: string | null;
      }[] = [];

      /** Build Instagram post URL from shortcode or use url/permalink if present */
      const getPostUrlFromItem = (item: any): string | null => {
        const url = item.url || item.permalink || item.link;
        if (url && typeof url === "string" && url.startsWith("http")) return url;
        const shortcode = item.shortcode || item.code;
        if (shortcode && typeof shortcode === "string") {
          return `https://www.instagram.com/p/${shortcode}/`;
        }
        return null;
      };

      if (Array.isArray(media) && media.length > 0) {
        media.forEach((item: any) => {
          const likes = item.likesCount || item.likeCount || 0;
          const comments = item.commentsCount || item.commentCount || 0;
          const engagement = likes + comments;
          totalLikes += likes;
          totalComments += comments;

          // Determine if it's a reel/video or post
          const isVideo = item.type === "Video" || item.isVideo === true || item.videoUrl || item.videoCodec;
          if (isVideo) {
            reelCount++;
            reelLikes += likes;
            reelComments += comments;
          } else {
            postCount++;
            postLikes += likes;
            postComments += comments;
          }
          const caption = item.caption || "";
          const timestamp =
            item.timestamp || item.takenAtTimestamp || 0;
          mediaSummaries.push({
            type: isVideo ? "Reel" : "Post",
            likes,
            comments,
            engagement,
            caption,
            timestamp,
            url: getPostUrlFromItem(item) || null,
          });
          
          // Extract hashtags (used elsewhere)
          if (caption) {
            const hashtags = caption.match(/#\w+/g) || [];
            hashtags.forEach((tag: string) => {
              const normalizedTag = tag.toLowerCase();
              hashtagCounts[normalizedTag] = (hashtagCounts[normalizedTag] || 0) + 1;
            });
          }
        });
      }
      
      const totalMedia = Array.isArray(media) ? media.length : 0;
      const overallAvgEngagement =
        totalMedia > 0 ? (totalLikes + totalComments) / totalMedia : 0;
      
      if (intent === "POSTING_TIME") {
        if (totalMedia === 0 && !isApifyRequired(intent)) {
          return {
            success: true,
            reply: buildLimitationResponse({
              dataChecked: "We checked posting times across your recent posts.",
              reason: "Most posts were published in a narrow time window (or we don't have timestamps). There aren't enough varied time slots to confidently compare performance.",
              nextStep: "Post at 2–3 different time slots over the next week, then run Instagram Analytics again. We'll analyze the results and suggest a best time.",
            }),
          };
        }
        if (totalMedia > 0) {
        const hourStats: Record<
          number,
          { totalEngagement: number; count: number }
        > = {};

        mediaSummaries.forEach((post) => {
          if (!post.timestamp) return;
          const date = new Date(post.timestamp * 1000);
          const hour = date.getUTCHours();
          if (!hourStats[hour]) {
            hourStats[hour] = { totalEngagement: 0, count: 0 };
          }
          hourStats[hour].totalEngagement += post.engagement;
          hourStats[hour].count += 1;
        });

        const rankedHours = Object.entries(hourStats)
          .map(([hour, stats]) => ({
            hour: Number(hour),
            avgEngagement: stats.totalEngagement / stats.count,
            postCount: stats.count,
          }))
          .sort((a, b) => b.avgEngagement - a.avgEngagement)
          .slice(0, 3);

        // When we have enough timestamp data, return data-driven reply; otherwise fall through to OpenAI for general advice.
        if (rankedHours.length !== 0) {
          const foundLines = rankedHours.map((h, index) =>
            `${index + 1}. Hour ${h.hour}:00–${h.hour}:59 UTC — avg engagement ${h.avgEngagement.toFixed(0)} (${h.postCount} posts).`
          ).join("\n");
          const multiplier = rankedHours.length > 1 && rankedHours[1].avgEngagement > 0
            ? (rankedHours[0].avgEngagement / rankedHours[1].avgEngagement).toFixed(1) + "x"
            : "highest";
          return {
            success: true,
            reply: buildAnalystResponse({
              dataAnalyzed: `We analyzed your last ${totalMedia} posts (UTC) by hour.`,
              found: foundLines,
              recommendation: `Post 3 Reels between ${rankedHours[0].hour}:00–${rankedHours[0].hour}:59 UTC over the next week and compare saves. Your engagement there is ${multiplier} your next-best hour.`,
            }),
          };
        }
      }
      }

      if (intent === "CONTENT_PERFORMANCE") {
        if (totalMedia === 0) {
          return {
            success: true,
            reply: buildLimitationResponse({
              dataChecked: "We checked your account for content with likes and comments.",
              reason: "We don't have any posts with likes or comments for this account yet.",
              nextStep: "Run Instagram Analytics to fetch your posts. Then ask again and we'll show which content performs best.",
            }),
          };
        }
        
        const topPosts = [...mediaSummaries]
          .sort((a, b) => b.engagement - a.engagement)
          .slice(0, 5);
        const factorX = overallAvgEngagement > 0 && topPosts[0].engagement > 0
          ? (topPosts[0].engagement / overallAvgEngagement).toFixed(1)
          : "the most";
        const foundLines = topPosts.map((post, index) => {
          const factor = overallAvgEngagement > 0
            ? (post.engagement / overallAvgEngagement).toFixed(2)
            : null;
          const detail = factor ? ` (${factor}x your avg)` : "";
          const urlLine = post.url ? ` URL: ${post.url}` : "";
          return `${index + 1}. ${post.type}: likes ${post.likes}, comments ${post.comments}, total engagement ${post.engagement}${detail}.${urlLine}`;
        }).join("\n");
        const topPostUrl = topPosts[0]?.url;
        const recSuffix = topPostUrl
          ? ` Direct link to your #1 post: ${topPostUrl}`
          : "";
        return {
          success: true,
          reply: buildAnalystResponse({
            dataAnalyzed: `We analyzed your last ${totalMedia} posts (avg engagement ${overallAvgEngagement.toFixed(0)}/post).`,
            found: foundLines,
            recommendation: `Double down on the format of your top-performing ${topPosts[0].type.toLowerCase()}. Post 3 more in that style over the next week and compare saves — it outperforms your average by ${factorX}.${recSuffix}`,
          }),
        };
      }
      
      if (intent === "HASHTAG_ANALYSIS") {
        if (totalMedia === 0) {
          return {
            success: true,
            reply: buildLimitationResponse({
              dataChecked: "We checked your posts for captions and hashtags.",
              reason: "We don't have any posts with captions or hashtags for this account yet.",
              nextStep: "Run Instagram Analytics to fetch your posts. Make sure your posts have captions with hashtags, then ask again.",
            }),
          };
        }
        
        const sortedByEngagement = [...mediaSummaries].sort(
          (a, b) => b.engagement - a.engagement
        );
        const topForHashtags = sortedByEngagement.slice(
          0,
          Math.min(10, sortedByEngagement.length)
        );
        
        const tagStats: Record<
          string,
          { totalEngagement: number; count: number }
        > = {};
        
        topForHashtags.forEach((post) => {
          const tags = post.caption.match(/#\w+/g) || [];
          const uniqueTags = Array.from(
            new Set(tags.map((t) => t.toLowerCase()))
          );
          uniqueTags.forEach((tag) => {
            if (!tagStats[tag]) {
              tagStats[tag] = { totalEngagement: 0, count: 0 };
            }
            tagStats[tag].totalEngagement += post.engagement;
            tagStats[tag].count += 1;
          });
        });
        
        const rankedTags = Object.entries(tagStats)
          .map(([tag, stats]) => ({
            tag,
            avgEngagement: stats.totalEngagement / stats.count,
            postCount: stats.count,
          }))
          .sort((a, b) => b.avgEngagement - a.avgEngagement)
          .slice(0, 10);
        
        if (rankedTags.length === 0) {
          return {
            success: true,
            reply: buildLimitationResponse({
              dataChecked: "We analyzed your top-performing posts for hashtag usage.",
              reason: "Your top-performing posts don't use enough hashtags to build a reliable comparison.",
              nextStep: "Add hashtags in your captions on the posts you care about, run Instagram Analytics again, then ask for hashtag insights.",
            }),
          };
        }
        
        const topTag = rankedTags[0];
        const secondAvg = rankedTags.length > 1 ? rankedTags[1].avgEngagement : 0;
        const multiplier = secondAvg > 0
          ? (topTag.avgEngagement / secondAvg).toFixed(1) + "x"
          : "the highest";
        const foundLines = rankedTags.map((tagInfo, index) =>
          `${index + 1}. ${tagInfo.tag} — avg engagement ${tagInfo.avgEngagement.toFixed(0)} across ${tagInfo.postCount} posts.`
        ).join("\n");
        return {
          success: true,
          reply: buildAnalystResponse({
            dataAnalyzed: `We analyzed your top ${topForHashtags.length} posts by engagement for hashtag performance.`,
            found: foundLines,
            recommendation: `Prioritize ${topTag.tag} in your next 3 posts. It drives ${multiplier} the avg engagement of your next-best hashtag. Compare saves after posting.`,
          }),
        };
      }
      
      // ============================================
      // FALLBACK: Only calculate core metrics if pre-calculated analytics don't exist OR are invalid (all zeros)
      // This ensures we NEVER override valid pre-calculated values with recalculated ones
      // But we DO calculate if the document exists but has no valid data
      // ============================================
      if (!hasPreCalculatedAnalytics) {
        console.log("SmartChat - Calculating core metrics from raw data (fallback mode)");
        console.log("SmartChat - Raw data stats:", {
          totalMedia,
          totalLikes,
          totalComments,
          rawFollowersCount: profileData.followersCount || profileData.followerCount || 0,
        });
        
        // Get followers from raw data if not already set
        if (followersCount === 0) {
          followersCount = profileData.followersCount || profileData.followerCount || 0;
        }
        
        avgLikes = totalMedia > 0 ? Math.round(totalLikes / totalMedia) : 0;
        avgComments = totalMedia > 0 ? Math.round(totalComments / totalMedia) : 0;
        engagementRate = followersCount > 0 && totalMedia > 0
          ? parseFloat(((totalLikes + totalComments) / (followersCount * totalMedia) * 100).toFixed(2))
          : 0;
        
        console.log("SmartChat - Calculated metrics from raw data:", {
          engagementRate,
          followersCount,
          avgLikes,
          avgComments,
        });
        
        // If calculated values are still 0 or very low, try Social Blade as final fallback
        // This matches what Analytics page does when Apify data is insufficient
        if (engagementRate === 0 && followersCount === 0 && totalMedia === 0) {
          console.log("SmartChat - Raw Apify data also has no metrics, trying Social Blade as final fallback...");
          try {
            const sbClientIdValue = sbClientId.value();
            const sbApiTokenValue = sbApiToken.value();
            
            if (sbClientIdValue && sbApiTokenValue) {
              // Use the same Social Blade API endpoint as getSocialBladeAnalytics function
              const url = `https://matrix.sbapis.com/b/instagram/statistics?query=${encodeURIComponent(selectedAccount)}`;
              const headers: Record<string, string> = {
                "clientid": sbClientIdValue,
                "token": sbApiTokenValue,
                "Content-Type": "application/json",
              };
              
              console.log("SmartChat - Calling Social Blade API:", url);
              const sbResponse = await axios.get(url, {
                headers,
                timeout: 10000,
              });
              
              if (sbResponse.data?.status?.success && sbResponse.data?.data?.statistics?.total) {
                const sbData = sbResponse.data.data.statistics.total;
                // Social Blade returns engagement_rate as a decimal (0.01 = 1%)
                // Need to multiply by 100 to match Analytics page format
                const sbEngagementRateDecimal = sbData.engagement_rate || 0;
                const sbEngagementRate = sbEngagementRateDecimal > 0 
                  ? parseFloat((sbEngagementRateDecimal * 100).toFixed(2)) 
                  : 0;
                const sbFollowers = sbData.followers || 0;
                
                // Also get avg likes/comments from daily data if available
                const sbDailyData = sbResponse.data.data.daily || [];
                let sbAvgLikes = 0;
                let sbAvgComments = 0;
                if (sbDailyData.length > 0) {
                  sbAvgLikes = Math.round(
                    sbDailyData.reduce((sum: number, day: any) => sum + (day.avg_likes || 0), 0) / sbDailyData.length
                  );
                  sbAvgComments = parseFloat(
                    (sbDailyData.reduce((sum: number, day: any) => sum + (day.avg_comments || 0), 0) / sbDailyData.length).toFixed(1)
                  );
                }
                
                if (sbEngagementRate > 0 || sbFollowers > 0) {
                  console.log("SmartChat - ✅ Got Social Blade data as fallback:", {
                    engagementRateDecimal: sbEngagementRateDecimal,
                    engagementRate: sbEngagementRate,
                    followers: sbFollowers,
                    avgLikes: sbAvgLikes,
                    avgComments: sbAvgComments,
                  });
                  
                  // Use Social Blade data (same source as Analytics page when Apify fails)
                  // CRITICAL: engagement_rate from Social Blade is a decimal, multiply by 100 to get percentage
                  engagementRate = sbEngagementRate;
                  followersCount = sbFollowers;
                  if (sbAvgLikes > 0) avgLikes = sbAvgLikes;
                  if (sbAvgComments > 0) avgComments = sbAvgComments;
                  
                  console.log("SmartChat - Using Social Blade metrics (matches Analytics page fallback behavior)");
                  console.log("SmartChat - Final metrics from Social Blade:", {
                    engagementRate,
                    followersCount,
                    avgLikes,
                    avgComments,
                  });
                }
              }
            } else {
              console.log("SmartChat - Social Blade secrets not available, skipping fallback");
            }
          } catch (sbError: any) {
            console.log("SmartChat - Social Blade fallback failed (non-critical):", sbError?.message);
            // Continue with calculated values (even if 0)
          }
        }
      } else {
        console.log("SmartChat - ✅ Using pre-calculated core metrics (engagementRate, avgLikes, avgComments)");
        console.log("SmartChat - Pre-calculated values:", {
          engagementRate,
          followersCount,
          avgLikes,
          avgComments,
        });
      }
      
      // Calculate average engagement by content type
      const avgReelLikes = reelCount > 0 ? Math.round(reelLikes / reelCount) : 0;
      const avgReelComments = reelCount > 0 ? Math.round(reelComments / reelCount) : 0;
      const avgPostLikes = postCount > 0 ? Math.round(postLikes / postCount) : 0;
      const avgPostComments = postCount > 0 ? Math.round(postComments / postCount) : 0;
      
      // Calculate posting frequency (posts per week) - only if not already loaded from analytics
      if (!hasPreCalculatedAnalytics) {
        if (Array.isArray(media) && media.length > 1) {
          const sortedMedia = [...media].sort((a: any, b: any) => {
            const timestampA = a.timestamp || a.takenAtTimestamp || 0;
            const timestampB = b.timestamp || b.takenAtTimestamp || 0;
            return timestampB - timestampA; // Most recent first
          });
          const firstPost = sortedMedia[0];
          const lastPost = sortedMedia[sortedMedia.length - 1];
          if (firstPost.timestamp && lastPost.timestamp) {
            const firstDate = new Date(firstPost.timestamp * 1000);
            const lastDate = new Date(lastPost.timestamp * 1000);
            const daysDiff = (firstDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
            postingFrequency = daysDiff > 0 ? parseFloat((totalMedia / daysDiff * 7).toFixed(2)) : 0;
          }
        }
      }
      
      // Get top hashtags - only if we don't have pre-calculated ones
      if (!hasPreCalculatedAnalytics || topHashtags.length === 0) {
        topHashtags = Object.entries(hashtagCounts)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 10)
          .map(([tag]) => tag);
      }
      
      // Analyze recent growth trend (compare older vs newer posts engagement)
      let recentGrowthTrend = "stable";
      if (Array.isArray(media) && media.length >= 6) {
        const sortedMedia = [...media].sort((a: any, b: any) => {
          const timestampA = a.timestamp || a.takenAtTimestamp || 0;
          const timestampB = b.timestamp || b.takenAtTimestamp || 0;
          return timestampB - timestampA; // Most recent first
        });
        const recentCount = Math.min(3, sortedMedia.length);
        const olderCount = Math.min(3, sortedMedia.length - recentCount);
        
        let recentEngagement = 0;
        let olderEngagement = 0;
        
        for (let i = 0; i < recentCount; i++) {
          const item = sortedMedia[i];
          recentEngagement += (item.likesCount || item.likeCount || 0) + (item.commentsCount || item.commentCount || 0);
        }
        
        for (let i = recentCount; i < recentCount + olderCount; i++) {
          const item = sortedMedia[i];
          olderEngagement += (item.likesCount || item.likeCount || 0) + (item.commentsCount || item.commentCount || 0);
        }
        
        const recentAvg = recentEngagement / recentCount;
        const olderAvg = olderEngagement / olderCount;
        
        if (recentAvg > olderAvg * 1.1) {
          recentGrowthTrend = "increasing";
        } else if (recentAvg < olderAvg * 0.9) {
          recentGrowthTrend = "declining";
        }
      }
      
      // Determine best and worst content types
      let bestContentType = "";
      let worstContentType = "";
      if (reelCount > 0 && postCount > 0) {
        const reelAvgEngagement = avgReelLikes + avgReelComments;
        const postAvgEngagement = avgPostLikes + avgPostComments;
        if (reelAvgEngagement > postAvgEngagement) {
          bestContentType = "Reels";
          worstContentType = "Posts";
        } else {
          bestContentType = "Posts";
          worstContentType = "Reels";
        }
      } else if (reelCount > 0) {
        bestContentType = "Reels";
      } else if (postCount > 0) {
        bestContentType = "Posts";
      }
      
      // Build performance summary
      let performanceSummary = "";
      if (engagementRate > 0) {
        performanceSummary = `Engagement rate: ${engagementRate}%`;
        if (recentGrowthTrend !== "stable") {
          performanceSummary += `, Trend: ${recentGrowthTrend}`;
        }
        if (postingFrequency > 0) {
          performanceSummary += `, Posting: ${postingFrequency.toFixed(1)}/week`;
        }
        if (bestContentType && worstContentType) {
          performanceSummary += `. Best performing: ${bestContentType}, Lower-engagement: ${worstContentType}`;
        }
      }
      
      // Use recentGrowthTrend as reachTrend
      const reachTrend = recentGrowthTrend;
      
      // Decision Layer: classify situation from metrics BEFORE response
      let postingTimeSpread: number | undefined;
      if (mediaSummaries.length > 0) {
        const hours = new Set<number>();
        mediaSummaries.forEach((p) => {
          if (p.timestamp) {
            hours.add(new Date(p.timestamp * 1000).getUTCHours());
          }
        });
        postingTimeSpread = hours.size;
      }
      const FINAL_DECISION = buildFinalDecision({
        intent,
        engagementRate,
        followersCount,
        avgLikes,
        avgComments,
        totalMedia,
        postingTimeSpread,
        bestContentType,
        reachTrend,
      });

      // SINGLE EXIT for INSUFFICIENT_DATA: never call OpenAI when we have no posts.
      // Always return intent-specific buildResponseFromDecision so different questions
      // (engagement, content ideas, best time) get different, tailored responses.
      const ANALYTICS_ONLY_INTENTS = [
        "POSTING_TIME",
        "CONTENT_PERFORMANCE",
        "HASHTAG_ANALYSIS",
        "WHY_ABOUT_POSTS",
      ];
      
      if (
        FINAL_DECISION.verdict === "INSUFFICIENT_DATA" &&
        media.length === 0 &&
        ANALYTICS_ONLY_INTENTS.includes(intent)
      ) {
        return {
          success: true,
          reply: buildResponseFromDecision(FINAL_DECISION),
        };
      }
       
      // ============================================
      // Construct analytics context block
      // NOTE: Core metrics (engagementRate, avgLikes, avgComments, followers, postingFrequency, topHashtags)
      // are from instagramAnalytics collection (same as Analytics page)
      // Additional metrics (content type performance, trends) are calculated from raw data
      // ============================================
      console.log("SmartChat - ========================================");
      console.log("SmartChat - CONSTRUCTING AI CONTEXT BLOCK");
      console.log("SmartChat - Engagement Rate Value:", engagementRate);
      console.log("SmartChat - Engagement Rate Type:", typeof engagementRate);
      console.log("SmartChat - Has Pre-calculated Analytics:", hasPreCalculatedAnalytics);
      console.log("SmartChat - ========================================");
      
      // For WHY_ABOUT_POSTS, include top posts with per-post data (likes, comments, type, url, time) for data-driven explanation
      const topPostsForWhy = intent === "WHY_ABOUT_POSTS" && mediaSummaries.length > 0
        ? [...mediaSummaries]
            .sort((a, b) => b.engagement - a.engagement)
            .slice(0, 5)
            .map((p, i) => ({
              rank: i + 1,
              type: p.type,
              likes: p.likes,
              comments: p.comments,
              engagement: p.engagement,
              url: p.url,
              hourUTC: p.timestamp ? new Date(p.timestamp * 1000).getUTCHours() : null,
            }))
        : [];

      const topPostsBlock = topPostsForWhy.length > 0
        ? `

TOP POSTS (for WHY questions — use this data to explain; do NOT invent reasons):
${JSON.stringify(topPostsForWhy, null, 2)}`
        : "";

      // Build context with FINAL_DECISION — GPT may ONLY use this. No diagnosis, judgment, or invention.
      accountContextBlock = `
═══════════════════════════════════════════════════════════════
FINAL_DECISION (YOU MAY ONLY USE THIS — NO OTHER INTERPRETATION)
═══════════════════════════════════════════════════════════════
Account: @${selectedAccount}

${JSON.stringify(FINAL_DECISION, null, 2)}${topPostsBlock}

═══════════════════════════════════════════════════════════════

LOCK: You may ONLY use the information in FINAL_DECISION and TOP POSTS (if present).
You may NOT diagnose, judge, or invent problems.
If something is not in facts, you must say it cannot be determined.

REMOVED: Failure modes, emotional framing, motivation, generic growth advice, assumptions, "Your content isn't compelling" type statements.

RESPONSE FORMAT (NON-NEGOTIABLE — use these exact section headers WITHOUT numbers):
DATA ANALYZED: [what we checked]
FACTS (numbers only): [metrics, post URLs when referencing specific content]
WHAT CANNOT BE CONCLUDED: [limitations]
NEXT STEP (testable): [actionable recommendation]

CRITICAL: Do NOT put numbers (1., 2., etc.) before DATA ANALYZED, FACTS, WHAT CANNOT BE CONCLUDED, or NEXT STEP. Use these as plain section headers. For sub-lists (e.g. top posts), use sequential numbers 1, 2, 3... When the user asks about best/top performing posts or content: list the TOP 3–5 posts with engagement and URL for each—not just the single best. Always include the exact Instagram post URL from the data.

STANDARD ADD-ON for analytics responses: In your NEXT STEP section, always append: "Want more data? Say 'analyze 50 posts', 'analyze 30 days', or 'analyze 90 days'—it will take longer but we'll fetch and analyze them."

If you cannot follow this format, return only the facts and nextStep from FINAL_DECISION.
`;
      
      console.log(`SmartChat - Analytics context block created for @${selectedAccount}`);
      console.log(`SmartChat - Data source: ${hasPreCalculatedAnalytics ? "✅✅✅ Pre-calculated (instagramAnalytics) - SAME as Analytics page ✅✅✅" : "⚠️ Calculated from raw data (fallback)"}`);
      console.log(`SmartChat - Engagement Rate in context: ${engagementRate}%`);
      console.log(`SmartChat - Core metrics (from Analytics page):`, {
        engagementRate: engagementRate,
        followers: followersCount,
        avgLikes: avgLikes,
        avgComments: avgComments,
        postingFrequency: postingFrequency,
        topHashtagsCount: topHashtags.length,
      });
      console.log(`SmartChat - Additional metrics (from raw data):`, {
        reachTrend,
        bestContentType,
        worstContentType,
        reelCount,
        postCount,
      });
      console.log(`SmartChat - Context block preview (first 500 chars):`, accountContextBlock.substring(0, 500));

    /* ===============================
       SYSTEM PROMPT (AI BRAIN)
       =============================== */

      const activeSystemPrompt = `You are Smart Chat, a data analyst for Instagram. You explain facts decided by code. You do NOT diagnose, judge, or invent problems.

${accountContextBlock}

TONE: Analytical, neutral, calm. Never motivational. Never judgmental. Sound like a senior analyst explaining findings to a founder.
NEVER: "typically", "usually", "generally", "you should focus on", "analyze your insights", "best practices suggest", "Your content isn't compelling".
ALWAYS: "Based on your last X posts", "Your data shows", "We couldn't determine X because", "To validate this, do Y".

COMPLETENESS: Always finish your response. If listing posts, either list every one you mention OR cap at 10 and say "Top 10 of X posts". Never cut off mid-list.
DEFAULT: We analyze 30 posts by default. If the user wants more, they can say "analyze 50 posts" (or any number up to 100).

CONVERSATIONAL CONTEXT: When prior messages are provided, treat this as a continuing conversation. Use them to understand what the user wants.
- If the user refers to "these", "those", "among these", "from above", "from the list" etc., they mean the data YOU provided in your previous response. Answer directly using that data—do NOT give generic "how to find" instructions.
- Example: You listed top 15 posts with engagement—if they ask "which had the highest comments?", pick from your list and answer: "Post X (URL) had the highest comments: N."
- Example: You gave best performing post—if they ask "top 5 of last 50 days", use the same dataset and list the top 5. Do NOT tell them to "sort by engagement" or "use Instagram insights."
- Be like ChatGPT: conversational, context-aware, direct answers when data is available.

WHY QUESTIONS (when user asks why posts are top): Use ONLY data you have. Explain using: engagement breakdown (likes vs comments), content type (Reel vs Post), posting time (if in data), hashtags (if in data). NEVER use generic phrases like "visually stunning", "engaging content", "effective captions", "compelling storytelling", "relatable moment" unless you have specific evidence. If data is insufficient, say: "We couldn't determine the exact reasons—we only have [list what we have]. From the numbers: [data-driven facts]."`;

    /* ===============================
       OPTIONAL CONTEXT
       =============================== */
    let contextBlock = "";

    if (username) {
      contextBlock += `\nInstagram username being analyzed: ${username}\n`;
    }

    if (analyticsContext) {
      contextBlock += `
Instagram Analytics Context:
${JSON.stringify(analyticsContext, null, 2)}
`;
    }

    /* ===============================
       FINAL USER PROMPT
       =============================== */
    let userPrompt = `
${contextBlock}

IntentHint: ${intent}

User Question:
"${message}"
`;

    if (intent === "HASHTAG_SUGGESTION") {
      const lowerPrompt = userPrompt.toLowerCase();
      userPrompt += `

Task:
For hashtag questions: List each post with its hashtags and full URL. If there are many posts (15+), list the top 10 by engagement and state "Top 10 of X posts by engagement"—otherwise list all. Always complete the list; never truncate mid-post. Include the full Instagram URL (https://www.instagram.com/p/...) for each post.`;
      if (!lowerPrompt.includes("hashtag")) {
        userPrompt += ` Suggest ONLY relevant Instagram hashtags for this account. No content ideas, no planning.`;
      }
    }

    if (intent === "WHY_ABOUT_POSTS") {
      userPrompt += `

Task:
The user is asking WHY certain posts are top performers. Answer using ONLY the data in FINAL_DECISION and TOP POSTS (if present).
- Compare likes vs comments: e.g. "Post 2 had the highest comments (1,030)—suggesting it drove discussion."
- Note content type if available: "Post 1 was a Reel; Reels often get higher reach."
- Use posting time if in the data.
BANNED (never use): "Content Appeal", "Effective Captions", "engaging content", "captivating visuals", "compelling narratives", "visually stunning", "resonated with your audience", "high engagement" as a reason. If you lack caption/content details: "We couldn't determine the exact reasons—we only have engagement numbers and content type. From the numbers: [present data-driven facts]."`;
    }

    /* ===============================
       OPENAI API CALL
       =============================== */
    // Access the secret value (Firebase Functions v2 uses defineSecret, not process.env)
    const openaiKey = openaiApiKeySecret.value();
    
    if (!openaiKey) {
      console.error("SmartChat - OPENAI_API_KEY secret is missing");
      throw new HttpsError(
        "failed-precondition",
        "OpenAI API key is not configured. Please contact support."
      );
    }

    // Build messages array with conversation history for context-aware responses
    const validHistory = Array.isArray(conversationHistory)
      ? conversationHistory
          .filter((m: any) => m && typeof m.role === "string" && typeof m.content === "string")
          .slice(-8) // Keep last 8 messages (4 exchanges)
          .map((m: { role: string; content: string }) => ({
            role: m.role === "assistant" ? "assistant" as const : "user" as const,
            content: String(m.content).slice(0, 4000), // Limit per-message length
          }))
      : [];

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: activeSystemPrompt },
      ...validHistory,
      { role: "user", content: userPrompt },
    ];

    const openaiPayload = {
      model: "gpt-4o-mini",
      messages,
      temperature: 0.4,
      max_tokens: 2000,
    };
    

    // Log OpenAI request payload (without exposing the API key)
    console.log("SmartChat - OpenAI request payload:", {
      model: openaiPayload.model,
      messageCount: openaiPayload.messages.length,
      temperature: openaiPayload.temperature,
      max_tokens: openaiPayload.max_tokens,
      userMessageLength: userPrompt.length,
      systemPromptLength: activeSystemPrompt.length,
      systemPromptPreview: activeSystemPrompt.substring(0, 500) + "...",
      accountContextIncluded: activeSystemPrompt.includes("FINAL_DECISION"),
    });
    
    // Log the full system prompt for debugging (truncated for readability)
    console.log("SmartChat - Full system prompt (first 2000 chars):", activeSystemPrompt.substring(0, 2000));

    // Always call OpenAI API - no fallback responses
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(openaiPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: any = {};
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        console.error("SmartChat - Failed to parse OpenAI error response:", errorText);
      }
      
      console.error("SmartChat - OpenAI API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });

      // Return explicit error messages based on status codes
      if (response.status === 401) {
        throw new HttpsError(
          "failed-precondition",
          "OpenAI API authentication failed. Please contact support."
        );
      } else if (response.status === 429) {
        throw new HttpsError(
          "resource-exhausted",
          "OpenAI API rate limit exceeded. Please try again in a moment."
        );
      } else if (response.status >= 500) {
        throw new HttpsError(
          "internal",
          `OpenAI API service error (${response.status}). Please try again later.`
        );
      } else {
        const errorMessage = errorData?.error?.message || errorData?.message || response.statusText;
        throw new HttpsError(
          "internal",
          `OpenAI API error: ${errorMessage}`
        );
      }
    }

    const result: any = await response.json();

    // Extract the assistant's reply - this is the ONLY response we return
    const reply = result?.choices?.[0]?.message?.content;
    
    if (!reply || typeof reply !== "string" || reply.trim().length === 0) {
      console.error("SmartChat - OpenAI returned empty or invalid content:", {
        result: JSON.stringify(result).substring(0, 500),
        choicesCount: result?.choices?.length || 0,
      });
      throw new HttpsError(
        "internal",
        "OpenAI returned an empty response. Please try rephrasing your question."
      );
    }

    // Log OpenAI response (truncated for long responses)
    console.log("SmartChat - OpenAI response text:", reply.substring(0, 200) + (reply.length > 200 ? "..." : ""));

    // Single-pass validation: either use GPT reply or fall back to FINAL_DECISION.
    const finalReply = isValidResponse(reply, FINAL_DECISION)
      ? reply
      : buildResponseFromDecision(FINAL_DECISION);

    return {
      success: true,
      reply: finalReply,
    };

  } catch (error: any) {
    console.error("SmartChat - Unexpected error:", {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });

    // Re-throw HttpsError as-is (these are already properly formatted)
    if (error instanceof HttpsError) {
      throw error;
    }

    // For unexpected errors, return explicit error message
    throw new HttpsError(
      "internal",
      `Smart Chat service error: ${error.message || "An unexpected error occurred. Please try again."}`
    );
  }
  }
);
