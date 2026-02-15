# Fix Google Sign-in IP Address Authorization

## Problem
The IP address `192.168.29.63` is not authorized for Google Sign-in in Firebase.

## Quick Fix (2 minutes)

### Option 1: Add IP Address to Firebase (Recommended)

1. **Open Firebase Console:**
   - Click the "Open Firebase Console" button in the error message, OR
   - Go to: https://console.firebase.google.com/project/social-trends-29ac2/authentication/settings

2. **Add Authorized Domain:**
   - Scroll down to the "Authorized domains" section
   - Click "Add domain"
   - Enter: `192.168.29.63`
   - Click "Add"

3. **Wait 1-2 minutes** for the change to propagate

4. **Refresh your app** and try signing in again

### Option 2: Use localhost Instead (Alternative)

If you're developing locally, you can use `localhost` instead:

1. **Stop your dev server**
2. **Access the app via:**
   ```
   http://localhost:8080
   ```
   (Replace 8080 with your actual port number)

3. **localhost is already authorized** in Firebase by default

## Why This Happens

Firebase requires all domains/IP addresses to be explicitly authorized for security. When you access your app via an IP address (like `192.168.29.63`), Firebase blocks Google Sign-in unless that IP is in the authorized domains list.

## After Adding the Domain

- The error should disappear immediately
- Google Sign-in will work normally
- You can continue developing on that IP address

## Need Help?

If the error persists after adding the domain:
1. Wait 2-3 minutes (Firebase needs time to propagate changes)
2. Clear your browser cache
3. Try signing in again
