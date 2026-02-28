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
import { getSocialBladeAnalytics } from "../api/getSocialBladeAnalytics";
import {
  checkAndLoadAnalytics,
  fetchAnalyticsIfNeeded,
  loadCachedAnalytics,
} from "../utils/loadCachedAnalytics";

import { useInstagramAnalyticsStore } from "../store/useInstagramAnalyticsStore";

const InstagramAnalyticsPage = () => {
  const [username, setUsername] = useState("");
  const [isRestoringFromCache, setIsRestoringFromCache] = useState(false);

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

  useEffect(() => {
    if (!userId) return;
    const loadPlanAndUsage = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", userId));
        const data = userDoc.data();
        const plan = (data?.currentPlan as string) || PLAN.FREE;
        setUserPlan(plan);
        const usage = (data as any)?.profileAnalysisUsage || {};
        const usageMonth = typeof usage.month === "string" ? usage.month : null;
        const usageCount = typeof usage.count === "number" ? usage.count : 0;
        const thisMonth = new Date().toISOString().slice(0, 7);
        const limit = PLAN_PROFILE_ANALYSES_LIMIT[plan] ?? PLAN_PROFILE_ANALYSES_LIMIT[PLAN.ANALYTICS_PLUS];
        setProfileAnalysisLimitReached(usageMonth === thisMonth && usageCount >= limit);
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
          if (profileAnalysisLimitReached) {
            const limit = PLAN_PROFILE_ANALYSES_LIMIT[userPlan] ?? PLAN_PROFILE_ANALYSES_LIMIT[PLAN.ANALYTICS_PLUS];
            const msg = `Your plan allows ${limit} profile analyses per month. You've reached that limit this month. Upgrade your plan to analyze more accounts.`;
            toast({ title: "Limit reached", description: msg, variant: "destructive" });
            setAnalysisError(msg);
            markLoaded(loadKey);
            return;
          }
          await fetchAnalyticsIfNeeded(userId, username);
          {
            const userDoc = await getDoc(doc(db, "users", userId));
            const data = userDoc.data();
            const usage = (data as any)?.profileAnalysisUsage || {};
            const usageMonth = typeof usage.month === "string" ? usage.month : null;
            const usageCount = typeof usage.count === "number" ? usage.count : 0;
            const thisMonth = new Date().toISOString().slice(0, 7);
            const limit = PLAN_PROFILE_ANALYSES_LIMIT[userPlan] ?? PLAN_PROFILE_ANALYSES_LIMIT[PLAN.ANALYTICS_PLUS];
            setProfileAnalysisLimitReached(usageMonth === thisMonth && usageCount >= limit);
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
      });
      return;
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
  };

  const dailyMetrics = instagramData.insights?.dailyMetrics || [];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

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
          <InstagramUsernameInput onAnalyze={handleAnalyzeUsername} />
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

        {instagramData.loading && !isRestoringFromCache && username && (
          <div className="bg-blue-50 p-5 rounded-lg text-center mb-6">
            Fetching analytics for @{username}…
          </div>
        )}

        {username && !instagramData.loading && !instagramData.error && (
          <div className="space-y-8">
            <InstagramDashboard
              username={username}
              profilePictureUrl={instagramData.profile.profile_picture_url}
              followers={instagramData.profile.followers_count}
              following={instagramData.profile.follows_count}
              posts={instagramData.profile.media_count}
              averageLikes={instagramData.insights.engagement.likes}
              averageComments={instagramData.insights.engagement.comments}
              engagementRate={instagramData.insights.engagement.rate}
            />

            <LiveFollowerCounter
              username={username}
              initialCount={instagramData.currentFollowerCount}
              onRefresh={() => analyzeUsername(username)}
            />

            {dailyMetrics.length > 0 && (
              <DailyEngagementChart data={dailyMetrics} />
            )}

            <InstagramAnalytics username={username} userPlan={userPlan} />
          </div>
        )}
      </main>
    </div>
  );
};

export default InstagramAnalyticsPage;
