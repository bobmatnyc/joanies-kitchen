# Complete Guide: Setting up Google OAuth for Recipe Manager with Clerk

## Overview
This guide will walk you through enabling Google OAuth sign-in for the Recipe Manager app using Clerk authentication. After completing these steps, users will be able to sign in using their Google accounts.

## Important Information
- **Clerk Instance**: `powerful-salmon-99.clerk.accounts.dev`
- **Publishable Key**: `pk_test_cG93ZXJmdWwtc2FsbW9uLTk5LmNsZXJrLmFjY291bnRzLmRldg==`
- **Development Port**: 3004 (based on your .env.local)

## Part 1: Google Cloud Console Setup

### Step 1: Access Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Sign in with your Google account
3. Create a new project or select an existing one

### Step 2: Enable Google+ API
1. Navigate to **APIs & Services** → **Library**
2. Search for "Google+ API"
3. Click on it and press **Enable**

### Step 3: Create OAuth 2.0 Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. If prompted, configure the OAuth consent screen first:
   - Choose **External** for user type (unless you have Google Workspace)
   - Fill in required fields:
     - App name: "Recipe Manager"
     - User support email: Your email
     - Developer contact: Your email
   - Add scopes: `email`, `profile`, `openid`
   - Add test users if in development

### Step 4: Configure OAuth Client
1. After consent screen setup, create OAuth client ID:
   - Application type: **Web application**
   - Name: "Recipe Manager Clerk Integration"

2. Add Authorized JavaScript origins:
   ```
   https://powerful-salmon-99.clerk.accounts.dev
   http://localhost:3004
   ```

3. Add Authorized redirect URIs (CRITICAL - must be exact):
   ```
   https://powerful-salmon-99.clerk.accounts.dev/v1/oauth_callback
   http://localhost:3004/.clerk/oauth_callback
   ```

4. Click **CREATE**
5. Save the **Client ID** and **Client Secret** - you'll need these for Clerk

## Part 2: Clerk Dashboard Setup

### Step 1: Access Clerk Dashboard
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Sign in and select your application (powerful-salmon-99)

### Step 2: Enable Google OAuth
1. Navigate to **Configure** → **SSO Connections** in the left sidebar
2. Click on **Google** (or find it in the list of OAuth providers)
3. Toggle the switch to **Enable Google**

### Step 3: Configure Google OAuth Settings
1. In the Google OAuth configuration page, enter:
   - **Client ID**: (paste from Google Cloud Console)
   - **Client Secret**: (paste from Google Cloud Console)

2. Advanced Settings (if available):
   - Enable "Use custom OAuth credentials" if not already selected
   - Scopes should include: `openid`, `email`, `profile`

3. Click **Save** or **Apply Changes**

### Step 4: Configure Sign-in/Sign-up Options
1. Go to **Configure** → **Email, Phone, Username**
2. Ensure that:
   - Email address is enabled as an identifier
   - Google appears in the list of authentication strategies

## Part 3: Verify Application Configuration

### Current Code Status
Your application already has the necessary code components:

1. **GoogleOneTap Component** (✅ Already implemented in `/src/components/auth/AuthProvider.tsx`):
   - Properly configured with `oauthStrategy="oauth_google"`
   - Will automatically work once Google OAuth is enabled in Clerk

2. **SignIn/SignUp Components** (✅ Already implemented):
   - Located in `/src/components/auth/AuthPageWrapper.tsx`
   - Will automatically show Google sign-in button once enabled

### No Code Changes Needed
The application is already configured correctly. Once you complete the Clerk Dashboard and Google Cloud Console setup, the Google sign-in option will automatically appear.

## Part 4: Testing

### Local Development Testing
1. Ensure your app is running on `http://localhost:3004`:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3004/sign-in`

3. You should now see:
   - "Sign in with Google" button
   - Google One-Tap prompt (if you're already signed into Google)

### Troubleshooting Checklist

If Google OAuth is not showing:

1. **Verify Clerk Dashboard**:
   - ✓ Google OAuth is enabled in SSO Connections
   - ✓ Client ID and Secret are correctly entered
   - ✓ Changes are saved

2. **Verify Google Cloud Console**:
   - ✓ OAuth consent screen is configured
   - ✓ OAuth 2.0 client is created
   - ✓ Redirect URIs are exactly as specified above
   - ✓ JavaScript origins include your domains

3. **Clear Browser Cache**:
   - Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux)
   - Try incognito/private browsing mode

4. **Check Browser Console**:
   - Open Developer Tools (F12)
   - Look for any OAuth-related errors
   - Check Network tab for failed OAuth requests

## Part 5: Production Deployment

When deploying to production:

1. **Update Google Cloud Console**:
   - Add production domain to Authorized JavaScript origins
   - Add production redirect URI: `https://yourdomain.com/.clerk/oauth_callback`

2. **Update Environment Variables**:
   - Ensure production Clerk keys are set
   - Update `NEXT_PUBLIC_APP_URL` to production URL

## API-Based Configuration (Alternative Method)

Unfortunately, Clerk does not provide a public API endpoint to programmatically enable OAuth providers or set OAuth credentials. This must be done through the Clerk Dashboard UI.

However, you can verify the current configuration using Clerk's Backend API:

```javascript
// This is for reference only - OAuth provider configuration
// must be done through the Dashboard
const clerkBackendAPI = require('@clerk/backend');

// You can check current instance settings but cannot modify OAuth config
const instance = await clerkBackendAPI.instances.getInstance({
  instanceId: 'your-instance-id'
});
```

## Common Issues and Solutions

### Issue: "Sign in with Google" button not appearing
**Solution**:
1. Ensure Google OAuth is enabled in Clerk Dashboard
2. Hard refresh your browser
3. Check that Client ID/Secret are saved in Clerk

### Issue: OAuth callback error
**Solution**:
1. Verify redirect URIs match exactly (no trailing slashes)
2. Ensure URIs are added to Google Cloud Console
3. Check protocol (http vs https)

### Issue: Google One-Tap not showing
**Solution**:
1. Must be on HTTPS in production (or localhost for dev)
2. User must be signed into Google in browser
3. Check browser console for Content Security Policy errors

## Additional Resources

- [Clerk Google OAuth Documentation](https://clerk.com/docs/authentication/social-connections/google)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Clerk Support](https://clerk.com/support)

## Summary

After completing these steps:
1. ✅ Google Cloud Console OAuth client configured
2. ✅ Clerk Dashboard Google OAuth enabled with credentials
3. ✅ Application code already supports Google sign-in
4. ✅ Users can sign in with Google accounts

The "Sign in with Google" button will automatically appear on your sign-in and sign-up pages once the Clerk Dashboard configuration is complete.