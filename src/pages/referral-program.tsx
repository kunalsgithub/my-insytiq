import { PageSeo } from "@/components/PageSeo";
import { PAGE_SEO } from "@/config/siteSeo";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { AffiliatePortalLink } from "@/components/AffiliatePortalLink";
import { ReferralEarningsCalculator } from "@/components/ReferralEarningsCalculator";
import {
  ArrowRight,
  BadgePercent,
  Mail,
  Repeat,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

const COMMISSION_TIERS = [
  {
    name: "Standard",
    rate: "20%",
    detail: "Recurring commission on every paid referral",
    requirement: "Approved affiliate — open to creators & coaches",
  },
  {
    name: "Growth",
    rate: "30%",
    detail: "Higher share for consistent promoters",
    requirement: "3+ active paying referrals",
    highlight: true,
  },
  {
    name: "Partner",
    rate: "40%",
    detail: "Top tier for high-volume partners",
    requirement: "10+ active paying referrals",
  },
] as const;

const BENCHMARKS = [
  { name: "Typical SaaS affiliate programs", range: "5% – 30%" },
  { name: "Mature SaaS programs", range: "15% – 25%" },
  { name: "Jotform (recurring)", range: "30% recurring" },
  { name: "Systeme.io (lifetime)", range: "60% lifetime recurring" },
];

const STEPS = [
  {
    title: "Apply",
    body: "Sign in and open your affiliate dashboard — add your niche and audience details as you create links.",
  },
  {
    title: "Get your link",
    body: "Create tracked promotional links in your dashboard. Each click and signup is counted automatically.",
  },
  {
    title: "Share & earn",
    body: "Recommend Insytiq to creators and coaches. Earn commission on every subscription you drive.",
  },
];

export default function ReferralProgramPage() {
  return (
    <>
      <PageSeo {...PAGE_SEO.referralProgram} />

      <div className="mx-auto max-w-4xl px-4 py-10 md:py-14">
        <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-pink-50 p-8 md:p-10">
          <p className="text-sm font-medium uppercase tracking-wide text-[#c0257a]">
            Insytiq Partner Program
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            Referral Program
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-600">
            Insytiq is AI-powered Instagram analytics for creators and coaches. Our commission
            structure is built to compete with serious SaaS affiliate programs — starting at{" "}
            <strong className="text-gray-800">20%</strong> and scaling to{" "}
            <strong className="text-gray-800">40%</strong> for top partners, with{" "}
            <strong className="text-gray-800">recurring</strong> payouts on subscriptions you refer.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              asChild
              className="bg-violet-600 hover:bg-violet-700"
            >
              <AffiliatePortalLink>
                Apply to join
                <ArrowRight className="ml-2 h-4 w-4" />
              </AffiliatePortalLink>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/features">See what you&apos;ll promote</Link>
            </Button>
          </div>
        </div>

        <section className="mt-12">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
            <BadgePercent className="h-5 w-5 text-[#c0257a]" />
            Commission tiers
          </h2>
          <p className="mt-2 text-gray-600">
            For a new product like Insytiq, 20% is credible for serious creators without
            over-committing early. High performers unlock more — right in line with how the best
            SaaS programs scale rewards.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {COMMISSION_TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-xl border p-5 ${
                  "highlight" in tier && tier.highlight
                    ? "border-violet-300 bg-violet-50/80 shadow-sm"
                    : "border-gray-200 bg-white"
                }`}
              >
                <p className="text-sm font-medium text-gray-500">{tier.name}</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{tier.rate}</p>
                <p className="mt-2 text-sm text-gray-600">{tier.detail}</p>
                <p className="mt-3 text-xs text-gray-500">{tier.requirement}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
            <Target className="h-5 w-5 text-[#c0257a]" />
            How we compare
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Creators benchmark against recurring programs like Systeme.io (60% lifetime) and
            Jotform (30% recurring). Insytiq&apos;s 20–40% tiered structure sits competitively in
            the middle — strong for a focused Instagram analytics tool.
          </p>
          <ul className="mt-4 divide-y divide-gray-100">
            {BENCHMARKS.map((row) => (
              <li
                key={row.name}
                className="flex justify-between gap-4 py-3 text-sm"
              >
                <span className="text-gray-700">{row.name}</span>
                <span className="font-medium text-gray-900">{row.range}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
            <Sparkles className="h-5 w-5 text-[#c0257a]" />
            Why promote Insytiq
          </h2>
          <ul className="mt-4 space-y-3 text-gray-600">
            <li className="flex gap-2">
              <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
              <span>
                <strong className="text-gray-800">Recurring revenue</strong> — subscriptions mean
                ongoing commission potential, not one-off payouts.
              </span>
            </li>
            <li className="flex gap-2">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
              <span>
                <strong className="text-gray-800">Perfect audience fit</strong> — Instagram coaches,
                creators, and social managers already need analytics and trend discovery.
              </span>
            </li>
            <li className="flex gap-2">
              <Target className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
              <span>
                <strong className="text-gray-800">North star benchmark</strong> — tools like Pallyy
                drive ~22% of MRR from affiliates by partnering with micro-influencers in creative
                niches. That&apos;s the playbook we&apos;re building toward.
              </span>
            </li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-gray-900">How it works</h2>
          <ol className="mt-4 space-y-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4 rounded-lg border border-gray-100 bg-gray-50/50 p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-gray-900">{step.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12 rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-6">
          <h2 className="text-lg font-semibold text-gray-900">Getting started (our playbook)</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Before scaling paid ads, we&apos;re activating existing fans and micro-influencers:
            set up affiliate links, then reach out to ~10 Instagram coaches with free Pro access so
            they can experience the product firsthand. No fancy pitch — just get Insytiq in their
            hands and let results drive referrals.
          </p>
        </section>

        <ReferralEarningsCalculator />

        <section className="mt-12 text-center">
          <h2 className="text-xl font-semibold text-gray-900">Ready to partner?</h2>
          <p className="mt-2 text-gray-600">
            Tell us about your audience and we&apos;ll send your affiliate link and onboarding details.
          </p>
          <Button asChild className="mt-4 bg-violet-600 hover:bg-violet-700">
            <AffiliatePortalLink>
              <Mail className="mr-2 h-4 w-4" />
              Open affiliate dashboard
            </AffiliatePortalLink>
          </Button>
        </section>

        <p className="mt-10 text-center text-sm text-gray-500">
          <Link to="/" className="text-[#c0257a] hover:underline">
            Back to home
          </Link>
          {" · "}
          <Link to="/pricing" className="text-[#c0257a] hover:underline">
            View pricing
          </Link>
        </p>
      </div>
    </>
  );
}
