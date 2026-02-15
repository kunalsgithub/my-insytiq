import React, { useEffect, useMemo, useState } from 'react';
import { useDevMode } from '../hooks/useDevMode';
import { db } from '@/services/firebaseService';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/services/firebaseService';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

type PlanKey = 'Free' | 'Trends+' | 'Analytics+' | 'Pro Combo';

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
      "Top 3 daily trending Reels",
      "1 profile analysis per day",
      "7-day snapshot view",
      "Limited SmartChat (5 queries/day)",
    ],
    isFree: true,
    usageLimit: 'per-day-1',
  },
  {
    tier: "Trends+",
    label: "CREATOR – Growth Builder",
    subtitle: "For serious individual creators",
    price: "$9",
    features: [
      "10 profile analyses per month",
      "30-day growth tracking",
      "Best time to post (data-based)",
      "Content performance insights",
      "Basic SmartChat (analytics only)",
      "Limited hashtag intelligence",
      "Competitor comparison (compare up to 2 usernames)",
    ],
    usageLimit: 10,
  },
  {
    tier: "Analytics+",
    label: "PRO – Growth Accelerator",
    subtitle: "Our most popular plan for growth",
    price: "$19",
    features: [
      "50 profile analyses per month",
      "90-day historical data",
      "Competitor comparison (compare up to 5 usernames)",
      "Engagement leak detection",
      "AI Growth Suggestions (data-backed)",
      "Advanced hashtag analysis",
      "SmartChat Pro (analytics + APIFY)",
      "CSV exports",
    ],
    mostPopular: true,
    badge: "⭐ MOST POPULAR",
    usageLimit: 50,
  },
  {
    tier: "Pro Combo",
    label: "ELITE – Agency",
    subtitle: "For agencies & power users",
    price: "$39",
    features: [
      "200 profile analyses per month",
      "Multi-account dashboard",
      "Downloadable brand reports",
      "Priority data processing",
      "AI forecasting (coming soon)",
      "Future API access",
    ],
    usageLimit: 200,
  },
];

type SubscriptionDoc = {
  currentPlan: PlanKey;
  usageCount: number;
  usageResetAt?: string | null; // ISO string for the next reset moment (used for Free plan daily reset)
  updatedAt?: any;
};

const planUsageText: Record<PlanKey, string> = {
  'Free': '1 profile analysis per day',
  'Trends+': 'Analyze up to 10 profiles per month',
  'Analytics+': 'Analyze up to 50 profiles per month',
  'Pro Combo': 'Analyze up to 200 profiles per month',
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
  const [uid, setUid] = useState<string | null>(null);
  const [sub, setSub] = useState<SubscriptionDoc | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [limitReached, setLimitReached] = useState<boolean>(false);

  const currentPlan = sub?.currentPlan || 'Free';
  const currentPlanConfig = useMemo(() => plans.find(p => p.tier === currentPlan)!, [currentPlan]);

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
        const data = snap.data() as SubscriptionDoc;
        const normalized: SubscriptionDoc = {
          currentPlan: (data.currentPlan as PlanKey) || 'Free',
          usageCount: typeof data.usageCount === 'number' ? data.usageCount : 0,
          usageResetAt: data.usageResetAt || null,
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
    if (!sub) {
      setLimitReached(false);
      return;
    }
    const usageLimit = currentPlanConfig.usageLimit;
    if (usageLimit === 'per-day-1') {
      setLimitReached(sub.usageCount >= 1);
    } else if (typeof usageLimit === 'number') {
      setLimitReached(sub.usageCount >= usageLimit);
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
  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-12 px-4 md:pl-16">
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
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 w-full">
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.tier;
            const isMostPopular = !!plan.mostPopular;
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
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-extrabold text-black">{plan.price}</span>
                  <span className="text-sm text-gray-500">{plan.isFree ? '' : '/month'}</span>
                </div>
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
              ) : (
                <button
                  className="mt-auto px-8 py-3 rounded-lg font-semibold transition-colors w-full text-lg shadow-md bg-[#8b5cf6] text-white hover:bg-[#7c3aed]"
                  onClick={() => selectPlan(plan.tier)}
                >
                  {plan.isFree ? 'Get Started' : 'Upgrade'}
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
          <ul className="text-sm md:text-base text-gray-700 space-y-2 text-left md:text-center list-disc list-inside md:list-none md:space-y-1">
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