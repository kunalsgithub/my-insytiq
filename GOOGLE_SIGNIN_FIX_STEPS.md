# Fix Google Sign-in "Unauthorized Domain" Error - Step by Step

## Current Error
Domain `192.168.1.11:8090` is not authorized for Google sign-in.

## ✅ SOLUTION: Add Domain to Firebase Console

### Step 1: Open Firebase Console
**Direct Link:** https://console.firebase.google.com/project/social-trends-29ac2/authentication/settings

### Step 2: Add Authorized Domain
1. Scroll down to the **"Authorized domains"** section
2. You'll see a list of domains (usually includes `localhost`, `social-trends-29ac2.firebaseapp.com`, etc.)
3. Click the **"Add domain"** button
4. In the input field, enter: **`192.168.1.11`** (without the port number)
5. Click **"Add"**
6. The domain will appear in the list immediately

### Step 3: Test
1. Go back to your app: `http://192.168.1.11:8090/auth`
2. Try Google Sign-in again
3. It should work now! ✅

## 🔄 Alternative: Use localhost (Faster)

If you're developing locally, you can use `localhost` instead:

1. Access your app at: **`http://localhost:8090`** instead of `http://192.168.1.11:8090`
2. `localhost` is usually already authorized in Firebase
3. No Firebase Console changes needed!

## 📝 Notes

- **Port numbers don't matter** - Firebase only checks the hostname/IP
- **Changes take effect immediately** - No redeploy needed
- **You can add multiple domains** - Add both `192.168.1.11` and `localhost` if needed

## 🚨 Still Not Working?

If you've added the domain but it's still not working:

1. **Clear browser cache** and try again
2. **Check the exact domain** in the error message
3. **Verify in Firebase Console** that the domain appears in the list
4. **Try incognito/private browsing mode**
