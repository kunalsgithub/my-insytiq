# IMMEDIATE FIX - Deploy Updated Function

## Quick Deployment Steps

1. **Deploy the function:**
   ```bash
   cd /Users/kunalkumar/Desktop/insta-trend-seeker-hub/v-1.3
   firebase deploy --only functions:fetchAndStoreInstagramData
   ```

2. **Wait for deployment to complete** (1-2 minutes)

3. **Test the fix:**
   - Go to Instagram Analytics page
   - Enter a username (e.g., "shadezahrai")
   - Click "Analyze"
   - Wait 1-2 minutes
   - Check browser console for success/error messages

4. **If still failing, check logs:**
   ```bash
   firebase functions:log | grep -A 20 "Starting Apify\|Actor ID\|Response status\|Apify run start failed"
   ```

## What Was Fixed

- ✅ Changed from non-existent task ID to actor ID: `apify~instagram-scraper`
- ✅ Fixed API endpoint: `/v2/acts/` (correct Apify API v2 format)
- ✅ Fixed input parameter: `maxPosts` instead of `resultsLimit`
- ✅ Added detailed error logging

## If Actor ID is Wrong

If you get "Actor not found" error, you may need to:
1. Go to https://console.apify.com/
2. Find the Instagram scraper actor
3. Get the exact actor ID (might be different format)
4. Update `ACTOR_ID` in `functions/src/apifyFetcher.ts`
