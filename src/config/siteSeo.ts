export const SITE_ORIGIN = "https://www.insytiq.ai";
export const OG_IMAGE = `${SITE_ORIGIN}/og-image.png`;

export type PageSeoMeta = {
  title: string;
  description: string;
  /** Route path, e.g. `/features` or `/` */
  path: string;
};

export function canonicalUrl(path: string): string {
  if (path === "/") return `${SITE_ORIGIN}/`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized}`;
}

/** Static marketing pages — source of truth for titles and descriptions */
export const PAGE_SEO = {
  home: {
    title: "Instagram Analytics Tool | AI Growth Strategy Platform",
    description:
      "Analyze Instagram performance and get actionable growth recommendations powered by AI.",
    path: "/",
  },
  features: {
    title:
      "Features — Instagram Analytics, Competitor Tracking & Trend Discovery | INSYTIQ",
    description:
      "Explore INSYTIQ's full feature set — Smart Chat, Trend Explorer, competitor intelligence, brand collaboration score, and multi-account dashboard.",
    path: "/features",
  },
  smartChat: {
    title: "Smart Chat — AI Instagram Strategy Assistant | INSYTIQ",
    description:
      "Ask INSYTIQ's Smart Chat anything about your Instagram performance. Get instant AI-powered answers about what to post, why engagement dropped, and what drives your growth.",
    path: "/smart-chat",
  },
  trending: {
    title: "Trending — Instagram Trend Discovery | INSYTIQ",
    description:
      "Discover what hashtags, sounds, and Reels formats are trending in your niche right now. INSYTIQ's Trend Explorer updates daily so you always create content that works.",
    path: "/trending",
  },
  instagramAnalytics: {
    title: "Instagram Analytics — AI-Powered Performance Insights | INSYTIQ",
    description:
      "Track your Instagram performance with AI-powered analytics. Monitor engagement rate, saves rate, reach, and follower growth with actionable recommendations.",
    path: "/instagram-analytics",
  },
  topInfluencers: {
    title: "Top Influencers — Instagram Influencer Discovery & Tracking | INSYTIQ",
    description:
      "Discover and track top Instagram influencers in any niche. INSYTIQ's influencer intelligence helps brands and agencies find the right creators for their campaigns.",
    path: "/top-influencers",
  },
  about: {
    title: "About INSYTIQ — The AI Instagram Analytics Platform",
    description:
      "Learn about INSYTIQ — the AI-powered Instagram analytics platform built for creators, agencies, and brands who want data-driven growth without the complexity.",
    path: "/about",
  },
  blog: {
    title: "Instagram Analytics Blog — Growth Insights & Strategy | INSYTIQ",
    description:
      "Read INSYTIQ's blog for data-driven Instagram growth strategies, analytics insights, competitor tracking tips, and AI-powered social media marketing advice.",
    path: "/blog",
  },
} as const satisfies Record<string, PageSeoMeta>;

export function blogPostSeoMeta(post: {
  slug: string;
  title: string;
  excerpt: string;
  seoTitle?: string;
  seoDescription?: string;
}): PageSeoMeta & { path: string } {
  const headline = post.seoTitle ?? post.title;
  const description = (post.seoDescription ?? post.excerpt).trim();
  return {
    title: `${headline} | INSYTIQ Blog`,
    description:
      description.length > 160 ? `${description.slice(0, 157)}...` : description,
    path: `/blog/${post.slug}`,
  };
}
