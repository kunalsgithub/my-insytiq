/**
 * Verifies built HTML files contain route-specific canonical URLs (not homepage).
 * Run after: npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectSeoRoutePaths, routePathToHtmlDest } from "./seoHead.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const distDir = path.join(root, "dist");
const blogSeoPath = path.join(root, "src", "data", "blogSeo.json");
const manifestPath = path.join(root, "seo-manifest.json");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const blogPosts = JSON.parse(fs.readFileSync(blogSeoPath, "utf8"));
const siteOrigin = manifest.siteOrigin;

const checks = collectSeoRoutePaths(manifest, blogPosts).map((routePath) => ({
  path: routePath,
  file: routePath === "/" ? "index.html" : routePathToHtmlDest(routePath).slice(1),
}));

let failed = 0;

for (const { path: routePath, file } of checks) {
  const htmlPath = path.join(distDir, file);
  const expectedCanonical =
    routePath === "/"
      ? `${siteOrigin}/`
      : `${siteOrigin}${routePath}`;

  if (!fs.existsSync(htmlPath)) {
    console.error(`FAIL missing file: ${file}`);
    failed += 1;
    continue;
  }

  const html = fs.readFileSync(htmlPath, "utf8");
  const canonicalMatch = html.match(
    /<link rel="canonical" href="([^"]+)"/
  );
  const titleMatch = html.match(/<title>([^<]*)<\/title>/);

  const homepageTitle = manifest.pages.home.title;

  if (!canonicalMatch || canonicalMatch[1] !== expectedCanonical) {
    console.error(
      `FAIL ${routePath}: canonical expected ${expectedCanonical}, got ${canonicalMatch?.[1] ?? "NONE"}`
    );
    failed += 1;
    continue;
  }

  if (!titleMatch || !titleMatch[1].trim()) {
    console.error(`FAIL ${routePath}: missing <title>`);
    failed += 1;
    continue;
  }

  if (routePath !== "/" && titleMatch[1] === homepageTitle) {
    console.error(`FAIL ${routePath}: still using homepage <title>`);
    failed += 1;
    continue;
  }

  console.log(`OK ${routePath}`);
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}

console.log("\nAll SEO HTML checks passed.");
