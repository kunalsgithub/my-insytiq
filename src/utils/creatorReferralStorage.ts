const SESSION_KEY = "insytiq_ref_code";

export function persistCreatorRefCode(code: string): void {
  if (!code?.trim()) return;
  try {
    sessionStorage.setItem(SESSION_KEY, code.trim().toLowerCase());
  } catch {
    /* private browsing */
  }
}

export function readCreatorRefCode(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function clearCreatorRefCode(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Fetch ref from httpOnly cookie via server endpoint and persist for signup flow. */
export async function syncCreatorRefFromServer(): Promise<string | null> {
  try {
    const res = await fetch("/api/get-creator-ref", { credentials: "include" });
    if (!res.ok) return readCreatorRefCode();
    const data = (await res.json()) as { refCode?: string | null };
    if (data.refCode) {
      persistCreatorRefCode(data.refCode);
      return data.refCode;
    }
    return readCreatorRefCode();
  } catch {
    return readCreatorRefCode();
  }
}
