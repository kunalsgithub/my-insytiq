# Daily trending sync (Apify → Firestore)

## Architecture (shared for all users)

| Layer | Role |
|--------|------|
| **`syncTrendingDaily`** | Runs **once per day** at 6:00 AM IST — only place that calls Apify |
| **Firestore** | `trendingContent`, `trendingHashtags`, `trendingMeta/latest` — **same data for every account** |
| **Trending page** | Reads Firestore only (~instant). **Refresh** re-loads cache; it does **not** run Apify |

On each daily sync:

1. Fetches Explore trends via Apify (small batch, ~25 posts).
2. **Deletes** previous `trendingContent` / `trendingHashtags` docs, then writes the new top reels/posts/audio.
3. **Purges** metric snapshots older than 2 days.

## Deploy

```bash
cd functions && npm run build && cd ..
firebase deploy --only functions:syncTrendingDaily,functions:syncTrendingNow
```

Env (`functions/.env` / `.env.social-trends-29ac2`):

```
CFG_APIFY_TRENDING_API_TOKEN=...
CFG_TRENDING_MAX_RESULTS=25
CFG_TRENDING_DOWNLOAD_MEDIAS=none
CFG_TRENDING_COUNTRY=India
```

## First-time / manual bootstrap (admin only)

Normal users should never wait on Apify. To seed Firestore once:

```bash
# Callable with force flag (signed-in user); or trigger from Firebase Console
# data: { "force": true }
```

Or wait for the 6 AM IST scheduled run.

## Frontend

- `/trending` loads from Firestore first (<10s typical).
- **Refresh** = reload Firestore, not Instagram scrape.
- Sheet backup is used only if Firestore has never been synced.

## Firestore rules

Merge blocks from `firestore.rules` so authenticated users can **read** trending collections (writes only via Admin SDK).
