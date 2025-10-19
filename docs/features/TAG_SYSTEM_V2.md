# Tag System V2: ID-Based Hierarchical Tags with Localization

**Version**: 2.0.0
**Status**: 🚧 In Development
**Author**: Recipe Manager Team
**Last Updated**: 2025-10-18

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tag Categories](#tag-categories)
4. [Usage Examples](#usage-examples)
5. [Migration Guide](#migration-guide)
6. [API Reference](#api-reference)
7. [Best Practices](#best-practices)

---

## Overview

### What's New in V2?

The new tag system replaces simple string tags with a structured, hierarchical ID-based system that supports:

- **Hierarchical Organization**: Tags organized into 11 categories with 2-level hierarchies
- **Multi-Language Support**: Built-in localization (English, Spanish, French)
- **Type Safety**: TypeScript enums and constants for autocomplete and validation
- **Backward Compatibility**: Seamless migration from old string tags
- **Difficulty as Tags**: User-requested change from separate field to tag category

### Old vs New Format

```typescript
// OLD FORMAT (V1)
tags: ["italian", "easy", "pasta", "quick"]

// NEW FORMAT (V2)
tags: [
  "cuisine.italian",
  "difficulty.beginner",
  "mainIngredient.grain.pasta",
  "planning.quick"
]
```

### Key Benefits

1. **Consistency**: Standardized tag IDs prevent duplicates ("italian" vs "Italian" vs "italy")
2. **Organization**: Clear categorization for filtering and search
3. **Localization**: Same tag displays in multiple languages
4. **Hierarchy**: Related tags grouped (Italian → Sicilian, Vegetarian → Vegan)
5. **Type Safety**: Autocomplete and compile-time validation

---

## Architecture

### File Structure

```
src/lib/tags/
├── tag-ids.ts              # Tag ID constants and enums
├── tag-hierarchy.ts        # Hierarchical relationships and metadata
├── tag-localization.ts     # Multi-language labels and descriptions
├── tag-migration.ts        # Backward compatibility utilities
├── semantic-tags.ts        # Legacy system (deprecated)
└── index.ts                # Main export
```

### Tag ID Format

```typescript
// Format: category.subcategory?.item
"cuisine.italian"              // 2-level (category.item)
"cuisine.italian.sicilian"     // 3-level (category.parent.child)
"difficulty.beginner"          // 2-level (flat category)
```

### Type System

```typescript
// Tag ID type
type TagId = string;

// Category enum
enum TagCategory {
  Cuisine = 'cuisine',
  MealType = 'mealType',
  Course = 'course',
  DishType = 'dishType',
  Dietary = 'dietary',
  CookingMethod = 'cookingMethod',
  MainIngredient = 'mainIngredient',
  Season = 'season',
  Planning = 'planning',
  Difficulty = 'difficulty',
  Characteristics = 'characteristics',
  Other = 'other',
}

// Type-safe tag constants
const TAG_IDS = {
  CUISINE: {
    ITALIAN: 'cuisine.italian' as const,
    SICILIAN: 'cuisine.italian.sicilian' as const,
    // ...
  },
  DIFFICULTY: {
    BEGINNER: 'difficulty.beginner' as const,
    INTERMEDIATE: 'difficulty.intermediate' as const,
    ADVANCED: 'difficulty.advanced' as const,
    EXPERT: 'difficulty.expert' as const,
  },
  // ...
};
```

---

## Tag Categories

### 1. Difficulty (Required)

**Hierarchy**: Flat
**Tags**: beginner, intermediate, advanced, expert

```typescript
TAG_IDS.DIFFICULTY.BEGINNER      // "difficulty.beginner"
TAG_IDS.DIFFICULTY.INTERMEDIATE  // "difficulty.intermediate"
TAG_IDS.DIFFICULTY.ADVANCED      // "difficulty.advanced"
TAG_IDS.DIFFICULTY.EXPERT        // "difficulty.expert"
```

**Note**: Difficulty is now a tag category (user requested), not a separate field. Recipes can have one difficulty tag.

### 2. Cuisine (2-Level Hierarchy)

**Examples**:
- Italian → Sicilian, Tuscan, Neapolitan, Roman
- Mexican → Tex-Mex, Yucatan
- Chinese → Cantonese, Szechuan, Hunan
- French → Provençal
- American → Southern, Cajun

```typescript
TAG_IDS.CUISINE.ITALIAN          // "cuisine.italian"
TAG_IDS.CUISINE.SICILIAN         // "cuisine.italian.sicilian"
TAG_IDS.CUISINE.MEXICAN          // "cuisine.mexican"
TAG_IDS.CUISINE.TEX_MEX          // "cuisine.mexican.texMex"
```

### 3. Meal Type (Flat)

**Tags**: breakfast, brunch, lunch, dinner, snack, dessert, appetizer, beverage

```typescript
TAG_IDS.MEAL_TYPE.BREAKFAST      // "mealType.breakfast"
TAG_IDS.MEAL_TYPE.DINNER         // "mealType.dinner"
TAG_IDS.MEAL_TYPE.DESSERT        // "mealType.dessert"
```

### 4. Course (Flat)

**Tags**: appetizer, soup, salad, main, side, dessert, beverage

```typescript
TAG_IDS.COURSE.APPETIZER         // "course.appetizer"
TAG_IDS.COURSE.MAIN              // "course.main"
TAG_IDS.COURSE.DESSERT           // "course.dessert"
```

### 5. Dish Type (Flat - NEW)

**Tags**: soup, stew, salad, sandwich, wrap, pizza, pasta, casserole, stir-fry, curry, bowl, taco, burger, smoothie

```typescript
TAG_IDS.DISH_TYPE.SOUP           // "dishType.soup"
TAG_IDS.DISH_TYPE.PIZZA          // "dishType.pizza"
TAG_IDS.DISH_TYPE.STIR_FRY       // "dishType.stirFry"
```

### 6. Dietary (2-Level Hierarchy)

**Examples**:
- Vegetarian → Vegan
- Low-Carb → Keto

```typescript
TAG_IDS.DIETARY.VEGETARIAN       // "dietary.vegetarian"
TAG_IDS.DIETARY.VEGAN            // "dietary.vegetarian.vegan"
TAG_IDS.DIETARY.LOW_CARB         // "dietary.lowCarb"
TAG_IDS.DIETARY.KETO             // "dietary.lowCarb.keto"
TAG_IDS.DIETARY.GLUTEN_FREE      // "dietary.glutenFree"
```

### 7. Cooking Method (2-Level Hierarchy)

**Examples**:
- Dry Heat → Baking, Roasting, Grilling, Broiling, Searing
- Moist Heat → Boiling, Steaming, Poaching, Simmering, Braising, Stewing
- Fat-Based → Frying, Deep Frying, Pan Frying, Sautéing, Stir-Frying

```typescript
TAG_IDS.COOKING_METHOD.BAKING           // "cookingMethod.dryHeat.baking"
TAG_IDS.COOKING_METHOD.STEAMING         // "cookingMethod.moistHeat.steaming"
TAG_IDS.COOKING_METHOD.STIR_FRYING      // "cookingMethod.fatBased.stirFrying"
TAG_IDS.COOKING_METHOD.SLOW_COOKER      // "cookingMethod.slowCooker"
TAG_IDS.COOKING_METHOD.AIR_FRYER        // "cookingMethod.airFryer"
```

### 8. Main Ingredient (2-Level Hierarchy)

**Examples**:
- Protein → Chicken, Beef, Pork, Seafood, Fish, Tofu
- Grain → Rice, Pasta, Noodles, Quinoa, Bread
- Legume → Beans, Lentils, Chickpeas
- Vegetable → Potatoes, Mushrooms, Tomatoes, Peppers
- Dairy → Cheese, Yogurt, Milk
- Fruit → Berries, Citrus, Apples

```typescript
TAG_IDS.MAIN_INGREDIENT.CHICKEN         // "mainIngredient.protein.chicken"
TAG_IDS.MAIN_INGREDIENT.PASTA           // "mainIngredient.grain.pasta"
TAG_IDS.MAIN_INGREDIENT.BEANS           // "mainIngredient.legume.beans"
TAG_IDS.MAIN_INGREDIENT.POTATOES        // "mainIngredient.vegetable.potatoes"
```

### 9. Season (Flat with Holiday Sub-Tags)

**Tags**: spring, summer, fall, winter, year-round
**Holidays**: thanksgiving, christmas, easter, halloween, new-year, valentines, fourth-july

```typescript
TAG_IDS.SEASON.SUMMER                   // "season.summer"
TAG_IDS.SEASON.THANKSGIVING             // "season.holiday.thanksgiving"
TAG_IDS.SEASON.CHRISTMAS                // "season.holiday.christmas"
```

### 10. Planning (NEW - Flat)

**Tags**: quick, make-ahead, freezer-friendly, meal-prep, leftover-friendly, one-pot, one-pan, sheet-pan, slow-cooker-friendly, overnight, batch-cooking

```typescript
TAG_IDS.PLANNING.QUICK                  // "planning.quick"
TAG_IDS.PLANNING.MAKE_AHEAD             // "planning.makeAhead"
TAG_IDS.PLANNING.MEAL_PREP              // "planning.mealPrep"
TAG_IDS.PLANNING.ONE_POT                // "planning.onePot"
```

### 11. Characteristics (NEW - Flat)

**Tags**: comfort-food, kid-friendly, crowd-pleaser, budget-friendly, healthy, light, hearty, spicy, mild, sweet, savory, tangy, crispy, creamy, fresh, gourmet, rustic, elegant, party-food, picnic

```typescript
TAG_IDS.CHARACTERISTICS.COMFORT_FOOD    // "characteristics.comfortFood"
TAG_IDS.CHARACTERISTICS.KID_FRIENDLY    // "characteristics.kidFriendly"
TAG_IDS.CHARACTERISTICS.HEALTHY         // "characteristics.healthy"
TAG_IDS.CHARACTERISTICS.SPICY           // "characteristics.spicy"
```

---

## Usage Examples

### Basic Usage

```typescript
import { TAG_IDS, getTagLabel } from '@/lib/tags';

// Create a recipe with new tags
const recipe = {
  name: "Spaghetti Carbonara",
  tags: [
    TAG_IDS.CUISINE.ITALIAN,
    TAG_IDS.DIFFICULTY.INTERMEDIATE,
    TAG_IDS.MEAL_TYPE.DINNER,
    TAG_IDS.MAIN_INGREDIENT.PASTA,
    TAG_IDS.PLANNING.QUICK,
  ],
};

// Get localized labels for display
recipe.tags.forEach(tagId => {
  console.log(getTagLabel(tagId, 'en')); // "Italian", "Intermediate", etc.
});
```

### Migration from Old Tags

```typescript
import { normalizeTagToId, normalizeTags } from '@/lib/tags';

// Single tag migration
const oldTag = "italian";
const newTag = normalizeTagToId(oldTag); // "cuisine.italian"

// Batch migration
const oldTags = ["italian", "easy", "pasta", "quick"];
const newTags = normalizeTags(oldTags);
// ["cuisine.italian", "difficulty.beginner", "mainIngredient.grain.pasta", "planning.quick"]
```

### Hierarchical Queries

```typescript
import { getChildTags, getParentTag, getAncestors } from '@/lib/tags';

// Get child tags
const children = getChildTags(TAG_IDS.CUISINE.ITALIAN);
// [Sicilian, Tuscan, Neapolitan, Roman]

// Get parent tag
const parent = getParentTag(TAG_IDS.CUISINE.SICILIAN);
// Italian

// Get all ancestors
const ancestors = getAncestors(TAG_IDS.CUISINE.SICILIAN);
// [Italian]
```

### Filtering by Category

```typescript
import { getCategoryFromTagId, getTagIdsByCategory, TagCategory } from '@/lib/tags';

// Get category from tag ID
const category = getCategoryFromTagId(TAG_IDS.CUISINE.ITALIAN);
// TagCategory.Cuisine

// Get all tags in a category
const cuisineTags = getTagIdsByCategory(TagCategory.Cuisine);
// ["cuisine.italian", "cuisine.mexican", "cuisine.chinese", ...]
```

### Related Tags for Suggestions

```typescript
import { getRelatedTagNodes } from '@/lib/tags';

// Get related tags for suggestions
const related = getRelatedTagNodes(TAG_IDS.CUISINE.ITALIAN);
// [pasta, mediterranean, pizza]

// Use for "Users who tagged Italian also tagged..." feature
```

---

## Migration Guide

### Database Migration Script

```typescript
import { batchMigrateTags, MigrationStrategy } from '@/lib/tags';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

async function migrateRecipeTags() {
  // Fetch all recipes
  const allRecipes = await db.select().from(recipes);

  // Migrate tags to new format
  const migratedRecipes = batchMigrateTags(allRecipes, {
    strategy: MigrationStrategy.NEW_ONLY,
    verbose: true,
  });

  // Update database
  for (const recipe of migratedRecipes) {
    await db.update(recipes)
      .set({ tags: recipe.tags })
      .where(eq(recipes.id, recipe.id));
  }

  console.log(`Migrated ${migratedRecipes.length} recipes`);
}
```

### Migration Report

```typescript
import { generateMigrationReport, printMigrationReport } from '@/lib/tags';

const oldTags = ["italian", "easy", "pasta", "unknown-tag"];
const report = generateMigrationReport(oldTags);
printMigrationReport(report);

// Output:
// === Tag Migration Report ===
// Total tags: 4
// Successfully mapped: 3 (75.0%)
// Already new format: 0 (0.0%)
// Unmapped (fallback to other.*): 1 (25.0%)
//
// Unmapped tags:
//   - unknown-tag
//
// Sample mappings:
//   italian → cuisine.italian
//   easy → difficulty.beginner
//   pasta → mainIngredient.grain.pasta
//   unknown-tag → other.unknown-tag
```

### Dual-Mode Support (Transition Period)

```typescript
import { migrateTags, MigrationStrategy } from '@/lib/tags';

// During transition, support both old and new tags
const tags = migrateTags(oldTags, {
  strategy: MigrationStrategy.DUAL,
  verbose: true,
});

// Returns both formats:
// ["cuisine.italian", "italian", "difficulty.beginner", "easy", ...]
```

---

## API Reference

### Tag IDs

```typescript
// Get tag by constant
TAG_IDS.CUISINE.ITALIAN;
TAG_IDS.DIFFICULTY.BEGINNER;

// Extract category from tag ID
getCategoryFromTagId(tagId: TagId): TagCategory;

// Check if tag is hierarchical
isHierarchicalTag(tagId: TagId): boolean;

// Get parent tag ID
getParentTagId(tagId: TagId): TagId | null;

// Get all tags for a category
getTagIdsByCategory(category: TagCategory): TagId[];

// Validate tag ID
isKnownTagId(tagId: string): tagId is KnownTagId;
```

### Hierarchy

```typescript
// Get tag node (metadata)
getTagNode(tagId: TagId): TagNode | null;

// Get children
getChildTags(tagId: TagId): TagNode[];

// Get parent
getParentTag(tagId: TagId): TagNode | null;

// Get related tags
getRelatedTagNodes(tagId: TagId): TagNode[];

// Get synonyms for backward compatibility
getTagSynonyms(tagId: TagId): string[];

// Find tag ID by old synonym
findTagIdBySynonym(synonym: string): TagId | null;

// Check if tag has children
isParentTag(tagId: TagId): boolean;

// Check if tag is a child
isChildTag(tagId: TagId): boolean;

// Get all ancestors
getAncestors(tagId: TagId): TagNode[];

// Get all descendants
getDescendants(tagId: TagId): TagNode[];
```

### Localization

```typescript
// Get localized label
getTagLabel(tagId: TagId, locale?: Locale): string;

// Get localized description
getTagDescription(tagId: TagId, locale?: Locale): string | undefined;

// Check if tag has label
hasTagLabel(tagId: TagId): boolean;

// Get available locales
getAvailableLocales(): Locale[];

// Get current locale
getCurrentLocale(): Locale;
```

### Migration

```typescript
// Normalize single tag
normalizeTagToId(tag: string): TagId;

// Normalize array of tags
normalizeTags(tags: string[]): TagId[];

// Convert tag ID to legacy format
tagIdToLegacy(tagId: TagId): string;

// Convert array to legacy
tagIdsToLegacy(tagIds: TagId[]): string[];

// Check tag format
isNewFormat(tag: string): boolean;

// Migrate tags with strategy
migrateTags(tags: string[], config: MigrationConfig): string[];

// Batch migrate database records
batchMigrateTags<T>(records: T[], config: MigrationConfig): T[];

// Generate migration report
generateMigrationReport(tags: string[]): MigrationReport;

// Print report to console
printMigrationReport(report: MigrationReport): void;

// Deduplicate tags
deduplicateTags(tags: string[]): string[];

// Validate tag IDs
validateTagIds(tags: TagId[]): { valid: TagId[]; invalid: TagId[]; warnings: string[] };
```

---

## Best Practices

### 1. Use Type-Safe Constants

```typescript
// ✅ GOOD - Type-safe, autocomplete
const tags = [TAG_IDS.CUISINE.ITALIAN, TAG_IDS.DIFFICULTY.BEGINNER];

// ❌ BAD - No autocomplete, prone to typos
const tags = ["cuisine.italian", "difficulty.beginner"];
```

### 2. Tag Count Limits

Based on research, optimal tag count is **2-5 tags per recipe**, with a maximum of **8 tags**.

```typescript
const MAX_TAGS = 8;
const OPTIMAL_TAGS = { min: 2, max: 5 };

function validateTagCount(tags: TagId[]): boolean {
  if (tags.length < OPTIMAL_TAGS.min) {
    console.warn('Recipes with fewer than 2 tags are less discoverable');
  }
  if (tags.length > MAX_TAGS) {
    throw new Error('Maximum 8 tags allowed');
  }
  return tags.length <= MAX_TAGS;
}
```

### 3. Difficulty Tag is Required

```typescript
function validateRecipeTags(tags: TagId[]): boolean {
  const hasDifficulty = tags.some(tag =>
    tag.startsWith('difficulty.')
  );

  if (!hasDifficulty) {
    throw new Error('Recipes must have a difficulty tag');
  }

  return true;
}
```

### 4. Localization

```typescript
// Always use getTagLabel for display
import { getTagLabel, getCurrentLocale } from '@/lib/tags';

const locale = getCurrentLocale(); // or from user preferences

tags.forEach(tagId => {
  const displayLabel = getTagLabel(tagId, locale);
  // Use displayLabel in UI
});
```

### 5. Migration

```typescript
// For new recipes: Use new format only
import { TAG_IDS } from '@/lib/tags';

const newRecipe = {
  tags: [TAG_IDS.CUISINE.ITALIAN, TAG_IDS.DIFFICULTY.BEGINNER],
};

// For existing recipes: Migrate on read
import { normalizeTags } from '@/lib/tags';

const recipe = await getRecipe(id);
recipe.tags = normalizeTags(JSON.parse(recipe.tags));
```

---

## Roadmap

### Phase 1: Implementation (Current)
- ✅ Tag ID system
- ✅ Hierarchical relationships
- ✅ Localization structure (English)
- ✅ Migration utilities
- 🚧 Component updates
- 🚧 Database migration script

### Phase 2: Rollout
- 🔜 Update RecipeForm to use new tags
- 🔜 Update tag display components
- 🔜 Migrate existing recipes
- 🔜 Update search/filter logic

### Phase 3: Enhancements
- 🔜 Spanish translations
- 🔜 French translations
- 🔜 Tag analytics
- 🔜 Related tag suggestions
- 🔜 Popular tag badges

---

## Support

For questions or issues with the new tag system:

1. Review this documentation
2. Check examples in `src/lib/tags/`
3. Run migration report to identify issues
4. File a GitHub issue with [Tag System V2] prefix

---

**Last Updated**: 2025-10-18
**Version**: 2.0.0
