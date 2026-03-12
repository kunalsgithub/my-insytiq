import Navbar from "../components/Navbar";
import InstagramAnalytics from "../components/InstagramAnalytics";
import InstagramDashboard from "../components/InstagramDashboard";
import DailyEngagementChart from "../components/DailyEngagementChart";
import { LiveFollowerCounter } from "../components/LiveFollowerCounter";
import InstagramUsernameInput from "../components/InstagramUsernameInput";

import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebaseService";
import { useInstagramData } from "../hooks/useInstagramData";
import { useUsernameManager } from "../hooks/useUsernameManager";
import { PLAN, PLAN_PROFILE_ANALYSES_LIMIT } from "../utils/accessControl";
import { useToast } from "../hooks/use-toast";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { getSocialBladeAnalytics } from "../api/getSocialBladeAnalytics";
import {
  checkAndLoadAnalytics,
  fetchAnalyticsIfNeeded,
  loadCachedAnalytics,
} from "../utils/loadCachedAnalytics";
import { reserveProfileAnalysisUsage } from "../api/reserveProfileAnalysisUsage";

import { useInstagramAnalyticsStore } from "../store/useInstagramAnalyticsStore";

const InstagramAnalyticsPage = () => {
  const [username, setUsername] = useState("");
  const [isRestoringFromCache, setIsRestoringFromCache] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStep, setLoadingStep] = useState<1 | 2 | 3>(1);

  const [instagramData, analyzeUsername, setDataFromFirestore, setAnalysisError] =
    useInstagramData();

  const {
    userId,
    saveUsername,
    lastAnalyzedUsername,
    saving,
  } = useUsernameManager();

  const { toast } = useToast();

  const {
    isLoaded,
    markLoaded,
    clearForUser,
  } = useInstagramAnalyticsStore();

  const [userPlan, setUserPlan] = useState<string>(PLAN.FREE);
  const [profileAnalysisLimitReached, setProfileAnalysisLimitReached] = useState(false);

  // Progressively advance loading steps while analysis is running
  useEffect(() => {
    if (!isAnalyzing) return;

    setLoadingStep(1);
    const t1 = window.setTimeout(() => setLoadingStep(2), 1000);
    const t2 = window.setTimeout(() => setLoadingStep(3), 2200);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [isAnalyzing]);

  useEffect(() => {
    if (!userId) return;
    const loadPlanAndUsage = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", userId));
        const data = userDoc.data();
        const plan = (data?.currentPlan as string) || PLAN.FREE;
        setUserPlan(plan);
        const usage = (data as any)?.usage?.profileAnalysis || {};
        const usageCount = typeof usage.monthlyUsed === "number" ? usage.monthlyUsed : 0;
        const limit = PLAN_PROFILE_ANALYSES_LIMIT[plan] ?? PLAN_PROFILE_ANALYSES_LIMIT[PLAN.ANALYTICS_PLUS];
        setProfileAnalysisLimitReached(usageCount >= limit);
      } catch {
        setUserPlan(PLAN.FREE);
        setProfileAnalysisLimitReached(false);
      }
    };
    loadPlanAndUsage();
  }, [userId]);

  // Restore last username
  useEffect(() => {
    if (lastAnalyzedUsername && !username) {
      setUsername(lastAnalyzedUsername);
    }
  }, [lastAnalyzedUsername, username]);

  // 🔒 SINGLE SOURCE OF TRUTH LOADER
  useEffect(() => {
    if (!username || username === "demo_user" || !userId) return;

    const loadKey = `${userId}:${username}`;

    // ✅ TAB SWITCH: restore instantly
    const loadedStatus = isLoaded(loadKey);
    if (loadedStatus) {
      setIsRestoringFromCache(true);

      const restoreFromFirestore = async () => {
        try {
          const result = await checkAndLoadAnalytics(userId, username);

          if (!result.needsFetch && result.analyticsData) {
            let profilePictureUrl: string | undefined;
            let mediaCount = 0;

            try {
              const raw = await loadCachedAnalytics(userId, username);
              if (raw?.profile) {
                profilePictureUrl =
                  raw.profile.profilePicUrl ||
                  raw.profile.profilePictureUrl;
                mediaCount =
                  raw.profile.mediaCount || raw.profile.media?.length || 0;
              }
            } catch {}

            setDataFromFirestore(username, {
              followers: result.analyticsData.followers,
              engagementRate: result.analyticsData.engagementRate,
              avgLikes: result.analyticsData.avgLikes,
              avgComments: result.analyticsData.avgComments,
              profilePictureUrl,
              mediaCount,
            });

            setIsRestoringFromCache(false);

            if (!profilePictureUrl || mediaCount === 0) {
              analyzeUsername(username);
            }
          } else {
            // If cached data is not available, fall back to fetching
            setIsRestoringFromCache(false);
            analyzeUsername(username);
          }
        } catch {
          setIsRestoringFromCache(false);
          analyzeUsername(username);
        }
      };

      restoreFromFirestore();
      return;
    }

    // 🔄 FIRST LOAD / NEW USERNAME
    const loadAnalytics = async () => {
      try {
        const result = await checkAndLoadAnalytics(userId, username);

        if (!result.needsFetch && result.analyticsData) {
          let profilePictureUrl: string | undefined;
          let mediaCount = 0;

          try {
            const raw = await loadCachedAnalytics(userId, username);
            if (raw?.profile) {
              profilePictureUrl =
                raw.profile.profilePicUrl ||
                raw.profile.profilePictureUrl;
              mediaCount =
                raw.profile.mediaCount || raw.profile.media?.length || 0;
            }
          } catch {}

          setDataFromFirestore(username, {
            followers: result.analyticsData.followers,
            engagementRate: result.analyticsData.engagementRate,
            avgLikes: result.analyticsData.avgLikes,
            avgComments: result.analyticsData.avgComments,
            profilePictureUrl,
            mediaCount,
          });

          markLoaded(loadKey);

          if (!profilePictureUrl || mediaCount === 0) {
            analyzeUsername(username);
          }

          return;
        }

        // 🔥 ONLY PLACE Apify CAN RUN
        if (result.needsFetch) {
          await fetchAnalyticsIfNeeded(userId, username);
          {
            const userDoc = await getDoc(doc(db, "users", userId));
            const data = userDoc.data();
            const usage = (data as any)?.usage?.profileAnalysis || {};
            const usageCount = typeof usage.monthlyUsed === "number" ? usage.monthlyUsed : 0;
            const limit = PLAN_PROFILE_ANALYSES_LIMIT[userPlan] ?? PLAN_PROFILE_ANALYSES_LIMIT[PLAN.ANALYTICS_PLUS];
            setProfileAnalysisLimitReached(usageCount >= limit);
          }
          markLoaded(loadKey);
        }

        analyzeUsername(username);
      } catch (err: any) {
        const code = err?.code || "";
        const message = err?.message || "";
        const isLimitReached =
          code === "functions/resource-exhausted" ||
          message.includes("profile analyses per month");
        if (isLimitReached) {
          toast({
            title: "Limit reached",
            description:
              message ||
              "You've reached your profile analysis limit for this month. Upgrade to analyze more accounts.",
            variant: "destructive",
          });
          setAnalysisError(
            message ||
              "You've reached your profile analysis limit for this month. Upgrade to analyze more accounts."
          );
          markLoaded(loadKey);
          return;
        }
        analyzeUsername(username);
        markLoaded(loadKey);
      }
    };

    setIsRestoringFromCache(false);
    loadAnalytics();
  }, [username, userId]);

  // Username submit handler
  const handleAnalyzeUsername = async (newUsername: string) => {
    if (!userId) {
      toast({
        title: "Login required",
        description: "Please login to analyze Instagram accounts.",
        variant: "destructive",
        action: (
          <button
            type="button"
            onClick={() => { window.location.href = "/auth"; }}
            className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-white/30 bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-[#d72989] md:relative md:z-10 md:min-w-[88px]"
          >
            Sign in
          </button>
        ),
      });
      return;
    }

    try {
      setIsAnalyzing(true);
      // 1️⃣ Reserve usage on the server BEFORE any cache logic
      try {
        await reserveProfileAnalysisUsage(userId);
      } catch (err: any) {
        const code = err?.code || "";
        const message = err?.message || "";
        const details = err?.details ?? {};
        const isCooldown = details?.cooldown === true || (typeof message === "string" && /wait.*minutes/i.test(message));
        const isLimit =
          (code === "functions/resource-exhausted" || code === "resource-exhausted") &&
          !isCooldown &&
          (details?.upgradeRequired === true || (typeof message === "string" && message.toLowerCase().includes("limit")));

        if (isCooldown) {
          const mins = details?.remainingMinutes ?? 1;
          toast({
            title: "Please wait",
            description: `Wait ${mins} minute${mins !== 1 ? "s" : ""} before running another profile analysis.`,
            variant: "destructive",
          });
          setIsAnalyzing(false);
          return;
        }
        if (isLimit) {
          const limit =
            PLAN_PROFILE_ANALYSES_LIMIT[userPlan] ??
            PLAN_PROFILE_ANALYSES_LIMIT[PLAN.ANALYTICS_PLUS];
          toast({
            title: "Limit reached",
            description:
              message ||
              `You've used your ${limit} profile analyses this month. Upgrade to analyze more.`,
            variant: "destructive",
          });
          setProfileAnalysisLimitReached(true);
          setIsAnalyzing(false);
          return;
        }
        throw err;
      }

      clearForUser(userId);
      const success = await saveUsername(newUsername);
      if (success) {
        setUsername(newUsername);
        toast({
          title: "Username saved",
          description: `@${newUsername} is being analyzed`,
        });
      }
    } catch (err) {
      console.error("Analyze username error:", err);
      toast({
        title: "Something went wrong",
        description: "Could not start analysis. Please try again.",
        variant: "destructive",
      });
      setIsAnalyzing(false);
    }
  };

  const dailyMetrics = instagramData.insights?.dailyMetrics || [];

  // When backend finishes loading (or errors), stop the front-end loading state
  useEffect(() => {
    if (!instagramData.loading && !isRestoringFromCache) {
      setIsAnalyzing(false);
    }
  }, [instagramData.loading, isRestoringFromCache]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <ErrorBoundary>
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8 md:px-6">
        <h1 className="text-4xl font-bold text-center gradient-text mb-10">
          Instagram Analytics
        </h1>

        {profileAnalysisLimitReached && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-center">
            <p className="text-amber-800 font-medium">
              You've used your {PLAN_PROFILE_ANALYSES_LIMIT[userPlan] ?? 0} profile analyses for this month.
            </p>
            <p className="text-sm text-amber-700 mt-1">
              {userPlan === PLAN.FREE ? "Upgrade your plan to analyze more accounts per month." : "Your limit resets next month."}
            </p>
            {userPlan === PLAN.FREE && (
              <a
                href="/subscription"
                className="inline-block mt-3 text-sm font-semibold text-amber-800 underline"
              >
                View plans →
              </a>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl shadow p-6 mb-8">
          <InstagramUsernameInput
            onAnalyze={handleAnalyzeUsername}
            disabled={profileAnalysisLimitReached}
            loading={isAnalyzing}
          />
          {saving && (
            <p className="text-sm text-gray-500 mt-3 text-center">
              Saving username…
            </p>
          )}
        </div>

        {instagramData.error && (
          <div className="bg-red-50 p-5 rounded-lg text-center mb-6">
            <p className="text-red-600">{instagramData.error}</p>
          </div>
        )}

        {(isAnalyzing || (instagramData.loading && !isRestoringFromCache && username)) && (
          <div className="bg-white rounded-xl shadow p-6 mb-8 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#d72989] border-t-transparent rounded-full animate-spin" />
            <div className="space-y-1 text-center">
              <p className="text-sm font-semibold text-gray-900">
                {loadingStep === 1 && "Fetching profile data…"}
                {loadingStep === 2 && "Fetching recent posts…"}
                {loadingStep === 3 && "Analyzing engagement patterns…"}
              </p>
              <p className="text-xs text-gray-500">
                This usually takes a few seconds. You can keep this tab open while we analyze @{username}.
              </p>
            </div>
            {/* Simple skeleton for analytics dashboard */}
            <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
              <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />
              <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />
              <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />
            </div>
          </div>
        )}

        {username && !instagramData.loading && !instagramData.error && instagramData.profile && instagramData.username === username && !profileAnalysisLimitReached && (
          <div className="space-y-8">
            <InstagramDashboard
              username={username}
              profilePictureUrl={instagramData.profile?.profile_picture_url}
              followers={instagramData.profile?.followers_count ?? 0}
              following={instagramData.profile?.follows_count ?? 0}
              posts={instagramData.profile?.media_count ?? 0}
              averageLikes={instagramData.insights?.engagement?.likes ?? 0}
              averageComments={instagramData.insights?.engagement?.comments ?? 0}
              engagementRate={instagramData.insights?.engagement?.rate ?? 0}
            />

            <LiveFollowerCounter
              username={username}
              initialCount={instagramData.currentFollowerCount ?? 0}
              onRefresh={() => analyzeUsername(username)}
            />

            {dailyMetrics.length > 0 && (
              <DailyEngagementChart data={dailyMetrics} />
            )}

            <InstagramAnalytics username={username} userPlan={userPlan} />
          </div>
        )}
      </main>
      </ErrorBoundary>
    </div>
  );
};

export default InstagramAnalyticsPage;
