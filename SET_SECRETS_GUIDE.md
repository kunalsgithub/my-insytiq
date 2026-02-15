# How to Set Social Blade API Credentials

## Step-by-Step Guide

### Prerequisites
1. Make sure you have Firebase CLI installed
2. Make sure you're logged into Firebase: `firebase login`
3. Have your Social Blade Business API credentials ready:
   - **SB_CLIENT_ID** (your Client ID)
   - **SB_API_TOKEN** (your API Token/Bearer token)

### Method 1: Using Firebase CLI (Recommended)

Open your terminal and run these commands:

```bash
# Navigate to your project directory
cd /Users/kunalkumar/Desktop/insta-trend-seeker-hub/v-1.3

# Set the Client ID
firebase functions:secrets:set SB_CLIENT_ID

# Set the API Token
firebase functions:secrets:set SB_API_TOKEN
```

**What happens:**
- When you run each command, Firebase will prompt you to enter the secret value
- Type or paste your credential and press Enter
- The secret will be securely stored in Firebase

### Method 2: Using Firebase Console (Alternative)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `social-trends-29ac2`
3. Go to **Functions** → **Secrets** (or **Config** → **Secrets**)
4. Click **Add Secret**
5. Enter:
   - **Name:** `SB_CLIENT_ID`
   - **Value:** (paste your Client ID)
6. Click **Add Secret** again
7. Enter:
   - **Name:** `SB_API_TOKEN`
   - **Value:** (paste your API Token)

### Verify Secrets Are Set

To verify your secrets are configured:

```bash
firebase functions:secrets:access SB_CLIENT_ID
firebase functions:secrets:access SB_API_TOKEN
```

(Note: This will show the values, so be careful in shared environments)

### Where to Get Social Blade Credentials

If you don't have your Social Blade Business API credentials yet:

1. Log into your Social Blade account
2. Go to **API** or **Developer** section
3. Find your **Business API** credentials
4. Copy:
   - **Client ID** → This is your `SB_CLIENT_ID`
   - **API Token** or **Bearer Token** → This is your `SB_API_TOKEN`

### Important Notes

- ✅ Secrets are encrypted and stored securely by Firebase
- ✅ They are automatically injected into your Cloud Functions at runtime
- ✅ Never commit secrets to git or expose them in code
- ✅ Secrets are project-specific (tied to `social-trends-29ac2`)

### Setting OpenAI API Key

To add the OpenAI API key for Smart Chat:

```bash
# Navigate to your project directory
cd /Users/kunalkumar/Desktop/insta-trend-seeker-hub/v-1.3

# Set the OpenAI API Key
firebase functions:secrets:set OPENAI_API_KEY
```

When prompted, paste your OpenAI API key and press Enter.

**Where to Get OpenAI API Key:**
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign in or create an account
3. Navigate to **API Keys** section
4. Click **Create new secret key**
5. Copy the key (it won't be shown again, so save it securely)

### Setting Apify API Token

**⚠️ REQUIRED for Instagram Analytics to work!**

To add the Apify API token for fetching Instagram data:

```bash
# Navigate to your project directory
cd /Users/kunalkumar/Desktop/insta-trend-seeker-hub/v-1.3

# Set the Apify API Token
firebase functions:secrets:set APIFY_API_TOKEN
```

When prompted, paste your Apify API token and press Enter.

**Where to Get Apify API Token:**
1. Go to [Apify Console](https://console.apify.com/)
2. Sign in or create an account
3. Navigate to **Settings** → **Integrations** → **API tokens**
4. Click **Create token** or copy your existing token
5. Copy the token (starts with `apify_api_`)

**Important:** Without this token, the Instagram Analytics feature will fail with "Analytics is still processing" error.

### After Setting Secrets

Once secrets are set, you can deploy:

```bash
# Deploy specific functions
firebase deploy --only functions:getSocialBladeAnalytics
firebase deploy --only functions:smartChat
firebase deploy --only functions:fetchAndStoreInstagramData

# Or deploy all functions
firebase deploy --only functions
```

The functions will automatically have access to these secrets at runtime.

