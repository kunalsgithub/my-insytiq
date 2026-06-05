/**
 * Next.js App Router reference for Creator referral click tracking.
 *
 * This Vite project implements the same behavior in:
 * - Production: api/ref.ts (Vercel serverless)
 * - Shared logic: api/lib/refHandler.ts
 *
 * GET /api/ref?ref=CODE
 * 1. Lookup creator by referralCode where status in ["grace","active"]
 * 2. Log referralClicks doc (ipHash = MD5 of IP)
 * 3. Increment creator.totalClicks
 * 4. Set cookie insytiq_ref=CODE (httpOnly, 30 days, SameSite=Lax)
 * 5. Redirect to https://www.insytiq.ai/
 */

export {};
