import React, { useEffect, useState } from "react";
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

export default function BrandCollabScorePage() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuccessResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const { toast } = useToast();

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

  const handleCalculate = async () => {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) {
      toast({
        title: "Username required",
        description: "Enter an Instagram username to analyze.",
        variant: "destructive",
      });
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
      return;
    }

    setLoading(true);
    setApiError(null);
    setErrorCode(null);
    setResult(null);
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
              className="text-white border-0 transition-opacity shadow-md min-w-[160px] hover:opacity-90"
              style={{ background: "linear-gradient(90deg, #f9ce34, #ee2a7b, #6228d7)" }}
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

      {/* Results (hidden until success) */}
      {result && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Large Score Card */}
          <Card className="shadow-lg border-0 overflow-hidden">
            <CardContent className="pt-8 pb-8">
              <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                <div className="relative flex items-center justify-center">
                  <CircularScoreRing score={result.totalScore} size={180} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl font-bold text-gray-900">{result.totalScore}</span>
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
                          className={`h-full rounded-full transition-all duration-500 ${fillClass}`}
                          style={{ width: `${pct}%` }}
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
            <Card className="shadow-lg border-0">
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
