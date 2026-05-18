import manifest from "../../seo-manifest.json";

export const SITE_ORIGIN = manifest.siteOrigin;
export const OG_IMAGE = manifest.ogImage;

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

/** Static marketing pages — source of truth in seo-manifest.json */
export const PAGE_SEO = manifest.pages;

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
