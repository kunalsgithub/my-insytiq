# Fix Google Sign-in "Unauthorized Domain" Error

## Problem
Error: "This domain is not authorized for Google sign-in"
Domain: `192.168.1.11:8090`

## Solution: Add Domain to Firebase Console

### Step 1: Go to Firebase Console
1. Open https://console.firebase.google.com/
2. Select your project: **social-trends-29ac2**
3. Go to **Authentication** → **Settings** → **Authorized domains**

### Step 2: Add Your Domain
1. Click **"Add domain"** button
2. Enter: `192.168.1.11`
3. Click **"Add"**
4. **Note:** You don't need to include the port number (`:8090`) - just the domain/IP

### Step 3: Verify
- The domain should appear in the list
- Changes take effect immediately (no redeploy needed)

## Alternative: Use localhost
If you're developing locally, you can use `localhost:8090` instead, which is usually already authorized:
- Change your dev server to run on `localhost:8090` instead of `192.168.1.11:8090`

## Quick Fix Commands

If using Vite dev server, you can specify the host:
```bash
npm run dev -- --host localhost --port 8090
```

Or if you need to use the IP address, add it to Firebase Console as described above.
