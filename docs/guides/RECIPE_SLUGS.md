# Recipe Slug System - Complete Guide

## Overview

The Recipe Slug System transforms recipe URLs from UUID-based to SEO-friendly format:

**Before**: `/recipes/abc123-def456-ghi789`
**After**: `/recipes/grandmas-chocolate-chip-cookies`

This improves SEO, user experience, and shareability of recipe URLs.

## Table of Contents

1. [Architecture](#architecture)
2. [Implementation Components](#implementation-components)
3. [Slug Generation Rules](#slug-generation-rules)
4. [Database Schema](#database-schema)
5. [Usage Guide](#usage-guide)
6. [Migration Process](#migration-process)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## Architecture

### Key Features

- **SEO-Friendly**: Human-readable URLs optimized for search engines
- **Backwards Compatible**: Old UUID URLs still work and redirect to slug URLs
- **Duplicate Handling**: Automatic resolution with numeric suffixes
- **Reserved Protection**: System routes protected from slug conflicts
- **Performance**: Indexed database column for fast lookups

### URL Resolution Flow

```
User visits: /recipes/[slug-or-id]
       ↓
getRecipe(slug-or-id) tries:
  1. Lookup by slug
  2. Fallback to UUID
       ↓
If found by UUID and has slug:
  → 301 Redirect to /recipes/[slug]
       ↓
Recipe displayed
```

---

## Implementation Components

### 1. Core Utilities (`src/lib/utils/slug.ts`)

**Functions:**
- `generateSlugFromName(name: string)` - Generate slug from recipe name
- `validateSlug(slug: string)` - Validate slug format
- `generateUniqueSlug(name: string)` - Generate with duplicate checking
- `slugExists(slug: string)` - Check if slug is in use
- `isReservedSlug(slug: string)` - Check reserved system slugs
- `updateRecipeSlug(id: string, slug: string)` - Update recipe slug
- `getAllSlugs()` - Get all existing slugs
- `batchCheckSlugs(slugs: string[])` - Bulk slug existence check

**Reserved Slugs:**
```typescript
const RESERVED_SLUGS = [
  'new', 'edit', 'delete', 'create', 'top-50',
  'discover', 'search', 'trending', 'import', 'export',
  'admin', 'api', 'auth', 'settings', 'profile',
  'help', 'about', 'contact', 'privacy', 'terms'
];
```

### 2. Database Schema (`src/lib/db/schema.ts`)

```typescript
export const recipes = pgTable('recipes', {
  // ... other fields ...
  slug: varchar('slug', { length: 255 }).unique(),
}, (table) => ({
  slugIdx: index('idx_recipes_slug').on(table.slug),
}));
```

### 3. Server Actions (`src/app/actions/recipes.ts`)

**Updated Functions:**
- `getRecipe(idOrSlug: string)` - Lookup by slug or ID
- `getRecipeBySlug(slug: string)` - Direct slug lookup
- `createRecipe(data)` - Auto-generates slug on creation

### 4. Recipe Detail Page (`src/app/recipes/[slug]/page.tsx`)

- Accepts both slug and UUID parameters
- Redirects UUID to slug URL (301-like)
- Uses slug for edit URLs

### 5. Components

**Updated to use slugs:**
- `RecipeCard.tsx` - Links use slug if available
- `RecipeList.tsx` - All recipe links use slugs
- `SharedRecipeCard.tsx` - Shared recipe links use slugs

### 6. SEO Sitemap (`src/app/sitemap.ts`)

Generates XML sitemap with all public recipe slugs:
```xml
<url>
  <loc>https://joanies-kitchen.com/recipes/grandmas-chocolate-chip-cookies</loc>
  <lastmod>2025-10-16</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.8</priority>
</url>
```

---

## Slug Generation Rules

### Transformation Process

**Input**: "Grandma's Chocolate Chip Cookies"

1. **Convert to lowercase**: "grandma's chocolate chip cookies"
2. **Handle possessives**: "grandmas chocolate chip cookies"
3. **Replace special chars**: "grandmas-chocolate-chip-cookies"
4. **Remove filler words**: "grandmas-chocolate-chip-cookies" *(kept main words)*
5. **Limit length**: Max 100 characters
6. **Check uniqueness**: If exists, append `-2`, `-3`, etc.

**Output**: `grandmas-chocolate-chip-cookies`

### Example Transformations

| Recipe Name | Generated Slug |
|-------------|----------------|
| "The BEST Chocolate Cake" | `chocolate-cake` |
| "Easy 30-Minute Pasta!" | `easy-30-minute-pasta` |
| "Mom's Famous Apple Pie" | `moms-famous-apple-pie` |
| "Quick & Easy Breakfast" | `quick-easy-breakfast` |
| "The Food Lab's Ultimate..." | `food-lab-ultimate-cookies` |

### Filler Words Removed

To create cleaner URLs, common filler words are removed:
```
the, a, an, and, or, but, in, on, at, to, for,
of, with, by, from, best, ultimate, perfect, amazing, delicious
```

---

## Database Schema

### Migration Steps

1. **Add Column**:
```sql
ALTER TABLE recipes ADD COLUMN slug VARCHAR(255);
```

2. **Add Index**:
```sql
CREATE INDEX idx_recipes_slug ON recipes(slug);
```

3. **Add Unique Constraint**:
```sql
ALTER TABLE recipes ADD CONSTRAINT recipes_slug_unique UNIQUE (slug);
```

### Column Details

- **Type**: `VARCHAR(255)`
- **Nullable**: Yes (for backwards compatibility)
- **Unique**: Yes
- **Indexed**: Yes (for performance)
- **Default**: `NULL`

---

## Usage Guide

### For Developers

#### Creating a New Recipe

```typescript
import { createRecipe } from '@/app/actions/recipes';

const newRecipe = await createRecipe({
  name: "Chocolate Chip Cookies",
  ingredients: ["flour", "sugar", "chocolate chips"],
  instructions: ["Mix ingredients", "Bake at 350F"],
  // ... other fields
});

// Slug is automatically generated:
// newRecipe.data.slug = "chocolate-chip-cookies"
```

#### Linking to a Recipe

```typescript
import Link from 'next/link';

// Use slug if available, fall back to ID
const recipeUrl = recipe.slug
  ? `/recipes/${recipe.slug}`
  : `/recipes/${recipe.id}`;

<Link href={recipeUrl}>{recipe.name}</Link>
```

#### Looking Up a Recipe

```typescript
import { getRecipe } from '@/app/actions/recipes';

// Works with both slug and UUID
const result = await getRecipe('chocolate-chip-cookies');
// OR
const result = await getRecipe('abc123-def456-ghi789');
```

### For Content Editors

#### Slug Best Practices

1. **Keep it short** - Under 60 characters ideal
2. **Use hyphens** - Not underscores
3. **Avoid numbers** - Unless part of recipe name
4. **Be descriptive** - Include main ingredients or dish name
5. **Check uniqueness** - System handles duplicates automatically

#### Good vs Bad Slugs

| Good | Bad | Why |
|------|-----|-----|
| `chocolate-chip-cookies` | `best-chocolate-chip-cookies-ever` | Too long |
| `easy-pasta-carbonara` | `easy_pasta_carbonara` | Use hyphens |
| `chicken-stir-fry` | `recipe-1234` | Not descriptive |
| `grandmas-apple-pie` | `new` | Reserved slug |

---

## Migration Process

### Step 1: Apply Database Migration

```bash
tsx scripts/migrations/add-recipe-slug.ts
```

**Output:**
```
Starting migration: Add slug column to recipes table...
Step 1: Adding slug column (varchar(255), nullable)...
✓ Slug column added successfully
Step 2: Adding index on slug column...
✓ Index created successfully
Step 3: Adding unique constraint on slug column...
✓ Unique constraint added successfully
✅ Migration completed successfully!
```

### Step 2: Generate Slugs (Dry Run)

```bash
tsx scripts/generate-recipe-slugs.ts --dry-run --verbose
```

**Output:**
```
╔══════════════════════════════════════════╗
║  Recipe Slug Generation - Dry Run        ║
╚══════════════════════════════════════════╝

Found 3,276 recipes without slugs
Processing recipes in batches of 100...

[████████████████████] 100% | 3,276/3,276
✓ 3,275 | ✗ 1 | Elapsed: 2m 15s

✅ DRY RUN COMPLETE
```

### Step 3: Generate Slugs (Production)

```bash
tsx scripts/generate-recipe-slugs.ts
```

**Options:**
- `--dry-run` - Preview changes without applying
- `--verbose` - Show detailed progress
- `--batch=N` - Process N recipes per batch (default: 100)

### Step 4: Verify Migration

```bash
tsx scripts/test-recipe-slugs.ts
```

**Output:**
```
╔══════════════════════════════════════════╗
║    Recipe Slug System - Test Suite       ║
╚══════════════════════════════════════════╝

✓ Slug Generation (12ms)
✓ Slug Validation (8ms)
✓ Reserved Slug Detection (5ms)
✓ Database Slug Uniqueness (245ms)
✓ Public Recipes Have Slugs (123ms)
✓ Slug Format Consistency (567ms)
✓ Unique Slug Generation (45ms)
✓ Query Performance (15ms)
✓ No Reserved Slugs In Use (89ms)
✓ Statistics Check (234ms)

Total: 10 | Passed: 10 | Failed: 0
✅ ALL TESTS PASSED
```

### Step 5: Deploy Application Changes

1. Push code to repository
2. Vercel/deployment will rebuild with new routes
3. Old UUID URLs automatically redirect to slug URLs

---

## Testing

### Automated Tests

Run the full test suite:
```bash
tsx scripts/test-recipe-slugs.ts
```

### Manual Testing Checklist

- [ ] Create new recipe - slug generated automatically
- [ ] Visit recipe via slug URL - loads correctly
- [ ] Visit recipe via UUID URL - redirects to slug URL
- [ ] Edit recipe name - slug remains unchanged (by design)
- [ ] Create recipe with duplicate name - slug gets `-2` suffix
- [ ] Try accessing reserved slug - fails validation
- [ ] Check sitemap - includes all public recipe slugs
- [ ] Search engines can index - robots.txt allows

### Performance Testing

**Slug Lookup Speed:**
```bash
# Should be <100ms even with 10k+ recipes
tsx scripts/test-recipe-slugs.ts
```

**Database Query:**
```sql
EXPLAIN ANALYZE
SELECT * FROM recipes WHERE slug = 'chocolate-chip-cookies';

-- Should use index: idx_recipes_slug
```

---

## Troubleshooting

### Issue: Duplicate Slug Error

**Symptom**: Error when creating recipe with duplicate name

**Cause**: Slug generation collision

**Solution**: System automatically appends `-2`, `-3`, etc. If error persists:
```typescript
const slug = await generateUniqueSlug(recipeName, undefined, 1000);
// Increases max attempts to 1000
```

### Issue: Reserved Slug Blocked

**Symptom**: Cannot create recipe with certain names

**Cause**: Recipe name generates reserved slug (e.g., "new", "admin")

**Solution**: Modify recipe name slightly:
- "New Recipe" → "New Recipe Ideas"
- "Admin's Favorite" → "Chef Admin's Favorite"

### Issue: Old UUID Links Not Redirecting

**Symptom**: UUID URL doesn't redirect to slug URL

**Cause**: Recipe doesn't have slug yet

**Solution**: Generate slugs for affected recipes:
```bash
tsx scripts/generate-recipe-slugs.ts
```

### Issue: Slow Slug Lookups

**Symptom**: Recipe pages load slowly

**Cause**: Missing or inefficient index

**Solution**: Rebuild index:
```sql
DROP INDEX IF EXISTS idx_recipes_slug;
CREATE INDEX idx_recipes_slug ON recipes(slug);
ANALYZE recipes;
```

### Issue: Slug Not SEO-Friendly

**Symptom**: Generated slug is too long or unclear

**Cause**: Recipe name has too many filler words

**Solution**: Manually update slug:
```typescript
import { updateRecipeSlug } from '@/lib/utils/slug';

await updateRecipeSlug(recipeId, 'better-slug-name');
```

---

## API Reference

### Server Actions

#### `getRecipe(idOrSlug: string)`

Fetch recipe by slug or UUID (backwards compatible).

**Parameters:**
- `idOrSlug` - Recipe slug or UUID

**Returns:**
```typescript
{
  success: boolean;
  data?: Recipe;
  error?: string;
}
```

**Example:**
```typescript
const recipe = await getRecipe('chocolate-chip-cookies');
```

#### `getRecipeBySlug(slug: string)`

Fetch recipe by slug only.

**Parameters:**
- `slug` - Recipe slug (kebab-case)

**Returns:**
```typescript
{
  success: boolean;
  data?: Recipe;
  error?: string;
}
```

**Example:**
```typescript
const recipe = await getRecipeBySlug('chocolate-chip-cookies');
```

### Utility Functions

#### `generateSlugFromName(name: string)`

Generate slug from recipe name (no uniqueness check).

**Parameters:**
- `name` - Recipe name

**Returns:** `string` - Generated slug

**Example:**
```typescript
const slug = generateSlugFromName("Mom's Apple Pie");
// Returns: "moms-apple-pie"
```

#### `generateUniqueSlug(name: string, excludeId?: string, maxAttempts?: number)`

Generate unique slug with collision resolution.

**Parameters:**
- `name` - Recipe name
- `excludeId` - Recipe ID to exclude (for updates)
- `maxAttempts` - Max attempts (default: 100)

**Returns:** `Promise<string>` - Unique slug

**Example:**
```typescript
const slug = await generateUniqueSlug("Chocolate Chip Cookies");
// If "chocolate-chip-cookies" exists, returns "chocolate-chip-cookies-2"
```

#### `validateSlug(slug: string)`

Validate slug format.

**Parameters:**
- `slug` - Slug to validate

**Returns:**
```typescript
{
  valid: boolean;
  error?: string;
}
```

**Example:**
```typescript
const result = validateSlug("chocolate-chip-cookies");
// Returns: { valid: true }

const result2 = validateSlug("Invalid Slug!");
// Returns: { valid: false, error: "..." }
```

---

## Best Practices

### Development

1. **Always use slug-based URLs** in new code
2. **Test both slug and UUID** resolution
3. **Handle missing slugs gracefully** (fall back to ID)
4. **Update sitemap** after bulk changes
5. **Monitor slug generation performance**

### Production

1. **Run dry-run first** before generating slugs
2. **Backup database** before migration
3. **Generate slugs during low-traffic** periods
4. **Monitor redirect logs** after deployment
5. **Update external links** to use new slug URLs

### SEO

1. **Canonical URLs**: Always use slug-based URLs
2. **301 Redirects**: UUID → Slug automatic
3. **Sitemap**: Regenerates with all slugs
4. **Social Sharing**: Slug URLs are more shareable
5. **Analytics**: Track both slug and UUID URLs initially

---

## Performance Metrics

### Expected Performance

- **Slug Generation**: <50ms per recipe
- **Slug Lookup**: <20ms with index
- **Bulk Generation**: ~3,000 recipes in 2-3 minutes
- **Sitemap Generation**: <2 seconds for 10k recipes

### Database Impact

- **Storage**: +255 bytes per recipe (VARCHAR(255))
- **Index Size**: ~5MB for 10k recipes
- **Query Speed**: 10x faster with index vs sequential scan

---

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Run test suite: `tsx scripts/test-recipe-slugs.ts`
3. Review logs in `scripts/` output
4. Check database with: `SELECT * FROM recipes WHERE slug IS NULL LIMIT 10;`

---

**Last Updated**: 2025-10-16
**Version**: 1.0.0
