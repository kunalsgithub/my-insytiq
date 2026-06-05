/**
 * After `vite build`, writes one HTML file per SEO route with correct
 * title, description, canonical, and og/twitter tags in the initial response.
 *
 * Framework: React + Vite + React Router (client SPA).
 * react-helmet-async updates meta after JS — crawlers need this build step.
 *
 * Blog routes: add each post to `src/data/blogSeo.json`.
 * Static pages: add to `seo-manifest.json`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildHeadBlock,
  buildVercelRewrites,
  canonicalUrl,
  collectSeoRoutePaths,
  getSeoMetaForPath,
} from "./seoHead.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const distDir = path.join(root, "dist");
const manifestPath = path.join(root, "seo-manifest.json");
const blogSeoPath = path.join(root, "src", "data", "blogSeo.json");
const templatePath = path.join(distDir, "index.html");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const blogPosts = JSON.parse(fs.readFileSync(blogSeoPath, "utf8"));

if (!fs.existsSync(templatePath)) {
  console.error("inject-seo-html: dist/index.html not found. Run vite build first.");
  process.exit(1);
}

const template = fs.readFileSync(templatePath, "utf8");
const PLACEHOLDER = "<!--SEO_HEAD-->";

if (!template.includes(PLACEHOLDER)) {
  console.error("inject-seo-html: <!--SEO_HEAD--> placeholder missing from index.html");
  process.exit(1);
}

function writeRouteHtml(routePath, meta) {
  const head = buildHeadBlock({
    title: meta.title,
    description: meta.description,
    canonical: meta.canonical || canonicalUrl(manifest.siteOrigin, routePath),
    ogImage: meta.ogImage || manifest.ogImage,
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

const routePaths = collectSeoRoutePaths(manifest, blogPosts);
const written = [];

for (const routePath of routePaths) {
  const meta = getSeoMetaForPath(manifest, blogPosts, routePath);
  if (!meta) continue;
  written.push(writeRouteHtml(routePath, meta));
}

function syncVercelConfig() {
  const vercelPath = path.join(root, "vercel.json");
  const vercel = JSON.parse(fs.readFileSync(vercelPath, "utf8"));
  vercel.buildCommand = vercel.buildCommand || "npm run build";
  vercel.outputDirectory = vercel.outputDirectory || "dist";
  vercel.rewrites = buildVercelRewrites(routePaths);
  fs.writeFileSync(vercelPath, `${JSON.stringify(vercel, null, 2)}\n`, "utf8");
}

syncVercelConfig();

console.log(`inject-seo-html: wrote ${written.length} HTML files with per-route canonical tags.`);
console.log(`inject-seo-html: synced ${routePaths.length} SEO rewrites in vercel.json`);
