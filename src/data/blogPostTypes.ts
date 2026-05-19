export type BlogPostSummary = {
  slug: string;
  title: string;
  excerpt: string;
  publishedLabel: string;
  /** Shorter headline for &lt;title&gt; and Open Graph */
  seoTitle?: string;
  /** Meta description override (defaults to excerpt) */
  seoDescription?: string;
};
