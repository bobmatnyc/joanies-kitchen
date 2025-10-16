# Recipe Slug Migration - Quick Reference

## Quick Start

### 1. Apply Database Migration
```bash
tsx scripts/migrations/add-recipe-slug.ts
```

### 2. Test Slug Generation (Dry Run)
```bash
tsx scripts/generate-recipe-slugs.ts --dry-run
```

### 3. Generate Slugs for All Recipes
```bash
tsx scripts/generate-recipe-slugs.ts
```

### 4. Verify Everything Works
```bash
tsx scripts/test-recipe-slugs.ts
```

---

## Migration Commands Reference

### Database Migration

**Apply migration:**
```bash
tsx scripts/migrations/add-recipe-slug.ts
```

**Rollback migration:**
```bash
tsx scripts/migrations/add-recipe-slug.ts --rollback
```

### Slug Generation

**Dry run (preview only):**
```bash
tsx scripts/generate-recipe-slugs.ts --dry-run
```

**Verbose output:**
```bash
tsx scripts/generate-recipe-slugs.ts --verbose
```

**Custom batch size:**
```bash
tsx scripts/generate-recipe-slugs.ts --batch=50
```

**Production run:**
```bash
tsx scripts/generate-recipe-slugs.ts
```

### Testing

**Run all tests:**
```bash
tsx scripts/test-recipe-slugs.ts
```

**Check specific recipe slug:**
```typescript
import { getRecipe } from '@/app/actions/recipes';
const recipe = await getRecipe('chocolate-chip-cookies');
```

---

## Database Queries

### Check migration status
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'recipes' AND column_name = 'slug';
```

### Count recipes with/without slugs
```sql
SELECT
  COUNT(*) as total_recipes,
  COUNT(slug) as with_slugs,
  COUNT(*) - COUNT(slug) as without_slugs
FROM recipes;
```

### Find duplicate slugs
```sql
SELECT slug, COUNT(*) as count
FROM recipes
WHERE slug IS NOT NULL
GROUP BY slug
HAVING COUNT(*) > 1;
```

### Find recipes without slugs
```sql
SELECT id, name, is_public
FROM recipes
WHERE slug IS NULL
ORDER BY created_at DESC
LIMIT 10;
```

### Check reserved slugs in use
```sql
SELECT slug FROM recipes
WHERE slug IN ('new', 'edit', 'delete', 'admin', 'api');
```

---

## Troubleshooting Quick Fixes

### Fix: Recipe has no slug

```typescript
import { generateUniqueSlug, updateRecipeSlug } from '@/lib/utils/slug';

const slug = await generateUniqueSlug(recipe.name, recipe.id);
await updateRecipeSlug(recipe.id, slug);
```

### Fix: Duplicate slugs exist

```sql
-- Find duplicates
SELECT slug, array_agg(id) as recipe_ids, COUNT(*) as count
FROM recipes
WHERE slug IS NOT NULL
GROUP BY slug
HAVING COUNT(*) > 1;

-- Fix with script
tsx scripts/generate-recipe-slugs.ts --fix-duplicates
```

### Fix: Slug index missing

```sql
DROP INDEX IF EXISTS idx_recipes_slug;
CREATE INDEX idx_recipes_slug ON recipes(slug);
ANALYZE recipes;
```

### Fix: Unique constraint missing

```sql
ALTER TABLE recipes
ADD CONSTRAINT recipes_slug_unique UNIQUE (slug);
```

---

## URL Migration Checklist

- [ ] Database migration applied
- [ ] All recipes have slugs generated
- [ ] Test suite passes (10/10 tests)
- [ ] Sitemap includes recipe slugs
- [ ] Old UUID URLs redirect to slug URLs
- [ ] Recipe cards use slug URLs
- [ ] Search results use slug URLs
- [ ] Social sharing uses slug URLs
- [ ] Analytics tracking updated
- [ ] External links updated (if any)

---

## Rollback Procedure

If you need to rollback the migration:

### 1. Rollback Database Changes
```bash
tsx scripts/migrations/add-recipe-slug.ts --rollback
```

### 2. Revert Code Changes
```bash
git checkout HEAD~1 src/lib/utils/slug.ts
git checkout HEAD~1 src/lib/db/schema.ts
git checkout HEAD~1 src/app/actions/recipes.ts
git checkout HEAD~1 src/app/recipes/[slug]/page.tsx
```

### 3. Restore Old Route
```bash
mv src/app/recipes/[slug] src/app/recipes/[id]
```

### 4. Deploy Changes
```bash
git commit -m "rollback: revert slug system"
git push
```

---

## Performance Benchmarks

### Expected Results

**Slug Generation:**
- Single recipe: < 50ms
- 100 recipes: ~5 seconds
- 3,276 recipes: ~2-3 minutes

**Slug Lookup:**
- With index: < 20ms
- Without index: 100-500ms

**Sitemap Generation:**
- 3,276 recipes: < 2 seconds

### Performance Testing

**Test slug lookup speed:**
```sql
EXPLAIN ANALYZE
SELECT * FROM recipes WHERE slug = 'test-recipe';
```

Should show:
```
Index Scan using idx_recipes_slug on recipes
(cost=0.28..8.30 rows=1)
```

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Slug already exists" | Duplicate recipe names | System adds `-2`, `-3` suffix |
| "Reserved slug" | Name conflicts with system route | Modify recipe name |
| UUID URL not redirecting | Recipe missing slug | Run slug generation script |
| Slow lookups | Missing index | Rebuild index (see above) |
| Sitemap empty | No public recipes with slugs | Check public recipes, regenerate slugs |

---

## Deployment Checklist

### Pre-Deployment

- [ ] Run full test suite locally
- [ ] Verify dry-run output
- [ ] Backup production database
- [ ] Test on staging environment
- [ ] Review migration logs

### During Deployment

- [ ] Apply database migration
- [ ] Generate slugs for all recipes
- [ ] Run test suite in production
- [ ] Verify sitemap generation
- [ ] Check sample recipe URLs

### Post-Deployment

- [ ] Monitor error logs
- [ ] Check redirect analytics
- [ ] Verify search engine indexing
- [ ] Update external links
- [ ] Monitor performance metrics

---

## Support Resources

**Documentation:**
- Full Guide: `docs/guides/RECIPE_SLUGS.md`
- This Reference: `docs/reference/SLUG_MIGRATION.md`

**Scripts:**
- Migration: `scripts/migrations/add-recipe-slug.ts`
- Generation: `scripts/generate-recipe-slugs.ts`
- Testing: `scripts/test-recipe-slugs.ts`

**Key Files:**
- Utility: `src/lib/utils/slug.ts`
- Schema: `src/lib/db/schema.ts`
- Actions: `src/app/actions/recipes.ts`
- Page: `src/app/recipes/[slug]/page.tsx`
- Sitemap: `src/app/sitemap.ts`

---

**Quick Help:**
```bash
# Show migration help
tsx scripts/migrations/add-recipe-slug.ts --help

# Show generation help
tsx scripts/generate-recipe-slugs.ts --help

# Run tests
tsx scripts/test-recipe-slugs.ts
```

---

**Last Updated**: 2025-10-16
**Version**: 1.0.0
