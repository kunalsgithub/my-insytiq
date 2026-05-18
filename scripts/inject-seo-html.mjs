/**
 * After `vite build`, writes one HTML file per SEO route with correct
 * title, description, canonical, and og/twitter tags in the initial response.
 * Required because react-helmet-async only updates the DOM after JavaScript runs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const distDir = path.join(root, "dist");
const manifestPath = path.join(root, "seo-manifest.json");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const templatePath = path.join(distDir, "index.html");

if (!fs.existsSync(templatePath)) {
  console.error("inject-seo-html: dist/index.html not found. Run vite build first.");
  process.exit(1);
}

const template = fs.readFileSync(templatePath, "utf8");
const PLACEHOLDER = "<!--SEO_HEAD-->";

if (!template.includes(PLACEHOLDER)) {
  console.error("inject-seo-html: <!--SEO_HEAD--> placeholder missing from dist/index.html");
  process.exit(1);
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function canonicalUrl(siteOrigin, routePath) {
  if (routePath === "/") return `${siteOrigin}/`;
  return `${siteOrigin}${routePath.startsWith("/") ? routePath : `/${routePath}`}`;
}

function buildHeadBlock({ title, description, canonical, ogImage, ogType = "website" }) {
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

function writeRouteHtml(routePath, meta) {
  const canonical = canonicalUrl(manifest.siteOrigin, routePath);
  const head = buildHeadBlock({
    title: meta.title,
    description: meta.description,
    canonical,
    ogImage: manifest.ogImage,
    ogType: meta.ogType || "website",
  });

  const html = template.replace(PLACEHOLDER, head);

  let outFile;
  if (routePath === "/") {
    outFile = path.join(distDir, "index.html");
  } else {
    const segments = routePath.replace(/^\//, "").split("/");
    outFile = path.join(distDir, ...segments) + ".html";
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
  }

  fs.writeFileSync(outFile, html, "utf8");
  return outFile;
}

const written = [];

for (const page of Object.values(manifest.pages)) {
  written.push(writeRouteHtml(page.path, page));
}

for (const post of manifest.blogPosts) {
  const headline = post.seoTitle || post.title;
  let description = (post.seoDescription || post.excerpt || "").trim();
  if (description.length > 160) description = `${description.slice(0, 157)}...`;

  written.push(
    writeRouteHtml(`/blog/${post.slug}`, {
      title: `${headline} | INSYTIQ Blog`,
      description,
      ogType: "article",
    })
  );
}

console.log(`inject-seo-html: wrote ${written.length} HTML files with per-route canonical tags.`);
