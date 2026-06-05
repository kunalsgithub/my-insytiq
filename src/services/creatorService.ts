import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { CREATOR_ADMIN_EMAIL } from "@/config/creatorEconomy";
import { db } from "@/firebase";
import type {
  CreatorProfile,
  PayoutRequest,
  ReferralConversion,
} from "@/types/creator";

const SITE_ORIGIN = "https://www.insytiq.ai";

export function generateReferralCode(instagramHandle: string): string {
  const base = instagramHandle
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 20);
  return base || "creator";
}

export async function isReferralCodeTaken(code: string, excludeUid?: string): Promise<boolean> {
  const snap = await getDocs(
    query(collection(db, "creators"), where("referralCode", "==", code), limit(1))
  );
  if (snap.empty) return false;
  return excludeUid ? snap.docs[0].id !== excludeUid : true;
}

export async function resolveUniqueReferralCode(
  instagramHandle: string
): Promise<string> {
  let code = generateReferralCode(instagramHandle);
  let suffix = 2;
  while (await isReferralCodeTaken(code)) {
    const trimmed = generateReferralCode(instagramHandle).slice(0, 17);
    code = `${trimmed}_${suffix}`;
    suffix += 1;
  }
  return code;
}

export async function getCreatorProfile(uid: string): Promise<CreatorProfile | null> {
  const snap = await getDoc(doc(db, "creators", uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as CreatorProfile;
}

export async function submitCreatorApplication(input: {
  uid: string;
  email: string;
  name: string;
  instagramHandle: string;
  audienceSize: string;
  niche: string;
  whyJoin?: string;
}): Promise<CreatorProfile> {
  const existing = await getCreatorProfile(input.uid);
  if (existing) return existing;

  const handle = input.instagramHandle.replace(/^@/, "").trim();
  const referralCode = await resolveUniqueReferralCode(handle);
  const referralLink = `${SITE_ORIGIN}/?ref=${referralCode}`;

  const profile: Omit<CreatorProfile, "createdAt" | "updatedAt"> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    uid: input.uid,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    instagramHandle: handle,
    audienceSize: input.audienceSize,
    niche: input.niche,
    ...(input.whyJoin?.trim() ? { whyJoin: input.whyJoin.trim() } : {}),
    referralCode,
    referralLink,
    status: "pending",
    planAccessActive: false,
    totalClicks: 0,
    totalSignups: 0,
    totalConversions: 0,
    totalEarnings: 0,
    pendingEarnings: 0,
    paidEarnings: 0,
    payoutRequested: false,
    bankDetails: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, "creators", input.uid), profile);

  // Notify admin of new creator application (Trigger Email — Format B, direct HTML)
  await addDoc(collection(db, "mail"), {
    to: CREATOR_ADMIN_EMAIL,
    message: {
      subject: `New Creator's Economy application — ${input.name} (@${handle})`,
      html: `
        <h2>New Creator Application</h2>
        <p><strong>Name:</strong> ${input.name}</p>
        <p><strong>Instagram:</strong> @${handle}</p>
        <p><strong>Audience size:</strong> ${input.audienceSize}</p>
        <p><strong>Niche:</strong> ${input.niche}</p>
        <p><strong>Why they want to join:</strong> ${input.whyJoin?.trim() || "Not provided"}</p>
        <p><strong>Email:</strong> ${input.email}</p>
        <p><strong>UID:</strong> ${input.uid}</p>
        <br/>
        <p>
          <a href="https://www.insytiq.ai/admin/creators" style="
            background: #7c1d5c;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: bold;
          ">
            Review in Admin Panel →
          </a>
        </p>
      `,
    },
  });

  return { ...profile, createdAt: undefined, updatedAt: undefined } as CreatorProfile;
}

export function clearedEarnings(creator: CreatorProfile): number {
  const cleared =
    (creator.totalEarnings || 0) -
    (creator.pendingEarnings || 0) -
    (creator.paidEarnings || 0);
  return Math.max(0, Math.round(cleared * 100) / 100);
}

export async function getMonthlyCreatorStats(creatorUid: string): Promise<{
  clicksLast30Days: number;
  conversionsLast30Days: number;
}> {
  const since = Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

  const [clicksSnap, conversionsSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, "referralClicks"),
        where("creatorUid", "==", creatorUid),
        where("clickedAt", ">=", since)
      )
    ),
    getDocs(
      query(
        collection(db, "referralConversions"),
        where("creatorUid", "==", creatorUid),
        where("convertedAt", ">=", since)
      )
    ),
  ]);

  return {
    clicksLast30Days: clicksSnap.size,
    conversionsLast30Days: conversionsSnap.size,
  };
}

export async function listRecentConversions(
  creatorUid: string,
  max = 5
): Promise<ReferralConversion[]> {
  const snap = await getDocs(
    query(
      collection(db, "referralConversions"),
      where("creatorUid", "==", creatorUid),
      orderBy("convertedAt", "desc"),
      limit(max)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ReferralConversion);
}

export async function listAllCreators(): Promise<CreatorProfile[]> {
  const snap = await getDocs(collection(db, "creators"));
  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() }) as CreatorProfile)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export async function listPayoutRequests(
  status?: PayoutRequest["status"]
): Promise<PayoutRequest[]> {
  const q = status
    ? query(
        collection(db, "payoutRequests"),
        where("status", "==", status),
        orderBy("requestedAt", "desc")
      )
    : query(collection(db, "payoutRequests"), orderBy("requestedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PayoutRequest);
}
