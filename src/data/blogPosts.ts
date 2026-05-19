import type { BlogPostSummary } from "./blogPostTypes";
import blogSeo from "./blogSeo.json";

/** Single source for blog list + SEO (also used by build-time inject-seo-html.mjs). */
export type { BlogPostSummary } from "./blogPostTypes";

export const blogPosts: BlogPostSummary[] = blogSeo as BlogPostSummary[];
