import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, ChevronRight, Sparkles, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Step = {
  step: string;
  title: string;
  description: React.ReactNode;
  icon: LucideIcon;
};

const STEPS: Step[] = [
  {
    step: "Step 1",
    title: "Enter any public Instagram handle",
    description: (
      <>
        Type any username — yours or a competitor&apos;s. Insytiq pulls profile metrics, engagement patterns, and post
        performance instantly. No login, no permissions.
      </>
    ),
    icon: BarChart3,
  },
  {
    step: "Step 2",
    title: "Layer in trends and competitors",
    description: (
      <>
        Browse what is rising across Instagram—hashtags, audio, and content themes—then contrast that with your own
        lane using competitor-style intelligence.
      </>
    ),
    icon: TrendingUp,
  },
  {
    step: "Step 3",
    title: "Turn insight into next week's plan",
    description: (
      <>
        Use AI-assisted summaries and scores (like brand readiness) to prioritize actions: what to film, what to test,
        and what to pause—so <strong className="font-semibold text-gray-800">Instagram growth</strong> is intentional,
        not random.
      </>
    ),
    icon: Sparkles,
  },
];

function StepCard({ step, title, description, icon: Icon }: Step) {
  return (
    <div className="flex flex-1 flex-col items-center text-center">
      <span className="inline-flex rounded-full bg-gradient-to-r from-[#c0257a] to-[#6228d7] px-4 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-sm">
        {step}
      </span>
      <div className="mt-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-100 bg-white shadow-md ring-4 ring-violet-50">
        <Icon className="h-8 w-8 text-gray-900" strokeWidth={1.5} aria-hidden />
      </div>
      <h3 className="mt-5 text-lg font-bold text-gray-900 md:text-xl">{title}</h3>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-gray-600 md:text-base">{description}</p>
    </div>
  );
}

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="border-t border-gray-100 bg-gradient-to-b from-white via-violet-50/40 to-white px-4 py-16 md:py-24"
      aria-labelledby="how-it-works-heading"
    >
      <div className="mx-auto max-w-5xl">
        <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-[#c0257a]">
          How it works
        </p>
        <h2
          id="how-it-works-heading"
          className="mt-4 text-center text-3xl font-bold tracking-tight text-gray-900 md:text-4xl lg:text-[2.75rem] lg:leading-tight"
        >
          3 simple steps,{" "}
          <span className="bg-gradient-to-r from-[#ee2a7b] via-[#c0257a] to-[#6228d7] bg-clip-text text-transparent">
            smarter Instagram growth
          </span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-base leading-relaxed text-gray-600 md:text-lg">
          Insytiq is designed as a simple loop: measure, compare, and act. Each step uses{" "}
          <strong className="font-semibold text-gray-800">Instagram analytics</strong> or live trend data so your{" "}
          <strong className="font-semibold text-gray-800">content strategy</strong> stays grounded in evidence.
        </p>

        <div className="mt-14 flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-center md:gap-3 lg:gap-5">
          {STEPS.map((item, index) => (
            <Fragment key={item.step}>
              <div className="w-full max-w-sm flex-1 px-2 md:max-w-[220px] lg:max-w-xs">
                <StepCard {...item} />
              </div>
              {index < STEPS.length - 1 && (
                <ChevronRight
                  className="h-7 w-7 shrink-0 rotate-90 text-[#c0257a]/60 md:mt-14 md:rotate-0"
                  aria-hidden
                />
              )}
            </Fragment>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-gray-600">
          <Link
            to="/features"
            className="inline-flex items-center gap-1 font-semibold text-[#c0257a] hover:underline"
          >
            Browse all features
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <span className="mx-2 text-gray-300">·</span>
          <Link to="/pricing" className="font-semibold text-[#c0257a] hover:underline">
            View pricing
          </Link>
        </p>
      </div>
    </section>
  );
}
