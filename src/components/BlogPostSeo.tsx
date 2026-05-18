import { PageSeo } from "@/components/PageSeo";
import { blogPostSeoMeta, type PageSeoMeta } from "@/config/siteSeo";

type BlogPostSeoProps = {
  slug: string;
  title: string;
  excerpt: string;
  seoTitle?: string;
  seoDescription?: string;
  jsonLd?: Record<string, unknown>;
};

export function BlogPostSeo({
  slug,
  title,
  excerpt,
  seoTitle,
  seoDescription,
  jsonLd,
}: BlogPostSeoProps) {
  const meta: PageSeoMeta & { path: string } = blogPostSeoMeta({
    slug,
    title,
    excerpt,
    seoTitle,
    seoDescription,
  });

  return (
    <PageSeo {...meta} ogType="article">
      {jsonLd ? (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      ) : null}
    </PageSeo>
  );
}
