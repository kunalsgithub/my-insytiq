import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp, getApps } from "firebase-admin/app";
import {
  getFirestore,
  FieldValue,
  type DocumentReference,
} from "firebase-admin/firestore";
import type { TrendingDownloadMedias } from "./apifyFetcher";
import {
  getApifyRunStatus,
  isApifyRunTerminalFailure,
  startTrendingExploreRun,
  waitForTrendingExploreRun,
} from "./trendingApifyRun";
import {
  apifyTrendingApiTokenParam,
  trendingCountryParam,
  trendingDownloadMediasParam,
} from "./configParams";
import { defineString } from "firebase-functions/params";
import {
  aggregateTrendingAudio,
  aggregateTrendingHashtags,
  normalizeApifyTrendItem,
  NormalizedTrendItem,
  MetricSnapshot,
} from "./trendingScoring";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

export const trendingMaxResultsParam = defineString("CFG_TRENDING_MAX_RESULTS", {
  default: "12",
});

const SNAPSHOT_RETENTION_DAYS = 2;

const TOP_REELS = 10;
const TOP_POSTS = 10;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayKey(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function loadSnapshots(
  dateKey: string
): Promise<Map<string, MetricSnapshot>> {
  const snap = await db
    .collection("trendingSnapshots")
    .doc(dateKey)
    .collection("items")
    .get();
  const map = new Map<string, MetricSnapshot>();
  snap.forEach((doc) => {
    const d = doc.data();
    map.set(doc.id, {
      plays: Number(d.plays) || 0,
      likes: Number(d.likes) || 0,
      comments: Number(d.comments) || 0,
      recordedAt: String(d.recordedAt || dateKey),
    });
  });
  return map;
}

async function loadHashtagCounts(
  dateKey: string
): Promise<Map<string, number>> {
  const snap = await db
    .collection("trendingHashtagSnapshots")
    .doc(dateKey)
    .collection("tags")
    .get();
  const map = new Map<string, number>();
  snap.forEach((doc) => {
    map.set(doc.id, Number(doc.data().count) || 0);
  });
  return map;
}

async function loadAudioUsage(dateKey: string): Promise<Map<string, number>> {
  const snap = await db
    .collection("trendingAudioSnapshots")
    .doc(dateKey)
    .collection("tracks")
    .get();
  const map = new Map<string, number>();
  snap.forEach((doc) => {
    map.set(doc.id, Number(doc.data().usage) || 0);
  });
  return map;
}

async function clearCollection(collectionName: string): Promise<void> {
  const coll = db.collection(collectionName);
  while (true) {
    const snap = await coll.limit(400).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

async function deleteSubcollection(
  parentRef: DocumentReference,
  subName: string
): Promise<void> {
  const sub = parentRef.collection(subName);
  while (true) {
    const snap = await sub.limit(400).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

function cutoffDateKey(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/** Remove snapshot docs older than retention window (velocity needs yesterday only). */
async function purgeOldSnapshots(): Promise<void> {
  const cutoff = cutoffDateKey(SNAPSHOT_RETENTION_DAYS);
  const roots = [
    { name: "trendingSnapshots", sub: "items" },
    { name: "trendingHashtagSnapshots", sub: "tags" },
    { name: "trendingAudioSnapshots", sub: "tracks" },
  ] as const;

  for (const { name, sub } of roots) {
    const snap = await db.collection(name).get();
    for (const doc of snap.docs) {
      if (doc.id >= cutoff) continue;
      await deleteSubcollection(doc.ref, sub);
      await doc.ref.delete();
      console.log(`[trending-sync] Purged old snapshot ${name}/${doc.id}`);
    }
  }
}

export type SyncTrendingResult = {
  success: boolean;
  /** Apify still running — next scheduled job will resume. */
  pending?: boolean;
  dateKey: string;
  sourceItems: number;
  reels: number;
  posts: number;
  audio: number;
  hashtags: number;
};

/** Wall-clock budget for one function invocation (stay under 540s timeout). */
const APIFY_WAIT_MS = 500_000;

const SYNC_LOCK_MAX_MS = 15 * 60 * 1000;

export type RunTrendingSyncOptions = {
  /** When true, skip Apify if today's batch already succeeded. */
  skipIfFresh?: boolean;
};

export async function runTrendingSync(
  options: RunTrendingSyncOptions = {}
): Promise<SyncTrendingResult> {
  const dateKey = todayKey();
  const metaRef = db.collection("trendingMeta").doc("latest");
  const existingMeta = await metaRef.get();
  const existing = existingMeta.data();

  if (
    options.skipIfFresh &&
    existing?.dateKey === dateKey &&
    existing?.syncInProgress !== true &&
    !existing?.syncError
  ) {
    console.log(`[trending-sync] Already synced for ${dateKey}, skipping Apify`);
    return {
      success: true,
      dateKey,
      sourceItems: Number(existing.sourceItems) || 0,
      reels: Number(existing.reels) || 0,
      posts: Number(existing.posts) || 0,
      audio: Number(existing.audio) || 0,
      hashtags: Number(existing.hashtags) || 0,
    };
  }

  const lockStartedMs =
    existing?.syncStartedAt?.toMillis?.() ??
    (typeof existing?.syncStartedAt === "object" &&
    existing.syncStartedAt &&
    "seconds" in existing.syncStartedAt
      ? (existing.syncStartedAt as { seconds: number }).seconds * 1000
      : 0);
  const pendingRunId = String(existing?.pendingApifyRunId || "");
  if (
    existing?.syncInProgress === true &&
    Date.now() - lockStartedMs < SYNC_LOCK_MAX_MS &&
    !pendingRunId
  ) {
    const err = new Error("SYNC_IN_PROGRESS");
    (err as Error & { code: string }).code = "SYNC_IN_PROGRESS";
    throw err;
  }

  const apifyToken = apifyTrendingApiTokenParam.value();
  if (!apifyToken) {
    throw new Error("CFG_APIFY_TRENDING_API_TOKEN is not configured");
  }

  const maxResults = parseInt(trendingMaxResultsParam.value(), 10) || 12;

  await metaRef.set(
    {
      syncInProgress: true,
      syncStartedAt: FieldValue.serverTimestamp(),
      syncError: FieldValue.delete(),
    },
    { merge: true }
  );
  const downloadMediasRaw = trendingDownloadMediasParam.value().trim().toLowerCase();
  const downloadMedias: TrendingDownloadMedias =
    downloadMediasRaw === "image" || downloadMediasRaw === "all"
      ? downloadMediasRaw
      : "none";
  const country = trendingCountryParam.value().trim() || "India";
  const prevDateKey = yesterdayKey();

  console.log(
    `[trending-sync] Starting for ${dateKey}, max_results=${maxResults}, download_medias=${downloadMedias}, country=${country}`
  );

  try {
  const [prevMetrics, prevHashtags, prevAudio] = await Promise.all([
    loadSnapshots(prevDateKey),
    loadHashtagCounts(prevDateKey),
    loadAudioUsage(prevDateKey),
  ]);

  const cappedResults = Math.min(Math.max(maxResults, 10), 20);
  let runId = pendingRunId || "";

  if (runId) {
    const status = await getApifyRunStatus(runId, apifyToken);
    if (isApifyRunTerminalFailure(status)) {
      console.warn(
        `[trending-sync] Dropping failed Apify run ${runId} (${status}), starting fresh`
      );
      runId = "";
      await metaRef.set(
        { pendingApifyRunId: FieldValue.delete() },
        { merge: true }
      );
    } else {
      console.log(`[trending-sync] Resuming Apify run ${runId} (${status})`);
    }
  }

  if (!runId) {
    runId = await startTrendingExploreRun(apifyToken, {
      max_results: cappedResults,
      download_medias: downloadMedias,
      country,
    });
    await metaRef.set({ pendingApifyRunId: runId }, { merge: true });
  }

  const waitResult = await waitForTrendingExploreRun(
    runId,
    apifyToken,
    APIFY_WAIT_MS
  );

  if (!waitResult.done) {
    console.log(
      `[trending-sync] Apify still ${waitResult.status} (run ${runId}); will resume on next schedule`
    );
    await metaRef.set(
      {
        pendingApifyRunId: runId,
        syncInProgress: true,
        syncStatus: "apify_running",
        syncError: FieldValue.delete(),
      },
      { merge: true }
    );
    return {
      success: false,
      pending: true,
      dateKey,
      sourceItems: 0,
      reels: 0,
      posts: 0,
      audio: 0,
      hashtags: 0,
    };
  }

  const rawItems = waitResult.items;
  console.log(`[trending-sync] Apify returned ${rawItems.length} items`);

  const normalized: NormalizedTrendItem[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    const id = String(record.code || record.shortcode || record.id || "");
    const item = normalizeApifyTrendItem(record, prevMetrics.get(id));
    if (item) normalized.push(item);
  }

  if (normalized.length === 0) {
    const sample = rawItems[0];
    const sampleKeys =
      sample && typeof sample === "object"
        ? Object.keys(sample as object).slice(0, 20).join(", ")
        : "n/a";
    throw new Error(
      `Apify returned ${rawItems.length} items but none could be parsed (sample keys: ${sampleKeys})`
    );
  }

  const reels = normalized
    .filter((i) => i.uiType === "reel")
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, TOP_REELS);

  const posts = normalized
    .filter((i) => i.uiType === "post")
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, TOP_POSTS);

  const audioRows = aggregateTrendingAudio(normalized, prevAudio);
  const hashtagRows = aggregateTrendingHashtags(normalized, prevHashtags);

  const now = FieldValue.serverTimestamp();

  // Persist today's metrics for tomorrow's velocity
  const snapshotBatch = db.batch();
  const snapshotRef = db.collection("trendingSnapshots").doc(dateKey);
  snapshotBatch.set(
    snapshotRef,
    { recordedAt: now, itemCount: normalized.length },
    { merge: true }
  );
  for (const item of normalized.slice(0, 400)) {
    snapshotBatch.set(
      snapshotRef.collection("items").doc(item.contentId),
      {
        plays: item.plays,
        likes: item.likes,
        comments: item.comments,
        recordedAt: dateKey,
      },
      { merge: true }
    );
  }
  await snapshotBatch.commit();

  // Hashtag snapshot
  const tagCounts = new Map<string, number>();
  for (const item of normalized) {
    for (const kw of item.keywords) {
      const name = kw.startsWith("#") ? kw.slice(1) : kw;
      tagCounts.set(name, (tagCounts.get(name) || 0) + 1);
    }
  }
  const tagSnapBatch = db.batch();
  const tagSnapRef = db.collection("trendingHashtagSnapshots").doc(dateKey);
  tagSnapBatch.set(tagSnapRef, { recordedAt: now }, { merge: true });
  for (const [name, count] of tagCounts.entries()) {
    tagSnapBatch.set(tagSnapRef.collection("tags").doc(name), { count });
  }
  await tagSnapBatch.commit();

  // Audio usage snapshot
  const audioSnapBatch = db.batch();
  const audioSnapRef = db.collection("trendingAudioSnapshots").doc(dateKey);
  audioSnapBatch.set(audioSnapRef, { recordedAt: now }, { merge: true });
  for (const row of audioRows) {
    audioSnapBatch.set(audioSnapRef.collection("tracks").doc(row.musicKey), {
      usage: row.usage,
    });
  }
  await audioSnapBatch.commit();

  await clearCollection("trendingContent");

  const contentBatch = db.batch();
  let order = 0;
  const writeContent = (
    item: NormalizedTrendItem,
    type: "reel" | "post" | "audio",
    rank: number
  ) => {
    order += 1;
    const ref = db.collection("trendingContent").doc(item.contentId);
    contentBatch.set(ref, {
      contentId: item.contentId,
      title: item.title,
      creator: item.creator,
      username: item.username,
      accountName: item.accountName,
      type,
      thumbnailUrl: item.thumbnailUrl,
      mediaUrl: item.mediaUrl,
      originalUrl: item.originalUrl,
      categories: item.categories,
      keywords: item.keywords,
      order: rank,
      trendScore: item.trendScore,
      likes: item.likes,
      comments: item.comments,
      plays: item.plays,
      section: item.section,
      topic: item.topic,
      source: "apify-explore",
      lastUpdated: now,
      updatedAt: now,
      createdAt: now,
    });
  };

  reels.forEach((item, idx) => writeContent(item, "reel", idx + 1));
  posts.forEach((item, idx) => writeContent(item, "post", idx + 1));

  // Audio as trendingContent type audio (for unified carousel UI)
  audioRows.forEach((row, idx) => {
    order += 1;
    const ref = db.collection("trendingContent").doc(`audio_${row.musicKey}`);
    contentBatch.set(ref, {
      contentId: `audio_${row.musicKey}`,
      title: row.title,
      creator: row.artist,
      username: row.artist.startsWith("@") ? row.artist : `@${row.artist.replace(/^@/, "")}`,
      accountName: row.title,
      type: "audio",
      thumbnailUrl: row.thumbnailUrl,
      mediaUrl: row.sampleUrl,
      originalUrl: row.sampleUrl,
      categories: row.categories,
      keywords: row.keywords,
      order: idx + 1,
      trendScore: row.trendScore,
      usage: row.usage,
      totalPlays: row.totalPlays,
      source: "apify-explore",
      lastUpdated: now,
      updatedAt: now,
      createdAt: now,
    });
  });

  await contentBatch.commit();

  await clearCollection("trendingHashtags");
  const hashtagBatch = db.batch();
  hashtagRows.forEach((row, idx) => {
    hashtagBatch.set(db.collection("trendingHashtags").doc(row.name), {
      name: row.name,
      posts: row.posts,
      growth: row.growth,
      categories: row.categories.includes("all")
        ? row.categories
        : [...row.categories, "all"],
      order: idx + 1,
      lastUpdated: now,
      updatedAt: now,
    });
  });
  await hashtagBatch.commit();

  await purgeOldSnapshots();

  await metaRef.set(
    {
      lastSyncedAt: now,
      dateKey,
      sourceItems: normalized.length,
      reels: reels.length,
      posts: posts.length,
      audio: audioRows.length,
      hashtags: hashtagRows.length,
      apifyActor: "agentx~instagram-trending-scraper",
      syncInProgress: false,
      syncStatus: "ready",
      pendingApifyRunId: FieldValue.delete(),
      syncError: FieldValue.delete(),
    },
    { merge: true }
  );

  console.log(
    `[trending-sync] Done: ${reels.length} reels, ${posts.length} posts, ${audioRows.length} audio, ${hashtagRows.length} hashtags`
  );

  return {
    success: true,
    dateKey,
    sourceItems: normalized.length,
    reels: reels.length,
    posts: posts.length,
    audio: audioRows.length,
    hashtags: hashtagRows.length,
  };
  } catch (syncErr) {
    const message = syncErr instanceof Error ? syncErr.message : String(syncErr);
    await metaRef.set(
      {
        syncInProgress: false,
        pendingApifyRunId: FieldValue.delete(),
        syncStatus: "error",
        syncError: message.slice(0, 500),
      },
      { merge: true }
    );
    throw syncErr;
  }
}

/** If cache is empty, run Apify bootstrap (checks every 15 minutes). */
export const ensureTrendingPopulated = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "Asia/Kolkata",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const metaSnap = await db.collection("trendingMeta").doc("latest").get();
    const meta = metaSnap.data();
    const snap = await db.collection("trendingContent").limit(1).get();

    const hasCache = !snap.empty;
    const hasPending = Boolean(meta?.pendingApifyRunId);
    const hasError = Boolean(meta?.syncError);
    const inProgress = meta?.syncInProgress === true;

    if (hasCache && !hasPending && !hasError) {
      return;
    }

    if (hasError && inProgress && !hasPending) {
      console.log("[trending-sync] Stale syncInProgress with error — resetting");
      await db.collection("trendingMeta").doc("latest").set(
        { syncInProgress: false },
        { merge: true }
      );
    }

    if (hasPending) {
      console.log("[trending-sync] Resuming pending Apify run", meta?.pendingApifyRunId);
    } else {
      console.log("[trending-sync] Cache empty — starting bootstrap Apify sync");
    }

    try {
      const result = await runTrendingSync({ skipIfFresh: false });
      if (result.pending) {
        console.log("[trending-sync] Apify still running; will retry on next schedule");
      }
    } catch (err) {
      console.error("[trending-sync] Bootstrap/resume failed:", err);
    }
  }
);

/** Daily 6:00 AM IST — sync Explore trending into Firestore */
export const syncTrendingDaily = onSchedule(
  {
    schedule: "0 6 * * *",
    timeZone: "Asia/Kolkata",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    try {
      await runTrendingSync({ skipIfFresh: true });
    } catch (err) {
      console.error("[trending-sync] Scheduled run failed:", err);
      throw err;
    }
  }
);

/**
 * Returns shared cache status only — does NOT run Apify (daily job updates everyone).
 * Optional `force: true` in request data for admin/bootstrap (still rate-limited by lock).
 */
export const syncTrendingNow = onCall(
  {
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async (req) => {
    if (!req.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in to view trending status.");
    }

    const force =
      req.data &&
      typeof req.data === "object" &&
      (req.data as { force?: boolean }).force === true;

    const cacheEmpty =
      (await db.collection("trendingContent").limit(1).get()).empty;

    const metaSnap = await db.collection("trendingMeta").doc("latest").get();
    const meta = metaSnap.data();
    const needsRetry = Boolean(meta?.syncError);

    if (force || cacheEmpty || needsRetry) {
      try {
        return await runTrendingSync({ skipIfFresh: false });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "SYNC_IN_PROGRESS") {
          return {
            success: false,
            inProgress: true,
            cached: false,
            dateKey: todayKey(),
            sourceItems: 0,
            reels: 0,
            posts: 0,
            audio: 0,
            hashtags: 0,
          };
        }
        throw new HttpsError("internal", message);
      }
    }

    return {
      success: true,
      cached: true,
      dateKey: String(meta?.dateKey || todayKey()),
      sourceItems: Number(meta?.sourceItems) || 0,
      reels: Number(meta?.reels) || 0,
      posts: Number(meta?.posts) || 0,
      audio: Number(meta?.audio) || 0,
      hashtags: Number(meta?.hashtags) || 0,
      syncInProgress: meta?.syncInProgress === true,
    };
  }
);
