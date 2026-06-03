import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { PageSeo } from "@/components/PageSeo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { onAuthStateChangedListener } from "@/services/firebaseService";
import {
  AFFILIATE_DESTINATIONS,
  type AffiliateDestination,
  type AffiliateLink,
  type AffiliateProfile,
  createAffiliateLink,
  ensureAffiliateProfile,
  isValidAffiliateSlug,
  listAffiliateLinks,
  promotionalUrl,
} from "@/services/affiliateService";
import {
  ArrowLeft,
  BarChart3,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  MousePointerClick,
  Plus,
  UserPlus,
} from "lucide-react";
import type { User } from "firebase/auth";

function CopyButton({ text, label }: { text: string; label?: string }) {
  const { toast } = useToast();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast({ title: "Copied", description: label || "Link copied to clipboard." });
        } catch {
          toast({ title: "Copy failed", variant: "destructive" });
        }
      }}
    >
      <Copy className="mr-1.5 h-3.5 w-3.5" />
      Copy
    </Button>
  );
}

export default function AffiliateDashboardPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<AffiliateProfile | null>(null);
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDestination, setNewDestination] = useState<AffiliateDestination>("/subscription");

  const refresh = useCallback(async (user: User) => {
    setLoading(true);
    try {
      const p = await ensureAffiliateProfile(
        user.uid,
        user.email || "",
        user.displayName || ""
      );
      setProfile(p);
      const list = await listAffiliateLinks(user.uid);
      setLinks(list);
    } catch (err) {
      console.error(err);
      toast({
        title: "Could not load dashboard",
        description: "Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const unsub = onAuthStateChangedListener((user) => setAuthUser(user ?? null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (authUser?.emailVerified) {
      refresh(authUser);
    } else if (authUser === null) {
      setLoading(false);
    }
  }, [authUser, refresh]);

  if (authUser === undefined) {
    return null;
  }

  if (!authUser) {
    return <Navigate to="/auth?from=affiliate" replace />;
  }

  if (!authUser.emailVerified) {
    return <Navigate to="/verify-email" state={{ from: "/affiliate" }} replace />;
  }

  const totalClicks = profile?.totalClicks ?? links.reduce((s, l) => s + l.clicks, 0);
  const totalSignups = profile?.totalSignups ?? links.reduce((s, l) => s + l.signups, 0);

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !authUser) return;
    const slug = newSlug.trim().toLowerCase();
    if (!isValidAffiliateSlug(slug)) {
      toast({
        title: "Invalid slug",
        description: "Use 3–40 lowercase letters, numbers, or hyphens.",
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    try {
      await createAffiliateLink(authUser.uid, profile.refCode, {
        label: newLabel.trim() || "Campaign link",
        slug,
        destinationPath: newDestination,
      });
      setNewLabel("");
      setNewSlug("");
      await refresh(authUser);
      toast({ title: "Link created", description: "Your new promotional link is ready to share." });
    } catch (err) {
      toast({
        title: "Could not create link",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <PageSeo
        title="Affiliate Dashboard | INSYTIQ"
        description="Manage your Insytiq promotional links and track traffic."
        path="/affiliate"
      />

      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-pink-50">
        <header className="border-b border-violet-100 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#c0257a]">
                Partner dashboard
              </p>
              <h1 className="text-xl font-bold text-gray-900">Affiliate links & traffic</h1>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/referral-program">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Program info
              </Link>
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-8">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-violet-100 bg-white p-5 shadow-sm">
                  <MousePointerClick className="h-5 w-5 text-violet-600" />
                  <p className="mt-2 text-2xl font-bold text-gray-900">{totalClicks}</p>
                  <p className="text-sm text-gray-600">Total link clicks</p>
                </div>
                <div className="rounded-xl border border-violet-100 bg-white p-5 shadow-sm">
                  <UserPlus className="h-5 w-5 text-[#c0257a]" />
                  <p className="mt-2 text-2xl font-bold text-gray-900">{totalSignups}</p>
                  <p className="text-sm text-gray-600">Signups from your links</p>
                </div>
                <div className="rounded-xl border border-violet-100 bg-white p-5 shadow-sm">
                  <Link2 className="h-5 w-5 text-violet-600" />
                  <p className="mt-2 text-2xl font-bold text-gray-900">{links.length}</p>
                  <p className="text-sm text-gray-600">Active promotional links</p>
                </div>
              </div>

              <p className="mt-6 flex items-start gap-2 rounded-lg border border-violet-100 bg-white/60 px-4 py-3 text-sm text-gray-600">
                <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                Share any link below. Each click is tracked automatically; when someone signs up
                after visiting your link, it counts toward your referral signups.
              </p>

              <section className="mt-8 rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">Create promotional link</h2>
                <form onSubmit={handleCreateLink} className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="link-label">Campaign name</Label>
                    <Input
                      id="link-label"
                      placeholder="e.g. Instagram bio, YouTube description"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="link-slug">URL slug</Label>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <span className="shrink-0">/r/</span>
                      <Input
                        id="link-slug"
                        placeholder={`${profile?.refCode || "yourname"}-pricing`}
                        value={newSlug}
                        onChange={(e) => setNewSlug(e.target.value.toLowerCase())}
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Destination page</Label>
                    <Select
                      value={newDestination}
                      onValueChange={(v) => setNewDestination(v as AffiliateDestination)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AFFILIATE_DESTINATIONS.map((d) => (
                          <SelectItem key={d.path} value={d.path}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Button
                      type="submit"
                      disabled={creating}
                      className="bg-violet-600 hover:bg-violet-700"
                    >
                      {creating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      Create link
                    </Button>
                  </div>
                </form>
              </section>

              <section className="mt-8">
                <h2 className="text-lg font-semibold text-gray-900">Your links</h2>
                <div className="mt-4 space-y-4">
                  {links.map((link) => {
                    const url = promotionalUrl(link.slug);
                    return (
                      <div
                        key={link.id}
                        className="rounded-xl border border-violet-100 bg-white p-5 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {link.label}
                              {link.isDefault && (
                                <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                                  Main
                                </span>
                              )}
                            </p>
                            <p className="mt-1 font-mono text-sm text-violet-700 break-all">{url}</p>
                            <p className="mt-1 text-xs text-gray-500">
                              Sends visitors to{" "}
                              <code className="rounded bg-gray-100 px-1">{link.destinationPath}</code>
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <CopyButton text={url} />
                            <Button variant="outline" size="sm" asChild>
                              <a href={url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                Preview
                              </a>
                            </Button>
                          </div>
                        </div>
                        <div className="mt-4 flex gap-6 text-sm">
                          <span>
                            <strong className="text-gray-900">{link.clicks}</strong> clicks
                          </span>
                          <span>
                            <strong className="text-gray-900">{link.signups}</strong> signups
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <p className="mt-10 text-center text-sm text-gray-500">
                <Link to="/" className="text-[#c0257a] hover:underline">
                  Back to Insytiq app
                </Link>
              </p>
            </>
          )}
        </main>
      </div>
    </>
  );
}
