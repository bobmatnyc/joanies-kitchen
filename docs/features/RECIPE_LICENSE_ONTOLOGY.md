# Recipe License Ontology Implementation

**Version**: 1.0.0
**Date**: 2025-10-19
**Status**: ✅ Implemented

---

## Overview

Added a comprehensive license ontology to the recipe schema to track usage rights and restrictions for recipes. This enables proper attribution, copyright management, and legal compliance for recipes from various sources.

## Implementation Details

### Database Schema Changes

#### Enum Type: `recipe_license`

Created PostgreSQL enum with 9 license types:

```sql
CREATE TYPE "public"."recipe_license" AS ENUM(
  'PUBLIC_DOMAIN',
  'CC_BY',
  'CC_BY_SA',
  'CC_BY_NC',
  'CC_BY_NC_SA',
  'EDUCATIONAL_USE',
  'PERSONAL_USE',
  'ALL_RIGHTS_RESERVED',
  'FAIR_USE'
);
```

#### Recipes Table Column

Added required `license` column to recipes table:

```typescript
license: recipeLicenseEnum('license')
  .notNull()
  .default('ALL_RIGHTS_RESERVED')
```

**Features**:
- NOT NULL constraint ensures every recipe has a license
- Default value: `ALL_RIGHTS_RESERVED` (most restrictive, safest for imported content)
- Indexed for efficient filtering by license type

### License Types Explained

| License Type | Description | Use Cases |
|-------------|-------------|-----------|
| `PUBLIC_DOMAIN` | No copyright restrictions | Historical recipes, expired copyrights |
| `CC_BY` | Attribution required | Free sharing with credit |
| `CC_BY_SA` | Attribution + ShareAlike | Free sharing, derivatives must use same license |
| `CC_BY_NC` | Attribution + NonCommercial | Free non-commercial use with credit |
| `CC_BY_NC_SA` | Attribution + NonCommercial + ShareAlike | Non-commercial use, same license for derivatives |
| `EDUCATIONAL_USE` | Educational purposes only | Teaching materials, classroom use |
| `PERSONAL_USE` | Personal, non-commercial use | Home cooking, personal recipe collections |
| `ALL_RIGHTS_RESERVED` | Full copyright protection | Copyrighted professional recipes |
| `FAIR_USE` | Fair use doctrine | News, commentary, education |

### TypeScript Types

```typescript
// Type export from schema
export type RecipeLicense = typeof recipeLicenseEnum.enumValues[number];

// Available in @/lib/db/schema and @/types/index
import type { RecipeLicense } from '@/types';
```

### Migration

**Migration File**: `drizzle/0013_exotic_mulholland_black.sql`

```sql
-- Create enum type
CREATE TYPE "public"."recipe_license" AS ENUM(
  'PUBLIC_DOMAIN', 'CC_BY', 'CC_BY_SA', 'CC_BY_NC',
  'CC_BY_NC_SA', 'EDUCATIONAL_USE', 'PERSONAL_USE',
  'ALL_RIGHTS_RESERVED', 'FAIR_USE'
);

-- Add column with default (backfills existing records)
ALTER TABLE "recipes"
  ADD COLUMN "license" "recipe_license"
  DEFAULT 'ALL_RIGHTS_RESERVED' NOT NULL;

-- Create index for efficient filtering
CREATE INDEX "idx_recipes_license"
  ON "recipes" USING btree ("license");
```

### Backfill Results

- **Total Recipes**: 4,345
- **All Backfilled**: ✅ 100% with `ALL_RIGHTS_RESERVED`
- **Migration Status**: Applied successfully

---

## Usage Examples

### Creating a Recipe with License

```typescript
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

// AI-generated recipe (personal use)
await db.insert(recipes).values({
  name: 'AI-Generated Chocolate Chip Cookies',
  license: 'PERSONAL_USE',
  is_ai_generated: true,
  // ... other fields
});

// User-created recipe (public domain)
await db.insert(recipes).values({
  name: 'Traditional Grandma\'s Recipe',
  license: 'PUBLIC_DOMAIN',
  // ... other fields
});

// Imported recipe (Creative Commons)
await db.insert(recipes).values({
  name: 'Food Blogger\'s Famous Pasta',
  license: 'CC_BY_NC',
  source: 'https://example.com/recipe',
  // ... other fields
});
```

### Querying by License

```typescript
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

// Find all Creative Commons recipes
const ccRecipes = await db
  .select()
  .from(recipes)
  .where(
    inArray(recipes.license, ['CC_BY', 'CC_BY_SA', 'CC_BY_NC', 'CC_BY_NC_SA'])
  );

// Find only recipes safe for commercial use
const commercialRecipes = await db
  .select()
  .from(recipes)
  .where(
    inArray(recipes.license, ['PUBLIC_DOMAIN', 'CC_BY', 'CC_BY_SA'])
  );

// Find recipes requiring attribution
const attributionRequired = await db
  .select()
  .from(recipes)
  .where(
    inArray(recipes.license, ['CC_BY', 'CC_BY_SA', 'CC_BY_NC', 'CC_BY_NC_SA'])
  );
```

### Filtering in UI Components

```typescript
import type { RecipeLicense } from '@/types';

interface RecipeFilters {
  license?: RecipeLicense[];
  commercialUse?: boolean;
}

function filterRecipes(filters: RecipeFilters) {
  const commercialLicenses: RecipeLicense[] = [
    'PUBLIC_DOMAIN',
    'CC_BY',
    'CC_BY_SA'
  ];

  // Filter by commercial use
  if (filters.commercialUse) {
    return recipes.filter(r =>
      commercialLicenses.includes(r.license)
    );
  }

  // Filter by specific licenses
  if (filters.license?.length) {
    return recipes.filter(r =>
      filters.license!.includes(r.license)
    );
  }

  return recipes;
}
```

---

## Best Practices

### 1. Default License Selection

**AI-Generated Recipes**:
- Use `PERSONAL_USE` for user-generated AI recipes
- Use `ALL_RIGHTS_RESERVED` if AI model's terms are unclear

**Imported Recipes**:
- Use `ALL_RIGHTS_RESERVED` as safe default
- Check source website for actual license
- Update license if source provides clear terms

**User-Created Recipes**:
- Let users choose during creation
- Default to `PERSONAL_USE` or `ALL_RIGHTS_RESERVED`
- Provide license explanations in UI

### 2. License Attribution

When displaying recipes, show attribution based on license:

```typescript
function getAttributionText(recipe: Recipe): string | null {
  const ccLicenses = ['CC_BY', 'CC_BY_SA', 'CC_BY_NC', 'CC_BY_NC_SA'];

  if (ccLicenses.includes(recipe.license)) {
    return `Licensed under ${recipe.license}. Attribution required.`;
  }

  if (recipe.license === 'PUBLIC_DOMAIN') {
    return 'This recipe is in the public domain.';
  }

  if (recipe.license === 'ALL_RIGHTS_RESERVED') {
    return 'All rights reserved. Used with permission.';
  }

  return null;
}
```

### 3. Commercial Use Checks

```typescript
function canUseCommercially(license: RecipeLicense): boolean {
  const commercialLicenses: RecipeLicense[] = [
    'PUBLIC_DOMAIN',
    'CC_BY',
    'CC_BY_SA'
  ];

  return commercialLicenses.includes(license);
}

function requiresAttribution(license: RecipeLicense): boolean {
  return license.startsWith('CC_BY');
}
```

### 4. License Migration for Imports

When importing recipes from external sources:

```typescript
async function importRecipe(url: string) {
  const recipeData = await fetchRecipeFromUrl(url);

  // Detect license from source
  const detectedLicense = detectLicenseFromSource(url, recipeData);

  // Safe default if detection fails
  const license = detectedLicense || 'ALL_RIGHTS_RESERVED';

  await db.insert(recipes).values({
    ...recipeData,
    license,
    source: url,
  });
}
```

---

## Future Enhancements

### Phase 1: UI Integration
- [ ] Add license selector to recipe creation form
- [ ] Display license badges on recipe cards
- [ ] Add license filter to recipe search
- [ ] Show attribution text for CC licenses

### Phase 2: License Detection
- [ ] Auto-detect license from recipe URLs
- [ ] Parse Creative Commons metadata
- [ ] Validate license claims from sources

### Phase 3: Compliance Tools
- [ ] License compatibility checker (for recipe combinations)
- [ ] Bulk license updater for admin
- [ ] Export recipes with license information
- [ ] Generate attribution text for recipe exports

### Phase 4: Legal Features
- [ ] License change history tracking
- [ ] User license preferences
- [ ] Recipe licensing API
- [ ] Automated DMCA compliance workflow

---

## Migration Notes

### Rollback (if needed)

```sql
-- Remove index
DROP INDEX IF EXISTS "idx_recipes_license";

-- Remove column
ALTER TABLE "recipes" DROP COLUMN IF EXISTS "license";

-- Remove enum type
DROP TYPE IF EXISTS "public"."recipe_license";
```

### Future License Additions

To add new license types, create a new migration:

```sql
-- Add new license type to enum
ALTER TYPE "public"."recipe_license"
  ADD VALUE IF NOT EXISTS 'NEW_LICENSE_TYPE';
```

---

## Testing Checklist

- [x] Schema changes applied successfully
- [x] Existing recipes backfilled with default license
- [x] TypeScript types exported correctly
- [x] Index created for efficient filtering
- [ ] Recipe creation with license works
- [ ] Recipe filtering by license works
- [ ] License display in UI
- [ ] License validation in forms

---

## Related Files

### Schema
- `src/lib/db/schema.ts` - License enum and column definition
- `drizzle/0013_exotic_mulholland_black.sql` - Migration file

### Types
- `src/types/index.ts` - Type exports

### Future Implementation
- `src/components/recipe/LicenseSelector.tsx` - License picker component
- `src/components/recipe/LicenseBadge.tsx` - License display badge
- `src/lib/utils/license-utils.ts` - License utility functions

---

## References

### Creative Commons Licenses
- [Creative Commons Official Site](https://creativecommons.org/)
- [CC License Chooser](https://chooser-beta.creativecommons.org/)
- [CC License Compatibility](https://wiki.creativecommons.org/wiki/Wiki/cc_license_compatibility)

### Copyright Law
- [U.S. Copyright Law - Fair Use](https://www.copyright.gov/fair-use/)
- [Public Domain in the United States](https://www.copyright.gov/help/faq/faq-definitions.html)

### Recipe Copyright
- [Can You Copyright a Recipe?](https://www.copyright.gov/help/faq/faq-protect.html)
- [Recipe Copyright Guide](https://www.nolo.com/legal-encyclopedia/copyright-recipes-30165.html)

---

**Implementation Complete**: ✅
**Database Updated**: ✅
**Backfill Verified**: ✅ (4,345 recipes)
**Ready for UI Integration**: ✅
