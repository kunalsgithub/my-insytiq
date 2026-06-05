import { Helmet } from "react-helmet-async";
import { OG_IMAGE, canonicalUrl, type PageSeoMeta } from "@/config/siteSeo";

type PageSeoProps = PageSeoMeta & {
  ogType?: "website" | "article";
  ogImage?: string;
  articlePublishedTime?: string;
  articleModifiedTime?: string;
  noIndex?: boolean;
  children?: React.ReactNode;
};

/** Per-route title, description, canonical, Open Graph, and Twitter tags */
export function PageSeo({
  title,
  description,
  path,
  ogType = "website",
  ogImage = OG_IMAGE,
  articlePublishedTime,
  articleModifiedTime,
  noIndex = false,
  children,
}: PageSeoProps) {
  const canonical = canonicalUrl(path);

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {noIndex ? <meta name="robots" content="noindex, nofollow" /> : null}
      <link rel="canonical" href={canonical} />

      <meta property="og:site_name" content="INSYTIQ" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:secure_url" content={ogImage} />
      {articlePublishedTime ? (
        <meta property="article:published_time" content={articlePublishedTime} />
      ) : null}
      {articleModifiedTime ? (
        <meta property="article:modified_time" content={articleModifiedTime} />
      ) : null}
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="en_US" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {children}
    </Helmet>
  );
}
