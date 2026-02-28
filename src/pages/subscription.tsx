import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useDevMode } from '../hooks/useDevMode';
import { useToast } from '../hooks/use-toast';
import { db, auth } from '../services/firebaseService';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

type PlanKey = 'Free' | 'Trends+' | 'Analytics+';

type BillingCycle = 'monthly' | 'yearly';

const plans: Array<{
  tier: PlanKey;
  label: string;
  subtitle: string;
  price: string;
  features: string[];
  isFree?: boolean;
  mostPopular?: boolean;
  badge?: string;
  usageLimit: number | 'unlimited' | 'per-day-1';
}> = [
  {
    tier: "Free",
    label: "FREE – Explorer",
    subtitle: "Get started with core insights",
    price: "$0",
    features: [
      "Top 5 daily trending Reels",
      "2 profile analyses per month",
      "7-day snapshot view",
      "Competitor Overview only (1 profile)",
      "Brand Collab Score: 1 lifetime full score",
      "Limited SmartChat (5 queries/day)",
    ],
    isFree: true,
    usageLimit: 'per-day-1',
  },
  {
    tier: "Trends+",
    label: "Creator",
    subtitle: "For individual creators building consistent growth.",
    price: "$19",
    features: [
      "Analytics",
      "12 Profile Analyses per month",
      "30-Day Growth Tracking",
      "Competitor Comparison (up to 3 profiles)",
      "Trending Competitor Posts",
      "Brand Collab Score: No access",
      "Content Performance Insights",
      "Basic Post Level Intelligence",
      "Core Hashtag Intelligence",
      "SmartChat (up to 600 queries/month)",
    ],
    usageLimit: 12,
  },
  {
    tier: "Analytics+",
    label: "Pro",
    subtitle: "For serious creators, brands, and growth-focused teams.",
    price: "$29",
    features: [
      "Advanced Analytics",
      "30 Profile Analyses per month",
      "90-Day Growth Tracking",
      "Growth Comparison chart (Pro only)",
      "Competitor Comparison (up to 5 profiles)",
      "Brand Collab Score: 50/month + premium features",
      "Engagement Drop Detection",
      "AI & Advanced Insights",
      "AI-Powered Growth Intelligence",
      "Advanced Hashtag Analysis",
      "SmartChat (1,200+ queries/month)",
      "CSV Data Exports",
    ],
    mostPopular: true,
    badge: "⭐ MOST POPULAR",
    usageLimit: 50,
  },
];

type ProfileAnalysisUsage = { month: string; count: number };

type SubscriptionDoc = {
  currentPlan: PlanKey;
  usageCount: number;
  usageResetAt?: string | null; // ISO string for the next reset moment (used for Free plan daily reset)
  profileAnalysisUsage?: ProfileAnalysisUsage | null;
  updatedAt?: any;
};

const planUsageText: Record<PlanKey, string> = {
  'Free': '2 profile analyses per month',
  'Trends+': 'Analyze up to 12 profiles per month',
  'Analytics+': 'Analyze up to 30 profiles per month',
};

// Paddle / Stripe Billing price IDs (from .env)
const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
const PADDLE_PRICE_IDS: Partial<Record<PlanKey, string>> = {
  'Trends+': env.VITE_PADDLE_PRICE_ID_CREATOR,
  'Analytics+': env.VITE_PADDLE_PRICE_ID_PRO,
};

// Stripe price IDs structured by plan + billing cycle
const STRIPE_PRICE_IDS: Record<string, string | undefined> = {
  creator_monthly: env.VITE_STRIPE_PRICE_ID_CREATOR_MONTHLY,
  creator_yearly: env.VITE_STRIPE_PRICE_ID_CREATOR_YEARLY,
  pro_monthly: env.VITE_STRIPE_PRICE_ID_PRO_MONTHLY,
  pro_yearly: env.VITE_STRIPE_PRICE_ID_PRO_YEARLY,
};

const gradientText = {
  background: 'linear-gradient(90deg, #f9ce34, #ee2a7b, #6228d7)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

const gradientBtn = {
  background: 'linear-gradient(90deg, #f9ce34, #ee2a7b, #6228d7)',
  color: 'white',
  border: 'none',
};

const Subscription = () => {
  const devMode = useDevMode();
  const { toast } = useToast();
  const [uid, setUid] = useState<string | null>(null);
  const [sub, setSub] = useState<SubscriptionDoc | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [limitReached, setLimitReached] = useState<boolean>(false);
  const [paddleReady, setPaddleReady] = useState<boolean>(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly'); // default yearly

  const currentPlan = sub?.currentPlan || 'Free';
  const currentPlanConfig = useMemo(() => {
    let normalized: PlanKey = 'Free';
    const p = typeof currentPlan === 'string' ? currentPlan.trim() : '';
    if (p === 'Analytics+' || p === 'Pro' || p.toLowerCase().includes('pro')) normalized = 'Analytics+';
    else if (p === 'Trends+' || p === 'Creator' || p.toLowerCase().includes('creator')) normalized = 'Trends+';
    else if (p === 'Free') normalized = 'Free';
    return plans.find(pl => pl.tier === normalized) ?? plans[0];
  }, [currentPlan]);

  // Initialize Paddle when client token is present (script may load after app)
  useEffect(() => {
    const token = env.VITE_PADDLE_CLIENT_TOKEN;
    if (!token?.trim() || typeof window === 'undefined') {
      setPaddleReady(false);
      return;
    }
    const trimmedToken = token.trim();
    const isSandbox = trimmedToken.startsWith('test_');
    const init = () => {
      const paddle = (window as unknown as {
        Paddle?: {
          Environment?: { set: (env: 'sandbox' | 'production') => void };
          Initialize: (o: { token: string }) => void;
        };
      }).Paddle;
      if (!paddle) return false;
      try {
        if (isSandbox && paddle.Environment?.set) {
          paddle.Environment.set('sandbox');
        }
        paddle.Initialize({ token: trimmedToken });
        setPaddleReady(true);
        return true;
      } catch {
        setPaddleReady(false);
        return false;
      }
    };
    if (init()) return;
    const t = setInterval(() => { if (init()) clearInterval(t); }, 200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUid(null);
        setSub(null);
        setLoading(false);
        return;
      }
      setUid(user.uid);
      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as SubscriptionDoc & { profileAnalysisUsage?: { month?: string; count?: number } };
        const rawUsage = data.profileAnalysisUsage;
        const normalized: SubscriptionDoc = {
          currentPlan: (data.currentPlan as PlanKey) || 'Free',
          usageCount: typeof data.usageCount === 'number' ? data.usageCount : 0,
          usageResetAt: data.usageResetAt || null,
          profileAnalysisUsage: rawUsage && typeof rawUsage.month === 'string' && typeof rawUsage.count === 'number'
            ? { month: rawUsage.month, count: rawUsage.count }
            : null,
          updatedAt: data.updatedAt,
        };
        // Handle daily reset for Free plan
        if (normalized.currentPlan === 'Free' && normalized.usageResetAt) {
          const now = new Date();
          const resetAt = new Date(normalized.usageResetAt);
          if (now >= resetAt) {
            // reset usage for the new day
            normalized.usageCount = 0;
            normalized.usageResetAt = computeNextDailyResetISO();
            await setDoc(ref, { ...normalized, updatedAt: serverTimestamp() }, { merge: true });
          }
        }
        setSub(normalized);
        setLoading(false);
      } else {
        const initial: SubscriptionDoc = {
          currentPlan: 'Free',
          usageCount: 0,
          usageResetAt: computeNextDailyResetISO(),
        };
        await setDoc(ref, { ...initial, updatedAt: serverTimestamp() }, { merge: true });
        setSub(initial);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!sub || !currentPlanConfig) {
      setLimitReached(false);
      return;
    }
    const usageLimit = currentPlanConfig.usageLimit;
    const thisMonth = new Date().toISOString().slice(0, 7);
    const usage = sub.profileAnalysisUsage;
    const usageMonth = usage?.month ?? null;
    const usageCount = usage?.count ?? 0;
    const isSameMonth = usageMonth === thisMonth;
    if (usageLimit === 'per-day-1') {
      setLimitReached(isSameMonth && usageCount >= 2);
    } else if (typeof usageLimit === 'number') {
      setLimitReached(isSameMonth && usageCount >= usageLimit);
    } else {
      setLimitReached(false);
    }
  }, [sub, currentPlanConfig]);

  const selectPlan = async (plan: PlanKey) => {
    if (!uid) return;
    const ref = doc(db, 'users', uid);
    const base: SubscriptionDoc = {
      currentPlan: plan,
      usageCount: 0,
      usageResetAt: plan === 'Free' ? computeNextDailyResetISO() : null,
    };
    await setDoc(ref, { ...base, updatedAt: serverTimestamp() }, { merge: true });
    setSub(base);
  };

  const getStripePriceKeyForPlan = (plan: PlanKey, cycle: BillingCycle): string | null => {
    if (plan === 'Trends+') {
      return cycle === 'monthly' ? 'creator_monthly' : 'creator_yearly';
    }
    if (plan === 'Analytics+') {
      return cycle === 'monthly' ? 'pro_monthly' : 'pro_yearly';
    }
    return null;
  };

  const openPaddleCheckout = (plan: PlanKey, cycle: BillingCycle) => {
    if (!uid) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to upgrade your plan.',
        variant: 'destructive',
      });
      window.location.href = '/auth?from=subscription&message=upgrade';
      return;
    }
    if (!paddleReady) {
      toast({
        title: 'Checkout loading',
        description: 'Payment is still loading. Please wait a moment and try again.',
        variant: 'destructive',
      });
      return;
    }

    // Base fallback price per plan (kept for backward compatibility)
    let priceId = PADDLE_PRICE_IDS[plan];

    // If specific monthly/yearly prices exist in .env, prefer them so
    // Paddle checkout matches the toggle selection.
    if (plan === 'Trends+') {
      const monthly = env.VITE_PADDLE_PRICE_ID_CREATOR_MONTHLY;
      const yearly = env.VITE_PADDLE_PRICE_ID_CREATOR_YEARLY;
      if (cycle === 'monthly' && monthly) {
        priceId = monthly;
      } else if (cycle === 'yearly' && yearly) {
        priceId = yearly;
      }
    } else if (plan === 'Analytics+') {
      const monthly = env.VITE_PADDLE_PRICE_ID_PRO_MONTHLY;
      const yearly = env.VITE_PADDLE_PRICE_ID_PRO_YEARLY;
      if (cycle === 'monthly' && monthly) {
        priceId = monthly;
      } else if (cycle === 'yearly' && yearly) {
        priceId = yearly;
      }
    }

    // Select matching Stripe price ID (for Stripe-based billing flows)
    const stripeKey = getStripePriceKeyForPlan(plan, cycle);
    const stripePriceId = stripeKey ? STRIPE_PRICE_IDS[stripeKey] : undefined;
    if (devMode) {
      console.log('Selected billing cycle:', cycle, 'Stripe price ID:', stripePriceId);
    }
    const paddle = (window as unknown as {
      Paddle?: {
        Checkout: {
          open: (o: {
            items: { priceId: string; quantity: number }[];
            successUrl: string;
            customer?: { email: string };
            customData?: Record<string, string>;
          }) => void;
        };
      };
    }).Paddle;

    if (!paddle?.Checkout) {
      toast({
        title: 'Checkout unavailable',
        description: 'Payment script did not load. Refresh the page or try again later.',
        variant: 'destructive',
      });
      return;
    }
    if (!priceId?.trim()) {
      toast({
        title: 'Checkout not configured',
        description: 'Subscription prices are not set for this environment. If you see this on the live site, add Paddle env vars in Vercel (Settings → Environment Variables).',
        variant: 'destructive',
      });
      return;
    }

    const user = auth.currentUser;
    const userEmail = user?.email ?? '';
    try {
      paddle.Checkout.open({
        items: [{ priceId: priceId.trim(), quantity: 1 }],
        successUrl: `${window.location.origin}/subscription`,
        ...(userEmail ? { customer: { email: userEmail } } : {}),
        customData: {
          userId: uid,
          email: userEmail,
          selectedPlan: plan,
        },
      });
    } catch (err) {
      toast({
        title: 'Checkout error',
        description: err instanceof Error ? err.message : 'Something went wrong. Try again.',
        variant: 'destructive',
      });
    }
  };

  const renewPlan = async () => {
    if (!uid || !sub) return;
    const ref = doc(db, 'users', uid);
    const reset: Partial<SubscriptionDoc> = {
      usageCount: 0,
      usageResetAt: sub.currentPlan === 'Free' ? computeNextDailyResetISO() : null,
    };
    await setDoc(ref, { ...reset, updatedAt: serverTimestamp() }, { merge: true });
    setSub({ ...sub, ...reset });
  };
  if (!loading && uid === null) {
    return <Navigate to="/auth?from=subscription" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4 md:pl-16">
      <div className="w-full md:ml-16 md:max-w-6xl">
        <h1 className="text-4xl font-bold mb-8 text-center" style={gradientText}>
          Subscription Plans
        </h1>
        <p className="text-center text-sm text-gray-500 mb-6">
          Pick the plan that matches where you are in your creator journey.
        </p>
        {!loading && limitReached && (
          <div className="mb-4 text-center text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md py-2 px-3">
            You’ve reached your analysis limit for this plan. Renew to continue.
          </div>
        )}

        {/* Billing cycle toggle (solid colors, no rgb/opacity) */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <div className="relative">
            <div
              role="switch"
              aria-checked={billingCycle === 'yearly'}
              aria-label="Toggle billing cycle between monthly and yearly"
              onClick={() =>
                setBillingCycle((prev) => (prev === 'monthly' ? 'yearly' : 'monthly'))
              }
              className="relative flex items-center w-64 h-12 cursor-pointer rounded-full bg-white border border-gray-200 shadow-md overflow-hidden"
            >
              {/* Sliding solid pill */}
              <div
                className={`absolute top-1 left-1 h-10 w-[calc(50%-0.25rem)] rounded-full bg-[#d72989] shadow-lg transition-transform duration-300 ease-out ${
                  billingCycle === 'yearly' ? 'translate-x-full' : 'translate-x-0'
                }`}
              />

              {/* Labels */}
              <div className="relative z-10 flex w-full h-full text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setBillingCycle('monthly');
                  }}
                  className="flex-1 flex items-center justify-center"
                >
                  <span
                    className={
                      billingCycle === 'monthly'
                        ? 'text-white'
                        : 'text-gray-600'
                    }
                  >
                    Monthly
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setBillingCycle('yearly');
                  }}
                  className="flex-1 flex items-center justify-center"
                >
                  <span
                    className={
                      billingCycle === 'yearly'
                        ? 'text-white'
                        : 'text-gray-600'
                    }
                  >
                    Yearly
                  </span>
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-gray-700">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-semibold">
              2 Months Free
            </span>
            <span>when you choose yearly billing.</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.tier;
            const isMostPopular = !!plan.mostPopular;

            // Pricing logic per plan + billing cycle
            let displayPrice = plan.price;
            let priceSuffix = plan.isFree ? '' : '/month';
            let billingSubtext: string | null = null;
            let savingsBadge: string | null = null;

            if (plan.tier === 'Trends+') {
              if (billingCycle === 'monthly') {
                displayPrice = '$19';
                priceSuffix = '/month';
              } else {
                displayPrice = '$189';
                priceSuffix = '/year';
                billingSubtext = '$15.75/month billed annually';
                savingsBadge = 'Save $39';
              }
            
            } else if (plan.tier === 'Analytics+') {
              if (billingCycle === 'monthly') {
                displayPrice = '$29';
                priceSuffix = '/month';
              } else {
                displayPrice = '$289';
                priceSuffix = '/year';
                billingSubtext = '$24.08/month billed annually';
                savingsBadge = 'Save $59';
              }
            }

            return (
              <div
                key={plan.tier}
                className={`relative bg-white rounded-2xl border p-8 flex flex-col items-center transition-transform ${
                  isMostPopular
                    ? 'shadow-xl border-[#d72989] scale-105'
                    : 'shadow-md border-gray-100 hover:scale-105'
                }`}
              >
                {isMostPopular && plan.badge && (
                  <div className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold bg-[#111827] text-white shadow-md">
                    {plan.badge}
                  </div>
                )}
                <h2 className="text-lg font-bold mb-1 text-center" style={gradientText}>
                  {plan.label}
                </h2>
                <p className="text-xs text-gray-500 mb-4 text-center">{plan.subtitle}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-extrabold text-black">{displayPrice}</span>
                  <span className="text-sm text-gray-500">{plan.isFree ? '' : priceSuffix}</span>
                </div>
                {billingSubtext && (
                  <p className="text-xs text-gray-500 mb-2 text-center">
                    {billingSubtext}
                  </p>
                )}
                {billingCycle === 'yearly' && savingsBadge && (
                  <div className="mb-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-50 text-[11px] font-semibold text-green-700">
                      {savingsBadge}
                    </span>
                  </div>
                )}
                <ul className="text-gray-700 text-left mb-6 list-disc list-inside space-y-2 w-full">
                {plan.features.map((feature, idx) => (
                  <li key={idx}>{feature}</li>
                ))}
              </ul>
              <div className="w-full mb-4 text-xs text-gray-600">
                <span className="font-semibold">Usage:</span>{' '}
                <span>{planUsageText[plan.tier]}</span>
              </div>
              {isCurrent ? (
                <button
                  className={`mt-auto px-8 py-3 rounded-lg font-semibold transition-colors w-full text-lg shadow-md ${
                    limitReached ? 'bg-[#8b5cf6] text-white hover:bg-[#7c3aed]' : 'bg-[#ede9fe] text-[#8b5cf6] cursor-default'
                  }`}
                  onClick={limitReached ? renewPlan : undefined}
                  disabled={!limitReached}
                >
                  {limitReached ? 'Renew Plan' : 'Current Plan'}
                </button>
              ) : plan.isFree ? (
                <button
                  className="mt-auto px-8 py-3 rounded-lg font-semibold transition-colors w-full text-lg shadow-md bg-[#8b5cf6] text-white hover:bg-[#7c3aed]"
                  onClick={() => selectPlan(plan.tier)}
                >
                  Get Started
                </button>
              ) : (
                <button
                  className="mt-auto px-8 py-3 rounded-lg font-semibold transition-colors w-full text-lg shadow-md bg-[#8b5cf6] text-white hover:bg-[#7c3aed]"
                  onClick={() => openPaddleCheckout(plan.tier, billingCycle)}
                >
                  {plan.tier === 'Trends+' ? 'Get Started' : 'Start Pro Plan'}
                </button>
              )}
              </div>
            );
          })}
        </div>

        {/* Why Creators Upgrade */}
        <div className="mt-12 max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4" style={gradientText}>
            Why Creators Upgrade
          </h2>
          <ul className="text-sm md:text-base text-gray-700 space-y-1 text-center list-none">
            <li>Identify growth leaks</li>
            <li>Increase engagement 20–40%</li>
            <li>Know best posting time using real data</li>
            <li>Analyze competitors before posting</li>
            <li>Make decisions using AI insights</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Subscription; 

function computeNextDailyResetISO(): string {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0); // next midnight
  return next.toISOString();
}