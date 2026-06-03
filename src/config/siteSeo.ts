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
  pageTitle?: string;
  seoTitle?: string;
  seoDescription?: string;
}): PageSeoMeta & { path: string } {
  const headline = post.seoTitle ?? post.title;
  const description = post.seoDescription
    ? post.seoDescription.trim()
    : post.excerpt.trim();
  const trimmedDescription =
    !post.seoDescription && description.length > 160
      ? `${description.slice(0, 157)}...`
      : description;

  return {
    title: post.pageTitle ?? `${headline} | INSYTIQ Blog`,
    description: trimmedDescription,
    path: `/blog/${post.slug}`,
  };
}

export function blogPostOgImage(ogImagePath?: string): string {
  if (!ogImagePath) return OG_IMAGE;
  if (ogImagePath.startsWith("http")) return ogImagePath;
  return `${SITE_ORIGIN}${ogImagePath.startsWith("/") ? ogImagePath : `/${ogImagePath}`}`;
}
