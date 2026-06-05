import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import type { User } from "firebase/auth";
import { PageSeo } from "@/components/PageSeo";
import { Button } from "@/components/ui/button";
import { CREATOR_ADMIN_EMAIL, CREATOR_BRAND, CREATOR_USD_TO_INR } from "@/config/creatorEconomy";
import { callProductionCallable } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { onAuthStateChangedListener } from "@/services/firebaseService";
import { listAllCreators, listPayoutRequests } from "@/services/creatorService";
import type { CreatorProfile, PayoutRequest } from "@/types/creator";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

export default function AdminCreatorsPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const isAdmin =
    authUser?.email?.toLowerCase() === CREATOR_ADMIN_EMAIL.toLowerCase();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        listAllCreators(),
        listPayoutRequests("requested"),
      ]);
      setCreators(c);
      setPayouts(p);
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to load admin data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const unsub = onAuthStateChangedListener((user) => setAuthUser(user ?? null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isAdmin) refresh();
    else if (authUser !== undefined) setLoading(false);
  }, [isAdmin, authUser, refresh]);

  const runAction = async (
    key: string,
    fn: () => Promise<unknown>
  ) => {
    setActionId(key);
    try {
      await fn();
      await refresh();
      toast({ title: "Done" });
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setActionId(null);
    }
  };

  if (authUser === undefined) return null;
  if (!authUser) return <Navigate to="/auth?from=admin/creators" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const annualInrFlag = (creator: CreatorProfile) => {
    const inr = (creator.totalEarnings || 0) * CREATOR_USD_TO_INR;
    if (inr >= 12000) return " ⚠️ TDS";
    return "";
  };

  return (
    <>
      <PageSeo
        title="Admin — Creators | INSYTIQ"
        description="Creator's Economy admin panel."
        path="/admin/creators"
        noIndex
      />

      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: CREATOR_BRAND }}>
          Admin
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Creator&apos;s Economy</h1>

        {loading ? (
          <div className="mt-12 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#7c1d5c]" />
          </div>
        ) : (
          <>
            <div className="mt-8 overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Instagram</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Clicks</th>
                    <th className="px-4 py-3 font-medium">Conversions</th>
                    <th className="px-4 py-3 font-medium">Earnings</th>
                    <th className="px-4 py-3 font-medium">Payout</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {creators.map((c) => (
                    <tr key={c.uid} className="border-b border-gray-100">
                      <td className="px-4 py-3">
                        {c.name}
                        {annualInrFlag(c)}
                      </td>
                      <td className="px-4 py-3">@{c.instagramHandle}</td>
                      <td className="px-4 py-3 capitalize">{c.status}</td>
                      <td className="px-4 py-3">{c.totalClicks}</td>
                      <td className="px-4 py-3">{c.totalConversions}</td>
                      <td className="px-4 py-3">${(c.totalEarnings || 0).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        {c.payoutRequested ? "Requested" : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {c.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={actionId !== null}
                              onClick={() =>
                                runAction(`approve-${c.uid}`, () =>
                                  callProductionCallable("approveCreator", { creatorUid: c.uid })
                                )
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionId !== null}
                              onClick={() =>
                                runAction(`reject-${c.uid}`, () =>
                                  callProductionCallable("rejectCreator", { creatorUid: c.uid })
                                )
                              }
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="mt-12 text-lg font-semibold text-gray-900">Payout requests</h2>
            <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="border-b bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Creator</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Amount INR</th>
                    <th className="px-4 py-3 font-medium">Requested</th>
                    <th className="px-4 py-3 font-medium">Bank details</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        No pending payout requests
                      </td>
                    </tr>
                  ) : (
                    payouts.map((p) => (
                      <tr key={p.id} className="border-b border-gray-100">
                        <td className="px-4 py-3">
                          {p.creatorName}
                          <br />
                          <span className="text-xs text-gray-500">{p.creatorEmail}</span>
                        </td>
                        <td className="px-4 py-3">${p.amount.toFixed(2)}</td>
                        <td className="px-4 py-3">₹{p.amountInr.toFixed(0)}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {p.requestedAt?.toDate
                            ? format(p.requestedAt.toDate(), "MMM d, yyyy")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {p.bankDetails ? (
                            <>
                              {p.bankDetails.accountName}
                              <br />
                              {p.bankDetails.accountNumber} · {p.bankDetails.ifscCode}
                              <br />
                              PAN: {p.bankDetails.panNumber}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            disabled={actionId !== null}
                            onClick={() =>
                              runAction(`paid-${p.id}`, () =>
                                callProductionCallable("markPayoutPaid", { payoutId: p.id })
                              )
                            }
                          >
                            Mark as Paid
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
