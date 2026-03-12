import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView, useMotionValue, useTransform, animate, useMotionValueEvent } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  Target,
  Sparkles,
  Shield,
  Zap,
  Gauge,
  ArrowRight,
  Play,
  Bot,
  LineChart,
  CheckCircle2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Hero: animated gradient text class (needs bg-size for keyframes)
// ---------------------------------------------------------------------------
const gradientTextClass =
  "bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] bg-[length:200%_auto] bg-clip-text text-transparent animate-gradient-shift";

// Same scoring logic as Brand Collab Score page (red / yellow / green)
function scoreToColor(score: number): "red" | "yellow" | "green" {
  if (score >= 60) return "green";
  if (score >= 40) return "yellow";
  return "red";
}
const RING_COLORS = { red: "#dc2626", yellow: "#eab308", green: "#16a34a" };
function pillarFillClass(pct: number): string {
  if (pct >= 70) return "bg-green-500";
  if (pct >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

// ---------------------------------------------------------------------------
// Live AI mock card — score 0→44, progress bars, deal estimate (matches Brand Collab animation)
// ---------------------------------------------------------------------------
function HeroMockCard() {
  const score = useMotionValue(0);
  const roundedScore = useTransform(score, (v) => Math.round(v));
  const [displayScore, setDisplayScore] = useState(0);
  const [dealVisible, setDealVisible] = useState(false);

  useMotionValueEvent(roundedScore, "change", setDisplayScore);

  useEffect(() => {
    const controls = animate(score, 44, {
      duration: 1.2,
      ease: "easeOut",
      delay: 0.6,
    });
    const t = setTimeout(() => setDealVisible(true), 1800);
    return () => {
      controls.stop();
      clearTimeout(t);
    };
  }, [score]);

  const pillars = [
    { label: "Engagement", pct: 72 },
    { label: "Consistency", pct: 55 },
    { label: "Reel Impact", pct: 38 },
    { label: "Community", pct: 60 },
    { label: "Professionalism", pct: 80 },
  ];
  const ringColor = RING_COLORS[scoreToColor(displayScore)];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="relative rounded-2xl border border-white/60 bg-white/70 p-6 shadow-xl backdrop-blur-xl"
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#fdf2f8]/50 to-[#f5f3ff]/50" />
      <div className="relative">
        <div className="mb-4 flex items-center gap-3">
          <img
            src="/hero-avatar.png"
            alt="Profile"
            className="h-10 w-10 shrink-0 overflow-hidden rounded-full object-cover ring-2 ring-white/80"
          />
          <div>
            <p className="font-semibold text-gray-900">@selenagomez</p>
            <p className="text-xs text-gray-500">Profile analyzed</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
              <path
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="3"
                d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31"
              />
              <path
                fill="none"
                stroke={ringColor}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="97"
                strokeDashoffset={97 - (displayScore / 100) * 97}
                className="transition-[stroke] duration-200 ease-out"
                d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31"
              />
            </svg>
            <span className="absolute text-lg font-bold text-gray-900">{displayScore}</span>
          </div>
          <div className="flex-1 space-y-1.5">
            {pillars.map((p, i) => (
              <motion.div
                key={p.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.08, duration: 0.3 }}
                className="flex items-center gap-2"
              >
                <span className="w-20 truncate text-xs text-gray-600">{p.label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                  <motion.div
                    className={`h-full rounded-full ${pillarFillClass(p.pct)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${p.pct}%` }}
                    transition={{ duration: 0.5, delay: 0.4 + i * 0.06, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: dealVisible ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          className="mt-4 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2"
        >
          <span className="text-xs font-medium text-gray-500">Deal estimate</span>
          <span className="text-sm font-semibold text-gray-900">$2560000 – $7680000</span>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Feature cards data
// ---------------------------------------------------------------------------
const features = [
  {
    title: "Instagram Analytics",
    description: "Track growth, engagement, and audience insights with clear, actionable charts.",
    icon: BarChart3,
    href: "/instagram-analytics",
  },
  {
    title: "Competitor Intelligence",
    description: "Compare your performance to competitors and spot opportunities.",
    icon: TrendingUp,
    href: "/analytics/competitor-intelligence",
  },
  {
    title: "Brand Collab Readiness",
    description: "See how ready your profile is for brand deals and partnership offers.",
    icon: Target,
    href: "/brand-collab-score",
  },
  {
    title: "Daily Trend Explorer",
    description: "Stay ahead with real-time hashtags, posts, and trending audio.",
    icon: Sparkles,
    href: "/trending",
  },
];

const trustIndicators = [
  { label: "AI-Powered Scoring Engine", icon: Zap },
  { label: "Real-Time Public Data Analysis", icon: Gauge },
  { label: "Brand Monetization Intelligence", icon: Shield },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

export default function Index() {
  const heroRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const trustRef = useRef<HTMLElement>(null);
  const aiCompareRef = useRef<HTMLElement>(null);
  const proRef = useRef<HTMLElement>(null);
  const heroInView = useInView(heroRef, { once: true, amount: 0.2 });
  const featuresInView = useInView(featuresRef, { once: true, amount: 0.15 });
  const trustInView = useInView(trustRef, { once: true, amount: 0.2 });
  const aiCompareInView = useInView(aiCompareRef, { once: true, amount: 0.2 });
  const proInView = useInView(proRef, { once: true, amount: 0.2 });

  return (
    <div className="min-h-screen bg-white">
      {/* ---------------------------------------------------------------------------
          HERO
      --------------------------------------------------------------------------- */}
      <section
        ref={heroRef}
        className="relative overflow-hidden px-4 py-16 md:py-24 lg:py-28"
      >
        {/* Animated background */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(249,206,52,0.12),transparent_50%),radial-gradient(ellipse_60%_80%_at_80%_20%,rgba(238,42,123,0.08),transparent_40%),radial-gradient(ellipse_60%_80%_at_20%_80%,rgba(98,40,215,0.08),transparent_40%)]"
          style={{ backgroundSize: "200% 200%" }}
        />
        <div className="absolute left-1/4 top-1/4 h-64 w-64 rounded-full bg-[#ee2a7b]/10 blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 h-48 w-48 rounded-full bg-[#6228d7]/10 blur-3xl animate-float" style={{ animationDelay: "1s" }} />
        <div className="absolute right-1/3 top-1/2 h-32 w-32 rounded-full bg-[#f9ce34]/15 blur-2xl animate-float" style={{ animationDelay: "2.5s" }} />

        <div className="relative mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-12 lg:items-center">
            <div className="text-center lg:text-left">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4 }}
                className="text-4xl font-extrabold leading-tight tracking-tight text-gray-900 md:text-5xl lg:text-[2.75rem]"
              >
                Turn Instagram Data Into{" "}
                <span className={gradientTextClass}>
                  Growth & Brand Intelligence
                </span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.08 }}
                className="mt-5 max-w-xl text-lg text-gray-600 md:text-xl mx-auto lg:mx-0"
              >
                AI-powered analytics, competitor intelligence, and brand readiness scoring — built for serious creators.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.16 }}
                className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
              >
                <Link
                  to="/brand-collab-score"
                  className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#c0257a] to-[#a01d68] px-6 py-3.5 font-semibold text-white shadow-lg shadow-[#c0257a]/25 transition-all duration-300 hover:shadow-xl hover:shadow-[#c0257a]/30 hover:from-[#d72989] hover:to-[#b82075] animate-shadow-pulse"
                >
                  Get Your Brand Score
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  to="/trending"
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-6 py-3.5 font-semibold text-gray-700 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50"
                >
                  <Play className="h-4 w-4" />
                  See What’s Trending
                </Link>
              </motion.div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <div className="w-full max-w-sm">
                <HeroMockCard />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------------
          FEATURES — Powerful AI Tools
      --------------------------------------------------------------------------- */}
      <section ref={featuresRef} className="px-4 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4 }}
            className="text-center text-3xl font-bold text-gray-900 md:text-4xl"
          >
            Powerful AI Tools for Instagram Growth
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.06 }}
            className="mx-auto mt-3 max-w-2xl text-center text-gray-600"
          >
            Everything you need to grow and monetize your presence.
          </motion.p>
          <motion.div
            variants={container}
            initial="hidden"
            animate={featuresInView ? "show" : "hidden"}
            className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {features.map((f) => (
              <motion.div key={f.title} variants={item}>
                <Link
                  to={f.href}
                  className="group relative flex flex-col rounded-2xl border border-white/80 bg-white/60 p-6 shadow-lg shadow-gray-200/50 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#ee2a7b]/10 hover:border-[#ee2a7b]/20"
                >
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/80 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="relative">
                    <div className="mb-4 inline-flex rounded-xl bg-gradient-to-br from-[#fdf2f8] to-[#f5f3ff] p-3 transition-transform duration-300 group-hover:scale-105">
                      <f.icon className="h-6 w-6 text-[#c0257a]" />
                    </div>
                    <h3 className="font-semibold text-gray-900">{f.title}</h3>
                    <p className="mt-2 text-sm text-gray-600">{f.description}</p>
                    <span className="mt-3 inline-block h-0.5 w-0 bg-gradient-to-r from-[#ee2a7b] to-[#6228d7] transition-all duration-300 group-hover:w-12" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------------
          TRUST — Built for Serious Creators
      --------------------------------------------------------------------------- */}
      <section ref={trustRef} className="border-t border-gray-100 bg-gray-50/80 px-4 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={trustInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4 }}
            className="text-center text-2xl font-bold text-gray-900 md:text-3xl"
          >
            Built for Serious Creators & Growth Teams
          </motion.h2>
          <motion.div
            variants={container}
            initial="hidden"
            animate={trustInView ? "show" : "hidden"}
            className="mt-10 grid gap-6 md:grid-cols-3"
          >
            {trustIndicators.map((t) => (
              <motion.div
                key={t.label}
                variants={item}
                className="flex items-center gap-4 rounded-2xl border border-gray-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-sm"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#fdf2f8] to-[#f5f3ff]">
                  <t.icon className="h-6 w-6 text-[#c0257a]" />
                </div>
                <span className="font-medium text-gray-800">{t.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------------
          AI COMPARISON — Generic AI vs INSYTIQ
      --------------------------------------------------------------------------- */}
      <section
        ref={aiCompareRef}
        className="px-4 py-16 md:py-20 bg-white"
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={aiCompareInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mx-auto max-w-6xl"
        >
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              Generic AI Advice vs Real Instagram Intelligence
            </h2>
            <p className="mt-3 text-sm md:text-base text-gray-600">
              Most AI tools give general advice. INSYTIQ analyzes your real Instagram data to give actionable insights.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {/* Generic AI card */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={aiCompareInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="relative rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                  <Bot className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-semibold text-gray-900">Generic AI Tools</h3>
                  <p className="text-xs text-gray-500">Chat-style answers, no real account data.</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-gray-500">
                <li>• How to grow Instagram</li>
                <li>• How to get more followers and likes</li>
                <li>• What hashtags should I use to get more engagement</li>
                <li>• How to make reels viral and get more views</li>
                <li>• When should I post</li>
                <li>• Generate captions for my next reel</li>
              </ul>
            </motion.div>

            {/* INSYTIQ card */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={aiCompareInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, ease: "easeOut" }}
              whileHover={{ scale: 1.02 }}
              className="relative rounded-2xl border border-[#c0257a]/40 bg-gradient-to-br from-[#fdf2f8] via-white to-[#eef2ff] p-6 shadow-lg shadow-[#c0257a]/20"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#f9ce34]/10 via-[#ee2a7b]/8 to-[#6228d7]/10 pointer-events-none" />
              <div className="relative flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-sm">
                    <LineChart className="h-5 w-5 text-[#c0257a]" />
                  </div>
                  <div>
                    <h3 className="text-base md:text-lg font-semibold text-gray-900">INSYTIQ</h3>
                    <p className="text-xs text-gray-500">Real Instagram analytics, not guesses.</p>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full bg-[#ecfdf3] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#166534] shadow-sm">
                  DATA-DRIVEN
                </span>
              </div>
              <ul className="relative space-y-2 text-sm text-gray-800">
                {[
                  "What are my top performing posts in the last 30 days?",
                  "Which hashtags are performing best for me?",
                  "What is the best time to post?",
                  "Analyze my account and tell me how much followers I can expect in the next 100 days?",
                  "Which content type is performing best for me?",
                  "Brand Collaboration Readiness Score of @username",
                  "What is currently trending on Instagram?"
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          <div className="mt-10 text-center space-y-4">
            <p className="text-sm md:text-base text-gray-600">
              <span className="line-through">Generic AI guesses</span>.{" "}
              <span className="font-semibold text-gray-900">INSYTIQ analyzes your real Instagram data.</span>
            </p>
            <Link
              to="/instagram-analytics"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#c0257a] to-[#a01d68] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#c0257a]/30 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-xl"
            >
              Analyze My Instagram
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ---------------------------------------------------------------------------
          PRO POSITIONING — Know What Brands See
      --------------------------------------------------------------------------- */}
      <section ref={proRef} className="px-4 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={proInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4 }}
            className="text-center text-3xl font-bold text-gray-900 md:text-4xl"
          >
            Know What Brands See Before They Reach Out
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={proInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.06 }}
            className="mx-auto mt-3 max-w-2xl text-center text-gray-600"
          >
            Brand Collab Readiness Score gives you the same lens brands use to evaluate creators.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={proInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.12 }}
            className="relative mx-auto mt-10 max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-200/50"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#fdf2f8]/30 to-[#f5f3ff]/30" />
            <div className="relative p-6 md:p-8">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                <img
                  src="/hero-avatar.png"
                  alt="Profile"
                  className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white shadow-md"
                />
                <div>
                  <p className="font-semibold text-gray-900">Brand Collab Readiness Score</p>
                  <p className="text-xs text-gray-500">Engagement · Consistency · Reel Impact · Deal estimate</p>
                </div>
              </div>
              <div className="mt-4 flex gap-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-yellow-400 text-xl font-bold text-gray-700">44</div>
                <div className="flex-1 space-y-2">
                  {["Engagement 72%", "Consistency 55%", "Reel Impact 38%"].map((s, i) => (
                    <div key={i} className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#ee2a7b] to-[#6228d7]"
                        style={{ width: s.includes("72") ? "72%" : s.includes("55") ? "55%" : "38%" }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-4 text-sm text-gray-500">Deal estimate: $800 – $2.4K / post</p>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={proInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-8 text-center"
          >
            <Link
              to="/subscription"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#c0257a] to-[#a01d68] px-6 py-3.5 font-semibold text-white shadow-lg shadow-[#c0257a]/25 transition-all duration-300 hover:shadow-xl hover:shadow-[#c0257a]/30"
            >
              Unlock PRO Insights
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------------
          CTA
      --------------------------------------------------------------------------- */}
      <section className="border-t border-gray-100 px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">Ready to get started?</h2>
          <p className="mt-2 text-gray-600">Choose a plan and unlock growth intelligence.</p>
          <Link
            to="/subscription"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#c0257a] to-[#a01d68] px-6 py-3.5 font-semibold text-white shadow-lg shadow-[#c0257a]/25 transition-all duration-300 hover:shadow-xl"
          >
            View Subscription Plans
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ---------------------------------------------------------------------------
          FOOTER
      --------------------------------------------------------------------------- */}
      <footer className="border-t border-gray-200 bg-gray-50/50 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 md:flex-row md:px-6">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
            <Link to="/terms-and-conditions" className="hover:text-[#c0257a] transition-colors">
              Terms of Service
            </Link>
            <Link to="/privacy" className="hover:text-[#c0257a] transition-colors">
              Privacy Policy
            </Link>
            <Link to="/refund" className="hover:text-[#c0257a] transition-colors">
              Refund Policy
            </Link>
          </div>
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Insytiq. All rights reserved.
          </p>
          <p className="text-sm text-gray-500">Data refreshes every 24 hours</p>
        </div>
      </footer>
    </div>
  );
}
