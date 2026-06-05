/**
 * Vercel serverless equivalent of Next.js app/api/ref/route.ts
 * GET /api/ref?ref=CODE — track click, set cookie, redirect home.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildRefHandlerInput, handleCreatorReferralClick } from "./lib/refHandler.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const input = buildRefHandlerInput({
      refQuery: req.query.ref,
      forwardedFor: req.headers["x-forwarded-for"] as string | undefined,
      remoteAddress: req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"] as string | undefined,
      isSecure:
        req.headers["x-forwarded-proto"] === "https" ||
        process.env.NODE_ENV === "production",
    });

    const result = await handleCreatorReferralClick(input);

    if (result.setCookie) {
      res.setHeader("Set-Cookie", result.setCookie);
    }
    res.redirect(302, result.redirectUrl);
  } catch (err) {
    console.error("api/ref error:", err);
    res.redirect(302, process.env.SITE_URL || "https://www.insytiq.ai");
  }
}
