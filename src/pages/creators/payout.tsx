import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import type { User } from "firebase/auth";
import { PageSeo } from "@/components/PageSeo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CREATOR_BRAND,
  CREATOR_MIN_PAYOUT_USD,
} from "@/config/creatorEconomy";
import { callProductionCallable } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { onAuthStateChangedListener } from "@/services/firebaseService";
import { clearedEarnings, getCreatorProfile } from "@/services/creatorService";
import type { CreatorProfile } from "@/types/creator";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function CreatorsPayoutPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [creator, setCreator] = useState<CreatorProfile | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [panNumber, setPanNumber] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChangedListener((user) => setAuthUser(user ?? null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authUser?.uid) return;
    getCreatorProfile(authUser.uid)
      .then((p) => {
        setCreator(p);
        if (p?.bankDetails) {
          setAccountName(p.bankDetails.accountName);
          setAccountNumber(p.bankDetails.accountNumber);
          setIfscCode(p.bankDetails.ifscCode);
          setPanNumber(p.bankDetails.panNumber);
        }
      })
      .finally(() => setLoading(false));
  }, [authUser]);

  if (authUser === undefined) return null;
  if (!authUser) return <Navigate to="/auth?from=creators/payout" replace />;
  if (!authUser.emailVerified) {
    return <Navigate to="/verify-email" state={{ from: "/creators/payout" }} replace />;
  }
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#7c1d5c]" />
      </div>
    );
  }
  if (!creator) return <Navigate to="/creators/apply" replace />;

  const cleared = clearedEarnings(creator);
  const formValid =
    accountName.trim() &&
    accountNumber.trim() &&
    ifscCode.trim() &&
    panNumber.trim();
  const canSubmit =
    formValid && cleared >= CREATOR_MIN_PAYOUT_USD && !creator.payoutRequested;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await callProductionCallable("submitCreatorPayout", {
        bankDetails: {
          accountName: accountName.trim(),
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.trim().toUpperCase(),
          panNumber: panNumber.trim().toUpperCase(),
        },
      });
      setSuccess(true);
    } catch (err) {
      toast({
        title: "Payout request failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageSeo
        title="Request Payout | Creator's Economy | INSYTIQ"
        description="Request your Creator's Economy earnings payout."
        path="/creators/payout"
        noIndex
      />

      <div className="mx-auto max-w-lg px-4 py-8 md:py-12">
        <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: CREATOR_BRAND }}>
          Creator&apos;s Economy
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Request payout</h1>
        <p className="mt-2 text-sm text-gray-600">
          Cleared earnings available: <strong>${cleared.toFixed(2)}</strong> (minimum $
          {CREATOR_MIN_PAYOUT_USD})
        </p>

        {success || creator.payoutRequested ? (
          <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <p className="mt-4 text-lg font-semibold text-gray-900">
              Payout requested — we&apos;ll transfer within 5 business days
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link to="/creators/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <Label htmlFor="accountName">Account holder name</Label>
              <Input
                id="accountName"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="accountNumber">Account number</Label>
              <Input
                id="accountNumber"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="ifsc">IFSC code</Label>
              <Input
                id="ifsc"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="pan">PAN number</Label>
              <Input
                id="pan"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                required
                className="mt-1.5"
              />
            </div>

            <p className="rounded-lg bg-gray-50 p-4 text-xs leading-relaxed text-gray-600">
              PAN is required for tax compliance. TDS will be deducted if your annual earnings
              exceed ₹15,000 as required by Indian tax law.
            </p>

            <Button
              type="submit"
              disabled={!canSubmit || submitting}
              className="w-full"
              style={{ backgroundColor: CREATOR_BRAND }}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Request payout"
              )}
            </Button>
          </form>
        )}
      </div>
    </>
  );
}
