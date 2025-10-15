# Clerk Authentication Setup Guide

This guide will help you set up Clerk authentication for the Recipe Manager application on localhost.

## Prerequisites

- Node.js and pnpm installed
- Recipe Manager application cloned and dependencies installed
- Port 3004 available (or modify to your preferred port)

## Step 1: Create a Clerk Account

1. Go to [https://dashboard.clerk.com](https://dashboard.clerk.com)
2. Sign up for a free account
3. Create a new application
4. Choose your application name (e.g., "Recipe Manager")

## Step 2: Configure OAuth Providers (Optional)

In the Clerk Dashboard:
1. Navigate to **Configure** → **SSO Connections** → **Social (OAuth)**
2. Enable Google OAuth if you want Google Sign-In
3. Follow Clerk's instructions to set up Google OAuth credentials

## Step 3: Get Your API Keys

In the Clerk Dashboard:
1. Go to **API Keys** in the left sidebar
2. Copy your keys:
   - **Publishable Key**: Starts with `pk_test_` or `pk_live_`
   - **Secret Key**: Starts with `sk_test_` or `sk_live_`

## Step 4: Configure Environment Variables

1. Open `.env.local` in your project root
2. Update the Clerk configuration section:

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key_here
CLERK_SECRET_KEY=your_secret_key_here

# Clerk Redirect URLs for localhost
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

3. Ensure your `NEXT_PUBLIC_APP_URL` matches your development URL:
```bash
NEXT_PUBLIC_APP_URL=http://localhost:3004
```

## Step 5: Configure Clerk Dashboard Settings

In the Clerk Dashboard:
1. Go to **Configure** → **Paths**
2. Set the following URLs:
   - **Home URL**: `http://localhost:3004`
   - **Sign-in URL**: `http://localhost:3004/sign-in`
   - **Sign-up URL**: `http://localhost:3004/sign-up`
   - **After sign-in URL**: `http://localhost:3004`
   - **After sign-up URL**: `http://localhost:3004`

## Step 6: Add Redirect URLs for OAuth

If using Google OAuth:
1. In Clerk Dashboard, go to **Configure** → **SSO Connections** → **Social (OAuth)**
2. Click on Google
3. Note the Redirect URI provided by Clerk (usually `https://your-app.clerk.accounts.dev/v1/oauth_callback`)
4. Add this to your Google Cloud Console OAuth 2.0 Client

## Step 7: Start the Application

1. Clear any cached data:
```bash
rm -rf .next
```

2. Unset any conflicting environment variables:
```bash
unset NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY CLERK_SECRET_KEY
```

3. Start the development server:
```bash
pnpm dev
```

## Troubleshooting

### "Publishable key not valid" Error

This error occurs when:
- The publishable key format is incorrect
- The key has trailing characters or is malformed
- Environment variables are cached

**Solution:**
1. Verify your keys don't have any trailing `$` or `=` characters
2. Ensure the keys are exactly as shown in Clerk Dashboard
3. Clear Next.js cache: `rm -rf .next`
4. Restart your development server

### Application Works Without Authentication

The application is designed to work without Clerk configured. If Clerk keys are not set or invalid, the app will:
- Skip authentication checks
- Allow access to all routes
- Not show sign-in/sign-up buttons

This is intentional for development flexibility.

### Port Conflicts

If port 3004 is in use:
1. Kill the process: `lsof -ti:3004 | xargs kill -9`
2. Or use a different port: `pnpm dev --port 3005`
3. Update `NEXT_PUBLIC_APP_URL` in `.env.local` accordingly

## Testing Authentication

Once configured:
1. Visit `http://localhost:3004`
2. Click the "Sign In" button (should appear when Clerk is configured)
3. Create an account or sign in with Google
4. Access protected routes like `/recipes`

## Security Notes

- Never commit `.env.local` with real API keys
- Use `.env.local.example` as a template for other developers
- Keep your Clerk Secret Key secure and never expose it in client-side code
- For production, use production keys (starting with `pk_live_` and `sk_live_`)

## Next Steps

After successful setup:
1. Test creating recipes (requires authentication)
2. Try the Google One Touch sign-in feature
3. Customize the sign-in/sign-up pages in `/src/app/sign-in` and `/src/app/sign-up`