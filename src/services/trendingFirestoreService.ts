import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/firebase";
import type { TrendingContent, TrendingHashtag } from "@/services/instagramService";

export type TrendingMeta = {
  lastSyncedAt?: { seconds: number } | { toDate: () => Date };
  dateKey?: string;
  sourceItems?: number;
  reels?: number;
  posts?: number;
  audio?: number;
  syncInProgress?: boolean;
  syncStatus?: string;
  pendingApifyRunId?: string;
  syncError?: string;
};

export function trendingMetaSyncedAtMs(meta: TrendingMeta | null): number {
  const raw = meta?.lastSyncedAt;
  if (!raw) return 0;
  if (typeof raw === "object" && "toDate" in raw) {
    return raw.toDate().getTime();
  }
  if (typeof raw === "object" && "seconds" in raw) {
    return raw.seconds * 1000;
  }
  return 0;
}

function formatFirestoreDate(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value) {
    const d = (value as { toDate: () => Date }).toDate();
    return d.toISOString();
  }
  return new Date().toISOString();
}

export async function fetchTrendingMeta(): Promise<TrendingMeta | null> {
  const snap = await getDoc(doc(db, "trendingMeta", "latest"));
  if (!snap.exists()) return null;
  return snap.data() as TrendingMeta;
}

export async function fetchTrendingContentFromFirestore(
  searchTerm = "",
  category = "all"
): Promise<TrendingContent[]> {
  const contentRef = collection(db, "trendingContent");
  let q = query(contentRef, orderBy("order", "asc"));

  if (category !== "all") {
    q = query(q, where("categories", "array-contains", category));
  }

  const snapshot = await getDocs(q);
  if (snapshot.empty) return [];

  let items: TrendingContent[] = snapshot.docs.map((docSnap, index) => {
    const data = docSnap.data();
    return {
      id: index + 1,
      title: String(data.title || "Untitled"),
      creator: String(data.creator || data.username || "@unknown"),
      username: data.username ? String(data.username) : undefined,
      accountName: data.accountName ? String(data.accountName) : undefined,
      thumbnailColor: "bg-blue-500",
      categories: Array.isArray(data.categories) ? data.categories : ["all"],
      keywords: Array.isArray(data.keywords) ? data.keywords : [],
      type: (data.type as TrendingContent["type"]) || "post",
      mediaUrl: String(data.mediaUrl || data.thumbnailUrl || ""),
      originalUrl: String(data.originalUrl || ""),
      contentId: String(data.contentId || docSnap.id),
      lastUpdated: formatFirestoreDate(data.lastUpdated || data.updatedAt),
      thumbnailUrl: String(data.thumbnailUrl || ""),
      likes: data.likes != null ? String(data.likes) : undefined,
      comments: data.comments != null ? String(data.comments) : undefined,
    };
  });

  if (searchTerm) {
    const qLower = searchTerm.toLowerCase();
    items = items.filter(
      (item) =>
        item.title.toLowerCase().includes(qLower) ||
        item.creator.toLowerCase().includes(qLower) ||
        (item.accountName?.toLowerCase().includes(qLower) ?? false) ||
        (item.username?.toLowerCase().includes(qLower) ?? false) ||
        item.keywords.some((kw) => kw.toLowerCase().includes(qLower))
    );
  }

  return items;
}

export async function fetchTrendingHashtagsFromFirestore(
  searchTerm = "",
  category = "all"
): Promise<TrendingHashtag[]> {
  const ref = collection(db, "trendingHashtags");
  let q = query(ref, orderBy("order", "asc"));

  if (category !== "all") {
    q = query(q, where("categories", "array-contains", category));
  }

  const snapshot = await getDocs(q);
  if (snapshot.empty) return [];

  let tags: TrendingHashtag[] = snapshot.docs.map((docSnap, index) => {
    const data = docSnap.data();
    return {
      id: index + 1,
      name: String(data.name || docSnap.id),
      posts: String(data.posts || "0"),
      growth: Number(data.growth) || 0,
      categories: Array.isArray(data.categories) ? data.categories : ["all"],
      lastUpdated: formatFirestoreDate(data.lastUpdated),
    };
  });

  if (searchTerm) {
    const qLower = searchTerm.toLowerCase();
    tags = tags.filter((tag) => tag.name.toLowerCase().includes(qLower));
  }

  return tags;
}
