# Vercel Clerk Authentication Fix Guide

## Issue Summary

**Error**: `Invalid host` - Clerk authentication failing on Vercel production deployment

**Root Cause**: Production environment was using test Clerk keys (`pk_test_*`, `sk_test_*`) instead of production keys (`pk_live_*`, `sk_live_*`)

**Impact**: All authentication requests to recipes.help were rejected by Clerk

**Status**: ✅ Fixed - Code updated, environment variables need to be configured

---

## Root Cause Analysis

### What Went Wrong

1. **Environment Variable Configuration Issue**
   - Production environment had `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` set to `pk_test_...` (test key)
   - Production environment had `CLERK_SECRET_KEY` set to `sk_test_...` (test key)
   - Test keys are only valid for development domains (e.g., `*.clerk.accounts.dev`)
   - Production domain `recipes.help` requires production keys (`pk_live_*`, `sk_live_*`)

2. **Key Mismatch**
   - The production keys were stored in `_PROD` suffixed variables:
     - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD=pk_live_...` ✅
     - `CLERK_SECRET_KEY_PROD=sk_live_...` ✅
   - But the application was falling back to the non-suffixed variables:
     - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...` ❌
     - `CLERK_SECRET_KEY=sk_test_...` ❌

3. **Code Behavior**
   - The `auth-config.ts` file tries `_PROD` suffixed keys first
   - Then falls back to non-suffixed keys as a backup
   - Since both exist, it should work, but the non-suffixed keys had priority in Clerk's own SDK
   - Clerk SDK reads `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` directly from environment

### Why This Error Occurred

```
┌─────────────────────────────────────────────────────────────────┐
│ Request Flow                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User visits: https://recipes.help/sign-in                  │
│  2. Browser loads Clerk SDK with NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
│  3. Clerk SDK sees: pk_test_... (test key)                     │
│  4. Clerk SDK tries to initialize with test key                │
│  5. Clerk API checks: Is recipes.help authorized for pk_test_?  │
│  6. Clerk API responds: ❌ Invalid host (test keys only work   │
│     with *.clerk.accounts.dev domains)                         │
│  7. Authentication fails with error                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Expected Flow (After Fix)

```
┌─────────────────────────────────────────────────────────────────┐
│ Correct Request Flow                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User visits: https://recipes.help/sign-in                  │
│  2. Browser loads Clerk SDK with NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
│  3. Clerk SDK sees: pk_live_... (production key)               │
│  4. Clerk SDK tries to initialize with production key          │
│  5. Clerk API checks: Is recipes.help authorized for pk_live_? │
│  6. Clerk API responds: ✅ Valid host                          │
│  7. Authentication succeeds                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Solution Overview

### Code Changes

✅ **Fixed**: `src/lib/auth-config.ts`
- Updated production key selection logic
- Now properly prioritizes `_PROD` suffixed keys
- Falls back to non-suffixed keys only if `_PROD` keys are missing
- Better comments explaining Vercel environment expectations

### Environment Variable Changes Needed

❌ **Action Required**: Update Vercel environment variables

**Current State** (❌ Incorrect):
```
Production Environment:
├── NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_test_... ❌ (test key)
├── CLERK_SECRET_KEY = sk_test_... ❌ (test key)
├── NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD = pk_live_... ✅ (correct but not used by Clerk SDK)
└── CLERK_SECRET_KEY_PROD = sk_live_... ✅ (correct but not used)
```

**Required State** (✅ Correct):
```
Production Environment:
├── NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_live_... ✅ (production key)
├── CLERK_SECRET_KEY = sk_live_... ✅ (production key)
├── NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD = pk_live_... ✅ (backup/documentation)
└── CLERK_SECRET_KEY_PROD = sk_live_... ✅ (backup/documentation)
```

---

## Fix Implementation

### Option 1: Automated Script (Recommended)

**Quick Fix** - Runs in ~30 seconds:

```bash
# Step 1: Pull current production environment
vercel env pull .env.vercel.production --environment=production --yes

# Step 2: Run automated fix script
./scripts/fix-vercel-clerk-env-automated.sh

# Step 3: Follow prompts to confirm and deploy
```

The script will:
1. ✅ Extract production keys from `_PROD` variables
2. ✅ Remove incorrect test keys from production
3. ✅ Add production keys to production environment
4. ✅ Prompt for deployment confirmation
5. ✅ Deploy to production if confirmed

---

### Option 2: Manual Fix via Vercel Dashboard (Safest)

**For those who prefer visual confirmation**:

1. **Navigate to Vercel Dashboard**
   - Go to: https://vercel.com/1-m/joanies-kitchen/settings/environment-variables
   - Log in if needed

2. **Update NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY**
   - Find: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - Environment: `Production`
   - Current value: `pk_test_...` ❌
   - Click "Edit"
   - Copy the value from `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD` (starts with `pk_live_`)
   - Paste new value: `pk_live_Y2xlcmsucmVjaXBlcy5oZWxwJA`
   - Click "Save"

3. **Update CLERK_SECRET_KEY**
   - Find: `CLERK_SECRET_KEY`
   - Environment: `Production`
   - Current value: `sk_test_...` ❌
   - Click "Edit"
   - Copy the value from `CLERK_SECRET_KEY_PROD` (starts with `sk_live_`)
   - Paste new value: `sk_live_kVahgqoC5y0pGHgfTjyxJoffbzYCh4OGI1AfwpXImg`
   - Click "Save"

4. **Redeploy**
   ```bash
   vercel --prod
   ```

5. **Monitor Deployment**
   - Visit: https://vercel.com/1-m/joanies-kitchen/deployments
   - Wait for deployment to complete (~2-3 minutes)
   - Check for any build errors

---

### Option 3: Manual Fix via Vercel CLI

**For command-line enthusiasts**:

```bash
# Step 1: Remove old variables (production scope)
vercel env rm NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env rm CLERK_SECRET_KEY production

# Step 2: Add production keys
# (Replace with your actual keys from NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD and CLERK_SECRET_KEY_PROD)
echo "pk_live_Y2xlcmsucmVjaXBlcy5oZWxwJA" | vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
echo "sk_live_kVahgqoC5y0pGHgfTjyxJoffbzYCh4OGI1AfwpXImg" | vercel env add CLERK_SECRET_KEY production

# Step 3: Deploy
vercel --prod
```

---

## Clerk Dashboard Configuration

**CRITICAL**: Ensure Clerk is configured for recipes.help domain

### 1. Verify Domain Configuration

1. Go to: https://dashboard.clerk.com
2. Select your production application
3. Go to: **Settings** → **Domains**
4. Verify `recipes.help` is listed as an authorized domain
5. If not listed, click "Add domain" and add `recipes.help`

### 2. Verify Redirect URLs

In Clerk Dashboard → **Paths**:

✅ Required Settings:
```
Sign-in URL: /sign-in
Sign-up URL: /sign-up
After sign-in URL: /
After sign-up URL: /
```

### 3. Verify Environment

In Clerk Dashboard → **API Keys**:

Ensure you're using the **Production** environment keys:
- Publishable Key should start with: `pk_live_`
- Secret Key should start with: `sk_live_`

---

## Verification Steps

After applying the fix, verify authentication works correctly:

### 1. Check Environment Variables

```bash
# Pull latest production environment
vercel env pull .env.vercel.production --environment=production --yes

# Verify production keys are set
grep "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=" .env.vercel.production
# Should show: pk_live_...

grep "CLERK_SECRET_KEY=" .env.vercel.production
# Should show: sk_live_...
```

### 2. Check Deployment Status

```bash
# View recent deployments
vercel deployments ls

# Check production logs
vercel logs --prod
```

### 3. Test Authentication Flow

**Test 1: Homepage Access**
```bash
curl -I https://recipes.help
# Should return: 200 OK
```

**Test 2: Sign-In Page**
1. Visit: https://recipes.help/sign-in
2. Verify Clerk sign-in widget loads (no errors in console)
3. Check browser console (F12) for any Clerk errors
4. Should NOT see: "Invalid host" error

**Test 3: Complete Authentication**
1. Click "Sign in"
2. Enter credentials (or sign in with Google)
3. Verify successful authentication
4. Should redirect to homepage
5. Verify user menu appears in header

**Test 4: Protected Routes**
1. Visit: https://recipes.help/recipes (should work when authenticated)
2. Visit: https://recipes.help/meal-plans (should work when authenticated)
3. Log out
4. Try accessing protected routes (should redirect to /sign-in)

### 4. Monitor for Errors

```bash
# Watch production logs in real-time
vercel logs --prod --follow

# Check for Clerk-related errors
vercel logs --prod | grep -i clerk
vercel logs --prod | grep -i "invalid host"
```

---

## Troubleshooting

### Issue: Still Getting "Invalid host" Error

**Diagnosis**:
```bash
# Check what keys are actually being used
vercel env ls | grep CLERK
```

**Solutions**:
1. Ensure environment variables were updated in **Production** scope (not Preview or Development)
2. Verify you deployed after updating environment variables: `vercel --prod`
3. Clear Vercel build cache: `vercel --prod --force`
4. Check Clerk dashboard for domain configuration

---

### Issue: Keys Not Updating

**Problem**: Environment variable changes not reflecting in deployment

**Solution**:
```bash
# Force a new deployment with fresh environment
vercel --prod --force

# Verify environment variables are correct
vercel env pull .env.vercel.production --environment=production --yes
cat .env.vercel.production | grep CLERK
```

---

### Issue: Build Succeeds but Runtime Error

**Problem**: Application builds successfully but Clerk fails at runtime

**Diagnosis**:
```bash
# Check runtime logs for actual error
vercel logs --prod --limit 100
```

**Common Causes**:
1. Clerk SDK version mismatch
2. Middleware configuration issue
3. Missing environment variables at runtime

**Solutions**:
1. Verify `@clerk/nextjs` version in `package.json` is `^5.0.0` or higher
2. Check `src/middleware.ts` is properly configured
3. Ensure `NEXT_PUBLIC_*` variables are accessible client-side

---

### Issue: Authentication Works Locally but Not on Vercel

**Problem**: Localhost works fine, production fails

**Diagnosis**:
```bash
# Compare local and production environments
# Local
cat .env.local | grep CLERK

# Production
vercel env pull .env.vercel.production --environment=production --yes
cat .env.vercel.production | grep CLERK
```

**Common Causes**:
1. Different keys between local and production
2. Domain not configured in Clerk dashboard
3. Environment variable scope mismatch

**Solutions**:
1. Ensure production uses `pk_live_*` and `sk_live_*` keys
2. Add `recipes.help` to Clerk allowed domains
3. Verify environment variables are in **Production** scope

---

## Prevention Checklist

To prevent this issue in future deployments:

### Pre-Deployment Checklist

- [ ] Verify environment variables before deployment
  ```bash
  vercel env ls | grep CLERK
  ```

- [ ] Ensure production uses production keys
  ```bash
  # Should see pk_live_ and sk_live_ for Production environment
  vercel env ls | grep -A 1 "Production"
  ```

- [ ] Test authentication in preview deployment first
  ```bash
  # Deploy to preview
  vercel

  # Test on preview URL
  # https://joanies-kitchen-xyz.vercel.app/sign-in
  ```

- [ ] Check Clerk dashboard configuration
  - [ ] Domain is authorized
  - [ ] Redirect URLs are configured
  - [ ] Using correct environment (Production)

- [ ] Review deployment logs after going live
  ```bash
  vercel logs --prod --limit 50
  ```

### Post-Deployment Checklist

- [ ] Test sign-in flow: https://recipes.help/sign-in
- [ ] Test sign-up flow: https://recipes.help/sign-up
- [ ] Test protected routes after authentication
- [ ] Test sign-out functionality
- [ ] Monitor error logs for 24 hours
- [ ] Set up Vercel alert for 5xx errors

---

## Environment Variable Best Practices

### Recommended Setup for All Environments

```bash
# ============================================================
# DEVELOPMENT ENVIRONMENT (localhost)
# ============================================================
Development Scope:
├── NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_test_... (dev keys)
├── CLERK_SECRET_KEY = sk_test_... (dev keys)
├── DATABASE_URL = <development database>
└── NEXT_PUBLIC_APP_URL = http://localhost:3004

# ============================================================
# PREVIEW ENVIRONMENT (Vercel preview deployments)
# ============================================================
Preview Scope:
├── NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_test_... (test keys)
├── CLERK_SECRET_KEY = sk_test_... (test keys)
├── DATABASE_URL = <staging database or same as production>
└── NEXT_PUBLIC_APP_URL = <leave empty for auto-generated URL>

# ============================================================
# PRODUCTION ENVIRONMENT (recipes.help)
# ============================================================
Production Scope:
├── NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_live_... (PRODUCTION KEYS) ✅
├── CLERK_SECRET_KEY = sk_live_... (PRODUCTION KEYS) ✅
├── DATABASE_URL = <production database>
├── NEXT_PUBLIC_APP_URL = https://recipes.help
├── NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD = pk_live_... (backup)
└── CLERK_SECRET_KEY_PROD = sk_live_... (backup)
```

### Key Naming Conventions

- **Never use suffixes for active keys** - Clerk SDK reads `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` directly
- **Use suffixes for backup/documentation** - `_PROD`, `_DEV` suffixes are for reference
- **Use environment scopes** - Leverage Vercel's Production/Preview/Development scopes

---

## Additional Resources

### Documentation Links

- **Clerk Dashboard**: https://dashboard.clerk.com
- **Vercel Environment Variables**: https://vercel.com/docs/concepts/projects/environment-variables
- **Clerk Next.js Guide**: https://clerk.com/docs/quickstarts/nextjs
- **Clerk Domain Configuration**: https://clerk.com/docs/deployments/domains

### Project Documentation

- **Environment Setup**: `docs/guides/ENVIRONMENT_SETUP.md`
- **Authentication Guide**: `docs/guides/AUTHENTICATION_GUIDE.md`
- **Deployment Guide**: `docs/guides/DEPLOYMENT.md` (if exists)

### Support Contacts

- **Clerk Support**: https://clerk.com/support
- **Vercel Support**: https://vercel.com/support
- **Project Repository**: (Add GitHub issues URL)

---

## Summary

### What Was Fixed

✅ Updated `src/lib/auth-config.ts` to properly prioritize production keys
✅ Created automated fix script for environment variables
✅ Documented root cause and prevention measures
✅ Created verification checklist

### What You Need to Do

1. **Update Vercel Environment Variables** (choose one method):
   - Run: `./scripts/fix-vercel-clerk-env-automated.sh`
   - Or: Update manually via Vercel Dashboard
   - Or: Update manually via Vercel CLI

2. **Verify Clerk Dashboard Configuration**:
   - Ensure `recipes.help` is in allowed domains
   - Verify redirect URLs are configured

3. **Deploy and Test**:
   - Deploy: `vercel --prod`
   - Test: https://recipes.help/sign-in

4. **Monitor**:
   - Watch logs: `vercel logs --prod --follow`
   - Test authentication flows

---

**Last Updated**: 2025-10-15
**Status**: Ready for implementation
**Impact**: Critical - Blocks all authentication on production

**Quick Fix**: Run `./scripts/fix-vercel-clerk-env-automated.sh` and deploy
