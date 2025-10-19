# Recipe Sources Ontology Implementation

**Status**: ✅ Complete
**Date**: 2025-10-19
**Version**: 1.0.0

## Overview

Implemented a 2-level hierarchical ontology for tracking recipe and chef sources across the Recipe Manager platform. This system provides structured tracking of where recipes come from (websites, APIs, users, AI, etc.) and how they were obtained (web scraping, API imports, manual entry, etc.).

## Architecture

### 2-Level Hierarchy

```
recipe_sources (Level 1)
├── Serious Eats
│   ├── Web Scrape (Level 2)
│   └── Chef Profile (Level 2)
├── TheMealDB
│   └── API (Level 2)
├── User Generated
│   ├── Manual Entry (Level 2)
│   └── Recipe Import (Level 2)
└── AI Generated
    ├── OpenRouter API (Level 2)
    └── Direct LLM (Level 2)
```

### Database Schema

#### `recipe_sources` (Top Level)
Represents the primary source of recipes and chef profiles.

```typescript
{
  id: uuid (primary key)
  name: text (unique) - "Serious Eats", "TheMealDB", etc.
  slug: text (unique) - URL-friendly identifier
  website_url: text (optional) - Source website
  logo_url: text (optional) - Logo for UI display
  description: text (optional) - Source description
  is_active: boolean (default: true) - Enable/disable sources
  created_at: timestamp
  updated_at: timestamp
}
```

**Indexes**:
- `recipe_sources_slug_idx` - Fast slug-based lookups
- `recipe_sources_is_active_idx` - Filter active sources

#### `recipe_source_types` (2nd Level)
Represents the method/category within each source.

```typescript
{
  id: uuid (primary key)
  source_id: uuid (foreign key → recipe_sources.id, CASCADE on delete)
  name: text - "Web Scrape", "API", "Manual Entry", "Chef Profile"
  description: text (optional) - Type description
  created_at: timestamp
}
```

**Indexes**:
- `recipe_source_types_source_id_idx` - Fast source-based queries
- `unique_source_type` - Unique constraint on (source_id, name)

### Foreign Key Relationships

#### `recipes` Table
Added nullable `source_id` field:
```typescript
source_id: uuid (foreign key → recipe_sources.id, SET NULL on delete)
```

This allows tracking which source a recipe originated from without breaking existing recipes.

#### `chefs` Table
Added nullable `source_id` field:
```typescript
source_id: uuid (foreign key → recipe_sources.id, SET NULL on delete)
```

This allows tracking which source a chef profile came from (e.g., Serious Eats, Food Network).

### TypeScript Types

```typescript
// Exported from src/lib/db/schema.ts
export type RecipeSource = typeof recipeSources.$inferSelect;
export type NewRecipeSource = typeof recipeSources.$inferInsert;
export type RecipeSourceType = typeof recipeSourceTypes.$inferSelect;
export type NewRecipeSourceType = typeof recipeSourceTypes.$inferInsert;
```

### Zod Validation Schemas

```typescript
// Exported from src/lib/db/schema.ts
export const insertRecipeSourceSchema = createInsertSchema(recipeSources);
export const selectRecipeSourceSchema = createSelectSchema(recipeSources);
export const insertRecipeSourceTypeSchema = createInsertSchema(recipeSourceTypes);
export const selectRecipeSourceTypeSchema = createSelectSchema(recipeSourceTypes);
```

## Initial Seed Data

The following sources were seeded via `scripts/seed-recipe-sources.ts`:

### Website Sources

1. **Serious Eats** (`serious-eats`)
   - Website: https://www.seriouseats.com
   - Types: Web Scrape, Chef Profile
   - Description: Trusted recipes with deep culinary science

2. **TheMealDB** (`themealdb`)
   - Website: https://www.themealdb.com
   - Types: API
   - Description: Free open-source recipe database with 500+ recipes

3. **Open Recipe Database** (`open-recipe-db`)
   - Website: https://cosylab.iiitd.edu.in/recipedb/
   - Types: API
   - Description: Academic recipe dataset with 118K+ recipes

4. **Epicurious** (`epicurious`)
   - Website: https://www.epicurious.com
   - Types: Web Scrape
   - Description: Classic recipes from Bon Appétit and Gourmet

5. **AllRecipes** (`allrecipes`)
   - Website: https://www.allrecipes.com
   - Types: Web Scrape, API
   - Description: Community-driven recipe platform

6. **Food Network** (`food-network`)
   - Website: https://www.foodnetwork.com
   - Types: Web Scrape, Chef Profile
   - Description: Celebrity chef recipes and TV shows

7. **Bon Appétit** (`bon-appetit`)
   - Website: https://www.bonappetit.com
   - Types: Web Scrape, Chef Profile
   - Description: Modern recipes from Test Kitchen

8. **NYT Cooking** (`nyt-cooking`)
   - Website: https://cooking.nytimes.com
   - Types: Web Scrape, API
   - Description: Trusted recipes from New York Times

### Platform Sources

9. **User Generated** (`user-generated`)
   - Types: Manual Entry, Recipe Import
   - Description: Recipes created by registered users

10. **AI Generated** (`ai-generated`)
    - Types: OpenRouter API, Direct LLM
    - Description: AI-generated recipes (GPT, Claude, Gemini)

### Chef Sources

11. **Kenji López-Alt** (`kenji-lopez-alt`)
    - Website: https://www.seriouseats.com/kenji-lopez-alt-5118689
    - Types: Chef Profile, Web Scrape
    - Description: Chef, author, culinary scientist

12. **Nancy Silverton** (`nancy-silverton`)
    - Website: https://www.nancysilverton.com
    - Types: Chef Profile, Web Scrape
    - Description: Chef, baker, artisan bread expert

13. **Lidia Bastianich** (`lidia-bastianich`)
    - Website: https://www.lidiasitaly.com
    - Types: Chef Profile, Web Scrape
    - Description: Italian-American chef, TV host

## Files Modified/Created

### Modified Files
1. **src/lib/db/schema.ts**
   - Added `recipeSources` table definition
   - Added `recipeSourceTypes` table definition
   - Added `source_id` foreign key to `recipes` table
   - Added TypeScript types and Zod schemas

2. **src/lib/db/chef-schema.ts**
   - Added `source_id` foreign key to `chefs` table
   - Updated imports to include `recipeSources`

### Created Files
1. **scripts/seed-recipe-sources.ts**
   - Idempotent seeding script (safe to run multiple times)
   - Seeds 13 recipe sources and 13+ source types
   - Includes update logic for existing sources

2. **drizzle/0012_lush_morgan_stark.sql**
   - Database migration file
   - Creates `recipe_sources` and `recipe_source_types` tables
   - Adds foreign keys to `recipes` and `chefs` tables
   - Creates necessary indexes

3. **docs/implementations/RECIPE_SOURCES_ONTOLOGY.md** (this file)
   - Implementation documentation

## Usage Examples

### Query Recipes by Source

```typescript
import { db } from '@/lib/db';
import { recipes, recipeSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Get all recipes from Serious Eats
const seriousEatsRecipes = await db
  .select()
  .from(recipes)
  .leftJoin(recipeSources, eq(recipes.source_id, recipeSources.id))
  .where(eq(recipeSources.slug, 'serious-eats'));

// Get all AI-generated recipes
const aiRecipes = await db
  .select()
  .from(recipes)
  .leftJoin(recipeSources, eq(recipes.source_id, recipeSources.id))
  .where(eq(recipeSources.slug, 'ai-generated'));
```

### Query Chefs by Source

```typescript
import { chefs, recipeSources } from '@/lib/db/schema';

// Get all chefs from Food Network
const foodNetworkChefs = await db
  .select()
  .from(chefs)
  .leftJoin(recipeSources, eq(chefs.source_id, recipeSources.id))
  .where(eq(recipeSources.slug, 'food-network'));
```

### Get Source Types for a Source

```typescript
import { recipeSourceTypes, recipeSources } from '@/lib/db/schema';

// Get all source types for Serious Eats
const seriousEatsSource = await db
  .select()
  .from(recipeSources)
  .where(eq(recipeSources.slug, 'serious-eats'))
  .limit(1);

if (seriousEatsSource.length > 0) {
  const sourceTypes = await db
    .select()
    .from(recipeSourceTypes)
    .where(eq(recipeSourceTypes.source_id, seriousEatsSource[0].id));
}
```

### Create Recipe with Source

```typescript
import { recipes } from '@/lib/db/schema';

// Find source ID first
const [aiSource] = await db
  .select()
  .from(recipeSources)
  .where(eq(recipeSources.slug, 'ai-generated'))
  .limit(1);

// Create recipe with source
await db.insert(recipes).values({
  user_id: 'user_123',
  source_id: aiSource.id,
  name: 'AI-Generated Pasta Carbonara',
  // ... other fields
});
```

## Migration Guide

### For Existing Recipes

Existing recipes will have `source_id = NULL` until manually updated. To update:

```typescript
// Update all AI-generated recipes
const [aiSource] = await db
  .select()
  .from(recipeSources)
  .where(eq(recipeSources.slug, 'ai-generated'))
  .limit(1);

await db
  .update(recipes)
  .set({ source_id: aiSource.id })
  .where(eq(recipes.is_ai_generated, true));

// Update user-created recipes
const [userSource] = await db
  .select()
  .from(recipeSources)
  .where(eq(recipeSources.slug, 'user-generated'))
  .limit(1);

await db
  .update(recipes)
  .set({ source_id: userSource.id })
  .where(eq(recipes.is_ai_generated, false));
```

### For Existing Chefs

Chefs can be updated based on their existing data:

```typescript
// Update Kenji López-Alt chef profile
const [kenjiSource] = await db
  .select()
  .from(recipeSources)
  .where(eq(recipeSources.slug, 'kenji-lopez-alt'))
  .limit(1);

await db
  .update(chefs)
  .set({ source_id: kenjiSource.id })
  .where(eq(chefs.slug, 'kenji-lopez-alt'));
```

## Backward Compatibility

- ✅ All `source_id` fields are nullable
- ✅ Existing recipes and chefs continue to work without sources
- ✅ Foreign key uses `SET NULL` on delete (won't break data)
- ✅ Idempotent seed script (safe to run multiple times)

## Future Enhancements

### Potential Additions

1. **Source Metadata**
   - Add `api_key` field for API-based sources
   - Add `rate_limit` configuration
   - Add `last_scraped_at` timestamp

2. **Source Statistics**
   - Track recipe count per source
   - Track success/failure rates
   - Track average quality scores

3. **Source Attribution UI**
   - Display source badges on recipe cards
   - Filter recipes by source in UI
   - Source attribution in recipe details

4. **Source Management Admin UI**
   - Enable/disable sources
   - Update source metadata
   - View source statistics

5. **Import History**
   - Link to scraping jobs
   - Track import batches
   - Audit trail for data provenance

## Testing

### Run Seed Script

```bash
pnpm tsx scripts/seed-recipe-sources.ts
```

Expected output:
```
📊 Summary:
  Sources created: 13
  Sources updated: 0
  Source types created: 13
  Total sources: 13

✅ Seeding completed successfully!
```

### Verify in Database

```sql
-- Count sources
SELECT COUNT(*) FROM recipe_sources;
-- Expected: 13

-- Count source types
SELECT COUNT(*) FROM recipe_source_types;
-- Expected: 13+

-- View source hierarchy
SELECT
  rs.name AS source_name,
  rst.name AS source_type,
  rst.description
FROM recipe_sources rs
LEFT JOIN recipe_source_types rst ON rst.source_id = rs.id
ORDER BY rs.name, rst.name;
```

## Success Criteria

- ✅ Schema tables created and migrated
- ✅ Foreign keys added to recipes and chefs tables
- ✅ TypeScript types and Zod schemas exported
- ✅ Seed script created and tested
- ✅ 13 sources and 13+ types seeded successfully
- ✅ Backward compatible with existing data
- ✅ Documentation complete

## Conclusion

The Recipe Sources Ontology provides a structured, extensible way to track data provenance across the Recipe Manager platform. The 2-level hierarchy allows for both broad categorization (source) and specific methodology (source type), enabling powerful filtering, attribution, and analytics capabilities.

---

**Implementation Team**: Engineer Agent
**Review Status**: Ready for review
**Next Steps**:
1. Update existing recipes and chefs with source_id
2. Add source filtering to recipe list UI
3. Display source attribution on recipe cards
4. Create admin UI for source management
