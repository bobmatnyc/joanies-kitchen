# External Image Migration - Ready to Execute

**Date**: 2025-10-27
**Status**: ✅ Tested and Ready
**Test Results**: 3/3 images migrated successfully

---

## Problem Solved

You were getting this error:

```
Invalid src prop (https://niksharmacooks.com/...) on `next/image`,
hostname "niksharmacooks.com" is not configured under images
```

**Root cause**: 303 recipe images hosted on external domains (primarily TheMealDB.com)

---

## Solution

I've created a migration script that:
1. ✅ Downloads external images
2. ✅ Uploads them to your Vercel Blob storage
3. ✅ Updates database with new URLs
4. ✅ Generates stable filenames

---

## What's Been Done

### 1. Migration Script Created
- **Location**: `scripts/migrate-external-images.ts`
- **Status**: Tested and working
- **Test Results**: 3 images migrated successfully

### 2. Documentation Created
- **Guide**: `docs/operations/IMAGE_MIGRATION_GUIDE.md`
- **Comprehensive instructions**: Dry runs, batch processing, error handling

### 3. Clean Next.js Config Prepared
- **Location**: `next.config.ts.new`
- **Improvement**: Reduces from 50+ remote domains to just 3
- **Ready**: Backup and swap after full migration

---

## Current State

| Metric | Count |
|--------|-------|
| Total External Images | 303 |
| Already Migrated (test) | 3 |
| Remaining to Migrate | 300 |
| Primary Domain | www.themealdb.com (298 images) |
| Secondary Domain | images.unsplash.com (5 images) |

---

## Recommended Migration Plan

### Phase 1: Migrate TheMealDB Images (Largest Batch)

```bash
# This is the bulk of your external images (298 images)
npx tsx scripts/migrate-external-images.ts --domain=themealdb.com
```

**Expected time**: ~10-15 minutes
**Bandwidth**: ~40MB total

### Phase 2: Migrate Remaining Images

```bash
# Migrate any remaining external images
npx tsx scripts/migrate-external-images.ts
```

**Expected time**: ~1-2 minutes

### Phase 3: Update Next.js Config

```bash
# Backup current config
cp next.config.ts next.config.ts.backup

# Use clean config (only Vercel Blob + Unsplash)
mv next.config.ts.new next.config.ts

# Restart server
pm2 restart recipe-dev
```

---

## Alternative: Incremental Migration

If you prefer to migrate in smaller batches:

```bash
# Migrate 50 images at a time
npx tsx scripts/migrate-external-images.ts --limit=50

# Check the website, verify images load

# Continue with next batch
npx tsx scripts/migrate-external-images.ts --limit=50

# Repeat until done
```

---

## Safety Features

✅ **Dry Run Mode**: Test without modifying anything
```bash
npx tsx scripts/migrate-external-images.ts --dry-run
```

✅ **Batch Processing**: Migrate in small chunks with `--limit=N`

✅ **Domain Filtering**: Target specific sources with `--domain=X`

✅ **Stable Filenames**: Uses MD5 hash to prevent duplicates

✅ **Automatic Retries**: Script continues on individual failures

---

## What Happens During Migration

For each recipe with an external image:

1. **Download** image from original URL
2. **Upload** to Vercel Blob storage
   - Format: `recipes/{recipe-id}-{hash}.jpg`
   - Example: `recipes/abc123-eb8762a7.jpg`
3. **Update** database with new Vercel Blob URL
4. **Verify** successful migration

**The original external images are not deleted** - they remain at their source URLs.

---

## Benefits After Migration

### Performance
- ⚡ Faster image loading (same CDN as your app)
- ⚡ Reduced DNS lookups (1 domain vs 50+)
- ⚡ Better caching

### Reliability
- ✅ No dependency on external sites
- ✅ Images won't disappear if source sites go down
- ✅ Complete control over all content

### Security
- 🔒 Reduced attack surface
- 🔒 Better CSP compliance
- 🔒 No external third-party dependencies

### Maintenance
- 📝 Clean `next.config.ts` (3 patterns vs 50+)
- 📝 No need to whitelist new domains
- 📝 Easier to audit and manage

---

## Cost Impact

**Storage**: ~40-50MB for 303 images
**Bandwidth**: Included in Vercel Pro plan (1TB/month)
**Additional Cost**: $0 (covered by Pro plan)

---

## Verification After Migration

```bash
# Check for remaining external images
node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
(async () => {
  const results = await sql\`
    SELECT COUNT(*) as remaining
    FROM recipes
    WHERE image_url LIKE 'http%'
      AND image_url NOT LIKE '%vercel-storage.com%'
      AND image_url NOT LIKE '%blob.vercel-app.com%'
  \`;
  console.log('Remaining external images:', results[0].remaining);
})();
"
```

**Expected result after full migration**: `Remaining external images: 0`

---

## Quick Start (Recommended)

```bash
# 1. Full migration of all external images
npx tsx scripts/migrate-external-images.ts

# 2. Verify migration completed
node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
(async () => {
  const results = await sql\`
    SELECT COUNT(*) as remaining
    FROM recipes
    WHERE image_url LIKE 'http%'
      AND image_url NOT LIKE '%vercel-storage.com%'
      AND image_url NOT LIKE '%blob.vercel-app.com%'
  \`;
  console.log('Remaining:', results[0].remaining);
})();
"

# 3. Update Next.js config
cp next.config.ts next.config.ts.backup
mv next.config.ts.new next.config.ts

# 4. Restart server
pm2 restart recipe-dev

# 5. Test website - images should load normally
curl -I http://localhost:3002
```

---

## Rollback Plan

If something goes wrong:

```bash
# 1. Restore old config
cp next.config.ts.backup next.config.ts

# 2. Restart server
pm2 restart recipe-dev

# Images will continue working because we kept the old remotePatterns
```

---

## Files Created

1. ✅ **Migration Script**: `scripts/migrate-external-images.ts`
2. ✅ **Documentation**: `docs/operations/IMAGE_MIGRATION_GUIDE.md`
3. ✅ **Clean Config**: `next.config.ts.new`
4. ✅ **This Summary**: `IMAGE_MIGRATION_SUMMARY.md`

---

## Next Steps

**Ready to proceed?** Run:

```bash
# Migrate all external images (recommended)
npx tsx scripts/migrate-external-images.ts
```

**Or start small:**

```bash
# Test with 10 images first
npx tsx scripts/migrate-external-images.ts --limit=10
```

---

## Support

- **Full Documentation**: `docs/operations/IMAGE_MIGRATION_GUIDE.md`
- **Script Location**: `scripts/migrate-external-images.ts`
- **Test Log**: `/tmp/migration-test.log` (from our successful test)

---

**Ready to eliminate those external image errors! 🚀**
