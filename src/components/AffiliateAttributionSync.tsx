import { useEffect, useRef } from "react";
import { onAuthStateChangedListener } from "@/services/firebaseService";
import { attributeAffiliateSignupUrl } from "@/firebase";
import {
  clearAffiliateAttribution,
  readAffiliateAttribution,
} from "@/utils/affiliateAttribution";

/**
 * When a user signs up after visiting an affiliate link, attribute them once.
 */
export function AffiliateAttributionSync() {
  const attempted = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChangedListener(async (user) => {
      if (!user?.emailVerified || attempted.current) return;
      const pending = readAffiliateAttribution();
      if (!pending) return;

      attempted.current = true;
      try {
        const token = await user.getIdToken();
        const res = await fetch(attributeAffiliateSignupUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            slug: pending.slug,
            refCode: pending.refCode,
            affiliateUserId: pending.affiliateUserId,
          }),
        });
        if (res.ok) {
          clearAffiliateAttribution();
        }
      } catch (err) {
        console.warn("Affiliate attribution failed:", err);
        attempted.current = false;
      }
    });
    return () => unsub();
  }, []);

  return null;
}
