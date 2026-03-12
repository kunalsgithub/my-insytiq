import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, getCurrentUser, onAuthStateChangedListener } from "../services/firebaseService";
import { getUserPlan, getUserPlanKey } from "../utils/userPlan";

interface UseUserPlanResult {
  /** "free" | "creator" | "pro" */
  plan: "free" | "creator" | "pro";
  /** Internal PLAN key used by accessControl / hasAccess */
  planKey: string;
  /** Whether user has full Trending access (Creator or Pro) */
  hasTrendingAccess: boolean;
  loading: boolean;
}

/**
 * Subscribe to the current user's document and derive their normalized plan.
 * Uses onSnapshot so UI reacts immediately when plan changes in Firestore.
 */
export function useUserPlan(): UseUserPlanResult {
  const [plan, setPlan] = useState<"free" | "creator" | "pro">("free");
  const [planKey, setPlanKey] = useState<string>(getUserPlanKey(null));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Initialize from current auth user if available
    const current = getCurrentUser();
    let unsubscribeUserDoc: (() => void) | null = null;

    const subscribeToUserDoc = (uid: string) => {
      if (!uid) return;
      const ref = doc(db, "users", uid);
      unsubscribeUserDoc = onSnapshot(
        ref,
        (snap) => {
          const data = snap.exists() ? snap.data() : null;
          const normalizedPlan = getUserPlan(data);
          const key = getUserPlanKey(data);
          setPlan(normalizedPlan);
          setPlanKey(key);
          setLoading(false);
          // Temporary debug to verify what UI reads
          console.log("User plan (normalized):", normalizedPlan, "raw:", data?.currentPlan || data?.planType);
        },
        () => {
          // On error, fall back to Free
          setPlan("free");
          setPlanKey(getUserPlanKey(null));
          setLoading(false);
        }
      );
    };

    if (current) {
      subscribeToUserDoc(current.uid);
    } else {
      setLoading(false);
    }

    const unsubscribeAuth = onAuthStateChangedListener((user) => {
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
      }
      if (user) {
        setLoading(true);
        subscribeToUserDoc(user.uid);
      } else {
        setPlan("free");
        setPlanKey(getUserPlanKey(null));
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribeUserDoc) unsubscribeUserDoc();
      unsubscribeAuth();
    };
  }, []);

  const hasTrendingAccess = plan === "creator" || plan === "pro";

  return { plan, planKey, hasTrendingAccess, loading };
}

