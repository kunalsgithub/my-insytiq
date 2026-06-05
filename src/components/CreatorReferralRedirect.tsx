import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Routes ?ref=CODE visits through /api/ref so the server can set the httpOnly cookie.
 */
export function CreatorReferralRedirect() {
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get("ref")?.trim();
    if (!ref) return;

    const apiUrl = `/api/ref?ref=${encodeURIComponent(ref)}`;
    window.location.replace(apiUrl);
  }, [location.pathname, location.search]);

  return null;
}
