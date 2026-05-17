import { onRequest } from "firebase-functions/v2/https";
import axios from "axios";

const ALLOWED_HOSTS = [
  "cdninstagram.com",
  "instagram.com",
  "fbcdn.net", // Instagram sometimes uses Facebook CDN
];

function isAllowedProfileImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

export const proxyProfileImage = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.status(204).end();
      return;
    }

    if (req.method !== "GET") {
      res.status(405).set("Allow", "GET").end();
      return;
    }

    const rawUrl = req.query.url;
    const url = typeof rawUrl === "string" ? rawUrl : "";

    if (!url || !isAllowedProfileImageUrl(url)) {
      res.status(400).send("Invalid or disallowed URL");
      return;
    }

    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 10000,
        maxRedirects: 3,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "image/*,*/*",
        },
        validateStatus: (status) => status === 200,
      });

      const contentType =
        response.headers["content-type"] || "image/jpeg";
      res.set("Cache-Control", "public, max-age=86400"); // 24h
      res.set("Content-Type", contentType);
      res.send(Buffer.from(response.data));
    } catch (err: unknown) {
      console.warn("proxyProfileImage fetch failed:", err);
      res.status(502).send("Failed to fetch image");
    }
  }
);
