import React, { useEffect, useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { onAuthStateChangedListener } from "../services/firebaseService";

type Status = "loading" | "unauthed" | "verified" | "unverified";

/**
 * Route guard that blocks access for logged-in users whose email is not verified.
 * - Unauthenticated users are allowed through (public pages handle their own gating).
 * - Verified users are allowed through.
 * - Unverified users are redirected to /verify-email.
 */
export const RequireVerifiedEmail: React.FC = () => {
  const [status, setStatus] = useState<Status>("loading");
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChangedListener((user) => {
      if (!user) {
        setStatus("unauthed");
      } else if (user.emailVerified) {
        setStatus("verified");
      } else {
        setStatus("unverified");
      }
    });
    return () => unsubscribe();
  }, []);

  if (status === "loading") {
    return null;
  }

  // Only block logged-in but unverified users from protected routes.
  if (status === "unverified") {
    return <Navigate to="/verify-email" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
};

export default RequireVerifiedEmail;

