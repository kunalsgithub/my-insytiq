# API Credits, Live Errors & Billing

## "FirebaseError: internal" on Instagram Analytics
- Usually the **Social Blade API** call from the function is failing (auth or rate limit). Backend now returns clearer error codes and messages.
- **Check:** Firebase Console → Project Settings → Secret Manager (or Functions → getSocialBladeAnalytics) — ensure **SB_CLIENT_ID** and **SB_API_TOKEN** are set and valid for the Social Blade Business API.
- **Logs:** Firebase Console → Functions → getSocialBladeAnalytics → Logs. Look for "Social Blade API request failed" to see status (e.g. 401 = bad credentials).

## 1. Too much API credit / Low Social Blade credits
- **Backend:** 24h cache per username (Firestore). **Frontend:** 30 min in-memory cache. Same username within 30 min = no new API call. Use one username when testing to save credits.
- If you see 429 or "rate limit/credits exhausted": wait before retrying; reuse the same username so cache is used. Add more credits at Social Blade dashboard when needed.

## 2. CORS / "Unable to fetch analytics data"
- **Code:** `cors: true` added to `getSocialBladeAnalytics` and `getFollowerHistory`. Redeploy:  
  `firebase deploy --only functions:getSocialBladeAnalytics,functions:getFollowerHistory`
- **Authorized domains:** If `insytiq.ai` (and `www.insytiq.ai` if you use it) are already in Firebase → Auth → Authorized domains, you’re set. Add `www.insytiq.ai` only if your live site uses that exact host.

## 3. Billing suspended
- Main cause of live errors **and** deploy failures. Secret Manager (used by functions) requires billing.
- **Fix:** (1) Update payment: https://console.cloud.google.com/billing/018559-AEEADC-949EC2/settings  
  (2) **Link project to billing:** https://console.cloud.google.com/billing/enable?project=social-trends-29ac2 (choose your billing account for project `social-trends-29ac2`).  
  (3) Enable Secret Manager API if needed: https://console.cloud.google.com/apis/library/secretmanager.googleapis.com?project=social-trends-29ac2  
  Wait 5–10 min, then run `firebase deploy --only functions:...` again.
- App now shows a clearer message when backend returns internal/unavailable.

## Checklist
- [ ] Use same username when testing (cache avoids extra calls)
- [x] Redeploy getSocialBladeAnalytics & getFollowerHistory (done)
- [x] Authorized domains (insytiq.ai already added; add www.insytiq.ai if needed)
- [x] Fix billing in Google Cloud
