import type { ReactNode } from "react";

export type FeaturedPlatform = {
  id: string;
  name: string;
};

export const FEATURED_PLATFORMS: FeaturedPlatform[] = [
  { id: "awwwards", name: "awwwards." },
  { id: "speckyboy", name: "Speckyboy" },
  { id: "devto", name: "DEV" },
  { id: "medium", name: "Medium" },
  { id: "sidebar", name: "Sidebar" },
  { id: "hackernoon", name: "Hacker Noon" },
  { id: "themewagon", name: "Theme Wagon" },
  { id: "awesome", name: "Awesome" },
  { id: "designernews", name: "Designer News" },
  { id: "cssauthor", name: "CSS Author" },
  { id: "producthunt", name: "Product Hunt" },
  { id: "codemarket", name: "Code.Market" },
  { id: "uneed", name: "Uneed" },
  { id: "alternativeto", name: "AlternativeTo" },
  { id: "statichunt", name: "Statichunt" },
  { id: "tailkits", name: "Tailkits" },
  { id: "microlaunch", name: "MicroLaunch" },
  { id: "dailydev", name: "daily.dev" },
  { id: "htmlrev", name: "HTMLRev" },
  { id: "devhunt", name: "DevHunt" },
];

export function FeaturedLogoMark({ id }: { id: string }) {
  const marks: Record<string, ReactNode> = {
    awwwards: (
      <span className="font-serif text-lg font-bold tracking-tight text-gray-900">
        awwwards<span className="text-[#c0257a]">.</span>
      </span>
    ),
    speckyboy: (
      <span className="text-sm font-semibold tracking-wide text-gray-800">
        specky<span className="font-normal text-gray-500">boy</span>
      </span>
    ),
    devto: (
      <span className="rounded bg-black px-2.5 py-1.5 text-sm font-bold tracking-tighter text-white">
        DEV
      </span>
    ),
    medium: (
      <span className="flex items-center gap-1.5 text-lg font-serif font-bold text-gray-900">
        Medium
        <span className="flex gap-0.5">
          <span className="h-1 w-1 rounded-full bg-gray-900" />
          <span className="h-1 w-1 rounded-full bg-gray-900" />
          <span className="h-1 w-1 rounded-full bg-gray-900" />
        </span>
      </span>
    ),
    sidebar: (
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-gray-800 text-gray-800"
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 15 9 22 9 17 14 19 22 12 18 5 22 7 14 2 9 9 9" />
        </svg>
      </span>
    ),
    hackernoon: (
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-800">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-gray-800">
          <span className="h-2 w-2 rounded-full bg-gray-800" />
        </span>
        HACKERNOON
      </span>
    ),
    themewagon: (
      <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-gray-700" aria-hidden fill="currentColor">
          <path d="M4 14c0-2 2-4 5-4h2c3 0 5 2 5 4v2H4v-2zm14-2c1 0 2 1 2 2v4h-4v-6c0-1 1-2 2-2z" />
        </svg>
        theme wagon
      </span>
    ),
    awesome: (
      <span className="flex items-center gap-1.5 text-sm font-bold text-gray-800">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full text-xs text-white"
          style={{ background: "linear-gradient(135deg,#42b883,#35495e)" }}
          aria-hidden
        >
          V
        </span>
        awesome
      </span>
    ),
    designernews: (
      <span className="rounded bg-[#1a5fb4] px-2 py-1 text-sm font-black text-white">DN</span>
    ),
    cssauthor: (
      <span className="font-mono text-sm font-bold text-gray-800">
        {"{"}CSS{"}"}
      </span>
    ),
    producthunt: (
      <span className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#da552f] text-xs font-bold text-white">
          P
        </span>
        Product Hunt
      </span>
    ),
    codemarket: (
      <span className="text-sm font-semibold text-gray-800">
        code<span className="text-[#c0257a]">.</span>market
      </span>
    ),
    uneed: (
      <span className="text-lg font-black tracking-tight text-gray-900">UNEED</span>
    ),
    alternativeto: (
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100"
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-violet-600" fill="currentColor">
          <circle cx="12" cy="10" r="4" />
          <path d="M8 16c0-2 2-3 4-3s4 1 4 3v2H8v-2z" opacity="0.85" />
        </svg>
      </span>
    ),
    statichunt: (
      <span className="text-sm font-bold tracking-tight text-gray-900">
        Static<span className="text-violet-600">hunt</span>
      </span>
    ),
    tailkits: (
      <span className="flex items-center gap-1 text-sm font-bold text-gray-900">
        <span className="flex h-6 w-6 items-center justify-center rounded bg-gray-900 text-xs text-white">
          t
        </span>
        tailkits
      </span>
    ),
    microlaunch: (
      <span className="text-sm font-bold text-gray-900">
        Micro<span className="text-violet-600">Launch</span>
      </span>
    ),
    dailydev: (
      <span className="text-sm font-bold text-gray-900">
        daily<span className="text-[#ce3e2f]">.</span>dev
      </span>
    ),
    htmlrev: (
      <span className="text-sm font-bold text-gray-900">
        HTML<span className="text-orange-500">Rev</span>
      </span>
    ),
    devhunt: (
      <span className="font-mono text-sm font-bold text-gray-900">
        DevHunt<span className="text-violet-600">_</span>
      </span>
    ),
  };

  return <>{marks[id] ?? <span className="text-sm font-semibold text-gray-700">{id}</span>}</>;
}
