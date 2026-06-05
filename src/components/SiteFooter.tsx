import { Link } from "react-router-dom";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-gray-50/50 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 md:flex-row md:px-6">
        <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
          <Link to="/features" className="transition-colors hover:text-[#c0257a]">
            Features
          </Link>
          <Link to="/pricing" className="transition-colors hover:text-[#c0257a]">
            Pricing
          </Link>
          <Link to="/about" className="transition-colors hover:text-[#c0257a]">
            About
          </Link>
          <Link to="/blog" className="transition-colors hover:text-[#c0257a]">
            Blog
          </Link>
          <Link
            to="/referral-program"
            className="font-medium text-[#c0257a] transition-colors hover:text-[#9e1d62]"
          >
            Referral Program
          </Link>
          <Link to="/creators/apply" className="transition-colors hover:text-[#7c1d5c]">
            Creator&apos;s Economy
          </Link>
          <Link to="/terms-and-conditions" className="transition-colors hover:text-[#c0257a]">
            Terms of Service
          </Link>
          <Link to="/privacy" className="transition-colors hover:text-[#c0257a]">
            Privacy Policy
          </Link>
          <Link to="/refund" className="transition-colors hover:text-[#c0257a]">
            Refund Policy
          </Link>
        </div>
        <p className="text-sm text-gray-500">
          &copy; {new Date().getFullYear()} Insytiq. All rights reserved.
        </p>
        <p className="text-sm text-gray-500">Data refreshes every 24 hours</p>
      </div>
    </footer>
  );
}
