# Recipe Sources Management

Guide for managing recipe sources in the Recipe Manager application.

## Overview

The Recipe Sources Ontology provides a 2-level hierarchical system for tracking where recipes and chef profiles originate:

1. **Level 1: Source** - The primary origin (e.g., Serious Eats, TheMealDB, User Generated)
2. **Level 2: Source Type** - The acquisition method (e.g., API, Web Scrape, Manual Entry)

## Quick Start

```bash
# Seed initial sources (idempotent - safe to run multiple times)
pnpm db:seed:sources

# Verify sources in database
pnpm db:verify:sources
```

## Commands

### `pnpm db:seed:sources`
Seeds the database with initial recipe sources and source types.

**Features**:
- Idempotent (safe to run multiple times)
- Updates existing sources without duplicating
- Seeds 13 sources and 13+ source types

**Sources Seeded**:
- Serious Eats
- TheMealDB
- Open Recipe Database
- Epicurious
- User Generated
- AI Generated
- Kenji López-Alt
- Nancy Silverton
- Lidia Bastianich
- AllRecipes
- Food Network
- Bon Appétit
- NYT Cooking

### `pnpm db:verify:sources`
Verifies that recipe sources are correctly seeded in the database.

**Output**:
- Total count of sources
- List of all sources with slugs
- Source type hierarchy

## Database Schema

### `recipe_sources` Table
```typescript
{
  id: uuid (primary key)
  name: text (unique)          // "Serious Eats"
  slug: text (unique)          // "serious-eats"
  website_url: text (optional) // "https://www.seriouseats.com"
  logo_url: text (optional)    // Logo URL for UI
  description: text (optional) // Source description
  is_active: boolean           // Can disable sources
  created_at: timestamp
  updated_at: timestamp
}
```

### `recipe_source_types` Table
```typescript
{
  id: uuid (primary key)
  source_id: uuid (foreign key → recipe_sources.id)
  name: text                   // "Web Scrape", "API", etc.
  description: text (optional)
  created_at: timestamp
}
```

### Foreign Keys

#### `recipes.source_id`
Links recipes to their source of origin.
- Nullable (backward compatible)
- SET NULL on source delete

#### `chefs.source_id`
Links chef profiles to their source of origin.
- Nullable (backward compatible)
- SET NULL on source delete

## Usage Examples

### Query Recipes by Source

```typescript
import { db } from '@/lib/db';
import { recipes, recipeSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Get all recipes from Serious Eats
const seriousEatsSource = await db
  .select()
  .from(recipeSources)
  .where(eq(recipeSources.slug, 'serious-eats'))
  .limit(1);

const seriousEatsRecipes = await db
  .select()
  .from(recipes)
  .where(eq(recipes.source_id, seriousEatsSource[0].id));
```

### Assign Source to Imported Recipe

```typescript
// When importing from TheMealDB
const themealdbSource = await db
  .select()
  .from(recipeSources)
  .where(eq(recipeSources.slug, 'themealdb'))
  .limit(1);

await db.insert(recipes).values({
  user_id: 'system',
  source_id: themealdbSource[0].id,
  name: 'Pad Thai',
  // ... other fields
});
```

### Get Source Types for a Source

```typescript
import { recipeSourceTypes } from '@/lib/db/schema';

const sourceTypes = await db
  .select()
  .from(recipeSourceTypes)
  .where(eq(recipeSourceTypes.source_id, sourceId));
```

## Migration Guide

### Update Existing Recipes

```typescript
// Update all AI-generated recipes
const aiSource = await db
  .select()
  .from(recipeSources)
  .where(eq(recipeSources.slug, 'ai-generated'))
  .limit(1);

await db
  .update(recipes)
  .set({ source_id: aiSource[0].id })
  .where(eq(recipes.is_ai_generated, true));
```

### Update Existing Chefs

```typescript
// Update Kenji López-Alt chef profile
const kenjiSource = await db
  .select()
  .from(recipeSources)
  .where(eq(recipeSources.slug, 'kenji-lopez-alt'))
  .limit(1);

await db
  .update(chefs)
  .set({ source_id: kenjiSource[0].id })
  .where(eq(chefs.slug, 'kenji-lopez-alt'));
```

## Adding New Sources

To add a new recipe source, edit `scripts/seed-recipe-sources.ts`:

```typescript
const RECIPE_SOURCES: SourceData[] = [
  // ... existing sources
  {
    name: 'New Source Name',
    slug: 'new-source-slug',
    website_url: 'https://example.com',
    description: 'Description of the source',
    is_active: true,
    types: [
      {
        name: 'API',
        description: 'Imported via API',
      },
      {
        name: 'Web Scrape',
        description: 'Scraped from website',
      },
    ],
  },
];
```

Then run:
```bash
pnpm db:seed:sources
```

## Source Types Reference

### Common Source Types

| Type | Description | Use Case |
|------|-------------|----------|
| **API** | Imported via official API | TheMealDB, Open Recipe DB |
| **Web Scrape** | Scraped from website | Serious Eats, Epicurious |
| **Manual Entry** | User-created recipes | User Generated |
| **Recipe Import** | User imported from URL | User Generated |
| **Chef Profile** | Chef-attributed recipes | Kenji, Nancy, Lidia |
| **OpenRouter API** | AI-generated via OpenRouter | AI Generated |
| **Direct LLM** | Direct LLM API calls | AI Generated |

## Active Sources

### Website Sources
- **Serious Eats** - Culinary science and technique
- **TheMealDB** - Free open-source recipe database
- **Open Recipe Database** - Academic recipe dataset
- **Epicurious** - Classic Bon Appétit and Gourmet recipes
- **AllRecipes** - Community recipe platform
- **Food Network** - Celebrity chef recipes
- **Bon Appétit** - Modern Test Kitchen recipes
- **NYT Cooking** - New York Times recipes

### Platform Sources
- **User Generated** - User-created recipes
- **AI Generated** - AI-generated recipes (GPT, Claude, Gemini)

### Chef Sources
- **Kenji López-Alt** - Culinary scientist, The Food Lab
- **Nancy Silverton** - Artisan bread and Italian cuisine
- **Lidia Bastianich** - Authentic Italian cuisine

## TypeScript Types

```typescript
// Available from src/lib/db/schema.ts
import type {
  RecipeSource,
  NewRecipeSource,
  RecipeSourceType,
  NewRecipeSourceType,
} from '@/lib/db/schema';

// Zod schemas for validation
import {
  insertRecipeSourceSchema,
  selectRecipeSourceSchema,
  insertRecipeSourceTypeSchema,
  selectRecipeSourceTypeSchema,
} from '@/lib/db/schema';
```

## Troubleshooting

### Sources Not Showing Up
```bash
# Verify database connection
pnpm db:studio

# Re-run seed script
pnpm db:seed:sources

# Verify sources
pnpm db:verify:sources
```

### Duplicate Sources
The seed script is idempotent and will update existing sources by slug:
- If slug exists: updates source metadata
- If slug doesn't exist: creates new source

### Migration Issues
```bash
# Generate new migration
pnpm db:generate

# Push to database
pnpm db:push

# Re-seed sources
pnpm db:seed:sources
```

## Related Documentation

- **Implementation Details**: `/docs/implementations/RECIPE_SOURCES_ONTOLOGY.md`
- **Database Schema**: `/src/lib/db/schema.ts`
- **Chef Schema**: `/src/lib/db/chef-schema.ts`
- **Import Scripts**: `/scripts/README-IMPORTS.md`

## Future Enhancements

- [ ] Source attribution badges on recipe cards
- [ ] Filter recipes by source in UI
- [ ] Source management admin UI
- [ ] Source statistics dashboard
- [ ] API rate limit configuration per source
- [ ] Source health monitoring

---

**Last Updated**: 2025-10-19
**Version**: 1.0.0
