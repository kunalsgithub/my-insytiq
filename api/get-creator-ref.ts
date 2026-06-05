import type { VercelRequest, VercelResponse } from "@vercel/node";

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(";").reduce<Record<string, string>>((acc, part) => {
    const [k, ...rest] = part.trim().split("=");
    if (k) acc[k] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

/** GET /api/get-creator-ref — expose httpOnly insytiq_ref to client for sessionStorage. */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const refCode = String(cookies.insytiq_ref || "").trim().toLowerCase() || null;
  res.status(200).json({ refCode });
}
