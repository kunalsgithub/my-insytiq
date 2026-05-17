/**
 * Social Blade Business API credentials.
 *
 * Primary source: `defineString` params (CFG_SB_*) from functions/.env at deploy.
 * Fallback: process.env.CFG_SB_* then legacy SB_* (emulator, shell, CI).
 *
 * @see https://firebase.google.com/docs/functions/config-env#secret-local
 */
export function resolveSocialBladeCredentials(
  secretClientId: string | undefined,
  secretApiToken: string | undefined
): { clientId: string; apiToken: string } {
  const clientId = (
    secretClientId?.trim() ||
    process.env.CFG_SB_CLIENT_ID?.trim() ||
    process.env.SB_CLIENT_ID?.trim() ||
    ""
  ).trim();
  const apiToken = (
    secretApiToken?.trim() ||
    process.env.CFG_SB_API_TOKEN?.trim() ||
    process.env.SB_API_TOKEN?.trim() ||
    ""
  ).trim();
  return { clientId, apiToken };
}

/** Redacted preview for logs (never log full tokens). */
export function redactSecretPreview(value: string, head = 4, tail = 2): string {
  const v = value.trim();
  if (!v) return "(empty)";
  if (v.length <= head + tail + 1) return `${v.slice(0, 2)}…(${v.length} chars)`;
  return `${v.slice(0, head)}…${v.slice(-tail)} (${v.length} chars)`;
}
