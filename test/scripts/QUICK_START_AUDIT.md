# Quick Start: Image Audit Script

## TL;DR

```bash
# Run the audit (generates JSON + CSV reports in ./reports/)
pnpm audit:images

# View results
ls -lh reports/
cat reports/image-audit-report-*.json | jq '.summary'
```

## Common Commands

```bash
# Basic audit (default: both JSON and CSV)
pnpm audit:images

# Verbose output
pnpm audit:images:verbose

# JSON only
pnpm audit:images:json

# CSV only
pnpm audit:images:csv

# Check external URLs (slower - makes HTTP requests)
pnpm audit:images:check-urls

# Custom output directory
npx tsx scripts/audit-missing-images.ts --output-dir=./my-reports

# Help
npx tsx scripts/audit-missing-images.ts --help
```

## What It Does

Scans your database for:

**Recipes**:
- ❌ No images at all (`image_url` AND `images` both empty)
- ⚠️  Has `images` array but `image_url` is null
- ⚠️  Has `image_url` but `images` array is empty
- ❌ Invalid local paths (like `/images/recipes/...` that don't exist)
- ❌ Malformed URLs
- ❌ External URLs that return 404 (optional check)

**Meals**:
- ❌ No image (`image_url` is null)
- ❌ Invalid local paths
- ❌ Malformed URLs
- ❌ External URLs that return 404 (optional check)

## Quick Fixes

### Fix null image_url (when images array exists)

```sql
-- Preview
SELECT id, name, image_url, images
FROM recipes
WHERE image_url IS NULL
  AND images IS NOT NULL
  AND images != '[]'
  AND images != 'null'
LIMIT 10;

-- Apply fix
UPDATE recipes
SET image_url = (images::json->>0)
WHERE image_url IS NULL
  AND images IS NOT NULL
  AND images != '[]'
  AND images != 'null';
```

### Remove invalid local paths

```sql
-- Preview
SELECT id, name, image_url
FROM recipes
WHERE image_url LIKE '/images/%'
  AND id IN (SELECT id FROM ...); -- Use audit report IDs

-- Apply fix (set to null)
UPDATE recipes
SET image_url = NULL
WHERE image_url LIKE '/images/%'
  AND id IN ('id1', 'id2', 'id3');
```

## Report Structure

### JSON Report
```json
{
  "summary": {
    "total_recipes": 4733,
    "recipes_with_image_issues": 4530,
    "issue_breakdown": {
      "recipes": {
        "no_images": 4131,
        "null_image_url": 298,
        "invalid_local_path": 101
      }
    }
  },
  "recipe_issues": [...]
}
```

### CSV Report
Import into Excel/Google Sheets for filtering and analysis.

## Workflow

1. **Run audit**
   ```bash
   pnpm audit:images
   ```

2. **Review reports**
   ```bash
   # Quick summary
   cat reports/image-audit-report-*.json | jq '.summary'

   # Open CSV in Excel
   open reports/image-audit-report-*.csv
   ```

3. **Fix issues**
   - Use SQL updates for simple fixes
   - Use admin UI for manual image uploads
   - Use image regeneration scripts for bulk fixes

4. **Verify**
   ```bash
   pnpm audit:images
   # Compare issue counts before/after
   ```

## Issue Types Explained

| Type | What It Means | How to Fix |
|------|---------------|------------|
| `no_images` | Recipe has no images at all | Upload images or generate with AI |
| `null_image_url` | Has images array but image_url is null | Run SQL update to copy first image |
| `empty_images_array` | Has image_url but images array is empty | Sync images array with image_url |
| `invalid_local_path` | Path like `/images/...` doesn't exist | Remove path or re-upload image |
| `invalid_url_format` | Malformed URL | Fix URL format or remove |
| `external_url_404` | External URL returns 404 | Re-upload to Vercel Blob or remove |

## Performance

- **4,733 recipes**: ~0.2 seconds
- **10 meals**: ~0.07 seconds
- **Report generation**: <1 second
- **External URL checking**: Adds ~100ms per URL

## Pro Tips

1. **Start with JSON reports** for programmatic processing
2. **Use CSV reports** for manual review in Excel
3. **Enable verbose mode** for debugging: `pnpm audit:images:verbose`
4. **Skip external URL checking** unless needed (it's slow)
5. **Run weekly** to catch new issues early

## Troubleshooting

**"DATABASE_URL must be valid"**
→ Set DATABASE_URL in `.env.local`

**"Permission denied creating reports directory"**
→ Use `--output-dir=~/reports` or check permissions

**Script hangs**
→ Check database connection, try without `--check-external-urls`

## More Info

- Full documentation: `/scripts/README-AUDIT-IMAGES.md`
- Implementation summary: `/IMAGE_AUDIT_IMPLEMENTATION.md`
- Source code: `/scripts/audit-missing-images.ts`
