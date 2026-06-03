import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { AffiliatePortalLink } from "@/components/AffiliatePortalLink";
import { TrendingUp, Users } from "lucide-react";

const MIN_REFERRALS = 1;
const MAX_REFERRALS = 500;
const DEFAULT_REFERRALS = 27;

/** Insytiq brand accents (matches referral page + site theme). */
const BRAND = {
  pink: "#d72989",
  pinkDark: "#c0257a",
  pinkLight: "#f9e6f3",
  violet: "#8B5CF6",
} as const;

/** Blended monthly plan value (60% Pro $39 + 40% Growth $69). */
const AVG_MONTHLY_PLAN_USD = 0.6 * 39 + 0.4 * 69;

function commissionRate(referrals: number): number {
  if (referrals >= 10) return 0.4;
  if (referrals >= 3) return 0.3;
  return 0.2;
}

function tierLabel(referrals: number): string {
  if (referrals >= 10) return "Partner (40%)";
  if (referrals >= 3) return "Growth (30%)";
  return "Standard (20%)";
}

const USD_TO_INR = 83;

function perReferralAnnualInr(referrals: number): number {
  const rate = commissionRate(referrals);
  return Math.round(AVG_MONTHLY_PLAN_USD * 12 * rate * USD_TO_INR);
}

function annualEarningsInr(referrals: number): number {
  return referrals * perReferralAnnualInr(referrals);
}

function formatInr(amountInr: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountInr);
}

export function ReferralEarningsCalculator() {
  const [referrals, setReferrals] = useState(DEFAULT_REFERRALS);

  const annualInr = useMemo(() => annualEarningsInr(referrals), [referrals]);
  const perReferralInr = perReferralAnnualInr(referrals);

  const tier = tierLabel(referrals);
  const thumbPercent = ((referrals - MIN_REFERRALS) / (MAX_REFERRALS - MIN_REFERRALS)) * 100;

  return (
    <section className="mt-16 text-center">
      <h2 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
        Calculate Your Potential
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
        See how much you can earn based on the number of customers you refer.
      </p>

      <div
        className="relative mx-auto mt-8 max-w-xl overflow-hidden rounded-3xl p-[1px] shadow-lg animate-shadow-pulse"
        style={{
          background:
            "linear-gradient(135deg, rgba(249,206,52,0.35) 0%, rgba(238,42,123,0.45) 50%, rgba(98,40,215,0.35) 100%)",
        }}
      >
        <div className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50/90 via-white to-pink-50/80 px-6 py-10 md:px-10">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider"
            style={{ backgroundColor: BRAND.pinkLight, color: BRAND.pink }}
          >
            <TrendingUp className="h-4 w-4" style={{ color: BRAND.pink }} />
            Annual earnings
          </div>

          <p className="gradient-text mt-6 text-5xl font-bold tracking-tight md:text-6xl">
            {formatInr(annualInr)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Based on{" "}
            <span className="font-semibold text-foreground">{referrals}</span> active
            referrals
            <span className="text-muted-foreground/80"> · {tier}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatInr(perReferralInr)} commission per paying referral per year × {referrals}
          </p>

          <div className="mt-10 px-2 text-left">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
              <Users className="h-4 w-4 text-insta-primary" />
              Referrals
            </div>

            <div className="relative pt-10 pb-2">
              <div
                className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 transition-[left] duration-150"
                style={{ left: `${thumbPercent}%` }}
              >
                <div
                  className="rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-md"
                  style={{ backgroundColor: BRAND.pink }}
                >
                  {referrals}
                  <div
                    className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent"
                    style={{ borderTopColor: BRAND.pink }}
                  />
                </div>
              </div>

              <Slider
                value={[referrals]}
                min={MIN_REFERRALS}
                max={MAX_REFERRALS}
                step={1}
                onValueChange={([v]) => setReferrals(v ?? MIN_REFERRALS)}
                className="[&>span:first-child]:h-1.5 [&>span:first-child]:bg-violet-100 [&>span:first-child>span]:bg-gradient-to-r [&>span:first-child>span]:from-[#ee2a7b] [&>span:first-child>span]:to-[#6228d7] [&_[role=slider]]:h-6 [&_[role=slider]]:w-6 [&_[role=slider]]:border-[3px] [&_[role=slider]]:border-[#d72989] [&_[role=slider]]:bg-white [&_[role=slider]]:shadow-md [&_[role=slider]]:ring-[#d72989]/20"
              />

              <div className="mt-2 flex justify-end text-xs text-muted-foreground">
                {MAX_REFERRALS}+
              </div>
            </div>
          </div>

          <Button
            asChild
            className="mt-8 h-12 w-full max-w-sm rounded-xl bg-violet-600 text-base font-semibold text-white hover:bg-violet-700"
          >
            <AffiliatePortalLink>Start earning now</AffiliatePortalLink>
          </Button>

          <p className="mt-4 text-xs text-muted-foreground">
            Formula: active referrals × blended plan ($39 Pro / $69 Growth, ~$51/mo) × 12 months ×
            your tier rate (20–40%), shown in INR at ~₹83/$. Assumes all referrals stay subscribed
            for a year. Results may vary.
          </p>
        </div>
      </div>
    </section>
  );
}
