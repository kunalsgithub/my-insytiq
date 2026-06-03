import { forwardRef, useEffect, useState } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { onAuthStateChangedListener } from "@/services/firebaseService";

type Props = Omit<LinkProps, "to"> & {
  children: React.ReactNode;
};

/** Routes signed-in users to the affiliate dashboard; others to signup with return path. */
export const AffiliatePortalLink = forwardRef<HTMLAnchorElement, Props>(
  function AffiliatePortalLink({ children, className, ...rest }, ref) {
    const [target, setTarget] = useState("/auth?from=affiliate");

    useEffect(() => {
      const unsub = onAuthStateChangedListener((user) => {
        if (user?.emailVerified) {
          setTarget("/affiliate");
        } else if (user) {
          setTarget("/verify-email");
        } else {
          setTarget("/auth?from=affiliate");
        }
      });
      return () => unsub();
    }, []);

    return (
      <Link ref={ref} to={target} className={className} {...rest}>
        {children}
      </Link>
    );
  }
);
