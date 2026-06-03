import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { trackAffiliateClickUrl } from "@/firebase";
import { saveAffiliateAttribution } from "@/utils/affiliateAttribution";

export default function AffiliateRedirectPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError("Invalid link.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(trackAffiliateClickUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: slug.toLowerCase() }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(data?.error?.message || "Link not found.");
          return;
        }

        saveAffiliateAttribution({
          slug: data.slug,
          refCode: data.refCode,
          affiliateUserId: data.affiliateUserId,
          linkId: data.linkId,
        });

        const dest = data.destinationPath || "/";
        if (!cancelled) {
          navigate(dest, { replace: true });
        }
      } catch {
        if (!cancelled) setError("Could not load this promotional link. Try again later.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-violet-50 via-white to-pink-50 px-4">
        <p className="text-lg font-medium text-gray-900">{error}</p>
        <button
          type="button"
          className="mt-4 text-sm text-[#c0257a] hover:underline"
          onClick={() => navigate("/", { replace: true })}
        >
          Go to Insytiq home
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-violet-50 via-white to-pink-50">
      <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      <p className="mt-3 text-sm text-gray-600">Redirecting…</p>
    </div>
  );
}
