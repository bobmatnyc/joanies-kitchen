# Synthetic Collections and Meal Plans Seeding

This document describes the seeding script for populating the database with realistic collections and meal plans created by synthetic users.

## Overview

The `seed-synthetic-collections-meals.ts` script generates demo data to:
- Test the meal pairing system
- Provide realistic examples for UI/UX testing
- Demonstrate collection and meal plan features
- Populate the discover/browse pages with content

## Quick Start

```bash
# Ensure you have recipes in the database first
pnpm tsx scripts/seed-system-recipes.ts

# Run the synthetic data seeding script
pnpm tsx scripts/seed-synthetic-collections-meals.ts
```

## What Gets Created

### Synthetic Users (4 profiles)

1. **Sarah Martinez** (@sarah_homecook)
   - Busy mom focused on quick, healthy weeknight dinners
   - Specialties: Quick Dinners, Meal Prep, Kid-Friendly
   - Collections: Quick Weeknight Dinners, Kids' Favorites, Healthy Meal Prep

2. **Alex Chen** (@alex_foodie)
   - Food enthusiast exploring global cuisines
   - Specialties: Asian, Italian, Mediterranean
   - Collections: Comfort Food Favorites, Asian Fusion, Italian Classics

3. **Emily Rodriguez** (@emily_baker)
   - Passionate baker and dessert lover
   - Specialties: Baking, Desserts, Comfort Food
   - Collections: Special Occasions, Weekend Baking, Comfort Classics

4. **Mike Thompson** (@mike_fitchef)
   - Fitness coach advocating for healthy eating
   - Specialties: Healthy, Protein-Rich, Low-Carb
   - Collections: Healthy High-Protein, Quick Post-Workout Meals, Meal Prep Basics

### Collections (12 themes, 2-3 per user)

Each collection contains 5-10 carefully selected recipes based on:
- **Quick Weeknight Dinners**: Fast recipes under 30 minutes
- **Kids' Favorites**: Kid-approved, family-friendly meals
- **Healthy Meal Prep**: Nutritious batch-cooking recipes
- **Comfort Food Classics**: Hearty, soul-warming dishes
- **Asian Fusion**: Asian-inspired recipes from various cuisines
- **Italian Classics**: Traditional Italian recipes
- **Special Occasions**: Impressive recipes for entertaining
- **Weekend Baking**: Fun baking projects
- **High-Protein Meals**: Protein-rich recipes for fitness
- **Post-Workout Fuel**: Quick, nutritious post-exercise meals
- **Meal Prep Essentials**: Foundational batch-cooking recipes

### Meal Plans (3 templates, 1-2 per user)

1. **Healthy Week Meal Plan**
   - 5-day dinner plan with main + side dishes
   - Balanced nutrition across chicken, fish, vegetarian, beef
   - Serves 4 people

2. **Quick Weeknight Dinners**
   - 5-day plan focused on speed (30 minutes or less)
   - One-pot, sheet-pan, and quick recipes
   - Perfect for busy families

3. **Weekend Brunch Plan**
   - 2-day plan for Saturday and Sunday brunch
   - Includes eggs, pancakes, pastries, fruit
   - Leisurely weekend cooking

## Features

### Intelligent Recipe Matching

The script intelligently matches recipes to collections and meal plans based on:
- **Cuisine types**: Filters by Italian, Asian, Mexican, etc.
- **Tags**: Searches for "quick", "healthy", "comfort food", etc.
- **Difficulty levels**: Easy, medium, or hard
- **Keywords**: Searches recipe names and descriptions

### Idempotent Design

- **Safe to run multiple times**: Won't create duplicates
- **Checks existing data**: Skips users, collections, and meal plans that already exist
- **Graceful failures**: Continues processing even if individual items fail

### Realistic Data Generation

- **Varied collection sizes**: 5-10 recipes per collection
- **Mixed visibility**: Some public collections, some private
- **Diverse meal structures**: Appetizers, mains, sides, desserts
- **Serving multipliers**: Realistic portion adjustments

## Script Architecture

### Main Components

1. **Synthetic User Definitions** (`SYNTHETIC_USERS`)
   - Pre-defined user profiles with personalities
   - Cooking specialties and preferences
   - Collection and meal plan themes

2. **Collection Templates** (`COLLECTION_TEMPLATES`)
   - 12 diverse collection themes
   - Recipe filtering criteria
   - Metadata (descriptions, tags, visibility)

3. **Meal Plan Templates** (`MEAL_PLAN_TEMPLATES`)
   - 3 meal plan structures
   - Day-by-day recipe requirements
   - Course categories (main, side, dessert)

4. **Helper Functions**
   - `ensureUserProfile()`: Create or verify user profiles
   - `findRecipesForCollection()`: Query recipes matching filters
   - `createCollection()`: Create collection with recipes
   - `findRecipeForMeal()`: Find recipe for meal plan slot
   - `createMealPlan()`: Create meal plan with multiple recipes

### Database Operations

The script performs the following database operations:

1. **User Profile Creation**
   ```typescript
   INSERT INTO user_profiles (user_id, username, display_name, bio, specialties)
   ```

2. **Collection Creation**
   ```typescript
   INSERT INTO collections (user_id, name, slug, description, is_public)
   INSERT INTO collection_recipes (collection_id, recipe_id, position)
   UPDATE recipes SET collection_count = collection_count + 1
   ```

3. **Meal Plan Creation**
   ```typescript
   INSERT INTO meals (user_id, name, description, meal_type, serves)
   INSERT INTO meal_recipes (meal_id, recipe_id, course_category, display_order)
   ```

## Troubleshooting

### No Recipes Found

**Error**: `⚠️ No recipes found in database`

**Solution**:
```bash
# Seed system recipes first
pnpm tsx scripts/seed-system-recipes.ts

# Or seed from external sources
pnpm tsx scripts/import-themealdb.ts
pnpm tsx scripts/import-open-recipe-db.ts
```

### Collections Have Few Recipes

**Problem**: Collections only have 1-2 recipes instead of 5-10

**Cause**: Not enough recipes matching the filter criteria

**Solution**:
- Import more recipes with diverse tags and cuisines
- Adjust `CollectionTemplate.recipeFilters` to be less restrictive
- Lower `minRecipes` and `maxRecipes` thresholds

### Meal Plans Not Created

**Problem**: Meal plans fail to create or have missing recipes

**Cause**: Recipe queries not finding suitable matches

**Solution**:
- Check recipe tags in database (tags should be lowercase)
- Broaden `recipeQuery` criteria in `MEAL_PLAN_TEMPLATES`
- Ensure recipes have proper cuisine and tag metadata

### Duplicate Collections

**Problem**: Running script multiple times creates duplicate collections

**Cause**: Should not happen (script is idempotent)

**Debug**:
```typescript
// Check for existing collections
SELECT user_id, slug, name FROM collections
WHERE user_id LIKE 'user_synthetic_%';
```

## Extending the Script

### Adding New Synthetic Users

```typescript
const SYNTHETIC_USERS: SyntheticUser[] = [
  // ... existing users
  {
    userId: 'user_synthetic_vegan',
    username: 'lily_veganchef',
    displayName: 'Lily Green',
    bio: 'Plant-based cooking enthusiast...',
    specialties: ['Vegan', 'Plant-Based', 'Sustainable'],
    collectionThemes: ['Vegan Essentials', 'Plant-Based Proteins'],
    mealTypes: ['breakfast', 'lunch', 'dinner'],
  },
];
```

### Adding New Collection Themes

```typescript
const COLLECTION_TEMPLATES: Record<string, CollectionTemplate> = {
  // ... existing templates
  'Vegan Essentials': {
    nameTemplate: 'Vegan Essentials',
    description: 'Must-have recipes for plant-based eating',
    tags: ['vegan', 'plant-based', 'essentials'],
    isPublic: true,
    recipeFilters: {
      tags: ['vegan', 'vegetarian'],
    },
    minRecipes: 8,
    maxRecipes: 12,
  },
};
```

### Adding New Meal Plan Templates

```typescript
const MEAL_PLAN_TEMPLATES: MealPlanTemplate[] = [
  // ... existing templates
  {
    name: 'Meal Prep Sunday',
    description: 'Batch cook 5 meals for the week',
    mealType: 'lunch',
    serves: 4,
    days: [
      {
        dayName: 'Sunday',
        meals: [
          { courseCategory: 'main', recipeQuery: { tags: ['meal prep', 'freezer-friendly'] } },
          { courseCategory: 'main', recipeQuery: { tags: ['meal prep', 'chicken'] } },
          // ... more meals
        ],
      },
    ],
  },
];
```

## Database Schema Reference

### User Profiles

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  username VARCHAR(30) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  bio TEXT,
  specialties JSON,
  is_public BOOLEAN DEFAULT TRUE
);
```

### Collections

```sql
CREATE TABLE collections (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  recipe_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT FALSE
);

CREATE TABLE collection_recipes (
  id UUID PRIMARY KEY,
  collection_id UUID NOT NULL,
  recipe_id TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  personal_note TEXT
);
```

### Meals

```sql
CREATE TABLE meals (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  meal_type TEXT,
  occasion TEXT,
  serves INTEGER DEFAULT 4,
  is_public BOOLEAN DEFAULT FALSE
);

CREATE TABLE meal_recipes (
  id UUID PRIMARY KEY,
  meal_id UUID NOT NULL,
  recipe_id TEXT NOT NULL,
  course_category TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  serving_multiplier DECIMAL(4,2) DEFAULT 1.00,
  preparation_notes TEXT
);
```

## Performance Considerations

- **Recipe Queries**: Script fetches 3x requested recipes and filters in memory
- **Batch Processing**: Creates one user at a time to avoid overwhelming database
- **Error Handling**: Catches and logs errors without stopping entire process
- **Transaction Safety**: Uses individual inserts (no transactions) for partial success

## Testing

### Verify Collections

```bash
# Count collections per user
npx tsx -e "
import { db } from './src/lib/db';
import { collections } from './src/lib/db/schema';
import { sql } from 'drizzle-orm';

const stats = await db
  .select({
    userId: collections.user_id,
    count: sql\`COUNT(*)\`
  })
  .from(collections)
  .groupBy(collections.user_id);

console.table(stats);
"
```

### Verify Meal Plans

```bash
# Count meal plans with recipe counts
npx tsx -e "
import { db } from './src/lib/db';
import { meals, mealRecipes } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

const allMeals = await db.select().from(meals);
for (const meal of allMeals) {
  const recipeCount = await db
    .select({ count: sql\`COUNT(*)\` })
    .from(mealRecipes)
    .where(eq(mealRecipes.meal_id, meal.id));

  console.log(\`\${meal.name}: \${recipeCount[0].count} recipes\`);
}
"
```

## Future Enhancements

- [ ] Add AI-generated collection descriptions using LLM
- [ ] Implement persona-based recipe preferences
- [ ] Add seasonal meal plan templates (Spring, Summer, Fall, Winter)
- [ ] Generate shopping lists for meal plans automatically
- [ ] Add more diverse synthetic users (dietary restrictions, cultural backgrounds)
- [ ] Implement collection cover image generation
- [ ] Add meal plan cost estimation using AI

## Related Scripts

- `seed-system-recipes.ts` - Seed curated system recipes
- `import-themealdb.ts` - Import recipes from TheMealDB API
- `import-open-recipe-db.ts` - Import from Open Recipe Database
- `seed-common-ingredients-tools.ts` - Seed ingredient and tool reference data

## Support

For issues or questions:
1. Check script output for detailed error messages
2. Verify database connection and schema
3. Ensure prerequisites (recipes) are seeded
4. Review database logs for constraint violations
5. Check `scripts/` directory for related seeding scripts

---

**Last Updated**: 2025-10-19
**Script Version**: 1.0.0
**Database Schema Version**: 0.65.0 (Meal Pairing System)
