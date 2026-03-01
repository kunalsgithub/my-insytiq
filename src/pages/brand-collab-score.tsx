import React, { useEffect, useState } from "react";
import { animate } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { getCurrentUser } from "../services/firebaseService";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebaseService";
import { functions } from "../firebase";
import { httpsCallable } from "firebase/functions";
import { useToast } from "../hooks/use-toast";
import { ToastAction } from "../components/ui/toast";
import { AlertCircle, Lightbulb, DollarSign, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import "../components/LoadingText.css";

type Breakdown = {
  engagement: number;
  consistency: number;
  reelImpact: number;
  community: number;
  professionalism: number;
};

type SuccessResult = {
  success: true;
  totalScore: number;
  status: string;
  breakdown: Breakdown;
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
};

type ErrorResult = {
  success: false;
  code: string;
  message: string;
};

type ApiResponse = SuccessResult | ErrorResult;

const PILLARS: { key: keyof Breakdown; label: string; max: number; description: string }[] = [
  { key: "engagement", label: "Engagement Quality", max: 40, description: "Likes and comments relative to followers." },
  { key: "consistency", label: "Consistency", max: 20, description: "Posting frequency over the last 30 days." },
  { key: "reelImpact", label: "Reel Impact", max: 20, description: "How well your Reels reach and engage viewers." },
  { key: "community", label: "Community Strength", max: 10, description: "Comment activity vs likes (conversation)." },
  { key: "professionalism", label: "Profile Professionalism", max: 10, description: "Bio clarity, niche signals, and link." },
];

/** Red = poor (0–39), Yellow = moderate (40–59), Green = good (60–100) */
function scoreToColor(score: number): "red" | "yellow" | "green" {
  if (score >= 60) return "green";
  if (score >= 40) return "yellow";
  return "red";
}

const RING_COLORS = { red: "#dc2626", yellow: "#eab308", green: "#16a34a" };

function CircularScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const stroke = Math.max(8, size / 16);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreToColor(score);
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        stroke={RING_COLORS[color]}
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
}

/** Progress bar fill color by percentage of max: Red < 40%, Yellow 40–69%, Green ≥ 70% */
function pillarFillClass(pct: number): string {
  if (pct >= 70) return "bg-green-500";
  if (pct >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

const BRAND_SCORE_STORAGE_KEY = "insytiq_brandScoreResult";

function loadBrandScoreFromStorage(): { result: SuccessResult; username: string } | null {
  try {
    const raw = localStorage.getItem(BRAND_SCORE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { result: SuccessResult; username: string };
    if (parsed?.result?.success && parsed?.username) return parsed;
  } catch {
    // ignore
  }
  return null;
}

function saveBrandScoreToStorage(result: SuccessResult, username: string) {
  try {
    localStorage.setItem(BRAND_SCORE_STORAGE_KEY, JSON.stringify({ result, username }));
  } catch {
    // ignore
  }
}

export default function BrandCollabScorePage() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuccessResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [barReveal, setBarReveal] = useState(0);
  const [dealVisible, setDealVisible] = useState(false);
  const { toast } = useToast();

  // Restore persisted result on mount (so results survive tab/route switches)
  useEffect(() => {
    const saved = loadBrandScoreFromStorage();
    if (saved) {
      setResult(saved.result);
      setUsername(saved.username);
    }
  }, []);

  // Persist result when we have a successful score (only overwrite on new success)
  useEffect(() => {
    if (result?.success && username.trim()) {
      saveBrandScoreToStorage(result, username.trim());
    }
  }, [result, username]);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user || username) return;
    const loadSelected = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const selected = (userDoc.data()?.selectedInstagramAccount as string) || "";
        if (selected.trim()) setUsername(selected.trim());
      } catch {
        // ignore
      }
    };
    loadSelected();
  }, [username]);

  // Animate score 0→totalScore, breakdown bars, and deal estimate when result is set
  useEffect(() => {
    if (!result) {
      setDisplayScore(0);
      setBarReveal(0);
      setDealVisible(false);
      return;
    }
    const targetScore = result.totalScore;
    const c1 = animate(0, targetScore, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (v) => setDisplayScore(v),
    });
    const c2 = animate(0, 1, {
      duration: 0.5,
      ease: "easeOut",
      delay: 0.4,
      onUpdate: (v) => setBarReveal(v),
    });
    const t = setTimeout(() => setDealVisible(true), 1800);
    return () => {
      c1.stop();
      c2.stop();
      clearTimeout(t);
    };
  }, [result]);

  const handleCalculate = async () => {
    setLoading(true);
    setApiError(null);
    setErrorCode(null);
    setResult(null);
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) {
      toast({
        title: "Username required",
        description: "Enter an Instagram username to analyze.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    const user = getCurrentUser();
    if (!user) {
      toast({
        title: "Login required",
        description: "Please login to analyze Instagram accounts.",
        variant: "destructive",
        action: (
          <ToastAction
            onClick={() => { window.location.href = "/auth"; }}
            altText="Sign in"
          >
            Sign in
          </ToastAction>
        ),
      });
      setLoading(false);
      return;
    }

    const startedAt = Date.now();
    const MIN_LOADING_MS = 800;
    await new Promise((r) => setTimeout(r, 0));
    try {
      const fn = httpsCallable<{ username: string }, ApiResponse>(functions, "getBrandCollabScore");
      const res = await fn({ username: trimmed });
      const data = res.data as ApiResponse;

      if (!data.success) {
        setApiError(data.message);
        setErrorCode(data.code);
        toast({ title: "Unable to calculate", description: data.message, variant: "destructive" });
        return;
      }
      const elapsed = Date.now() - startedAt;
      const delay = elapsed < MIN_LOADING_MS ? MIN_LOADING_MS - elapsed : 0;
      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay));
      }
      setResult(data);
      toast({ title: "Score ready", description: `${data.totalScore}/100 — ${data.status}` });
    } catch (err: any) {
      const msg = err?.message || "Something went wrong. Please try again.";
      setApiError(msg);
      setErrorCode(null);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status: string) => {
    if (status === "Brand Ready" || status === "Strong") return "text-green-600";
    if (status === "Developing") return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <header className="mb-8 animate-in fade-in duration-500">
        <h1 className="text-3xl font-bold text-gray-900">
          Brand Collab Readiness Score
        </h1>
        <p className="text-gray-600 mt-2">
          See how brand-ready your Instagram is using engagement, consistency, reels, and public profile data.
        </p>
      </header>

      {/* Profile Input Card */}
      <Card className="mb-8 shadow-lg border-0 bg-white/95 backdrop-blur animate-in fade-in slide-in-from-bottom-4 duration-500">
        <CardHeader>
          <CardTitle className="text-lg">Analyze a profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Instagram username (without @)"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setApiError(null);
                setErrorCode(null);
              }}
              className="sm:max-w-xs border-gray-200 focus:ring-2 focus:ring-[#ee2a7b]/30"
              onKeyDown={(e) => e.key === "Enter" && handleCalculate()}
              disabled={loading}
            />
            <Button
              onClick={handleCalculate}
              disabled={loading}
              className="min-w-[160px] border-0 text-white shadow-md transition-all hover:opacity-95 bg-[#d72989] hover:bg-[#c0257a]"
            >
              {loading ? (
                <span className="loading-text-inline">
                  {"CALCULATING".split("").map((ch, index) => (
                    <span key={index} className="loading-char">
                      {ch}
                    </span>
                  ))}
                </span>
              ) : (
                "Calculate Score"
              )}
            </Button>
          </div>
          {apiError && !errorCode?.startsWith("BRAND_") && errorCode !== "PRO_ONLY_FEATURE" && errorCode !== "MONTHLY_LIMIT_REACHED" && (
            <div className="flex flex-col gap-3 p-4 rounded-lg border animate-in fade-in bg-red-50 border-red-100 text-red-800" role="alert">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <p className="text-sm">{apiError}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan-gated lock screens */}
      {apiError && (errorCode === "BRAND_SCORE_LOCKED" || errorCode === "PRO_ONLY_FEATURE" || errorCode === "MONTHLY_LIMIT_REACHED") && (
        <Card className="mb-8 shadow-lg border-0 bg-amber-50/80 border border-amber-200 animate-in fade-in">
          <CardContent className="pt-8 pb-8 text-center">
            {errorCode === "BRAND_SCORE_LOCKED" && (
              <>
                <h2 className="text-xl font-bold text-amber-900">Brand Collab Score Locked</h2>
                <p className="text-amber-800 mt-2">Free plan includes 1 lifetime report.</p>
                <Link
                  to="/subscription"
                  className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors mt-4"
                >
                  Upgrade to PRO
                </Link>
              </>
            )}
            {errorCode === "PRO_ONLY_FEATURE" && (
              <>
                <h2 className="text-xl font-bold text-amber-900">Available in PRO Plan</h2>
                <p className="text-amber-800 mt-2">Brand Collab Score is a PRO-only feature. Upgrade to run unlimited reports.</p>
                <Link
                  to="/subscription"
                  className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors mt-4"
                >
                  View PRO plan
                </Link>
              </>
            )}
            {errorCode === "MONTHLY_LIMIT_REACHED" && (
              <>
                <h2 className="text-xl font-bold text-amber-900">Monthly limit reached</h2>
                <p className="text-amber-800 mt-2">You've used all 50 reports this month. Your limit resets at the start of next month.</p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI Calculating skeleton (min 800ms, then transition to result) */}
      {loading && (
        <div className="space-y-8 mt-8" role="status" aria-live="polite" aria-label="Calculating score">
          <Card className="shadow-lg border-0 overflow-hidden border border-gray-200 bg-white">
            <CardContent className="pt-8 pb-8">
              <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                <div className="relative flex items-center justify-center">
                  <CircularScoreRing score={0} size={180} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl font-bold text-gray-400">0</span>
                  </div>
                </div>
                <div className="text-center md:text-left space-y-3 min-w-[200px]">
                  <p className="text-sm font-medium text-gray-600 animate-pulse">AI analyzing engagement patterns...</p>
                  <div className="space-y-2">
                    <div className="h-3 w-full max-w-[180px] skeleton-shimmer rounded bg-gray-200" />
                    <div className="h-3 w-2/3 max-w-[140px] skeleton-shimmer rounded bg-gray-200" />
                    <div className="h-3 w-1/2 max-w-[120px] skeleton-shimmer rounded bg-gray-200" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-500">Score breakdown</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {PILLARS.map(({ label }) => (
                <Card key={label} className="shadow-md border-gray-200 bg-gray-50/50">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="h-4 w-24 skeleton-shimmer rounded bg-gray-200" />
                      <span className="h-4 w-10 skeleton-shimmer rounded bg-gray-200" />
                    </div>
                    <div className="h-2 rounded-full bg-gray-200 overflow-hidden mb-2">
                      <div className="h-full w-2/3 skeleton-shimmer rounded-full max-w-full bg-gray-300" />
                    </div>
                    <div className="h-3 w-full skeleton-shimmer rounded mt-2 bg-gray-200" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          <Card className="shadow-lg border-0 border-gray-200 bg-gray-50/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="h-5 w-5 skeleton-shimmer rounded bg-gray-200" />
                <span className="h-5 w-48 skeleton-shimmer rounded bg-gray-200" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-4 w-full max-w-md skeleton-shimmer rounded mb-3 bg-gray-200" />
              <div className="h-8 w-40 skeleton-shimmer rounded bg-gray-200" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results (persistent; restored from localStorage when returning to page) */}
      {result && !loading && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Large Score Card */}
          <Card className="shadow-lg border-0 overflow-hidden">
            <CardContent className="pt-8 pb-8">
              <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                <div className="relative flex items-center justify-center">
                  <CircularScoreRing score={displayScore} size={180} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl font-bold text-gray-900">{Math.round(displayScore)}</span>
                  </div>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-5xl font-bold text-gray-900">/ 100</p>
                  <p className={`text-xl font-semibold mt-2 ${statusColor(result.status)}`}>
                    {result.status}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Based on {result.followers.toLocaleString()} followers · {result.avgLikes.toLocaleString()} avg likes · {result.avgComments.toLocaleString()} avg comments
                  </p>
                  {result.expectedEngagementRange != null && result.actualEngagementRate != null && (
                    <div className="mt-4 pt-4 border-t border-gray-100 text-left">
                      <p className="text-sm text-gray-600">
                        Average engagement for accounts your size: <span className="font-medium text-gray-900">{result.expectedEngagementRange}</span>
                      </p>
                      <p className="text-sm text-gray-600 mt-0.5">
                        Your engagement: <span className="font-semibold text-gray-900">{result.actualEngagementRate}%</span>
                      </p>
                    </div>
                  )}
                  {result.riskFlags && result.riskFlags.length > 0 && (
                    <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-800">Brand risk flags</p>
                        <ul className="mt-1 list-disc list-inside space-y-0.5 text-amber-900">
                          {result.riskFlags.map((flag, i) => (
                            <li key={i}>{flag}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Breakdown Grid */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Score breakdown</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {PILLARS.map(({ key, label, max, description }) => {
                const value = result.breakdown[key];
                const pct = max > 0 ? Math.round((value / max) * 100) : 0;
                const fillClass = pillarFillClass(pct);
                const textColor = pct >= 70 ? "text-green-600" : pct >= 40 ? "text-yellow-600" : "text-red-600";
                const widthPct = Math.round(pct * barReveal);
                return (
                  <Card key={key} className="shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="font-medium text-gray-900">{label}</span>
                        <span className={`text-sm font-semibold ${textColor}`}>
                          {value}/{max}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-200 overflow-hidden mb-2">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ease-out ${fillClass}`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">{description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Deal Estimate (PRO only) */}
          {result.dealEstimate && (
            <Card
              className={`shadow-lg border-0 transition-opacity duration-500 ${dealVisible ? "opacity-100" : "opacity-0"}`}
            >
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Estimated brand deal range
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-3">
                  Approximate range per post based on followers and engagement. Actual rates vary by niche and brand.
                </p>
                <p className="text-2xl font-bold text-green-700">
                  ${result.dealEstimate.min.toLocaleString()} – ${result.dealEstimate.max.toLocaleString()} USD
                </p>
                <p className="text-xs text-gray-500 mt-1">per post</p>
                {result.enableExport && (
                  <p className="text-xs text-gray-500 mt-2">Export enabled for PRO.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Improvement Suggestions */}
          {result.recommendations && result.recommendations.length > 0 && (
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  Improvement suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="text-yellow-600 font-bold">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
