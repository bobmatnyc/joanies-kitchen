# Quick Start: Enable Google OAuth Sign-In

## Your Specific URLs and Configuration

### Clerk Instance Details
- **Instance Name**: powerful-salmon-99
- **Dashboard URL**: https://dashboard.clerk.com
- **Instance URL**: https://powerful-salmon-99.clerk.accounts.dev

### Required Redirect URIs for Google Cloud Console
Copy these EXACTLY (no trailing slashes):
```
https://powerful-salmon-99.clerk.accounts.dev/v1/oauth_callback
http://localhost:3004/.clerk/oauth_callback
```

### Required JavaScript Origins for Google Cloud Console
```
https://powerful-salmon-99.clerk.accounts.dev
http://localhost:3004
```

## Step-by-Step Instructions

### 1. Google Cloud Console (5 minutes)
1. Go to: https://console.cloud.google.com
2. Create new project or select existing
3. Enable Google+ API:
   - APIs & Services → Library → Search "Google+ API" → Enable
4. Create OAuth Credentials:
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: Web application
   - Name: Recipe Manager
   - Add JavaScript origins (copy from above)
   - Add redirect URIs (copy from above)
   - Click Create
5. **SAVE THE CLIENT ID AND CLIENT SECRET**

### 2. Clerk Dashboard (3 minutes)
1. Go to: https://dashboard.clerk.com
2. Sign in and find your app: **powerful-salmon-99**
3. Navigate: Configure → SSO Connections → Google
4. Toggle: Enable Google
5. Enter:
   - Client ID: (from Google Cloud Console)
   - Client Secret: (from Google Cloud Console)
6. Save changes

### 3. Test Locally
1. Run your app:
   ```bash
   npm run dev
   ```
2. Visit: http://localhost:3004/sign-in
3. You should see "Sign in with Google" button

## Debug Endpoint
Visit this URL to check your configuration:
```
http://localhost:3004/api/debug-clerk
```

## If Google Sign-In Not Showing

### Check #1: Clerk Dashboard
- Is Google enabled in SSO Connections?
- Are Client ID and Secret saved?
- Did you click Save/Apply?

### Check #2: Browser
- Hard refresh: Cmd+Shift+R (Mac) or Ctrl+F5 (Windows)
- Try incognito mode
- Check console for errors (F12)

### Check #3: Google Cloud Console
- Are all redirect URIs added exactly as shown?
- Is OAuth consent screen configured?
- Is the app in testing or production mode?

## Code Status
✅ Your code is already configured correctly:
- GoogleOneTap component is implemented
- SignIn/SignUp components are ready
- No code changes needed

## Support Links
- [Clerk Support Chat](https://clerk.com/support)
- [Clerk Discord](https://discord.com/invite/b5rXHjAg7A)
- [Google OAuth Issues](https://developers.google.com/identity/protocols/oauth2/troubleshooting)