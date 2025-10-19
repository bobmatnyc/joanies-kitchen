# Meal Pairing Schema Additions - v0.65.0

## Overview

Added meal pairing metadata fields to the `recipes` table to support sophisticated multi-course meal planning based on the reference implementation in `src/lib/ai/meal-pairing-system.ts`.

## Changes Made

### 1. New Database Columns Added to `recipes` Table

All fields are **nullable** (backward compatible with existing recipes):

| Field Name | Type | Description | Example Values |
|------------|------|-------------|----------------|
| `weight_score` | `integer` | Dish heaviness on 1-5 scale | 1=light salad, 5=heavy stew |
| `richness_score` | `integer` | Fat/oil content on 1-5 scale | 1=lean, 5=rich/fatty |
| `acidity_score` | `integer` | Acidic components on 1-5 scale | 1=neutral, 5=very acidic |
| `sweetness_level` | `text` (enum) | Sweetness classification | 'light', 'moderate', 'rich' |
| `dominant_textures` | `text` (JSON) | Array of texture descriptors | ["crispy", "creamy", "crunchy"] |
| `dominant_flavors` | `text` (JSON) | Array of flavor profiles | ["umami", "sweet", "salty"] |
| `serving_temperature` | `text` (enum) | Serving temperature | 'hot', 'cold', 'room' |
| `pairing_rationale` | `text` | Explanation of pairing compatibility | "Light acidity balances rich main" |

### 2. Performance Indexes Added

**Composite Index for Pairing Queries:**
```sql
CREATE INDEX idx_recipes_pairing_metadata
ON recipes (weight_score, richness_score, acidity_score);
```
- Enables efficient filtering for recipes that complement a main dish
- Supports queries like "find light sides (weight_score 1-2) with high acidity (acidity_score 4-5)"

**Temperature Index:**
```sql
CREATE INDEX idx_recipes_serving_temp
ON recipes (serving_temperature);
```
- Supports temperature progression queries (hot → cold → hot → cold)
- Enables finding alternating temperatures for palate variety

### 3. TypeScript Types

The types are automatically inferred from the schema via Drizzle ORM:

```typescript
// All pairing fields are optional (nullable)
type Recipe = {
  // ... existing fields ...
  weight_score?: number | null;
  richness_score?: number | null;
  acidity_score?: number | null;
  sweetness_level?: 'light' | 'moderate' | 'rich' | null;
  dominant_textures?: string | null; // JSON array
  dominant_flavors?: string | null; // JSON array
  serving_temperature?: 'hot' | 'cold' | 'room' | null;
  pairing_rationale?: string | null;
}
```

## Pairing Logic Reference

Based on `src/lib/ai/meal-pairing-system.ts`:

### Weight Matching Rules
- Heavy mains (4-5) → Light sides/apps (1-2)
- Medium mains (3) → Light-medium sides (2-3)
- Light mains (1-2) → Light sides (1-3)

### Acid-Fat Balance
- Rich/fatty dishes REQUIRE acidic components
- Rule: `side_acidity >= main_richness - 1`

### Texture Contrast
- Minimum 6 unique textures per meal
- Never serve consecutive courses with identical texture
- Layer opposites: crispy/creamy, crunchy/soft, flaky/smooth

### Temperature Progression
- Classic pattern: Hot → Cold → Hot → Cold
- Alternation prevents sensory fatigue

### Valid Texture Values
```typescript
const VALID_TEXTURES = [
  'crispy', 'creamy', 'crunchy', 'soft',
  'flaky', 'smooth', 'tender', 'chewy',
  'silky', 'velvety', 'airy', 'dense'
];
```

### Valid Flavor Values
```typescript
const VALID_FLAVORS = [
  'umami', 'sweet', 'salty', 'bitter',
  'sour', 'spicy', 'savory', 'tangy',
  'earthy', 'smoky', 'herbal', 'citrus'
];
```

## Migration Details

**Generated Migration File:** `drizzle/0011_brainy_mentor.sql`

**Migration Status:** ✅ Generated, NOT YET APPLIED

**Migration Lines (103-110):**
```sql
ALTER TABLE "recipes" ADD COLUMN "weight_score" integer;
ALTER TABLE "recipes" ADD COLUMN "richness_score" integer;
ALTER TABLE "recipes" ADD COLUMN "acidity_score" integer;
ALTER TABLE "recipes" ADD COLUMN "sweetness_level" text;
ALTER TABLE "recipes" ADD COLUMN "dominant_textures" text;
ALTER TABLE "recipes" ADD COLUMN "dominant_flavors" text;
ALTER TABLE "recipes" ADD COLUMN "serving_temperature" text;
ALTER TABLE "recipes" ADD COLUMN "pairing_rationale" text;
```

**Index Creation Lines (144-145):**
```sql
CREATE INDEX "idx_recipes_pairing_metadata"
ON "recipes" USING btree ("weight_score","richness_score","acidity_score");

CREATE INDEX "idx_recipes_serving_temp"
ON "recipes" USING btree ("serving_temperature");
```

## How to Apply Migration

**IMPORTANT: Review migration file before running!**

```bash
# Option 1: Push schema changes (development)
pnpm db:push

# Option 2: Run migration (production)
pnpm db:migrate
```

## Backward Compatibility

✅ **Fully Backward Compatible**
- All new fields are nullable
- Existing recipes continue working without changes
- Queries without pairing metadata still function
- No data loss or migration of existing records

## Query Examples

### Find Light Sides for Rich Main Dish
```typescript
const lightSides = await db.select()
  .from(recipes)
  .where(
    and(
      between(recipes.weight_score, 1, 2),
      gte(recipes.acidity_score, 3),
      eq(recipes.serving_temperature, 'hot')
    )
  );
```

### Find Desserts with Moderate Sweetness
```typescript
const desserts = await db.select()
  .from(recipes)
  .where(
    and(
      eq(recipes.sweetness_level, 'moderate'),
      eq(recipes.serving_temperature, 'cold')
    )
  );
```

### Temperature Progression Query
```typescript
// Get recipes with alternating temperatures
const hotAppetizers = await db.select()
  .from(recipes)
  .where(eq(recipes.serving_temperature, 'hot'));

const coldDesserts = await db.select()
  .from(recipes)
  .where(eq(recipes.serving_temperature, 'cold'));
```

## Integration with Meal Pairing System

The schema now supports the full meal pairing workflow:

1. **AI Analysis**: LLM analyzes recipe and generates pairing metadata
2. **Database Storage**: Metadata stored in nullable fields
3. **Smart Queries**: Composite indexes enable fast pairing queries
4. **Multi-Course Planning**: System finds compatible recipes based on:
   - Weight balance (heavy vs. light)
   - Acid-fat complementarity
   - Texture variety
   - Temperature progression
   - Flavor intensity matching

## Next Steps

1. ✅ Schema updated in `src/lib/db/schema.ts`
2. ✅ Migration generated in `drizzle/0011_brainy_mentor.sql`
3. ⏳ Review migration file (lines 103-110, 144-145)
4. ⏳ Apply migration: `pnpm db:push` or `pnpm db:migrate`
5. ⏳ Implement AI metadata generation logic
6. ⏳ Build pairing query functions
7. ⏳ Create UI for multi-course meal planning

## References

- **Pairing Logic**: `src/lib/ai/meal-pairing-system.ts`
- **Schema Definition**: `src/lib/db/schema.ts` (lines 113-121)
- **Migration File**: `drizzle/0011_brainy_mentor.sql`
- **TypeScript Types**: Auto-generated by Drizzle ORM

---

**Generated**: 2025-10-19
**Version**: v0.65.0
**Status**: Schema updated, migration ready to apply
