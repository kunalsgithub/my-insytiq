import { onCall, HttpsError } from "firebase-functions/v2/https";
import sharp from "sharp";

const W = 1080;
const H = 1920;

type RequestData = {
  score: number;
  stage: string;
  highestMetric: string;
  lowestMetric: string;
};

function buildStoryCardSvg(data: RequestData): string {
  const { score, stage, highestMetric, lowestMetric } = data;
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#ee2a7b"/>
      <stop offset="25%" style="stop-color:#d72989"/>
      <stop offset="60%" style="stop-color:#9c1f6b"/>
      <stop offset="100%" style="stop-color:#6b1550"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <text x="${W / 2}" y="380" text-anchor="middle" fill="white" font-family="system-ui, Arial, sans-serif" font-size="48" font-weight="600" opacity="0.95">INSYTIQ Creator Score</text>
  <text x="${W / 2}" y="580" text-anchor="middle" fill="white" font-family="system-ui, Arial, sans-serif" font-size="140" font-weight="700">${escape(String(score))} / 100</text>
  <text x="${W / 2}" y="720" text-anchor="middle" fill="white" font-family="system-ui, Arial, sans-serif" font-size="56" font-weight="600">${escape(stage)}</text>
  <text x="${W / 2}" y="920" text-anchor="middle" fill="white" font-family="system-ui, Arial, sans-serif" font-size="36" opacity="0.9">Strength: ${escape(highestMetric)}</text>
  <text x="${W / 2}" y="1000" text-anchor="middle" fill="white" font-family="system-ui, Arial, sans-serif" font-size="36" opacity="0.9">Improve: ${escape(lowestMetric)}</text>
  <text x="${W / 2}" y="1720" text-anchor="middle" fill="white" font-family="system-ui, Arial, sans-serif" font-size="32" opacity="0.9">Analyze your profile</text>
  <text x="${W / 2}" y="1800" text-anchor="middle" fill="white" font-family="system-ui, Arial, sans-serif" font-size="48" font-weight="700">insytiq.ai</text>
</svg>`;
}

export const generateCreatorScoreCard = onCall(
  { timeoutSeconds: 30, memory: "256MiB" },
  async (request): Promise<{ imageBase64: string }> => {
    const data = request.data as RequestData | undefined;
    if (!data || typeof data.score !== "number" || !data.stage || !data.highestMetric || !data.lowestMetric) {
      throw new HttpsError("invalid-argument", "Missing or invalid: score, stage, highestMetric, lowestMetric.");
    }
    const score = Math.max(0, Math.min(100, Math.round(data.score)));
    const stage = String(data.stage).trim().slice(0, 80);
    const highestMetric = String(data.highestMetric).trim().slice(0, 80);
    const lowestMetric = String(data.lowestMetric).trim().slice(0, 80);

    try {
      const svg = buildStoryCardSvg({ score, stage, highestMetric, lowestMetric });
      const pngBuffer = await sharp(Buffer.from(svg))
        .resize(W, H)
        .png()
        .toBuffer();
      const imageBase64 = pngBuffer.toString("base64");
      return { imageBase64 };
    } catch (err) {
      console.error("generateCreatorScoreCard error:", err);
      throw new HttpsError("internal", "Failed to generate story card image.");
    }
  }
);
