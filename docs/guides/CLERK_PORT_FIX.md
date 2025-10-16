# Clerk "Invalid host" Error - Port Mismatch Fix

**Date**: 2025-10-15
**Issue**: Clerk authentication failing with "Invalid host" error on localhost:3002
**Root Cause**: Port mismatch between server (3002) and Clerk configuration (3004)

---

## Problem Summary

### Error Message
```json
{
  "errors": [{
    "message": "Invalid host",
    "long_message": "We were unable to attribute this request to an instance running on Clerk. Make sure that your Clerk Publishable Key is correct.",
    "code": "host_invalid"
  }],
  "clerk_trace_id": "8f6ad8469e84da77c084c95125e02fa5"
}
```

### Root Cause Analysis
1. **Dev server running on**: `localhost:3002` (defined in package.json)
2. **Environment variables configured for**: `localhost:3004` (old configuration)
3. **Clerk dashboard configured for**: `localhost:3004` (needs update)
4. **Result**: Host validation fails because Clerk expects requests from port 3004, not 3002

---

## Changes Made

### 1. Updated Environment Variables
**File**: `.env.local`
```diff
- NEXT_PUBLIC_APP_URL=http://localhost:3004
+ NEXT_PUBLIC_APP_URL=http://localhost:3002
```

### 2. Updated Clerk Development Configuration
**File**: `src/config/clerk-dev.ts`
```diff
- satelliteDomain: 'localhost:3004',
+ satelliteDomain: 'localhost:3002',
```

### 3. Updated Auth Configuration Default
**File**: `src/lib/auth-config.ts`
```diff
- // Default to localhost:3004 in development
- return 'http://localhost:3004';
+ // Default to localhost:3002 in development
+ return 'http://localhost:3002';
```

### 4. Updated Documentation
**File**: `.env.local.example`
```diff
- # Application Configuration
- NEXT_PUBLIC_APP_URL=http://localhost:3004
+ # Application Configuration
+ NEXT_PUBLIC_APP_URL=http://localhost:3002

- # Development keys (for localhost:3004)
+ # Development keys (for localhost:3002)
```

---

## Required Manual Steps

### ⚠️ CRITICAL: Update Clerk Dashboard

You **MUST** add `http://localhost:3002` to your Clerk dashboard's allowed origins.

#### Step-by-Step Instructions:

1. **Go to Clerk Dashboard**:
   - URL: https://dashboard.clerk.com/
   - Log in to your account

2. **Select Development Instance**:
   - Click on your development app: `native-marmoset-74`
   - This is the instance using `pk_test_c2FmZS1jaWNhZGEtNjIuY2xlcmsuYWNjb3VudHMuZGV2JA`

3. **Navigate to Domain Settings**:
   - Go to: **Configure** → **Paths** (or **Settings** → **Domains**)
   - Look for **"Allowed Origins"** or **"Authorized Domains"**

4. **Add localhost:3002**:
   - Click "Add domain" or "Add origin"
   - Enter: `http://localhost:3002`
   - **Optional**: Keep `http://localhost:3004` for backward compatibility
   - Click **Save**

5. **Verify Configuration**:
   - Ensure `http://localhost:3002` appears in the list
   - You should see it marked as a development origin

#### Alternative: Quick Visual Guide
```
Dashboard → Apps → native-marmoset-74 → Configure → Paths
└─ Allowed Origins
   ├─ http://localhost:3002  ✅ (ADD THIS)
   └─ http://localhost:3004  (existing, optional to keep)
```

---

## Testing the Fix

### 1. Restart Development Server
```bash
# The dev server was stopped as part of the fix
# Restart it to apply the new environment variables
pnpm dev
```

### 2. Test Localhost Authentication
```bash
# After restart, open in browser:
http://localhost:3002

# Test authentication:
1. Click "Sign In" button
2. You should NOT see "Invalid host" error
3. Sign-in page should load from Clerk
4. Complete sign-in flow
```

### 3. Verify Environment Configuration
```bash
# Check the debug endpoint:
curl http://localhost:3002/api/debug-clerk

# Should show:
# - publishableKey: pk_test_c2FmZS1jaWNhZGEtNjIuY2xlcmsuYWNjb3VudHMuZGV2JA
# - environment: development
# - appUrl: http://localhost:3002
```

### 4. Verify Production Still Works
```bash
# Test production deployment:
curl https://recipes.help

# Should work without issues (uses different Clerk keys)
```

---

## Success Criteria

- ✅ Dev server runs on `localhost:3002`
- ✅ `.env.local` has `NEXT_PUBLIC_APP_URL=http://localhost:3002`
- ✅ Clerk dashboard has `http://localhost:3002` in allowed origins
- ✅ No "Invalid host" error when accessing localhost:3002
- ✅ Sign-in/sign-up flows work on localhost:3002
- ✅ Production deployment (recipes.help) still works

---

## Troubleshooting

### Issue: Still getting "Invalid host" error after restart

**Solution 1: Clear Browser Cache**
1. Open DevTools (F12)
2. Right-click refresh button → "Empty Cache and Hard Reload"
3. Try signing in again

**Solution 2: Verify Clerk Dashboard Settings**
1. Double-check that `http://localhost:3002` was saved in Clerk dashboard
2. It may take a few minutes for Clerk to propagate changes
3. Try waiting 5 minutes and test again

**Solution 3: Check Environment Variables**
```bash
# Verify the correct values are loaded:
node -e "
require('dotenv').config({ path: '.env.local' });
console.log('APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
"

# Should output: http://localhost:3002
```

**Solution 4: Alternative Port Configuration**
If you can't update Clerk dashboard immediately, change dev server to use port 3004:

```bash
# In package.json, change:
"dev": "next dev --turbopack -p 3002"
# To:
"dev": "next dev --turbopack -p 3004"

# And revert .env.local:
NEXT_PUBLIC_APP_URL=http://localhost:3004
```

---

## Technical Details

### Why This Error Occurs
Clerk validates incoming requests against configured allowed origins for security. When the origin (`http://localhost:3002`) doesn't match any allowed origin in the dashboard (`http://localhost:3004`), Clerk rejects the request with "Invalid host".

### Development vs Production Keys
- **Development**: `pk_test_*` / `sk_test_*` - for `native-marmoset-74.clerk.accounts.dev`
- **Production**: `pk_live_*` / `sk_live_*` - for `clerk.recipes.help`

Both environments need their respective allowed origins configured.

### Dual-Environment Setup
This app supports running BOTH environments on localhost:
- Development Clerk: Uses `pk_test_*` keys by default
- Production Clerk: Uses `pk_live_*` keys when `USE_PRODUCTION_CLERK=true`

---

## Related Files

- `/Users/masa/Projects/recipe-manager/.env.local` - Main environment configuration
- `/Users/masa/Projects/recipe-manager/src/config/clerk-dev.ts` - Clerk dev config
- `/Users/masa/Projects/recipe-manager/src/lib/auth-config.ts` - Auth configuration logic
- `/Users/masa/Projects/recipe-manager/src/middleware.ts` - Clerk middleware
- `/Users/masa/Projects/recipe-manager/package.json` - Dev server port (line 6)

---

## Next Steps

1. ✅ **Manual Action Required**: Add `http://localhost:3002` to Clerk dashboard
2. ✅ **Restart Dev Server**: Run `pnpm dev` to apply changes
3. ✅ **Test Locally**: Verify sign-in works at localhost:3002
4. ✅ **Test Production**: Ensure recipes.help still works
5. 🔄 **Optional**: Update CLAUDE.md to reflect port 3002 as standard

---

**Status**: Configuration files updated, awaiting Clerk dashboard update and server restart.
