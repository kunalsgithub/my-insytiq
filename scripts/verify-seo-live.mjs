/**
 * Curl production URLs and assert canonical/title are not homepage duplicates.
 * Usage: npm run verify:seo:live
 */
import { collectSeoRoutePaths } from "./seoHead.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "seo-manifest.json"), "utf8")
);
const blogPosts = JSON.parse(
  fs.readFileSync(path.join(root, "src/data/blogSeo.json"), "utf8")
);

const siteOrigin = manifest.siteOrigin;
const homepageTitle = manifest.pages.home.title;
const routes = collectSeoRoutePaths(manifest, blogPosts).filter((p) => p.startsWith("/blog/"));

let failed = 0;

for (const routePath of routes) {
  const url = `${siteOrigin}${routePath}`;
  const res = await fetch(url);
  const html = await res.text();
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];

  const expectedCanonical = `${siteOrigin}${routePath}`;

  if (canonical !== expectedCanonical) {
    console.error(`FAIL ${url}: canonical ${canonical ?? "MISSING"} (expected ${expectedCanonical})`);
    failed += 1;
    continue;
  }
  if (!title || title === homepageTitle) {
    console.error(`FAIL ${url}: title is homepage duplicate (${title ?? "MISSING"})`);
    failed += 1;
    continue;
  }
  console.log(`OK ${routePath}`);
}

if (failed > 0) {
  console.error(`\n${failed} live check(s) failed.`);
  process.exit(1);
}

console.log("\nAll live blog SEO checks passed.");
