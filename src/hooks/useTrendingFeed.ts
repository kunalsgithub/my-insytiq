import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, syncTrendingNow } from "@/firebase";
import {
  fetchTrendingContent,
  type TrendingContent,
} from "@/services/instagramService";
import {
  fetchTrendingMeta,
  type TrendingMeta,
} from "@/services/trendingFirestoreService";
import { formatTrendingSyncErrorPublic } from "@/utils/trendingSyncErrors";

export type TrendingFeedItem = TrendingContent;

const POLL_MS = 10_000;

function formatLastSynced(meta: TrendingMeta | null): string | null {
  const raw = meta?.lastSyncedAt;
  if (!raw) return null;
  let date: Date;
  if (typeof raw === "object" && "toDate" in raw) {
    date = raw.toDate();
  } else if (typeof raw === "object" && "seconds" in raw) {
    date = new Date(raw.seconds * 1000);
  } else {
    return null;
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function isServerSyncActive(meta: TrendingMeta | null): boolean {
  if (!meta) return false;
  if (meta.syncInProgress === true) return true;
  if (meta.syncStatus === "apify_running") return true;
  return Boolean(meta.pendingApifyRunId);
}

/** Loads shared trending cache from Firestore (same data for all accounts). */
export function useTrendingFeed(searchTerm: string, category: string) {
  const [items, setItems] = useState<TrendingFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedLabel, setLastSyncedLabel] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"firestore" | "empty">("empty");
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [serverSyncActive, setServerSyncActive] = useState(false);
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [isRetrying, setIsRetrying] = useState(false);
  const retryCooldown = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  const loadContent = useCallback(async (): Promise<number> => {
    try {
      const [content, meta] = await Promise.all([
        fetchTrendingContent(searchTerm, category),
        fetchTrendingMeta().catch(() => null),
      ]);
      const list = Array.isArray(content) ? content : [];
      setItems(list);
      setLastSyncedLabel(formatLastSynced(meta));
      setDateKey(meta?.dateKey ?? null);
      setServerSyncActive(isServerSyncActive(meta));

      if (isServerSyncActive(meta)) {
        setError(null);
      } else if (meta?.syncError) {
        setError(formatTrendingSyncErrorPublic(meta.syncError));
      } else {
        setError(null);
      }

      setDataSource(meta?.dateKey && list.length > 0 ? "firestore" : "empty");
      return list.length;
    } catch (err) {
      console.error("useTrendingFeed load failed:", err);
      setError("Could not load trending content from the server.");
      setItems([]);
      setDataSource("empty");
      return 0;
    }
  }, [searchTerm, category]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      await loadContent();
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadContent]);

  useEffect(() => {
    if (!serverSyncActive) return;
    const id = window.setInterval(() => {
      loadContent();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [serverSyncActive, loadContent]);

  /** Poll while server reported an error (scheduled job retries every 5 min). */
  useEffect(() => {
    if (serverSyncActive || !error) return;
    const id = window.setInterval(() => {
      loadContent();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [serverSyncActive, error, loadContent]);

  const retryServerSync = useCallback(async (): Promise<boolean> => {
    if (!user || retryCooldown.current) return false;
    retryCooldown.current = true;
    setIsRetrying(true);
    setError(null);
    try {
      await syncTrendingNow({ force: true });
      await loadContent();
      return true;
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Retry failed";
      setError(formatTrendingSyncErrorPublic(msg));
      return false;
    } finally {
      setIsRetrying(false);
      window.setTimeout(() => {
        retryCooldown.current = false;
      }, 60_000);
    }
  }, [user, loadContent]);

  const refreshFromCache = useCallback(async (): Promise<boolean> => {
    setIsRefreshing(true);
    try {
      await loadContent();
      return true;
    } catch {
      setError("Could not refresh trending content.");
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, [loadContent]);

  return {
    items,
    isLoading,
    isRefreshing,
    isBootstrapping: (serverSyncActive || isRetrying) && items.length === 0,
    isRetrying,
    isSignedIn: Boolean(user),
    error,
    lastSyncedLabel,
    dataSource,
    dateKey,
    serverSyncActive,
    loadContent,
    refreshFromCache,
    retryServerSync,
  };
};
