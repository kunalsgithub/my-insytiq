import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useToast } from "../hooks/use-toast";
import { functions } from "../firebase";
import { httpsCallable } from "firebase/functions";
import { db, getCurrentUser } from "../services/firebaseService";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  deleteDoc,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import "../components/LoadingText.css";
// NOTE: Recharts-based chart was causing an invalid hook call in this route
// in the current environment, even though the same library works elsewhere.
// To keep this page stable, we are temporarily not importing or rendering
// the chart here. Growth metrics, spikes and gap insights still function.

interface CompetitorPost {
  postId: string;
  type: "Reel" | "Post";
  likes: number;
  comments: number;
  engagement: number;
  timestamp: number;
  caption: string;
  thumbnailUrl: string | null;
  url?: string | null;
}

interface CompetitorDoc {
  username: string;
  followers: number;
  engagementRate: number;
  avgLikes: number;
  avgComments: number;
  postingFrequency: number;
  lastUpdated?: any;
  posts: CompetitorPost[];
}

interface FollowerHistoryPoint {
  date: Date;
  followers: number;
}

interface GrowthMetric {
  username: string;
  displayName: string;
  isSelf: boolean;
  seriesKey: string;
  currentFollowers: number;
  followers30DaysAgo: number;
  growthPercent: number;
  netGain: number;
  dailyAvg: number;
  status: "Accelerating" | "Stable" | "Slowing";
}

interface GrowthSpike {
  username: string;
  displayName: string;
  date: Date;
  gain: number;
}

const gradientText = {
  background: "linear-gradient(90deg, #f9ce34, #ee2a7b, #6228d7)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

const gradientBtn = {
  background: "linear-gradient(90deg, #f9ce34, #ee2a7b, #6228d7)",
  color: "white",
  border: "none",
};

const CompetitorIntelligencePage: React.FC = () => {
  const { toast } = useToast();
  const [inputUsername, setInputUsername] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [accountStats, setAccountStats] = useState<CompetitorDoc | null>(null);
  const [competitors, setCompetitors] = useState<CompetitorDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<
    Record<string, FollowerHistoryPoint[]>
  >({});

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      setUserId(null);
      setLoading(false);
      return;
    }
    setUserId(user.uid);

    // Load selected Instagram account analytics for "self" row
    const loadSelf = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.data() || {};
        const selected = userData.selectedInstagramAccount as string | undefined;
        setCurrentPlan((userData.currentPlan as string | undefined) || null);
        if (!selected) {
          setAccountStats(null);
          return;
        }
        const norm = selected.toLowerCase().trim();
        const anaSnap = await getDoc(doc(db, "instagramAnalytics", norm));
        if (!anaSnap.exists()) {
          setAccountStats(null);
          return;
        }
        const d: any = anaSnap.data();
        setAccountStats({
          username: norm,
          followers: d.followers ?? 0,
          engagementRate: d.engagementRate ?? 0,
          avgLikes: d.avgLikes ?? 0,
          avgComments: d.avgComments ?? 0,
          postingFrequency: d.postingFrequency ?? 0,
          posts: Array.isArray(d.posts)
            ? d.posts.map((p: any) => ({
                postId: p.url || p.shortcode || p.code || String(p.timestamp || Date.now()),
                type: p.type === "Video" || p.isVideo ? "Reel" : "Post",
                likes: p.likesCount ?? 0,
                comments: p.commentsCount ?? 0,
                engagement: (p.likesCount ?? 0) + (p.commentsCount ?? 0),
                timestamp:
                  typeof p.timestamp === "number"
                    ? p.timestamp
                    : typeof p.takenAtTimestamp === "number"
                    ? p.takenAtTimestamp
                    : Math.floor(Date.now() / 1000),
                caption: p.caption || "",
                thumbnailUrl: p.url || null,
              }))
            : [],
        });
      } catch (err: any) {
        setAccountStats(null);
        toast({
          title: "Unable to load analytics",
          description: "Please refresh the page or try again later.",
          variant: "destructive",
        });
      }
    };

    loadSelf();

    // Subscribe to competitor docs
    const compsCol = collection(db, "users", user.uid, "competitors");
    const unsub = onSnapshot(
      compsCol,
      (snap) => {
        const docs: CompetitorDoc[] = snap.docs.map((d) => {
          const data: any = d.data();
          return {
            username: data.username || d.id,
            followers: data.followers ?? 0,
            engagementRate: data.engagementRate ?? 0,
            avgLikes: data.avgLikes ?? 0,
            avgComments: data.avgComments ?? 0,
            postingFrequency: data.postingFrequency ?? 0,
            lastUpdated: data.lastUpdated,
            posts: Array.isArray(data.posts) ? data.posts : [],
          };
        });
        setCompetitors(docs);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!accountStats?.username) {
      setHistoryData({});
      return;
    }

    const baseUsername = accountStats.username;
    const competitorUsernames = competitors
      // Include up to 4 competitors so a PRO user can
      // compare 5 usernames total (self + 4 competitors).
      .slice(0, 4)
      .map((c) => c.username.toLowerCase());

    const usernames = [baseUsername, ...competitorUsernames].filter(
      (value, index, self) => self.indexOf(value) === index
    );

    if (usernames.length === 0) {
      setHistoryData({});
      return;
    }

    let cancelled = false;

    const loadHistory = async () => {
      setHistoryLoading(true);

      const historyCol = collection(db, "followerHistory");
      const result: Record<string, FollowerHistoryPoint[]> = {};

      try {
        await Promise.all(
          usernames.map(async (uname) => {
            const q = query(historyCol, where("username", "==", uname));
            const snap = await getDocs(q);
            const rawPoints: FollowerHistoryPoint[] = snap.docs.map((docSnap) => {
              const data: any = docSnap.data();
              const ts = data.date;
              const jsDate =
                ts && typeof ts.toDate === "function" ? ts.toDate() : new Date();
              return {
                date: jsDate,
                followers:
                  typeof data.followers === "number" ? data.followers : 0,
              };
            });
            // Keep only last 30 days and sort ascending
            const since = new Date();
            since.setDate(since.getDate() - 29);
            since.setHours(0, 0, 0, 0);
            const filtered = rawPoints.filter(
              (p) => p.date.getTime() >= since.getTime()
            );
            filtered.sort((a, b) => a.date.getTime() - b.date.getTime());
            result[uname] = filtered;
          })
        );

        if (!cancelled) {
          setHistoryData(result);
          setHistoryLoading(false);
        }
      } catch {
        if (!cancelled) {
          setHistoryData({});
          setHistoryLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [accountStats?.username, competitors]);

  const maxCompetitorsForPlan = useMemo(() => {
    if (!currentPlan) return 0;
    const plan = currentPlan.toLowerCase();
    if (plan.includes("creator") || plan.includes("trends+")) {
      return 2;
    }
    if (plan.includes("pro – growth accelerator") || plan.includes("analytics+")) {
      return 5;
    }
    if (plan.includes("pro combo") || plan.includes("elite") || plan.includes("agency")) {
      return 10;
    }
    return 0;
  }, [currentPlan]);

  const handleAddCompetitor = async () => {
    const trimmed = inputUsername.trim();
    if (!trimmed || !userId) return;
    const limit = maxCompetitorsForPlan || 0;
    if (limit > 0 && competitors.length >= limit) {
      toast({
        title: "Limit reached",
        description: `You can track up to ${limit} competitors on your current plan.`,
        variant: "destructive",
      });
      return;
    }
    setAdding(true);
    try {
      const fn = httpsCallable(functions, "addCompetitor");
      const res = await fn({ username: trimmed });
      const data: any = res.data;
      if (data?.message) {
        toast({ title: "Competitor", description: data.message });
      } else {
        toast({ title: "Competitor added", description: `Now tracking @${trimmed}.` });
      }
      setInputUsername("");
    } catch (error: any) {
      const msg =
        error?.code === "failed-precondition"
          ? "Upgrade your plan to track more competitors."
          : error?.message || "Failed to add competitor.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const {
    metrics,
    chartData,
    spikes,
    hasEnoughHistory,
  } = useMemo(() => {
    if (!accountStats?.username) {
      return { metrics: [] as GrowthMetric[], chartData: [] as any[], spikes: [] as GrowthSpike[], hasEnoughHistory: false };
    }

    const baseUsername = accountStats.username;
    const competitorUsernames = competitors
      .slice(0, 3)
      .map((c) => c.username.toLowerCase());
    const usernames = [baseUsername, ...competitorUsernames].filter(
      (value, index, self) => self.indexOf(value) === index
    );

    if (usernames.length === 0) {
      return { metrics: [] as GrowthMetric[], chartData: [] as any[], spikes: [] as GrowthSpike[], hasEnoughHistory: false };
    }

    type SeriesPoint = { date: Date; followers: number; dailyGain: number };
    const seriesPerAccount: Record<string, SeriesPoint[]> = {};

    usernames.forEach((uname) => {
      const raw = historyData[uname] || [];
      if (!raw.length) {
        seriesPerAccount[uname] = [];
        return;
      }
      const sorted = [...raw].sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      );
      let prevFollowers: number | null = null;
      const enriched: SeriesPoint[] = sorted.map((p) => {
        const gain =
          prevFollowers === null ? 0 : p.followers - prevFollowers;
        prevFollowers = p.followers;
        return { date: p.date, followers: p.followers, dailyGain: gain };
      });
      seriesPerAccount[uname] = enriched;
    });

    const baseHistory = seriesPerAccount[baseUsername] || [];
    // Require a meaningful history window: at least 30 days of snapshots
    // for the primary account before enabling the growth comparison dashboard.
    if (baseHistory.length < 30) {
      return {
        metrics: [] as GrowthMetric[],
        chartData: [] as any[],
        spikes: [] as GrowthSpike[],
        hasEnoughHistory: false,
      };
    }

    const days: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d);
    }

    type ChartRow = { date: string; [key: string]: number | string };
    const chart: ChartRow[] = days.map((d) => ({
      date: d.toLocaleDateString(),
    }));

    const metrics: GrowthMetric[] = [];
    const spikes: GrowthSpike[] = [];

    usernames.forEach((uname, index) => {
      const series = seriesPerAccount[uname];
      if (!series || series.length === 0) {
        return;
      }

      const isSelf = uname === baseUsername;
      const displayName = isSelf ? `${uname} (you)` : `@${uname}`;
      const seriesKey = isSelf ? "You" : `@${uname}`;

      let pointer = 0;
      let lastFollowers = series[0].followers;
      let lastGain = series[0].dailyGain;
      const firstFollowers = series[0].followers;
      const finalFollowers = series[series.length - 1].followers;

      chart.forEach((row, dayIndex) => {
        const dayDate = days[dayIndex];
        const dayEnd = new Date(dayDate);
        dayEnd.setDate(dayEnd.getDate() + 1);
        while (
          pointer < series.length &&
          series[pointer].date < dayEnd
        ) {
          lastFollowers = series[pointer].followers;
          lastGain = series[pointer].dailyGain;
          pointer += 1;
        }
        row[seriesKey] = lastFollowers;
        (row as any)[`${seriesKey}_gain`] = lastGain;
      });

      const netGain = finalFollowers - firstFollowers;
      const growthPercent =
        firstFollowers > 0 ? (netGain / firstFollowers) * 100 : 0;
      const dailyAvg = netGain / 30;

      const lastWeekPoints = series.slice(-7);
      const earlierPoints = series.slice(
        0,
        Math.max(0, series.length - 7)
      );
      const avgFromDiffs = (pts: SeriesPoint[]) => {
        if (pts.length < 2) return dailyAvg;
        let sum = 0;
        for (let i = 1; i < pts.length; i += 1) {
          sum += pts[i].followers - pts[i - 1].followers;
        }
        const span = pts.length - 1;
        return span > 0 ? sum / span : dailyAvg;
      };
      const recentAvg = avgFromDiffs(lastWeekPoints);
      const overallAvg = avgFromDiffs(series);

      let status: GrowthMetric["status"] = "Stable";
      if (recentAvg > overallAvg * 1.25 && recentAvg > 0) {
        status = "Accelerating";
      } else if (recentAvg < overallAvg * 0.75 && overallAvg > 0) {
        status = "Slowing";
      }

      metrics.push({
        username: uname,
        displayName,
        isSelf,
        seriesKey,
        currentFollowers: finalFollowers,
        followers30DaysAgo: firstFollowers,
        growthPercent,
        netGain,
        dailyAvg,
        status,
      });

      const threshold = dailyAvg * 2;
      if (threshold > 0) {
        series.forEach((p) => {
          if (p.dailyGain > threshold) {
            spikes.push({
              username: uname,
              displayName,
              date: p.date,
              gain: p.dailyGain,
            });
          }
        });
      }
    });

    spikes.sort((a, b) => b.date.getTime() - a.date.getTime());

    return { metrics, chartData: chart, spikes, hasEnoughHistory: true };
  }, [historyData, accountStats?.username, competitors]);

  const isProPlan = useMemo(() => {
    if (!currentPlan) return false;
    const plan = currentPlan.toLowerCase();
    if (plan.includes("pro – growth accelerator")) return true;
    if (plan.includes("analytics+")) return true;
    if (plan.includes("pro combo")) return true;
    if (plan.includes("elite") || plan.includes("agency")) return true;
    if (plan.includes("pro") && !plan.includes("creator")) return true;
    return false;
  }, [currentPlan]);

  const lineColors = ["#2563eb", "#d946ef", "#22c55e", "#f97316"];

  const GrowthTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="rounded-lg bg-white/95 p-3 shadow-md border border-gray-200 text-xs">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((item: any) => {
          const gainKey = `${item.name}_gain`;
          const dailyGain = item.payload?.[gainKey] ?? 0;
          return (
            <div
              key={item.name}
              className="flex items-center justify-between gap-3"
            >
              <span
                className="font-medium"
                style={{ color: item.color || "#111827" }}
              >
                {item.name}
              </span>
              <span>{Number(item.value || 0).toLocaleString()} followers</span>
              <span className="text-gray-500">
                +
                {Number(dailyGain || 0).toLocaleString()}
                {" / day"}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center pt-12 pb-8 px-4 md:py-8 md:pl-16">
      <div className="w-full md:ml-16 md:max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2" style={gradientText}>
            Competitor Intelligence
          </h1>
          <p className="text-sm text-gray-600">
            Track how your Instagram competitors are growing and how their content performs.
          </p>
        </div>

        {/* Add Competitor */}
        <Card>
          <CardHeader>
            <CardTitle>Add Competitor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <Input
                placeholder="Enter Instagram username (without @)"
                value={inputUsername}
                onChange={(e) => setInputUsername(e.target.value)}
                className="md:max-w-sm"
              />
              <Button
                onClick={handleAddCompetitor}
                disabled={
                  adding ||
                  !inputUsername.trim() ||
                  !userId ||
                  (maxCompetitorsForPlan > 0 &&
                    competitors.length >= maxCompetitorsForPlan)
                }
                style={gradientBtn}
              >
                {adding ? (
                  <span className="loading-text-inline">
                    {["A", "D", "D", "I", "N", "G"].map((ch, index) => (
                      <span key={index} className="loading-char">
                        {ch}
                      </span>
                    ))}
                  </span>
                ) : (
                  "Add Competitor"
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              {maxCompetitorsForPlan > 0 ? (
                <>
                  Tracking {competitors.length} of {maxCompetitorsForPlan} competitors
                  in this workspace.
                </>
              ) : (
                "Upgrade your plan to start tracking competitors."
              )}
            </p>
          </CardContent>
        </Card>

        {/* Overview Table */}
        <Card>
          <CardHeader>
            <CardTitle>Competitor Overview (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-500">Loading competitor data…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-2 pr-4">Account</th>
                      <th className="py-2 pr-4">Followers</th>
                      <th className="py-2 pr-4">Engagement Rate</th>
                      <th className="py-2 pr-4">Posting Frequency (posts/week)</th>
                      <th className="py-2 pr-4">Posts (30d)</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountStats && (
                      <tr className="border-b bg-gray-50">
                        <td className="py-2 pr-4 font-semibold">@{accountStats.username} (you)</td>
                        <td className="py-2 pr-4">{accountStats.followers.toLocaleString()}</td>
                        <td className="py-2 pr-4">{accountStats.engagementRate.toFixed(2)}%</td>
                        <td className="py-2 pr-4">
                          {accountStats.postingFrequency.toFixed(2)}
                        </td>
                        <td className="py-2 pr-4">{accountStats.posts.length}</td>
                        <td className="py-2 pr-4 text-xs text-gray-400">—</td>
                      </tr>
                    )}
                    {competitors.map((c) => (
                      <tr key={c.username} className="border-b">
                        <td className="py-2 pr-4 font-semibold">@{c.username}</td>
                        <td className="py-2 pr-4">{c.followers.toLocaleString()}</td>
                        <td className="py-2 pr-4">{c.engagementRate.toFixed(2)}%</td>
                        <td className="py-2 pr-4">{c.postingFrequency.toFixed(2)}</td>
                        <td className="py-2 pr-4">{c.posts?.length || 0}</td>
                        <td className="py-2 pr-4">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!userId) return;
                              const confirmed = window.confirm(
                                `Remove @${c.username} from your competitor list?`
                              );
                              if (!confirmed) return;
                              try {
                                await deleteDoc(
                                  doc(db, "users", userId, "competitors", c.username)
                                );
                                toast({
                                  title: "Removed",
                                  description: `Stopped tracking @${c.username}.`,
                                });
                              } catch (err: any) {
                                toast({
                                  title: "Error",
                                  description: "Failed to remove competitor. Please try again.",
                                  variant: "destructive",
                                });
                              }
                            }}
                            className="text-red-500 text-xs hover:underline"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!accountStats && competitors.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-4 text-gray-400">
                          No analytics found yet. Run Instagram Analytics and add a competitor to
                          get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Growth Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Growth Comparison</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            {historyLoading ? (
              <p className="text-sm text-gray-500">Loading follower history…</p>
            ) : !hasEnoughHistory ? (
              <p className="text-sm text-gray-500">
                Not enough historical data to generate growth comparison.
              </p>
            ) : (
              <div
                className={
                  !isProPlan
                    ? "pointer-events-none select-none filter blur-sm"
                    : ""
                }
              >
                {/* Growth Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {(() => {
                    if (metrics.length === 0) return null;
                    const growthValues = metrics.map((m) => m.growthPercent);
                    const maxGrowth = Math.max(...growthValues);
                    const minGrowth = Math.min(...growthValues);
                    const hasMultiple = metrics.length > 1;
                    return metrics.map((m) => {
                      const isMax = hasMultiple && m.growthPercent === maxGrowth;
                      const isMin = hasMultiple && m.growthPercent === minGrowth;
                      const baseClasses =
                        "rounded-xl border p-3 bg-white shadow-sm text-xs md:text-sm";
                      const toneClasses = isMax
                        ? " border-green-500 bg-green-50"
                        : isMin
                        ? " border-red-500 bg-red-50"
                        : " border-gray-200";
                      const statusSymbol =
                        m.status === "Accelerating"
                          ? "↗"
                          : m.status === "Slowing"
                          ? "↘"
                          : "→";
                      return (
                        <div key={m.username} className={baseClasses + toneClasses}>
                          <p className="text-[11px] text-gray-500 mb-1">
                            {m.isSelf ? `${m.username} (you)` : `@${m.username}`}
                          </p>
                          <p className="font-semibold mb-1">
                            30 Day Growth: {m.growthPercent.toFixed(1)}%
                          </p>
                          <p className="text-gray-600">
                            Net Gain: {m.netGain.toLocaleString()}
                          </p>
                          <p className="text-gray-600">
                            Daily Avg: {m.dailyAvg.toFixed(1)} / day
                          </p>
                          <p className="mt-1 text-gray-700 font-medium">
                            {statusSymbol} {m.status}
                          </p>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Growth Gap Insight */}
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs md:text-sm">
                  {(() => {
                    if (!accountStats?.username) {
                      return (
                        <p className="text-gray-500">
                          Connect an Instagram account to see growth gap insights.
                        </p>
                      );
                    }
                    const selfMetric = metrics.find(
                      (m) => m.username === accountStats.username
                    );
                    const competitorMetrics = metrics.filter(
                      (m) => m.username !== accountStats.username
                    );
                    if (!selfMetric || competitorMetrics.length === 0) {
                      return (
                        <p className="text-gray-500">
                          Add at least one competitor to see growth gap insights.
                        </p>
                      );
                    }
                    const bestCompetitor = competitorMetrics.reduce(
                      (best, current) =>
                        current.growthPercent > best.growthPercent ? current : best
                    );
                    const growthDiff =
                      bestCompetitor.growthPercent - selfMetric.growthPercent;
                    const userDaily = selfMetric.dailyAvg;
                    const compDaily = bestCompetitor.dailyAvg;
                    const diffDaily = compDaily - userDaily;
                    const projectedGap = diffDaily * 30;
                    if (growthDiff > 0 && projectedGap > 0) {
                      return (
                        <>
                          <p className="text-gray-700">
                            You are growing {Math.round(growthDiff)}% slower than{" "}
                            {bestCompetitor.displayName}.
                          </p>
                          <p className="text-gray-700 mt-1">
                            If this continues, {bestCompetitor.displayName} will gain
                            approximately{" "}
                            {Math.round(projectedGap).toLocaleString()} more
                            followers than you in the next 30 days.
                          </p>
                        </>
                      );
                    }
                    const reverseGap = -projectedGap;
                    return (
                      <>
                        <p className="text-gray-700">
                          You are growing at a similar or faster rate than{" "}
                          {bestCompetitor.displayName}.
                        </p>
                        {reverseGap > 0 && (
                          <p className="text-gray-700 mt-1">
                            If this continues, you could gain approximately{" "}
                            {Math.round(reverseGap).toLocaleString()} more followers
                            than {bestCompetitor.displayName} in the next 30 days.
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
            {!historyLoading && hasEnoughHistory && !isProPlan && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-lg">
                <p className="text-sm font-medium text-gray-700 text-center max-w-sm">
                  Upgrade to PRO – Growth Accelerator to unlock competitor growth
                  intelligence.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trending Competitor Posts */}
        <Card>
          <CardHeader>
            <CardTitle>Trending Competitor Posts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {competitors.length === 0 ? (
              <p className="text-sm text-gray-500">
                Add competitors to see their top performing posts.
              </p>
            ) : (
              competitors.map((c) => {
                const topPosts = [...(c.posts || [])]
                  .sort((a, b) => b.engagement - a.engagement)
                  .slice(0, 3);
                if (!topPosts.length) return null;
                return (
                  <div key={c.username}>
                    <h3 className="font-semibold mb-2">@{c.username}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {topPosts.map((p) => {
                        const date = new Date(p.timestamp * 1000);
                        return (
                          <div
                            key={p.postId}
                            className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col"
                          >
                            <div className="p-3 space-y-1 flex-1 flex flex-col">
                              <p className="text-xs text-gray-500">
                                {date.toLocaleDateString()} · {p.type}
                              </p>
                              <p className="text-xs text-gray-700 line-clamp-3 flex-1">
                                {p.caption || "No caption"}
                              </p>
                              <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
                                <span>❤️ {p.likes}</span>
                                <span>💬 {p.comments}</span>
                                <span>⚡ {p.engagement}</span>
                              </div>
                              <Button
                                asChild
                                className="mt-3 text-xs w-full bg-[#d72989] hover:bg-[#c0257a] text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <a
                                  href={
                                    p.url && p.url.startsWith("http")
                                      ? p.url
                                      : `https://www.instagram.com/p/${p.postId}/`
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  View Post
                                </a>
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompetitorIntelligencePage;

