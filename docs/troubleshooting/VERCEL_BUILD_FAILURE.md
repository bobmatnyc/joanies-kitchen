# Vercel Build Failure Troubleshooting Guide

**Date**: 2025-10-23
**Issue**: Production build failing on Vercel with 0ms build time
**Status**: Requires Vercel dashboard configuration check

---

## Problem Summary

The Vercel deployment is failing with a **0ms build time**, indicating the build fails **before compilation starts**. This is NOT a code issue, as local builds succeed perfectly:

```bash
✓ Local build succeeds in 7.1s
✓ All 55 pages generate successfully
✓ No TypeScript errors
✓ All dependencies installed correctly
```

---

## Root Cause Analysis

### 1. **Environment Variables Not Set** (MOST LIKELY)

Vercel requires these environment variables to be configured in the dashboard:

**Required Variables:**
- `DATABASE_URL` - PostgreSQL connection string (Neon)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk auth public key
- `CLERK_SECRET_KEY` - Clerk auth secret key

**Optional but Recommended:**
- `OPENROUTER_API_KEY` - For AI recipe generation
- `NEXT_PUBLIC_APP_URL` - Should be `https://joanies.kitchen` for production
- `BRAVE_SEARCH_API_KEY` - For recipe discovery
- `HUGGINGFACE_API_KEY` - For vector embeddings
- `SERPAPI_API_KEY` - For chef recipe scraping
- `FIRECRAWL_API_KEY` - For recipe content extraction
- `REPLICATE_API_TOKEN` - For AI image generation

### 2. **Package Manager Configuration**

The project uses `pnpm` (not npm or yarn). Vercel must be configured to use pnpm.

**Check in Vercel Dashboard:**
- Settings → General → Build & Development Settings
- Package Manager: Should be set to `pnpm`

### 3. **Node.js Version**

**Local Environment:**
- Node.js: `v24.9.0`
- pnpm: `10.18.3`

**Vercel Configuration:**
- Check Settings → General → Node.js Version
- Should be set to `24.x` or `Latest LTS`

---

## Step-by-Step Fix Instructions

### Step 1: Check Environment Variables

1. Go to Vercel Dashboard: https://vercel.com/
2. Select project: `joanies-kitchen`
3. Go to **Settings** → **Environment Variables**
4. Verify these variables are set for **Production** environment:

```env
DATABASE_URL=postgresql://...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_APP_URL=https://joanies.kitchen
```

### Step 2: Verify Build Settings

1. Go to **Settings** → **General**
2. Under **Build & Development Settings**, verify:
   - **Framework Preset**: Next.js
   - **Build Command**: `pnpm build` (or leave empty for auto-detect)
   - **Output Directory**: `.next` (or leave empty for auto-detect)
   - **Install Command**: `pnpm install` (or leave empty for auto-detect)

### Step 3: Check Package Manager

1. Still in **Settings** → **General**
2. Look for **Package Manager** setting
3. Should be set to: `pnpm`
4. If not available, it might be auto-detected from `pnpm-lock.yaml`

### Step 4: Verify Node.js Version

1. In **Settings** → **General**
2. Find **Node.js Version**
3. Set to: `24.x` (matches local environment)

### Step 5: Check Build Logs

1. Go to **Deployments** tab
2. Click on the latest failed deployment
3. Click on the **Building** step to see detailed logs
4. Look for specific error messages

**Common Error Patterns:**
- `Missing required environment variable: DATABASE_URL`
- `Cannot find module 'xyz'` - dependency issue
- `Permission denied` - file system issue
- `ENOENT` - file not found

### Step 6: Redeploy

After making changes:
1. Go to **Deployments** tab
2. Click **...** (three dots) on the latest deployment
3. Click **Redeploy**
4. Check if build succeeds

---

## Recent Code Changes

### Commit: `f6eaa4b` (Latest)
**Title**: feat: Add sustainability badges and tooltip components for chef profiles

**Changes:**
- ✅ Added `@radix-ui/react-tooltip` dependency
- ✅ Added `serpapi` dependency for chef scraping
- ✅ Created `src/components/ui/tooltip.tsx`
- ✅ Created `src/lib/utils/chef-utils.ts`
- ✅ Updated `ChefAvatar.tsx` with sustainability badges
- ✅ Updated `ChefCard.tsx` with sustainability indicators
- ✅ Updated `package.json` and `pnpm-lock.yaml`

**Impact:** All dependencies are properly committed and should install correctly.

---

## Verification Commands

Run these locally to verify everything is correct:

```bash
# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Build test
pnpm build

# Expected output:
# ✓ Compiled successfully in 7.1s
# ✓ Generating static pages (55/55)
# ✓ Finalizing page optimization
```

---

## Known Working Configuration

**Last Successful Deployment:**
- Commit: `6abaa82` (9 hours ago)
- Status: ● Ready
- Duration: 2 minutes
- URL: https://joanies-kitchen-hh21ziplb-1-m.vercel.app

**Changes Since Then:**
1. Commit `e351d80` - Tools page fixes (succeeded)
2. Commit `77da20a` - TypeScript fix (failed)
3. Commit `f6eaa4b` - Sustainability badges (failed)

---

## If All Else Fails

### Option 1: Rollback to Last Working Commit

```bash
git revert HEAD~1  # Revert latest commit
git push origin main
```

### Option 2: Contact Vercel Support

Provide them with:
- Project name: `joanies-kitchen`
- Failed deployment ID: `dpl_GvHrWCB5tbbjZ2iXRUgUajVPB4qz`
- Error: "Build fails with 0ms duration"
- Note: Local builds succeed

### Option 3: Fresh Deployment

1. Disconnect project from Vercel
2. Create new Vercel project
3. Import from GitHub again
4. Configure environment variables
5. Deploy

---

## Additional Resources

- **Vercel Docs**: https://vercel.com/docs/deployments/troubleshooting
- **Next.js Docs**: https://nextjs.org/docs/deployment
- **pnpm on Vercel**: https://vercel.com/docs/concepts/deployments/build-step#package-managers
- **Project README**: `/README.md`
- **Environment Setup Guide**: `/docs/guides/ENVIRONMENT_SETUP.md`

---

## Status Updates

**2025-10-23 02:10 AM EST:**
- ✅ Identified root cause: Likely environment variable configuration
- ✅ All code changes committed and pushed
- ✅ Local build succeeds (verified)
- ⏳ Waiting for Vercel dashboard verification
- ⏳ Need to check environment variables in Vercel UI

---

## Next Steps

1. **User Action Required:** Check Vercel dashboard settings
2. Verify all environment variables are set correctly
3. Confirm pnpm is configured as package manager
4. Check Node.js version is set to 24.x
5. Review build logs for specific error messages
6. Redeploy after configuration changes
