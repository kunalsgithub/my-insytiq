/**
 * Shared SEO head builder for build-time HTML injection and Vite dev middleware.
 * Framework: React + Vite + React Router (SPA). Crawlers need meta in initial HTML.
 */

export function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

export function canonicalUrl(siteOrigin, routePath) {
  if (routePath === "/") return `${siteOrigin}/`;
  return `${siteOrigin}${routePath.startsWith("/") ? routePath : `/${routePath}`}`;
}

export function buildHeadBlock({ title, description, canonical, ogImage, ogType = "website" }) {
  const t = escapeAttr(title);
  const d = escapeAttr(description);
  const c = escapeAttr(canonical);
  const img = escapeAttr(ogImage);

  return `    <title>${t}</title>
    <meta name="description" content="${d}" />
    <link rel="canonical" href="${c}" />
    <meta property="og:site_name" content="INSYTIQ" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:url" content="${c}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:secure_url" content="${img}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="en_US" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${img}" />`;
}

export function routePathToHtmlDest(routePath) {
  if (routePath === "/") return "/index.html";
  const segments = routePath.replace(/^\//, "").split("/");
  return `/${segments.join("/")}.html`;
}

/** Resolve per-route SEO meta from seo-manifest.json + blogSeo.json */
export function getSeoMetaForPath(manifest, blogPosts, routePath) {
  if (routePath === "/" || routePath === "") {
    const home = manifest.pages.home;
    return {
      title: home.title,
      description: home.description,
      canonical: canonicalUrl(manifest.siteOrigin, "/"),
      ogImage: manifest.ogImage,
      ogType: "website",
    };
  }

  for (const page of Object.values(manifest.pages)) {
    if (page.path === routePath) {
      return {
        title: page.title,
        description: page.description,
        canonical: canonicalUrl(manifest.siteOrigin, page.path),
        ogImage: manifest.ogImage,
        ogType: "website",
      };
    }
  }

  const blogMatch = routePath.match(/^\/blog\/([^/]+)\/?$/);
  if (blogMatch) {
    const slug = blogMatch[1];
    const post = blogPosts.find((p) => p.slug === slug);
    if (!post) return null;

    const headline = post.seoTitle || post.title;
    const pageTitle = post.pageTitle || `${headline} | INSYTIQ Blog`;
    let description = (post.seoDescription || post.excerpt || "").trim();
    if (!post.seoDescription && description.length > 160) {
      description = `${description.slice(0, 157)}...`;
    }
    const ogImage = post.ogImage
      ? post.ogImage.startsWith("http")
        ? post.ogImage
        : `${manifest.siteOrigin}${post.ogImage.startsWith("/") ? post.ogImage : `/${post.ogImage}`}`
      : manifest.ogImage;

    return {
      title: pageTitle,
      description,
      canonical: canonicalUrl(manifest.siteOrigin, `/blog/${slug}`),
      ogImage,
      ogType: "article",
    };
  }

  return null;
}

export function collectSeoRoutePaths(manifest, blogPosts) {
  const paths = new Set(Object.values(manifest.pages).map((p) => p.path));
  for (const post of blogPosts) {
    paths.add(`/blog/${post.slug}`);
  }
  return [...paths].sort((a, b) => b.length - a.length);
}

export function buildVercelRewrites(routePaths) {
  const rewrites = [{ source: "/", destination: "/index.html" }];

  for (const route of routePaths) {
    if (route === "/") continue;
    const dest = routePathToHtmlDest(route);
    rewrites.push({ source: route, destination: dest });
    rewrites.push({ source: `${route}/`, destination: dest });
  }

  rewrites.push({ source: "/(.*)", destination: "/index.html" });
  return rewrites;
}
