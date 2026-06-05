import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildHeadBlock,
  getSeoMetaForPath,
} from "./scripts/seoHead.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname);
const srcRoot = path.resolve(projectRoot, "src");

const manifest = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "seo-manifest.json"), "utf8")
);
const blogPosts = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "src/data/blogSeo.json"), "utf8")
);

/** Dev-only: serve correct <title>/canonical in raw HTML for SEO routes (View Source). */
function seoDevMiddleware(): Plugin {
  return {
    name: "insytiq-seo-dev",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== "GET" || !req.url) return next();

        const pathname = req.url.split("?")[0].split("#")[0];
        if (pathname.includes(".") && !pathname.endsWith("/")) return next();
        // Dev SEO injection for blog routes (production uses dist/*.html + vercel rewrites).
        if (pathname !== "/blog" && !pathname.startsWith("/blog/")) return next();

        const meta = getSeoMetaForPath(manifest, blogPosts, pathname === "" ? "/" : pathname);
        if (!meta) return next();

        const indexPath = path.join(projectRoot, "index.html");
        let html = fs.readFileSync(indexPath, "utf8");
        html = html.replace(
          "<!--SEO_HEAD-->",
          buildHeadBlock({
            title: meta.title,
            description: meta.description,
            canonical: meta.canonical,
            ogImage: meta.ogImage,
            ogType: meta.ogType,
          })
        );

        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(html);
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  root: projectRoot,
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), seoDevMiddleware()],
  resolve: {
    alias: {
      "@": srcRoot,
    },
  },
}));
