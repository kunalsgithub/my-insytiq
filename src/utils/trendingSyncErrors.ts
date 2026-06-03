/** Safe message for all visitors — no Apify billing, tokens, or console URLs. */
export function formatTrendingSyncErrorPublic(raw?: string | null): string {
  if (!raw?.trim()) {
    return "Trending data is updating on our servers. Please check back shortly.";
  }

  const r = raw.trim();

  if (/timed out|still running|in progress|apify_running|retrying/i.test(r)) {
    return "Trending sync is still running on the server. This page will refresh automatically.";
  }

  if (
    /outstanding invoices|billing|Apify|CFG_APIFY|API token|platform-feature-disabled|not deployed|Failed to fetch|CONNECTION_REFUSED/i.test(
      r
    )
  ) {
    return "Trending sync is retrying on the server. We're working to restore the latest posts and reels.";
  }

  return "Trending sync is retrying on the server. Please refresh in a few minutes.";
}

/** Detailed message for admin / dev troubleshooting (not shown on public trending UI). */
export function formatTrendingSyncError(raw: string): string {
  if (/outstanding invoices|platform-feature-disabled/i.test(raw)) {
    return (
      "Instagram trending sync is paused: the Apify account has unpaid invoices. " +
      "Settle billing at console.apify.com → Billing, then click Get latest again. " +
      "Until then, posts/reels from the sheet backup still appear below."
    );
  }

  if (/Apify API token|CFG_APIFY_API_TOKEN/i.test(raw)) {
    return "Apify API token is missing or invalid on the server. Contact support or update billing credentials.";
  }

  if (/Apify run timed out|taking longer than expected/i.test(raw)) {
    return (
      "Instagram trending sync is still running on the server. " +
      "This page will refresh automatically — no action needed."
    );
  }

  if (/timed out|still running on the server|already in progress/i.test(raw)) {
    return raw;
  }

  if (/Failed to fetch|CONNECTION_REFUSED|127\.0\.0\.1:5002/i.test(raw)) {
    return "Could not reach the sync service. Refresh the page and try Get latest again.";
  }

  if (/functions\/not-found/i.test(raw)) {
    return "Trending sync is not deployed yet. Deploy syncTrendingNow to Firebase Functions.";
  }

  // Strip noisy Apify JSON dumps if any slip through
  if (raw.startsWith("Apify task failed to start:") && raw.includes('"error"')) {
    return formatTrendingSyncError(
      raw.includes("outstanding invoices") ? "outstanding invoices" : raw
    );
  }

  return raw.length > 220 ? `${raw.slice(0, 217)}…` : raw;
}
