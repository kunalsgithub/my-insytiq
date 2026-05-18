import { PageSeo } from "@/components/PageSeo";
import { PAGE_SEO } from "@/config/siteSeo";
import { Link } from "react-router-dom";

export default function AboutPage() {
  return (
    <>
      <PageSeo {...PAGE_SEO.about} />
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">About Insytiq</h1>
        <p className="mt-4 text-base leading-relaxed text-gray-600">
          Insytiq is an <strong className="font-medium text-gray-800">AI Instagram analytics</strong> platform for
          creators, social managers, and growth teams. We focus on turning public signals and your own performance data
          into a clear <strong className="font-medium text-gray-800">content strategy</strong>—so{" "}
          <strong className="font-medium text-gray-800">Instagram growth</strong> is driven by evidence, not guesswork.
        </p>
        <p className="mt-4 text-base leading-relaxed text-gray-600">
          Our product combines dashboards, trend discovery, and AI-assisted explanations so{" "}
          <strong className="font-medium text-gray-800">social media analytics</strong> answers what to publish next,
          which formats to double down on, and how your profile compares in your niche.
        </p>
        <h2 className="mt-10 text-xl font-semibold text-gray-900">Learn more</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-gray-600">
          <li>
            <Link to="/features" className="text-[#c0257a] hover:underline">
              Features
            </Link>
          </li>
          <li>
            <Link to="/pricing" className="text-[#c0257a] hover:underline">
              Pricing
            </Link>
          </li>
          <li>
            <Link to="/blog" className="text-[#c0257a] hover:underline">
              Blog
            </Link>
          </li>
        </ul>
        <p className="mt-10 text-sm text-gray-500">
          <Link to="/" className="text-[#c0257a] hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </>
  );
}
