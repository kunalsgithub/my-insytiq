import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { HandCoins } from "lucide-react";
import { onAuthStateChangedListener } from "@/services/firebaseService";
import { getCreatorProfile } from "@/services/creatorService";

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `group/nav relative flex items-center rounded-xl px-3 py-2 transition-all ${
    isActive
      ? "bg-[#e9f2ff] text-[#1a73e8]"
      : "text-gray-700 hover:bg-gray-100/80 hover:text-gray-900"
  }`;

const labelClass =
  "ml-3 truncate text-sm font-medium opacity-0 transition-opacity duration-150 group-hover:opacity-100";

/** Sidebar link — dashboard if creator exists, otherwise apply. */
export function CreatorEconomyNavLink() {
  const [href, setHref] = useState("/creators/apply");

  useEffect(() => {
    const unsub = onAuthStateChangedListener(async (user) => {
      if (!user) {
        setHref("/creators/apply");
        return;
      }
      const profile = await getCreatorProfile(user.uid);
      setHref(profile ? "/creators/dashboard" : "/creators/apply");
    });
    return () => unsub();
  }, []);

  return (
    <NavLink to={href} className={navItemClass}>
      <HandCoins className="h-5 w-5 shrink-0" />
      <span className={labelClass}>Creator&apos;s Economy</span>
    </NavLink>
  );
}
