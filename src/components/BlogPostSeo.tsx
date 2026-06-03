import { PageSeo } from "@/components/PageSeo";
import { blogPostOgImage, blogPostSeoMeta, type PageSeoMeta } from "@/config/siteSeo";

type BlogPostSeoProps = {
  slug: string;
  title: string;
  excerpt: string;
  pageTitle?: string;
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: string;
  datePublished?: string;
  dateModified?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

export function BlogPostSeo({
  slug,
  title,
  excerpt,
  pageTitle,
  seoTitle,
  seoDescription,
  ogImage: ogImagePath,
  datePublished,
  dateModified,
  jsonLd,
}: BlogPostSeoProps) {
  const meta: PageSeoMeta & { path: string } = blogPostSeoMeta({
    slug,
    title,
    excerpt,
    pageTitle,
    seoTitle,
    seoDescription,
  });

  const schemas = jsonLd
    ? Array.isArray(jsonLd)
      ? jsonLd
      : [jsonLd]
    : [];

  const publishedIso = datePublished
    ? datePublished.includes("T")
      ? datePublished
      : `${datePublished}T00:00:00.000Z`
    : undefined;
  const modifiedIso = dateModified
    ? dateModified.includes("T")
      ? dateModified
      : `${dateModified}T00:00:00.000Z`
    : publishedIso;

  return (
    <PageSeo
      {...meta}
      ogType="article"
      ogImage={blogPostOgImage(ogImagePath)}
      articlePublishedTime={publishedIso}
      articleModifiedTime={modifiedIso}
    >
      {schemas.map((schema, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </PageSeo>
  );
}
