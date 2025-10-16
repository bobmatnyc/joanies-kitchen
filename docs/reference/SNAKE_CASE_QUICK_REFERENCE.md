# Snake_Case Quick Reference

**Last Updated**: 2025-10-15 | **Status**: Schema Complete, Actions/Components In Progress

---

## Quick Field Lookup

### Most Common Fields

```typescript
// Recipe Fields (use these!)
recipe.user_id          // ✅ not userId
recipe.is_public        // ✅ not isPublic
recipe.is_ai_generated  // ✅ not isAiGenerated
recipe.prep_time        // ✅ not prepTime
recipe.cook_time        // ✅ not cookTime
recipe.created_at       // ✅ not createdAt
recipe.updated_at       // ✅ not updatedAt

// Chef Fields
chef.display_name       // ✅ not displayName
chef.profile_image_url  // ✅ not profileImageUrl
chef.is_verified        // ✅ not isVerified
chef.recipe_count       // ✅ not recipeCount

// User Profile Fields
profile.user_id         // ✅ not userId
profile.display_name    // ✅ not displayName
profile.profile_image_url // ✅ not profileImageUrl
profile.is_public       // ✅ not isPublic
```

---

## Common Patterns

### Database Queries

```typescript
// ✅ CORRECT
const recipes = await db.query.recipes.findMany({
  where: eq(recipes.user_id, userId),
  orderBy: recipes.created_at.desc(),
});

// ❌ WRONG
const recipes = await db.query.recipes.findMany({
  where: eq(recipes.userId, userId),      // ❌ userId doesn't exist
  orderBy: recipes.createdAt.desc(),      // ❌ createdAt doesn't exist
});
```

### Insert Operations

```typescript
// ✅ CORRECT
await db.insert(recipes).values({
  user_id: userId,
  is_public: true,
  prep_time: 30,
  cook_time: 45,
  created_at: new Date(),
});

// ❌ WRONG
await db.insert(recipes).values({
  userId: userId,          // ❌ userId doesn't exist
  isPublic: true,          // ❌ isPublic doesn't exist
  prepTime: 30,            // ❌ prepTime doesn't exist
  cookTime: 45,            // ❌ cookTime doesn't exist
  createdAt: new Date(),   // ❌ createdAt doesn't exist
});
```

### Component Props

```tsx
// ✅ CORRECT
interface RecipeCardProps {
  recipe: {
    user_id: string;
    is_public: boolean;
    prep_time: number;
    created_at: Date;
  };
}

// In JSX:
<div>
  <p>Prep: {recipe.prep_time} min</p>
  <p>Cook: {recipe.cook_time} min</p>
  <p>Created: {recipe.created_at.toLocaleDateString()}</p>
</div>

// ❌ WRONG
interface RecipeCardProps {
  recipe: {
    userId: string;          // ❌
    isPublic: boolean;       // ❌
    prepTime: number;        // ❌
    createdAt: Date;         // ❌
  };
}
```

---

## TypeScript Errors Guide

### Error: "Property 'userId' does not exist"

```typescript
// Error message:
// Property 'userId' does not exist on type 'Recipe'. Did you mean 'user_id'?

// Fix:
recipes.userId  // ❌ Change to:
recipes.user_id // ✅
```

### Error: "Object literal may only specify known properties"

```typescript
// Error message:
// but 'isPublic' does not exist in type {...}. Did you mean to write 'is_public'?

// Fix:
db.insert(recipes).values({
  isPublic: true,  // ❌ Change to:
  is_public: true, // ✅
});
```

---

## Find & Replace Patterns

Use these regex patterns for mass updates:

### Common Property Names

```regex
# userId → user_id
\.userId\b     →  .user_id
userId:        →  user_id:

# isPublic → is_public
\.isPublic\b   →  .is_public
isPublic:      →  is_public:

# createdAt → created_at
\.createdAt\b  →  .created_at
createdAt:     →  created_at:

# prepTime → prep_time
\.prepTime\b   →  .prep_time
prepTime:      →  prep_time:

# cookTime → cook_time
\.cookTime\b   →  .cook_time
cookTime:      →  cook_time:
```

**⚠️ Warning**: Always review changes after bulk find-and-replace!

---

## Complete Field Name Mapping

### Recipe Table (35 fields)

```
id → id                               (no change)
userId → user_id
chefId → chef_id
name → name                           (no change)
description → description             (no change)
ingredients → ingredients             (no change)
instructions → instructions           (no change)
prepTime → prep_time
cookTime → cook_time
servings → servings                   (no change)
difficulty → difficulty               (no change)
cuisine → cuisine                     (no change)
tags → tags                           (no change)
imageUrl → image_url
images → images                       (no change)
isAiGenerated → is_ai_generated
isPublic → is_public
isSystemRecipe → is_system_recipe
nutritionInfo → nutrition_info
modelUsed → model_used
source → source                       (no change)
createdAt → created_at
updatedAt → updated_at
searchQuery → search_query
discoveryDate → discovery_date
confidenceScore → confidence_score
validationModel → validation_model
embeddingModel → embedding_model
discoveryWeek → discovery_week
discoveryYear → discovery_year
publishedDate → published_date
systemRating → system_rating
systemRatingReason → system_rating_reason
avgUserRating → avg_user_rating
totalUserRatings → total_user_ratings
```

### Chef Table (14 fields)

```
id → id                               (no change)
slug → slug                           (no change)
name → name                           (no change)
displayName → display_name
bio → bio                             (no change)
profileImageUrl → profile_image_url
website → website                     (no change)
socialLinks → social_links
specialties → specialties             (no change)
isVerified → is_verified
isActive → is_active
recipeCount → recipe_count
createdAt → created_at
updatedAt → updated_at
```

### User Profile Table (12 fields)

```
id → id                               (no change)
userId → user_id
username → username                   (no change)
displayName → display_name
bio → bio                             (no change)
profileImageUrl → profile_image_url
location → location                   (no change)
website → website                     (no change)
specialties → specialties             (no change)
isPublic → is_public
createdAt → created_at
updatedAt → updated_at
```

---

## Conversion Utilities

For external APIs or gradual migration:

```typescript
import { toSnakeCase, toCamelCase } from '@/lib/types/snake-case';

// Convert external camelCase API response to snake_case
const externalData = { userId: '123', isActive: true };
const internalData = toSnakeCase(externalData);
// Result: { user_id: '123', is_active: true }

// Convert internal snake_case to camelCase for external API
const internalData = { user_id: '123', is_active: true };
const externalData = toCamelCase(internalData);
// Result: { userId: '123', isActive: true }
```

---

## Testing Your Changes

### 1. TypeScript Compilation

```bash
pnpm tsc --noEmit
```

Should show zero errors when migration is complete.

### 2. Development Server

```bash
pnpm dev
```

Visit http://localhost:3004 and test key features.

### 3. Database Verification

```bash
pnpm db:studio
```

Check that database columns remain unchanged (already snake_case).

---

## Need Help?

1. **Full Migration Guide**: `docs/guides/SNAKE_CASE_MIGRATION_GUIDE.md`
2. **Type Utilities**: `src/lib/types/snake-case.ts`
3. **TypeScript Errors**: Run `pnpm tsc --noEmit | grep "Did you mean"`

---

**Remember**: All field names are now snake_case from database to UI. No conversions needed! 🎉
