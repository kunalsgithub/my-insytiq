# Deploy Smart Chat Function

## Important: Where to run commands

**Firebase must be run from the folder that contains `firebase.json`.** In this project that is the **`v-1.3`** folder.

- If your terminal prompt shows `v-1.3 %`, you are already in the right place. Use `cd functions` (not `cd v-1.3/functions`).
- If you are in the repo root (parent of `v-1.3`), use `cd v-1.3` first, then the commands below.

## Steps to Fix

### 1. Set the OpenAI API Key Secret (one-time)
**IMPORTANT:** Run this command correctly - do NOT paste the API key in the command itself.

From **v-1.3**:
```bash
cd functions
firebase functions:secrets:set OPENAI_API_KEY
```
When prompted, paste your OpenAI API key. Then `cd ..` back to v-1.3.

### 2. Build and deploy Smart Chat

From **v-1.3** (the folder with `firebase.json`):

```bash
cd functions && npm run build && cd .. && npx firebase deploy --only functions:smartChat
```

Or step by step:
```bash
cd functions
npm run build
cd ..
npx firebase deploy --only functions:smartChat
```

Deploy **all** functions:
```bash
cd functions && npm run build && cd .. && npx firebase deploy --only functions
```

### 4. Verify Deployment
After deployment, wait 1-2 minutes for the function to be fully available, then:
- Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache if needed
- Try the Smart Chat feature again

### 5. Check Function Status
```bash
firebase functions:list
```

You should see `smartChat` in the list with status "Deployed".

## Troubleshooting

### Still seeing CORS errors?
1. Verify the function is deployed: `firebase functions:list`
2. Check function logs: `firebase functions:log --only smartChat`
3. Ensure you're using `httpsCallable` in the frontend (already implemented)
4. Verify the region matches: `us-central1` (already configured in `src/firebase.ts`)

### Secret not working?
1. Check secret is set: The secret should be set in Firebase Secret Manager
2. Redeploy after setting secret: You must redeploy the function after setting a new secret
3. Verify secret name matches: Must be exactly `OPENAI_API_KEY` (as defined in `functions/src/smartChat.ts`)
