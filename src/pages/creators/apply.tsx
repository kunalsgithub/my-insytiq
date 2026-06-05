import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { User } from "firebase/auth";
import { PageSeo } from "@/components/PageSeo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PillSelector } from "@/components/creator/PillSelector";
import {
  AUDIENCE_SIZE_OPTIONS,
  CREATOR_BRAND,
  NICHE_OPTIONS,
  type AudienceSizeOption,
  type NicheOption,
} from "@/config/creatorEconomy";
import { useToast } from "@/hooks/use-toast";
import { onAuthStateChangedListener } from "@/services/firebaseService";
import { getCreatorProfile, submitCreatorApplication } from "@/services/creatorService";
import { PAGE_SEO } from "@/config/siteSeo";
import { CheckCircle2, Loader2 } from "lucide-react";

const BENEFITS = [
  "Free Creator's Economy plan — renewed monthly when you hit the threshold",
  "40% recurring commission — on every paying user you refer, every month they stay",
  "Your referral dashboard — track clicks, conversions, earnings in real time",
  "Content starter kit — captions, talking points, screen recordings to get started",
];

export default function CreatorsApplyPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);

  const [name, setName] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [audienceSize, setAudienceSize] = useState<AudienceSizeOption | "">("");
  const [niche, setNiche] = useState<NicheOption | "">("");
  const [whyJoin, setWhyJoin] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChangedListener((user) => setAuthUser(user ?? null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authUser?.uid) return;
    getCreatorProfile(authUser.uid).then((p) => {
      if (p) {
        setAlreadyApplied(true);
        if (p.status !== "rejected") setSubmitted(true);
      }
      if (authUser.displayName) setName(authUser.displayName);
    });
  }, [authUser]);

  if (authUser === undefined) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;

    if (!name.trim() || !instagramHandle.trim() || !audienceSize || !niche) {
      toast({
        title: "Missing fields",
        description: "Please complete all required fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await submitCreatorApplication({
        uid: authUser.uid,
        email: authUser.email || "",
        name,
        instagramHandle,
        audienceSize,
        niche,
        whyJoin,
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      toast({
        title: "Submission failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageSeo {...PAGE_SEO.creatorsApply} />

      <div className="mx-auto max-w-2xl px-4 py-10 md:py-14">
        <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: CREATOR_BRAND }}>
          Creator&apos;s Economy
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
          Grow your income. Share what you love.
        </h1>

        <div className="mt-8 rounded-xl bg-gray-50 p-6">
          <p className="mb-3 text-sm font-semibold text-gray-800">What you get</p>
          <ul className="space-y-2 text-sm text-gray-600">
            {BENEFITS.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-0.5 text-[#7c1d5c]">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {!authUser ? (
          <div className="mt-8 rounded-xl border border-gray-200 p-6 text-center">
            <p className="text-gray-600">Sign in to submit your application.</p>
            <Button asChild className="mt-4" style={{ backgroundColor: CREATOR_BRAND }}>
              <Link to="/auth?from=creators/apply">Sign in to apply</Link>
            </Button>
          </div>
        ) : submitted || alreadyApplied ? (
          <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <p className="mt-4 text-lg font-semibold text-gray-900">
              Application submitted — we&apos;ll review within 48 hours
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link to="/creators/dashboard">View dashboard</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="handle">Instagram handle</Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                <Input
                  id="handle"
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value.replace(/^@/, ""))}
                  required
                  className="pl-8"
                  placeholder="yourhandle"
                />
              </div>
            </div>

            <PillSelector
              label="Audience size"
              options={AUDIENCE_SIZE_OPTIONS}
              value={audienceSize}
              onChange={setAudienceSize}
            />

            <PillSelector
              label="Your niche"
              options={NICHE_OPTIONS}
              value={niche}
              onChange={setNiche}
            />

            <div>
              <Label htmlFor="why">Why do you want to join? (optional)</Label>
              <Textarea
                id="why"
                value={whyJoin}
                onChange={(e) => setWhyJoin(e.target.value)}
                className="mt-1.5 min-h-[100px]"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
              style={{ backgroundColor: CREATOR_BRAND }}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit application"
              )}
            </Button>
          </form>
        )}
      </div>
    </>
  );
}
