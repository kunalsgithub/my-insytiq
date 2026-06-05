import { useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

/**
 * After sign-in, attributes the httpOnly insytiq_ref cookie to the user via /api/attribute-creator-ref.
 */
export function CreatorAttributionSync() {
  const syncedUid = useRef<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user || syncedUid.current === user.uid) return;
      syncedUid.current = user.uid;

      try {
        const token = await user.getIdToken();
        await fetch("/api/attribute-creator-ref", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
      } catch (err) {
        console.warn("Creator referral attribution failed:", err);
      }
    });

    return () => unsub();
  }, []);

  return null;
}
