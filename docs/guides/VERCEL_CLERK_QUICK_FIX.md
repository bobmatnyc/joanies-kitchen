# Vercel Clerk Authentication - Quick Fix Guide

**Issue**: "Invalid host" error on recipes.help production deployment
**Time to Fix**: ~5 minutes
**Status**: ✅ Code fixed, environment variables need update

---

## TL;DR - Quick Fix (3 Steps)

```bash
# Step 1: Pull current production environment
vercel env pull .env.vercel.production --environment=production --yes

# Step 2: Run automated fix
./scripts/fix-vercel-clerk-env-automated.sh

# Step 3: Verify on production
# Visit: https://recipes.help/sign-in
```

---

## What's Wrong?

Production is using **test keys** (`pk_test_*`) instead of **production keys** (`pk_live_*`).

Test keys only work on `*.clerk.accounts.dev` domains, not on `recipes.help`.

---

## The Fix

### Option A: Automated (Recommended)

```bash
# Run this script - it does everything
./scripts/fix-vercel-clerk-env-automated.sh

# Follow prompts:
# 1. Confirm environment variable updates
# 2. Confirm production deployment
# 3. Done!
```

**What it does**:
1. Extracts production keys from `_PROD` variables
2. Updates `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` to `pk_live_...`
3. Updates `CLERK_SECRET_KEY` to `sk_live_...`
4. Deploys to production

---

### Option B: Manual (5 minutes)

#### 1. Go to Vercel Dashboard
https://vercel.com/1-m/joanies-kitchen/settings/environment-variables

#### 2. Update These Variables (Production scope only)

**Variable 1**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- Current: `pk_test_...` ❌
- Change to: `pk_live_Y2xlcmsucmVjaXBlcy5oZWxwJA` ✅

**Variable 2**: `CLERK_SECRET_KEY`
- Current: `sk_test_...` ❌
- Change to: `sk_live_kVahgqoC5y0pGHgfTjyxJoffbzYCh4OGI1AfwpXImg` ✅

#### 3. Deploy
```bash
vercel --prod
```

---

## Clerk Dashboard Configuration

**IMPORTANT**: Also verify this in Clerk dashboard:

1. Go to: https://dashboard.clerk.com
2. Select **Production** application
3. Go to **Settings** → **Domains**
4. Verify `recipes.help` is listed ✅

If not listed:
- Click "Add domain"
- Enter: `recipes.help`
- Save

---

## Verification

### Test 1: Homepage
```bash
curl -I https://recipes.help
# Should return: 200 OK
```

### Test 2: Sign-In Page
Visit: https://recipes.help/sign-in
- Clerk widget should load (no errors)
- No "Invalid host" in console

### Test 3: Complete Flow
1. Sign in at: https://recipes.help/sign-in
2. Verify redirect to homepage
3. Verify user menu appears
4. Success! ✅

---

## If Still Not Working

### Check Environment Variables
```bash
vercel env ls | grep CLERK
```

Should show for **Production**:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_live_...` ✅
- `CLERK_SECRET_KEY` = `sk_live_...` ✅

### Check Deployment
```bash
# View logs
vercel logs --prod --limit 50

# Look for errors
vercel logs --prod | grep -i "invalid host"
```

### Force Redeploy
```bash
# Force fresh deployment
vercel --prod --force
```

---

## What Changed in Code?

✅ **Fixed**: `src/lib/auth-config.ts`
- Now properly uses production keys in production
- Better fallback logic for environment variables

No other code changes needed.

---

## Need More Details?

See comprehensive guides:
- **Full Fix Guide**: `docs/guides/VERCEL_CLERK_FIX.md`
- **Clerk Dashboard Setup**: `docs/guides/CLERK_DASHBOARD_SETUP.md`

---

## Summary

**Problem**: Test keys on production domain
**Solution**: Use production keys
**Fix**: Run `./scripts/fix-vercel-clerk-env-automated.sh`
**Time**: ~5 minutes
**Impact**: Fixes authentication for all users

**Quick Command**:
```bash
vercel env pull .env.vercel.production --environment=production --yes && ./scripts/fix-vercel-clerk-env-automated.sh
```

---

**Last Updated**: 2025-10-15
**Status**: Ready to apply
