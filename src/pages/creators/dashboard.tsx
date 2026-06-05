import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import type { User } from "firebase/auth";
import { format } from "date-fns";
import { PageSeo } from "@/components/PageSeo";
import { Button } from "@/components/ui/button";
import {
  CREATOR_BRAND,
  CREATOR_CLICK_THRESHOLD,
  CREATOR_CONVERSION_THRESHOLD,
  CREATOR_MIN_PAYOUT_USD,
  CREATOR_USD_TO_INR,
} from "@/config/creatorEconomy";
import { useToast } from "@/hooks/use-toast";
import { onAuthStateChangedListener } from "@/services/firebaseService";
import {
  clearedEarnings,
  getCreatorProfile,
  getMonthlyCreatorStats,
  listRecentConversions,
} from "@/services/creatorService";
import type { CreatorProfile, ReferralConversion } from "@/types/creator";
import { cn } from "@/lib/utils";
import { Clock, Copy, DollarSign, Loader2, MousePointerClick, UserPlus, Users } from "lucide-react";

function StatusBadge({ status }: { status: CreatorProfile["status"] }) {
  if (status === "grace") {
    return (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
        Grace period — first month free
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
        Active — free access this month ✓
      </span>
    );
  }
  if (status === "paused") {
    return (
      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
        Access paused — subscribe to continue
      </span>
    );
  }
  return null;
}

function ProgressBar({
  label,
  current,
  target,
}: {
  label: string;
  current: number;
  target: number;
}) {
  const pct = Math.min(100, Math.round((current / target) * 100));
  const met = current >= target;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className={cn("font-medium", met ? "text-emerald-600" : "text-gray-800")}>
          {current} / {target} required
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn("h-full rounded-full transition-all", met ? "bg-emerald-500" : "bg-[#7c1d5c]")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CopyReferralButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      <Copy className="mr-1.5 h-3.5 w-3.5" />
      {copied ? "Copied ✓" : "Copy"}
    </Button>
  );
}

export default function CreatorsDashboardPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [creator, setCreator] = useState<CreatorProfile | null | undefined>(undefined);
  const [monthly, setMonthly] = useState({ clicksLast30Days: 0, conversionsLast30Days: 0 });
  const [conversions, setConversions] = useState<ReferralConversion[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const profile = await getCreatorProfile(uid);
      setCreator(profile);
      if (profile && profile.status !== "pending" && profile.status !== "rejected") {
        const [stats, recent] = await Promise.all([
          getMonthlyCreatorStats(uid),
          listRecentConversions(uid),
        ]);
        setMonthly(stats);
        setConversions(recent);
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Could not load dashboard", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const unsub = onAuthStateChangedListener((user) => setAuthUser(user ?? null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (authUser?.emailVerified) refresh(authUser.uid);
    else if (authUser === null) setLoading(false);
  }, [authUser, refresh]);

  if (authUser === undefined) return null;
  if (!authUser) return <Navigate to="/auth?from=creators/dashboard" replace />;
  if (!authUser.emailVerified) {
    return <Navigate to="/verify-email" state={{ from: "/creators/dashboard" }} replace />;
  }
  if (loading && creator === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#7c1d5c]" />
      </div>
    );
  }
  if (!creator) return <Navigate to="/creators/apply" replace />;

  const cleared = clearedEarnings(creator);
  const canRequestPayout =
    cleared >= CREATOR_MIN_PAYOUT_USD && !creator.payoutRequested;
  const metConversions = monthly.conversionsLast30Days >= CREATOR_CONVERSION_THRESHOLD;
  const metClicks = monthly.clicksLast30Days >= CREATOR_CLICK_THRESHOLD;
  const metEither = metConversions || metClicks;

  return (
    <>
      <PageSeo
        title="Creator Dashboard | INSYTIQ"
        description="Track your Creator's Economy referral performance."
        path="/creators/dashboard"
        noIndex
      />

      <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: CREATOR_BRAND }}>
              Creator&apos;s Economy
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900 md:text-3xl">
              Welcome, {creator.name.split(" ")[0]}
            </h1>
          </div>
          <StatusBadge status={creator.status} />
        </div>

        {creator.status === "pending" && (
          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
            <Clock className="mx-auto h-10 w-10 text-amber-600" />
            <p className="mt-4 text-lg font-semibold text-gray-900">Application under review</p>
            <p className="mt-2 text-sm text-gray-600">
              We&apos;ll email you within 48 hours once approved.
            </p>
          </div>
        )}

        {creator.status === "rejected" && (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-lg font-semibold text-gray-900">Application not approved</p>
            <p className="mt-2 text-sm text-gray-600">
              Contact{" "}
              <a href="mailto:support@insytiq.ai" className="text-[#7c1d5c] underline">
                support@insytiq.ai
              </a>{" "}
              if you have questions.
            </p>
          </div>
        )}

        {(creator.status === "grace" ||
          creator.status === "active" ||
          creator.status === "paused") && (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Total link clicks", value: creator.totalClicks, icon: MousePointerClick },
                { label: "Sign-ups", value: creator.totalSignups, icon: UserPlus },
                { label: "Paying users", value: creator.totalConversions, icon: Users },
                {
                  label: "Total earned",
                  value: `$${(creator.totalEarnings || 0).toFixed(2)}`,
                  icon: DollarSign,
                },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <stat.icon className="h-5 w-5 text-[#7c1d5c]" />
                  <p className="mt-2 text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>

            {creator.status !== "grace" && (
              <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
                <h2 className="text-lg font-semibold text-gray-900">Monthly threshold</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Hit 3 paying conversions or 100 referred clicks in any rolling 30-day window to
                  keep free access.
                </p>
                <div className="mt-5 space-y-4">
                  <ProgressBar
                    label="Conversions this month"
                    current={monthly.conversionsLast30Days}
                    target={CREATOR_CONVERSION_THRESHOLD}
                  />
                  <ProgressBar
                    label="Referred clicks this month"
                    current={monthly.clicksLast30Days}
                    target={CREATOR_CLICK_THRESHOLD}
                  />
                </div>
                {metEither && (
                  <p className="mt-4 text-sm font-semibold text-emerald-600">
                    ✓ Met — access secured next month
                  </p>
                )}
              </div>
            )}

            <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900">Your referral link</h2>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <code className="flex-1 break-all rounded-lg bg-gray-50 px-3 py-2 font-mono text-sm text-gray-800">
                  {creator.referralLink}
                </code>
                <CopyReferralButton url={creator.referralLink} />
              </div>
            </div>

            <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900">Earnings</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Total earned", amount: creator.totalEarnings },
                  { label: "Pending (30-day hold)", amount: creator.pendingEarnings },
                  { label: "Already paid", amount: creator.paidEarnings },
                ].map((card) => (
                  <div key={card.label} className="rounded-lg bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">{card.label}</p>
                    <p className="mt-1 text-xl font-bold text-gray-900">
                      ${(card.amount || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400">
                      ₹{((card.amount || 0) * CREATOR_USD_TO_INR).toFixed(0)} INR
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5">
                {creator.payoutRequested ? (
                  <p className="text-sm font-medium text-amber-700">
                    Payout requested — transfer within 5 business days
                  </p>
                ) : canRequestPayout ? (
                  <Button asChild style={{ backgroundColor: CREATOR_BRAND }}>
                    <Link to="/creators/payout">Request payout →</Link>
                  </Button>
                ) : (
                  <p className="text-sm text-gray-500">
                    Minimum ${CREATOR_MIN_PAYOUT_USD} cleared earnings required for payout.
                    Cleared: ${cleared.toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900">Recent conversions</h2>
              {conversions.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">No conversions yet — share your link!</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-gray-500">
                        <th className="py-2 pr-4 font-medium">Plan</th>
                        <th className="py-2 pr-4 font-medium">Date</th>
                        <th className="py-2 pr-4 font-medium">Commission</th>
                        <th className="py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conversions.map((c) => (
                        <tr key={c.id} className="border-b border-gray-100">
                          <td className="py-2.5 pr-4 capitalize">{c.planType}</td>
                          <td className="py-2.5 pr-4 text-gray-600">
                            {c.convertedAt?.toDate
                              ? format(c.convertedAt.toDate(), "MMM d, yyyy")
                              : "—"}
                          </td>
                          <td className="py-2.5 pr-4 font-medium">
                            ${c.commissionAmount.toFixed(2)}
                          </td>
                          <td className="py-2.5 capitalize text-gray-600">{c.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
