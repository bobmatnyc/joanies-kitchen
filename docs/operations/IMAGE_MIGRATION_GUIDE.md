# External Image Migration Guide

**Last Updated**: 2025-10-27
**Purpose**: Migrate all external recipe images to Vercel Blob storage

---

## Current State

### External Images in Database

- **Total External Images**: 303
- **Primary Source**: TheMealDB (298 images)
- **Secondary Source**: Unsplash (5 images)

### Problem

External images from domains like `niksharmacooks.com`, `themealdb.com`, etc. cause Next.js errors:

```
Invalid src prop (https://niksharmacooks.com/...) on `next/image`,
hostname "niksharmacooks.com" is not configured under images
```

### Solution

Migrate all external images to Vercel Blob storage, eliminating the need for 50+ remotePatterns entries in `next.config.ts`.

---

## Migration Script Usage

### Quick Start

```bash
# Dry run (see what would happen)
tsx scripts/migrate-external-images.ts --dry-run

# Test with 10 images
tsx scripts/migrate-external-images.ts --limit=10

# Migrate all TheMealDB images
tsx scripts/migrate-external-images.ts --domain=themealdb.com

# Migrate everything
tsx scripts/migrate-external-images.ts
```

### Options

| Option | Description | Example |
|--------|-------------|---------|
| `--dry-run` | Preview changes without modifying anything | `--dry-run` |
| `--limit=N` | Only migrate first N images | `--limit=50` |
| `--domain=X` | Only migrate images from specific domain | `--domain=themealdb.com` |
| `--force` | Re-migrate images even if already migrated | `--force` |

---

## Migration Process

### Step 1: Dry Run

Always start with a dry run to see what will be migrated:

```bash
tsx scripts/migrate-external-images.ts --dry-run
```

Expected output:
```
🖼️  External Image Migration Script
=====================================

🔍 DRY RUN MODE - No changes will be made

📊 Fetching recipes with external images...
Found 303 recipes with external images

Domain breakdown:
  www.themealdb.com: 298 images
  images.unsplash.com: 5 images

🚀 Starting migration (dry run)...
...
```

### Step 2: Test Migration

Test with a small batch first:

```bash
tsx scripts/migrate-external-images.ts --limit=10
```

Verify the migrated images work:
1. Check the recipe pages
2. Verify images load correctly
3. Check Vercel Blob dashboard for uploaded files

### Step 3: Full Migration

Once confident, migrate everything:

```bash
# Migrate TheMealDB images first (largest batch)
tsx scripts/migrate-external-images.ts --domain=themealdb.com

# Then migrate remaining images
tsx scripts/migrate-external-images.ts
```

### Step 4: Verify Migration

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

### Step 5: Clean Up next.config.ts

Once all images are migrated, replace `next.config.ts` with the cleaned version:

```bash
# Backup current config
cp next.config.ts next.config.ts.backup

# Use clean config
mv next.config.ts.new next.config.ts

# Restart server
pm2 restart recipe-dev
```

---

## How the Script Works

### 1. Image Download

```typescript
async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
```

### 2. Filename Generation

Generates stable, unique filenames:

```typescript
// Format: recipes/{recipe-id}-{url-hash}.{extension}
// Example: recipes/abc123-a7b3c91f.jpg
function generateFilename(url: string, recipeId: string): string {
  const urlHash = crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
  const extension = url.split('.').pop()?.split('?')[0] || 'jpg';
  return `recipes/${recipeId}-${urlHash}.${extension}`;
}
```

### 3. Vercel Blob Upload

```typescript
async function uploadToBlob(buffer: Buffer, filename: string): Promise<string> {
  const blob = await put(filename, buffer, {
    access: 'public',
    addRandomSuffix: false, // Use our stable filename
  });
  return blob.url;
}
```

### 4. Database Update

```typescript
await sql`
  UPDATE recipes
  SET
    image_url = ${newUrl},
    updated_at = NOW()
  WHERE id = ${recipeId}
`;
```

---

## Handling Failures

### Common Failure Scenarios

#### 1. Image Download Failed (404, 403, etc.)

**Symptom**: `Failed to download image: 404 Not Found`

**Solution**: The image is no longer available at the source. Options:
1. Generate new image with Stable Diffusion (preferred)
2. Use placeholder image
3. Remove image from recipe

```bash
# Find recipes with failed downloads
SELECT id, name, image_url
FROM recipes
WHERE image_url LIKE 'http%'
  AND image_url NOT LIKE '%vercel-storage.com%'
LIMIT 10;
```

#### 2. Large Image Files

**Symptom**: Upload timeout or memory issues

**Solution**: The script handles this automatically, but for very large files:
- Vercel Blob has 4.5MB limit per file
- Script will skip files that are too large
- Generate replacement images instead

#### 3. Rate Limiting

**Symptom**: Too many requests errors from source domains

**Solution**: Run migration in smaller batches with delays:

```bash
# Migrate in batches of 50
tsx scripts/migrate-external-images.ts --limit=50
# Wait a few minutes
tsx scripts/migrate-external-images.ts --limit=50
```

---

## Alternative: Stable Diffusion Generation

For recipes where images can't be migrated (404, copyright issues, etc.), generate new images:

```bash
# Generate images for recipes missing images
tsx scripts/image-gen/generate-recipe-images-sd.ts --only-missing
```

See `scripts/image-gen/MEAL_IMAGE_GENERATION.md` for details on Stable Diffusion image generation.

---

## Vercel Blob Storage

### Storage Limits

- **Free tier**: 500MB storage
- **Pro tier**: 100GB storage (included)
- **File size limit**: 4.5MB per file

### Pricing

- **Storage**: Included in Vercel Pro plan
- **Bandwidth**: Included in Pro plan (1TB/month)

### Dashboard

View uploaded images: https://vercel.com/[your-team]/[your-project]/stores

---

## Next.js Image Configuration

### Before Migration

`next.config.ts` had 50+ `remotePatterns` entries for various domains:

```typescript
remotePatterns: [
  { hostname: 'www.themealdb.com' },
  { hostname: 'niksharmacooks.com' },
  { hostname: 'www.bonappetit.com' },
  // ... 47 more entries
]
```

### After Migration

Clean configuration with only Vercel Blob:

```typescript
remotePatterns: [
  // Vercel Blob Storage (our images)
  { hostname: '*.public.blob.vercel-storage.com' },
  { hostname: '*.blob.vercel-app.com' },
  // Fallback: Unsplash for ingredients
  { hostname: 'images.unsplash.com' },
]
```

---

## Benefits of Migration

### 1. Performance
- Images served from Vercel's CDN (same network as app)
- Reduced DNS lookups (1 domain vs 50+)
- Better caching and optimization

### 2. Reliability
- No dependency on external sites staying online
- No risk of images being removed or changed
- Consistent image availability

### 3. Security
- Reduced attack surface (fewer external domains)
- Better CSP compliance
- Control over all image content

### 4. Maintenance
- Simpler `next.config.ts` (3 patterns vs 50+)
- No need to whitelist new domains
- Easier to audit and manage

---

## Rollback Procedure

If migration causes issues, rollback is simple:

```bash
# 1. Restore old config
cp next.config.ts.backup next.config.ts

# 2. Restart server
pm2 restart recipe-dev

# 3. If needed, restore old image URLs from database backup
# (Only if you have a backup - script doesn't create one automatically)
```

**Important**: The migration script **does not back up the database**. If you want a safety net:

```bash
# Before full migration, backup affected recipes
psql $DATABASE_URL -c "COPY (
  SELECT id, name, image_url
  FROM recipes
  WHERE image_url LIKE 'http%'
    AND image_url NOT LIKE '%vercel-storage.com%'
) TO '/tmp/recipe-images-backup.csv' CSV HEADER;"
```

---

## FAQ

### Q: What happens to the old external images?

**A**: They remain at their original URLs. The script only updates the database to point to the new Vercel Blob URLs. The old images are not deleted.

### Q: Can I migrate images incrementally?

**A**: Yes! Use `--limit` to migrate in batches:

```bash
tsx scripts/migrate-external-images.ts --limit=50
# Verify, then continue
tsx scripts/migrate-external-images.ts --limit=50
```

### Q: What if a recipe has multiple images?

**A**: Currently, recipes only have one `image_url` field. If you add support for multiple images in the future, update the script accordingly.

### Q: Can I re-migrate images?

**A**: Yes, use `--force` to re-migrate images even if they're already in Vercel Blob:

```bash
tsx scripts/migrate-external-images.ts --force
```

### Q: How much will this cost?

**A**: If you're on Vercel Pro plan:
- **Storage**: ~150MB for 303 images (well under 100GB limit)
- **Bandwidth**: Covered by 1TB/month allowance
- **Cost**: $0 additional (included in Pro plan)

---

## Monitoring

After migration, monitor:

1. **Vercel Blob Dashboard**: Storage usage and bandwidth
2. **Server Logs**: Any image loading errors
3. **User Reports**: Visual issues on recipe pages

---

## Next Steps

After successful migration:

1. ✅ Remove old `next.config.ts` entries (keep backup)
2. ✅ Restart production server
3. ✅ Monitor for 24 hours
4. ✅ Migrate ingredient images (Unsplash → Blob or SD)
5. ✅ Document process for future imports

---

**Generated**: 2025-10-27
**Script**: `scripts/migrate-external-images.ts`
