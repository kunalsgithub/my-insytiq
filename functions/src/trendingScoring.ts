/**
 * Trending score: velocity + engagement rate + recency + Explore placement.
 * Requires prior-day snapshots in Firestore for velocity; day-one uses ER + recency only.
 */

export type TrendingUiType = "reel" | "post" | "audio";

export type MetricSnapshot = {
  plays: number;
  likes: number;
  comments: number;
  recordedAt: string;
};

export type NormalizedTrendItem = {
  contentId: string;
  uiType: TrendingUiType;
  title: string;
  creator: string;
  username: string;
  accountName: string;
  originalUrl: string;
  thumbnailUrl: string;
  mediaUrl: string;
  categories: string[];
  keywords: string[];
  section: string;
  topic: string;
  likes: number;
  comments: number;
  plays: number;
  publishedAt: Date | null;
  trendScore: number;
  /** For audio aggregation */
  musicKey?: string;
  musicTitle?: string;
};

const SECTION_TO_CATEGORY: Record<string, string> = {
  "fashion & beauty": "fashion",
  "music & audio": "entertainment",
  "sports & fitness": "sports",
  "food & drink": "food",
  travel: "travel",
  "science & tech": "tech",
  entertainment: "entertainment",
  gaming: "entertainment",
  art: "lifestyle",
  news: "all",
};

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function sectionToCategories(section: string): string[] {
  const key = section.toLowerCase().trim();
  const mapped = SECTION_TO_CATEGORY[key];
  const cats = new Set<string>(["all"]);
  if (mapped) cats.add(mapped);
  return Array.from(cats);
}

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u0900-\u097F]+/g);
  if (!matches) return [];
  return matches.map((t) => t.toLowerCase());
}

function parsePublishedAt(raw: Record<string, unknown>): Date | null {
  const candidates = [
    raw.timestamp,
    raw.date,
    raw.published_at,
    raw.taken_at,
    raw.takenAtTimestamp,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c) {
      const d = new Date(c);
      if (!Number.isNaN(d.getTime())) return d;
    }
    if (typeof c === "number" && c > 0) {
      const ms = c > 1e12 ? c : c * 1000;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function recencyFactor(publishedAt: Date | null, maxAgeHours = 168): number {
  if (!publishedAt) return 0.5;
  const ageHours = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60);
  if (ageHours < 0) return 1;
  if (ageHours >= maxAgeHours) return 0.05;
  return Math.exp(-ageHours / 48);
}

function velocity(current: number, previous: number | undefined): number {
  if (previous === undefined || previous <= 0) {
    return current > 0 ? 0.35 : 0;
  }
  const v = (current - previous) / previous;
  return Math.max(0, Math.min(v, 5)) / 5;
}

function engagementRate(likes: number, comments: number, plays: number, followers = 0): number {
  const engagement = likes + comments * 2;
  if (plays > 0) {
    return Math.min(engagement / plays, 1);
  }
  if (followers > 0) {
    return Math.min(engagement / followers, 1);
  }
  return Math.min(engagement / 10000, 1);
}

export function computeTrendScore(
  metrics: { plays: number; likes: number; comments: number },
  publishedAt: Date | null,
  previous?: MetricSnapshot,
  exploreBoost = 1
): number {
  const prevPlays = previous?.plays;
  const prevEng =
    previous !== undefined
      ? previous.likes + previous.comments
      : undefined;
  const curEng = metrics.likes + metrics.comments;

  const playVel = velocity(metrics.plays, prevPlays);
  const engVel = velocity(curEng, prevEng);
  const er = engagementRate(metrics.likes, metrics.comments, metrics.plays);
  const rec = recencyFactor(publishedAt);

  const score =
    0.35 * playVel +
    0.25 * engVel +
    0.2 * er +
    0.1 * rec +
    0.1 * exploreBoost;

  return Math.round(score * 10000) / 10000;
}

function instagramPostUrl(code: string, type: string): string {
  if (!code) return "";
  if (type === "clips" || type.includes("clip")) {
    return `https://www.instagram.com/reel/${code}/`;
  }
  return `https://www.instagram.com/p/${code}/`;
}

function mapUiType(apifyType: string): TrendingUiType {
  const t = apifyType.toLowerCase();
  if (t === "clips" || t.includes("clip") || t === "video") return "reel";
  if (t === "carousel_container" || t.includes("carousel")) return "post";
  if (t === "image" || t === "feed") return "post";
  return "post";
}

function extractPostCode(raw: Record<string, unknown>): string {
  const direct =
    str(raw.code) ||
    str(raw.shortcode) ||
    str(raw.shortCode) ||
    str(raw.short_code) ||
    str(raw.pk) ||
    str(raw.id);
  if (direct && direct.length >= 5 && direct.length <= 32) return direct;

  const url =
    str(raw.url) ||
    str(raw.link) ||
    str(raw.permalink) ||
    str(raw.post_url) ||
    str(raw.postUrl);
  if (url) {
    const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i);
    if (m?.[1]) return m[1];
  }
  return "";
}

export function normalizeApifyTrendItem(
  raw: Record<string, unknown>,
  previous?: MetricSnapshot
): NormalizedTrendItem | null {
  const code = extractPostCode(raw);
  if (!code) return null;

  const apifyType = str(raw.type) || "image";
  const uiType = mapUiType(apifyType);
  let userUsername = "";
  const userField = raw.user;
  if (userField && typeof userField === "object") {
    userUsername = str((userField as Record<string, unknown>).username);
  }
  const handle =
    str(raw.username) ||
    str(raw.ownerUsername) ||
    userUsername ||
    "unknown";
  const username = handle.startsWith("@") ? handle : `@${handle}`;
  const accountName =
    str(raw.full_name) ||
    str(raw.fullName) ||
    str(raw.ownerFullName) ||
    str(raw.profile_name) ||
    str(raw.profileName) ||
    username.replace(/^@/, "").replace(/[_.]+/g, " ");
  const caption = str(raw.caption) || str(raw.text) || "";
  const section = str(raw.section) || "Explore";
  const topic = str(raw.topic) || "";
  const likes = num(raw.likes ?? raw.like_count ?? raw.likesCount);
  const comments = num(raw.comments ?? raw.comment_count ?? raw.commentsCount);
  const plays = num(raw.plays ?? raw.play_count ?? raw.videoViewCount ?? raw.viewCount);
  const publishedAt = parsePublishedAt(raw);
  const exploreBoost = section ? 1 : 0.7;

  const trendScore = computeTrendScore(
    { plays, likes, comments },
    publishedAt,
    previous,
    exploreBoost
  );

  const title =
    caption.length > 0
      ? caption.slice(0, 80) + (caption.length > 80 ? "…" : "")
      : topic || section || "Trending on Instagram";

  const thumbnailUrl =
    str(raw.thumbnail_url) ||
    str(raw.thumbnailUrl) ||
    str(raw.image_url) ||
    str(raw.imageUrl) ||
    "";
  const videoUrl = str(raw.video_url) || str(raw.videoUrl) || "";

  const musicTitle =
    str(raw.music_title) ||
    str(raw.musicTitle) ||
    str(raw.audio_title) ||
    topic ||
    "";
  const musicId = str(raw.music_id) || str(raw.musicId) || str(raw.audio_id) || "";

  return {
    contentId: code,
    uiType,
    title,
    creator: username,
    username,
    accountName,
    originalUrl: str(raw.url) || instagramPostUrl(code, apifyType),
    thumbnailUrl,
    mediaUrl: videoUrl || thumbnailUrl,
    categories: sectionToCategories(section),
    keywords: extractHashtags(caption),
    section,
    topic,
    likes,
    comments,
    plays,
    publishedAt,
    trendScore,
    musicKey: musicId || (musicTitle ? musicTitle.toLowerCase() : undefined),
    musicTitle: musicTitle || undefined,
  };
}

export type AggregatedAudio = {
  musicKey: string;
  title: string;
  artist: string;
  usage: number;
  totalPlays: number;
  trendScore: number;
  sampleUrl: string;
  thumbnailUrl: string;
  categories: string[];
  keywords: string[];
};

/** Build trending audio rows from reels with audio / Music section posts. */
export function aggregateTrendingAudio(
  items: NormalizedTrendItem[],
  previousUsage: Map<string, number>
): AggregatedAudio[] {
  const byKey = new Map<string, AggregatedAudio>();

  for (const item of items) {
    const isMusicSection = item.section.toLowerCase().includes("music");
    const hasMusic = Boolean(item.musicKey || item.musicTitle);
    if (item.uiType !== "reel" && !isMusicSection) continue;
    if (!hasMusic && !isMusicSection) continue;

    const key =
      item.musicKey ||
      (item.musicTitle ? item.musicTitle.toLowerCase() : item.contentId);
    const title = item.musicTitle || `Sound — ${item.topic || item.section}`;
    const existing = byKey.get(key);
    const usage = (existing?.usage ?? 0) + 1;
    const totalPlays = (existing?.totalPlays ?? 0) + item.plays;
    const prev = previousUsage.get(key);
    const usageVel = velocity(usage, prev);
    const avgPlays = totalPlays / usage;
    const trendScore =
      0.45 * usageVel +
      0.35 * Math.min(avgPlays / 500000, 1) +
      0.2 * recencyFactor(item.publishedAt);

    byKey.set(key, {
      musicKey: key,
      title,
      artist: item.creator,
      usage,
      totalPlays,
      trendScore: Math.round(trendScore * 10000) / 10000,
      sampleUrl: item.originalUrl,
      thumbnailUrl: item.thumbnailUrl,
      categories: item.categories,
      keywords: item.keywords,
    });
  }

  return Array.from(byKey.values())
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, 10);
}

export type HashtagTrendRow = {
  name: string;
  posts: string;
  growth: number;
  categories: string[];
};

export function aggregateTrendingHashtags(
  items: NormalizedTrendItem[],
  previousCounts: Map<string, number>
): HashtagTrendRow[] {
  const counts = new Map<string, { count: number; categories: Set<string> }>();

  for (const item of items) {
    for (const tag of item.keywords) {
      const name = tag.startsWith("#") ? tag.slice(1) : tag;
      if (!name) continue;
      const row = counts.get(name) || { count: 0, categories: new Set<string>() };
      row.count += 1;
      item.categories.forEach((c) => row.categories.add(c));
      counts.set(name, row);
    }
  }

  const rows: HashtagTrendRow[] = [];
  for (const [name, data] of counts.entries()) {
    const prev = previousCounts.get(name) ?? 0;
    const growth =
      prev > 0
        ? Math.round(((data.count - prev) / prev) * 100)
        : data.count > 1
          ? 100
          : 50;
    rows.push({
      name,
      posts: `${data.count * 1000}+`,
      growth: Math.min(Math.max(growth, 0), 999),
      categories: Array.from(data.categories),
    });
  }

  return rows.sort((a, b) => b.growth - a.growth).slice(0, 20);
}
