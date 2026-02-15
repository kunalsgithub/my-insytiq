# Social Blade API Integration - Setup Guide

## ✅ Completed
- ✅ Created Firebase Cloud Function `getSocialBladeAnalytics`
- ✅ Added 24-hour Firestore caching
- ✅ Created frontend API client
- ✅ Updated UI components to use real data
- ✅ Removed all "saves" references
- ✅ Connected refresh button to API

## 🔧 Next Steps

### 1. Set Firebase Secrets

You need to configure your Social Blade Business API credentials as Firebase secrets:

```bash
# Set the Client ID
firebase functions:secrets:set SB_CLIENT_ID

# Set the API Token
firebase functions:secrets:set SB_API_TOKEN
```

When prompted, enter your actual Social Blade Business API credentials.

**Note:** Make sure you have:
- Social Blade Business API access
- Your `SB_CLIENT_ID` (Client ID from Social Blade dashboard)
- Your `SB_API_TOKEN` (API Token/Bearer token from Social Blade)

### 2. Build and Deploy the Function

```bash
cd functions
npm run build
cd ..
firebase deploy --only functions:getSocialBladeAnalytics
```

Or deploy all functions:
```bash
firebase deploy --only functions
```

### 3. Verify API Response Format

The function expects the Social Blade API to return data in this format:

```json
{
  "followers": 12345,
  "following": 567,
  "media": 890,
  "averageLikes": 1234,
  "averageComments": 56,
  "engagementRate": 3.8,
  "dailyHistory": [
    { "date": "2024-01-01", "followers": 12000 },
    { "date": "2024-01-02", "followers": 12100 }
  ],
  "projections": [
    { "date": "2024-07-01", "followers": 15000 }
  ]
}
```

**⚠️ Important:** You may need to adjust the field mapping in `functions/src/getSocialBladeAnalytics.ts` if Social Blade's actual API response structure differs. Check their API documentation.

### 4. Test the Integration

1. **Test the Cloud Function directly:**
   ```bash
   # Using Firebase CLI
   firebase functions:shell
   # Then call: getSocialBladeAnalytics({username: "test_username"})
   ```

2. **Test from the UI:**
   - Go to `/instagram-analytics` page
   - Enter a valid Instagram username
   - Verify data loads correctly
   - Test the refresh button

3. **Check Firestore cache:**
   - Look for `socialblade_cache` collection
   - Verify data is being cached with 24-hour TTL

### 5. Monitor and Debug

**Check Function Logs:**
```bash
firebase functions:log --only getSocialBladeAnalytics
```

**Common Issues to Check:**

1. **"Missing SB_API_TOKEN secret"**
   - Make sure secrets are set correctly
   - Verify secret names match exactly: `SB_CLIENT_ID` and `SB_API_TOKEN`

2. **API Response Format Mismatch**
   - Check Social Blade API documentation
   - Adjust field extraction in `getSocialBladeAnalytics.ts` if needed
   - The function extracts: `followers`, `following`, `media`, `averageLikes`, `averageComments`, `engagementRate`, `dailyHistory`, `projections`

3. **Caching Issues**
   - Check Firestore `socialblade_cache` collection
   - Verify `cachedAt` timestamps
   - Cache expires after 24 hours

4. **Rate Limiting**
   - Social Blade may have rate limits
   - The 24-hour cache helps reduce API calls
   - Monitor your API usage in Social Blade dashboard

### 6. Adjust API Endpoint if Needed

If Social Blade's Business API endpoint differs, update this line in `functions/src/getSocialBladeAnalytics.ts`:

```typescript
const url = `https://api.socialblade.com/v2/instagram/profile/${username}`;
```

Check Social Blade's API documentation for the correct endpoint format.

### 7. Error Handling

The function includes:
- ✅ Cache fallback (returns expired cache if API fails)
- ✅ Proper error messages
- ✅ Logging for debugging

If you see errors, check:
- Firebase Functions logs
- Browser console (for frontend errors)
- Network tab (for API call failures)

## 📝 Notes

- **Caching:** Data is cached for 24 hours to reduce API costs
- **Secrets:** Never commit API credentials to git
- **Testing:** Test with a real Instagram username that exists
- **Rate Limits:** Be aware of Social Blade's API rate limits

## 🚀 Ready to Deploy?

Once you've:
1. ✅ Set the Firebase secrets
2. ✅ Verified your Social Blade API credentials work
3. ✅ Built the functions

Run:
```bash
firebase deploy --only functions:getSocialBladeAnalytics
```

Then test the integration in your app!

