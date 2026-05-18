import { PageSeo } from "@/components/PageSeo";
import { PAGE_SEO } from "@/config/siteSeo";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function FeaturesPage() {
  return (
    <>
      <PageSeo {...PAGE_SEO.features} />
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">Insytiq features</h1>
        <p className="mt-4 text-base leading-relaxed text-gray-600">
          Insytiq brings together <strong className="font-medium text-gray-800">Instagram analytics</strong>, trend
          discovery, and brand-focused scoring so you can build a repeatable{" "}
          <strong className="font-medium text-gray-800">content strategy</strong>. Use the links below to open each
          product area in the app.
        </p>
        <ul className="mt-8 space-y-4">
          <li>
            <Link
              to="/instagram-analytics"
              className="group inline-flex items-center gap-2 font-medium text-[#c0257a] hover:text-[#a01d68]"
            >
              Instagram analytics dashboard
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <p className="mt-1 text-sm text-gray-600">Profile and post-level metrics to guide posting and creative tests.</p>
          </li>
          <li>
            <Link
              to="/trending"
              className="group inline-flex items-center gap-2 font-medium text-[#c0257a] hover:text-[#a01d68]"
            >
              Daily trend explorer
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <p className="mt-1 text-sm text-gray-600">Trending hashtags, audio, and content signals for faster ideation.</p>
          </li>
          <li>
            <Link
              to="/analytics/competitor-intelligence"
              className="group inline-flex items-center gap-2 font-medium text-[#c0257a] hover:text-[#a01d68]"
            >
              Competitor intelligence
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <p className="mt-1 text-sm text-gray-600">Benchmark angles and spot gaps in your niche.</p>
          </li>
          <li>
            <Link
              to="/brand-collab-score"
              className="group inline-flex items-center gap-2 font-medium text-[#c0257a] hover:text-[#a01d68]"
            >
              Brand collab readiness score
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <p className="mt-1 text-sm text-gray-600">Understand how partnership-ready your profile looks to brands.</p>
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
