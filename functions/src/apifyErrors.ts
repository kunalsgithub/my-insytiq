/** Map Apify API error payloads to short, actionable messages (no raw JSON in UI). */
export function apifyStartFailureMessage(runJson: unknown): string {
  const body = runJson as {
    error?: { type?: string; message?: string };
    message?: string;
  } | null;

  const type = body?.error?.type ?? "";
  const message = (body?.error?.message || body?.message || "").trim();

  if (
    type === "platform-feature-disabled" ||
    /outstanding invoices/i.test(message)
  ) {
    return (
      "Apify billing is blocked: there are unpaid invoices on the Apify account tied to this API token. " +
      "Pay outstanding invoices at https://console.apify.com/billing/invoices, then try Get latest again."
    );
  }

  if (type === "record-not-found") {
    return "Apify actor was not found. Check the actor ID in the server configuration.";
  }

  if (/invalid.*token|unauthorized/i.test(message) || type === "user-or-token-not-found") {
    return "Apify API token is invalid or expired. Update CFG_APIFY_API_TOKEN in Firebase Functions env.";
  }

  if (message) return message;

  return "Apify could not start the scraper run. Check Apify Console for account status.";
}
