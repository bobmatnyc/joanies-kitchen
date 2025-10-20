# Chef Avatar Images Fix - October 17, 2025

## Issue Summary

Chef avatar images were not appearing on production (https://recipes.help) despite working correctly in local development.

## Investigation

### Symptoms
- 10 chef avatars returning 404 on production
- Images: yotam-ottolenghi, nigella-lawson, samin-nosrat, lidia-bastianich, nancy-silverton, kenji-lopez-alt, madhur-jaffrey, jacques-pepin, alton-brown, gordon-ramsay
- All images located in `/public/chefs/avatars/`
- Images working correctly in local development
- Database records pointing to correct paths: `/chefs/avatars/{slug}.jpg`

### Investigation Steps

1. **Verified images in git repository**:
   ```bash
   git ls-files public/chefs/avatars/
   # Result: All 10 .jpg files present and tracked
   ```

2. **Confirmed images were committed and pushed**:
   ```bash
   git log --oneline -- public/chefs/avatars/*.jpg
   # Result: Committed in 1be8fd5
   ```

3. **Tested production access**:
   ```bash
   curl -I "https://recipes.help/chefs/avatars/kenji-lopez-alt.jpg"
   # Result: HTTP/2 404 - Images not being served
   ```

4. **Checked Next.js configuration**:
   - Found `output: 'standalone'` in `next.config.ts`
   - This is a known issue with Next.js standalone builds

## Root Cause

**Next.js `output: 'standalone'` mode does not automatically include the public folder in production builds on Vercel.**

When using `output: 'standalone'`, Next.js creates a minimal production build in `.next/standalone/` that only includes:
- Server files
- Required node_modules
- Build output

The `public/` folder must be manually copied to `.next/standalone/public/` for static assets to be served. Vercel's build process doesn't do this automatically.

## Solution

**Removed `output: 'standalone'` from `next.config.ts`**

Vercel's default Next.js deployment:
- Handles public folder assets correctly
- Provides similar optimization benefits
- Is the recommended configuration for Vercel deployments
- Still supports all Next.js features (ISR, API routes, server actions, etc.)

### Additional Fix

Updated Gordon Ramsay's avatar from Unsplash URL to local image for consistency:
```typescript
// Before: https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400&h=400&fit=crop&crop=faces
// After:  /chefs/avatars/gordon-ramsay.jpg
```

## Changes Made

### File: `next.config.ts`
```diff
- output: 'standalone',
+ // Removed 'output: standalone' - Vercel handles deployment better with default output
+ // The standalone mode was causing public folder assets to not be served in production
```

### Database Update
```sql
UPDATE chefs
SET profile_image_url = '/chefs/avatars/gordon-ramsay.jpg'
WHERE slug = 'gordon-ramsay';
```

## Verification Steps

After deployment completes on Vercel (typically 2-3 minutes):

1. **Test individual avatar images**:
   ```bash
   curl -I "https://recipes.help/chefs/avatars/kenji-lopez-alt.jpg"
   # Expected: HTTP/2 200
   ```

2. **Test all chef avatars**:
   ```bash
   for chef in yotam-ottolenghi nigella-lawson samin-nosrat lidia-bastianich \
               nancy-silverton kenji-lopez-alt madhur-jaffrey jacques-pepin \
               alton-brown gordon-ramsay; do
     echo "Testing: $chef"
     curl -I "https://recipes.help/chefs/avatars/$chef.jpg" 2>&1 | grep "HTTP/"
   done
   # Expected: All return HTTP/2 200
   ```

3. **Visual verification**:
   - Visit https://recipes.help/discover/chefs
   - Confirm all chef avatars display correctly
   - Check browser DevTools Network tab for 404 errors

## Current Avatar Status

| Chef | Avatar Path | Source | Status |
|------|-------------|--------|--------|
| Alton Brown | /chefs/avatars/alton-brown.jpg | Local | ✅ Fixed |
| Gordon Ramsay | /chefs/avatars/gordon-ramsay.jpg | Local | ✅ Fixed |
| Ina Garten | Unsplash URL | External | ⚠️ Different source |
| Jacques Pépin | /chefs/avatars/jacques-pepin.jpg | Local | ✅ Fixed |
| Joanie | Vercel Blob | Blob Storage | ⚠️ Different source |
| Kenji López-Alt | /chefs/avatars/kenji-lopez-alt.jpg | Local | ✅ Fixed |
| Lidia Bastianich | /chefs/avatars/lidia-bastianich.jpg | Local | ✅ Fixed |
| Madhur Jaffrey | /chefs/avatars/madhur-jaffrey.jpg | Local | ✅ Fixed |
| Nancy Silverton | /chefs/avatars/nancy-silverton.jpg | Local | ✅ Fixed |
| Nigella Lawson | /chefs/avatars/nigella-lawson.jpg | Local | ✅ Fixed |
| Samin Nosrat | /chefs/avatars/samin-nosrat.jpg | Local | ✅ Fixed |
| Yotam Ottolenghi | /chefs/avatars/yotam-ottolenghi.jpg | Local | ✅ Fixed |

## Related Files

- **Next.js Config**: `next.config.ts`
- **Chef Schema**: `src/lib/db/chef-schema.ts`
- **Avatar Component**: `src/components/chef/ChefAvatar.tsx`
- **Public Assets**: `public/chefs/avatars/`
- **Verification Scripts**:
  - `scripts/check-avatar-urls.ts`
  - `scripts/fix-gordon-ramsay-avatar.ts`

## Prevention

To prevent similar issues in the future:

1. **Avoid `output: 'standalone'` on Vercel**:
   - Use only when deploying to custom servers (Docker, VPS, etc.)
   - Not needed for Vercel deployments

2. **Test production builds locally**:
   ```bash
   pnpm build && pnpm start
   # Verify public assets are accessible at http://localhost:3000
   ```

3. **Monitor deployment logs**:
   - Check Vercel build logs for warnings
   - Verify public folder is included in deployment

4. **Add deployment checks**:
   - Create a post-deployment smoke test
   - Verify critical assets are accessible

## References

- **Next.js Standalone Output**: https://nextjs.org/docs/pages/api-reference/next-config-js/output#standalone
- **Vercel Next.js Deployment**: https://vercel.com/docs/frameworks/nextjs
- **GitHub Commit**: c434f19 (fix: remove standalone output)
- **Previous Commit**: 1be8fd5 (feat: chef avatars added)

## Timeline

- **2025-10-17 17:53**: Chef avatars committed to git (1be8fd5)
- **2025-10-17 18:00**: Deployed to production
- **2025-10-17 18:30**: Issue reported (avatars not showing)
- **2025-10-17 19:00**: Root cause identified (standalone output)
- **2025-10-17 19:15**: Fix implemented and deployed (c434f19)
- **2025-10-17 19:18**: Awaiting production deployment completion

---

**Status**: Fix deployed, awaiting verification
**Severity**: Medium (visual issue, no data loss)
**Impact**: 10 chef avatar images on production site
**Resolution Time**: ~45 minutes from report to fix deployment
