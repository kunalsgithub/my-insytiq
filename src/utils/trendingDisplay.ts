import { proxyProfileImageBaseUrl } from "@/firebase";

/** Normalize @handle for display */
export function formatUsername(value: string | undefined): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return "@unknown";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

/** Fallback display name when account name is missing */
export function displayNameFromUsername(username: string): string {
  const bare = username.replace(/^@/, "").replace(/[_.]+/g, " ").trim();
  if (!bare) return "Unknown";
  return bare
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function resolveTrendingIdentity(item: {
  username?: string;
  accountName?: string;
  creator?: string;
  title?: string;
}): { username: string; accountName: string } {
  const username = formatUsername(item.username || item.creator);
  const accountName =
    (item.accountName && item.accountName.trim()) ||
    (item.title && item.title.trim() && item.title.length <= 80
      ? item.title.trim()
      : "") ||
    displayNameFromUsername(username);
  return { username, accountName };
}

/** Use Cloud Function proxy for Instagram CDN images (avoids hotlink / 403 in browser). */
export function trendThumbnailSrc(url: string | undefined): string | undefined {
  if (!url || !url.startsWith("http")) return undefined;
  const lower = url.toLowerCase();
  const isCdn =
    lower.includes("cdninstagram") ||
    lower.includes("fbcdn.net") ||
    /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url);
  if (!isCdn) return undefined;
  if (lower.includes("cdninstagram") || lower.includes("fbcdn.net")) {
    return `${proxyProfileImageBaseUrl}?url=${encodeURIComponent(url)}`;
  }
  return url;
}
