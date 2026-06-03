export type BlogPostSummary = {
  slug: string;
  title: string;
  excerpt: string;
  publishedLabel: string;
  category?: string;
  readTime?: string;
  /** Full document title (no site suffix) when set */
  pageTitle?: string;
  /** Shorter headline for &lt;title&gt; and Open Graph */
  seoTitle?: string;
  /** Meta description override (defaults to excerpt) */
  seoDescription?: string;
  /** Path under site origin, e.g. /og-blog-engagement-rate.png */
  ogImage?: string;
  datePublished?: string;
  dateModified?: string;
};
