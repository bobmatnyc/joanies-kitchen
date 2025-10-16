# Snake_Case Migration Guide

## Overview

This guide documents the refactoring of the Recipe Manager codebase to use **consistent snake_case naming** across all layers, from database to frontend.

**Migration Date**: 2025-10-15
**Status**: ✅ Schema Updated | ⏳ Actions In Progress | ⏳ Components In Progress

---

## Why snake_case?

### Benefits

1. **Database Consistency**: PostgreSQL standard convention
2. **No Conversion Layer**: Direct mapping from database → types → UI
3. **Type Safety**: TypeScript infers correct snake_case types from Drizzle schemas
4. **Industry Standard**: Python, SQL, and data layer conventions
5. **Fewer Bugs**: Eliminates camelCase ↔ snake_case conversion errors

### The Problem We're Solving

**Before (Inconsistent)**:
```typescript
// Database column: user_id
// Drizzle property: userId
// TypeScript type: { userId: string }
// Component prop: { userId: string }
// Conversion bugs: Frequent mapping errors between layers
```

**After (Consistent)**:
```typescript
// Database column: user_id
// Drizzle property: user_id
// TypeScript type: { user_id: string }
// Component prop: { user_id: string }
// No conversion needed! 🎉
```

---

## Migration Strategy

### Phase 1: Database Schema (✅ COMPLETED)

**Files Updated**:
- `src/lib/db/schema.ts` (recipes, recipeEmbeddings, recipeRatings, recipeFlags)
- `src/lib/db/chef-schema.ts` (chefs, chefRecipes, scrapingJobs)
- `src/lib/db/user-discovery-schema.ts` (userProfiles, collections, collectionRecipes, favorites, recipeViews)

**Changes**:
- Updated all Drizzle property names to snake_case
- Column names already were snake_case (no database migration needed!)
- TypeScript types now auto-infer snake_case from schemas

**Example**:
```typescript
// BEFORE:
export const recipes = pgTable('recipes', {
  userId: text('user_id').notNull(),
  isPublic: boolean('is_public').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// AFTER:
export const recipes = pgTable('recipes', {
  user_id: text('user_id').notNull(),
  is_public: boolean('is_public').default(false),
  created_at: timestamp('created_at').defaultNow(),
});
```

**Type Inference**:
```typescript
type Recipe = typeof recipes.$inferSelect;
// BEFORE: { userId: string; isPublic: boolean; createdAt: Date; }
// AFTER:  { user_id: string; is_public: boolean; created_at: Date; }
```

### Phase 2: Server Actions (⏳ IN PROGRESS)

**Files to Update**:
- `src/app/actions/recipes.ts`
- `src/app/actions/ai-recipes.ts`
- `src/app/actions/admin.ts`
- `src/app/actions/chefs.ts`
- `src/app/actions/chef-scraping.ts`
- `src/app/actions/collections.ts`
- `src/app/actions/favorites.ts`
- `src/app/actions/user-profiles.ts`
- `src/app/actions/recipe-discovery.ts`
- `src/app/actions/recipe-import.ts`
- `src/app/actions/recipe-export.ts`
- `src/app/actions/semantic-search.ts`
- `src/app/actions/rate-recipe.ts`
- `src/app/actions/flag-recipe.ts`
- `src/app/actions/ai-upload.ts`
- `src/app/actions/recipe-crawl.ts`
- `src/app/actions/recipe-search.ts`

**Changes Needed**:

1. **Database Queries**: Update field references
```typescript
// BEFORE:
const recipes = await db.query.recipes.findMany({
  where: eq(recipes.userId, userId),
  orderBy: recipes.createdAt.desc(),
});

// AFTER:
const recipes = await db.query.recipes.findMany({
  where: eq(recipes.user_id, userId),
  orderBy: recipes.created_at.desc(),
});
```

2. **Insert/Update Operations**: Update field names
```typescript
// BEFORE:
await db.insert(recipes).values({
  userId: userId,
  isPublic: true,
  createdAt: new Date(),
});

// AFTER:
await db.insert(recipes).values({
  user_id: userId,
  is_public: true,
  created_at: new Date(),
});
```

3. **Server Action Parameters**: Accept snake_case
```typescript
// BEFORE:
export async function createRecipe(data: {
  userId: string;
  isPublic: boolean;
}) { ... }

// AFTER:
export async function createRecipe(data: {
  user_id: string;
  is_public: boolean;
}) { ... }
```

### Phase 3: Components (⏳ IN PROGRESS)

**Files to Update**: All component files that use recipe/chef/user data

**Changes Needed**:

1. **Component Props**: Update to snake_case
```typescript
// BEFORE:
interface RecipeCardProps {
  recipe: {
    userId: string;
    isPublic: boolean;
    createdAt: Date;
  };
}

// AFTER:
interface RecipeCardProps {
  recipe: {
    user_id: string;
    is_public: boolean;
    created_at: Date;
  };
}
```

2. **JSX Property Access**: Update property names
```tsx
// BEFORE:
<div>
  <p>User: {recipe.userId}</p>
  <p>Public: {recipe.isPublic ? 'Yes' : 'No'}</p>
  <p>Created: {recipe.createdAt.toISOString()}</p>
</div>

// AFTER:
<div>
  <p>User: {recipe.user_id}</p>
  <p>Public: {recipe.is_public ? 'Yes' : 'No'}</p>
  <p>Created: {recipe.created_at.toISOString()}</p>
</div>
```

3. **State Management**: Update state object keys
```typescript
// BEFORE:
const [recipe, setRecipe] = useState({
  userId: '',
  isPublic: false,
  createdAt: new Date(),
});

// AFTER:
const [recipe, setRecipe] = useState({
  user_id: '',
  is_public: false,
  created_at: new Date(),
});
```

### Phase 4: Tests (⏳ IN PROGRESS)

**Files to Update**: Test files in `src/app/actions/__tests__/`

**Changes Needed**:
- Update all property assertions to use snake_case
- Update mock data objects
- Update test expectations

```typescript
// BEFORE:
expect(recipe.confidenceScore).toBeGreaterThan(0.7);
expect(recipe.searchQuery).toBe('italian pasta');

// AFTER:
expect(recipe.confidence_score).toBeGreaterThan(0.7);
expect(recipe.search_query).toBe('italian pasta');
```

---

## Type Safety Utilities

**Location**: `src/lib/types/snake-case.ts`

### Type Utilities

```typescript
import { ToSnakeCase, ToCamelCase } from '@/lib/types/snake-case';

// Convert types
type UserCamel = { userId: string; isActive: boolean };
type UserSnake = ToSnakeCase<UserCamel>; // { user_id: string; is_active: boolean }

type DataSnake = { user_id: string; created_at: Date };
type DataCamel = ToCamelCase<DataSnake>; // { userId: string; createdAt: Date }
```

### Runtime Utilities

```typescript
import { toSnakeCase, toCamelCase } from '@/lib/types/snake-case';

// Convert objects at runtime
const camelData = { userId: '123', isActive: true };
const snakeData = toSnakeCase(camelData);
// Result: { user_id: '123', is_active: true }

const snakeData = { user_id: '123', is_active: true };
const camelData = toCamelCase(snakeData);
// Result: { userId: '123', isActive: true }
```

**Note**: These utilities are available for gradual migration or external API integration, but ideally shouldn't be needed in the main codebase after migration.

---

## Field Mapping Reference

### Recipes Table

| Old (camelCase) | New (snake_case) | Type | Description |
|-----------------|------------------|------|-------------|
| `userId` | `user_id` | `string` | Clerk user ID |
| `chefId` | `chef_id` | `string | null` | Optional chef reference |
| `prepTime` | `prep_time` | `number | null` | Preparation time (minutes) |
| `cookTime` | `cook_time` | `number | null` | Cooking time (minutes) |
| `imageUrl` | `image_url` | `string | null` | Single image URL (deprecated) |
| `isAiGenerated` | `is_ai_generated` | `boolean` | AI-generated recipe flag |
| `isPublic` | `is_public` | `boolean` | Public visibility |
| `isSystemRecipe` | `is_system_recipe` | `boolean` | System/curated recipe |
| `nutritionInfo` | `nutrition_info` | `string | null` | JSON nutritional data |
| `modelUsed` | `model_used` | `string | null` | AI model identifier |
| `createdAt` | `created_at` | `Date` | Creation timestamp |
| `updatedAt` | `updated_at` | `Date` | Last update timestamp |
| `searchQuery` | `search_query` | `string | null` | Discovery search query |
| `discoveryDate` | `discovery_date` | `Date | null` | Discovery timestamp |
| `confidenceScore` | `confidence_score` | `string | null` | Validation confidence (decimal) |
| `validationModel` | `validation_model` | `string | null` | Validation AI model |
| `embeddingModel` | `embedding_model` | `string | null` | Embedding model name |
| `discoveryWeek` | `discovery_week` | `number | null` | ISO week number |
| `discoveryYear` | `discovery_year` | `number | null` | Discovery year |
| `publishedDate` | `published_date` | `Date | null` | Original publish date |
| `systemRating` | `system_rating` | `string | null` | AI quality score (decimal) |
| `systemRatingReason` | `system_rating_reason` | `string | null` | Rating explanation |
| `avgUserRating` | `avg_user_rating` | `string | null` | Average user rating (decimal) |
| `totalUserRatings` | `total_user_ratings` | `number | null` | Rating count |

### Recipe Embeddings Table

| Old (camelCase) | New (snake_case) | Type | Description |
|-----------------|------------------|------|-------------|
| `recipeId` | `recipe_id` | `string` | Recipe foreign key |
| `embeddingText` | `embedding_text` | `string` | Text used for embedding |
| `modelName` | `model_name` | `string` | Embedding model name |
| `createdAt` | `created_at` | `Date` | Creation timestamp |
| `updatedAt` | `updated_at` | `Date` | Last update timestamp |

### Recipe Ratings Table

| Old (camelCase) | New (snake_case) | Type | Description |
|-----------------|------------------|------|-------------|
| `recipeId` | `recipe_id` | `string` | Recipe foreign key |
| `userId` | `user_id` | `string` | User foreign key |
| `createdAt` | `created_at` | `Date` | Creation timestamp |
| `updatedAt` | `updated_at` | `Date` | Last update timestamp |

### Recipe Flags Table

| Old (camelCase) | New (snake_case) | Type | Description |
|-----------------|------------------|------|-------------|
| `recipeId` | `recipe_id` | `string` | Recipe foreign key |
| `userId` | `user_id` | `string` | Reporter user ID |
| `reviewedBy` | `reviewed_by` | `string | null` | Admin reviewer ID |
| `reviewedAt` | `reviewed_at` | `Date | null` | Review timestamp |
| `reviewNotes` | `review_notes` | `string | null` | Admin notes |
| `createdAt` | `created_at` | `Date` | Creation timestamp |
| `updatedAt` | `updated_at` | `Date` | Last update timestamp |

### Chefs Table

| Old (camelCase) | New (snake_case) | Type | Description |
|-----------------|------------------|------|-------------|
| `displayName` | `display_name` | `string | null` | Display name |
| `profileImageUrl` | `profile_image_url` | `string | null` | Profile image URL |
| `socialLinks` | `social_links` | `jsonb | null` | Social media links |
| `isVerified` | `is_verified` | `boolean` | Verification status |
| `isActive` | `is_active` | `boolean` | Active status |
| `recipeCount` | `recipe_count` | `number` | Recipe count |
| `createdAt` | `created_at` | `Date` | Creation timestamp |
| `updatedAt` | `updated_at` | `Date` | Last update timestamp |

### Chef Recipes Table

| Old (camelCase) | New (snake_case) | Type | Description |
|-----------------|------------------|------|-------------|
| `chefId` | `chef_id` | `string` | Chef foreign key |
| `recipeId` | `recipe_id` | `string` | Recipe foreign key |
| `originalUrl` | `original_url` | `string | null` | Source URL |
| `scrapedAt` | `scraped_at` | `Date | null` | Scrape timestamp |
| `createdAt` | `created_at` | `Date` | Creation timestamp |

### Scraping Jobs Table

| Old (camelCase) | New (snake_case) | Type | Description |
|-----------------|------------------|------|-------------|
| `chefId` | `chef_id` | `string | null` | Chef foreign key |
| `sourceUrl` | `source_url` | `string` | Scraping source URL |
| `recipesScraped` | `recipes_scraped` | `number` | Success count |
| `recipesFailed` | `recipes_failed` | `number` | Failure count |
| `totalPages` | `total_pages` | `number` | Total pages |
| `currentPage` | `current_page` | `number` | Current page |
| `startedAt` | `started_at` | `Date | null` | Start timestamp |
| `completedAt` | `completed_at` | `Date | null` | Completion timestamp |
| `createdAt` | `created_at` | `Date` | Creation timestamp |
| `updatedAt` | `updated_at` | `Date` | Last update timestamp |

### User Profiles Table

| Old (camelCase) | New (snake_case) | Type | Description |
|-----------------|------------------|------|-------------|
| `userId` | `user_id` | `string` | Clerk user ID |
| `displayName` | `display_name` | `string` | Display name |
| `profileImageUrl` | `profile_image_url` | `string | null` | Profile image URL |
| `isPublic` | `is_public` | `boolean` | Public profile |
| `createdAt` | `created_at` | `Date` | Creation timestamp |
| `updatedAt` | `updated_at` | `Date` | Last update timestamp |

### Collections Table

| Old (camelCase) | New (snake_case) | Type | Description |
|-----------------|------------------|------|-------------|
| `userId` | `user_id` | `string` | User foreign key |
| `coverImageUrl` | `cover_image_url` | `string | null` | Cover image URL |
| `recipeCount` | `recipe_count` | `number` | Recipe count |
| `isPublic` | `is_public` | `boolean` | Public collection |
| `createdAt` | `created_at` | `Date` | Creation timestamp |
| `updatedAt` | `updated_at` | `Date` | Last update timestamp |
| `lastRecipeAddedAt` | `last_recipe_added_at` | `Date | null` | Last recipe addition |

### Collection Recipes Table

| Old (camelCase) | New (snake_case) | Type | Description |
|-----------------|------------------|------|-------------|
| `collectionId` | `collection_id` | `string` | Collection foreign key |
| `recipeId` | `recipe_id` | `string` | Recipe foreign key |
| `personalNote` | `personal_note` | `string | null` | Personal note |
| `addedAt` | `added_at` | `Date` | Addition timestamp |

### Favorites Table

| Old (camelCase) | New (snake_case) | Type | Description |
|-----------------|------------------|------|-------------|
| `userId` | `user_id` | `string` | User foreign key |
| `recipeId` | `recipe_id` | `string` | Recipe foreign key |
| `createdAt` | `created_at` | `Date` | Creation timestamp |

### Recipe Views Table

| Old (camelCase) | New (snake_case) | Type | Description |
|-----------------|------------------|------|-------------|
| `userId` | `user_id` | `string | null` | User foreign key (nullable) |
| `recipeId` | `recipe_id` | `string` | Recipe foreign key |
| `viewedAt` | `viewed_at` | `Date` | View timestamp |

---

## Migration Checklist

### Schema Layer ✅
- [x] Update `src/lib/db/schema.ts` to snake_case
- [x] Update `src/lib/db/chef-schema.ts` to snake_case
- [x] Update `src/lib/db/user-discovery-schema.ts` to snake_case
- [x] Verify no database migration needed (columns already snake_case)
- [x] Create type safety utilities in `src/lib/types/snake-case.ts`

### Server Actions Layer ⏳
- [ ] Update `src/app/actions/recipes.ts`
- [ ] Update `src/app/actions/ai-recipes.ts`
- [ ] Update `src/app/actions/admin.ts`
- [ ] Update `src/app/actions/chefs.ts`
- [ ] Update `src/app/actions/chef-scraping.ts`
- [ ] Update `src/app/actions/collections.ts`
- [ ] Update `src/app/actions/favorites.ts`
- [ ] Update `src/app/actions/user-profiles.ts`
- [ ] Update all other action files

### Component Layer ⏳
- [ ] Update all recipe components
- [ ] Update all chef components
- [ ] Update all collection components
- [ ] Update all admin components
- [ ] Update all shared components

### Testing Layer ⏳
- [ ] Update test files in `src/app/actions/__tests__/`
- [ ] Verify all tests pass
- [ ] Update test mock data

### Final Steps ⏳
- [ ] Run full TypeScript compilation: `pnpm tsc --noEmit`
- [ ] Run all tests: `pnpm test` (when implemented)
- [ ] Run development server: `pnpm dev`
- [ ] Manual testing of key features
- [ ] Update project documentation

---

## Breaking Changes

⚠️ **This is a breaking change for all consumers of the application's data types.**

### Impact

1. **Server Actions**: All action functions now accept/return snake_case data
2. **Components**: All component props now use snake_case
3. **API Routes**: All API responses now use snake_case (if applicable)
4. **External Integrations**: Any external systems consuming our data will need updates

### Migration Timeline

**Recommended Approach**: Big Bang (All at once)
- Reason: Early-stage project, small team
- Benefit: Cleaner, faster migration
- Alternative: Gradual migration with conversion utilities (for production apps)

---

## Common Pitfalls

### 1. Missing Conversions

```typescript
// ❌ WRONG: Mixing camelCase and snake_case
const recipe = await getRecipe(id);
if (recipe.isPublic) { // ❌ isPublic doesn't exist
  console.log(recipe.user_id); // ✅ user_id exists
}

// ✅ CORRECT: Consistent snake_case
const recipe = await getRecipe(id);
if (recipe.is_public) { // ✅ is_public exists
  console.log(recipe.user_id); // ✅ user_id exists
}
```

### 2. Database Query Errors

```typescript
// ❌ WRONG: Using old property names
await db.query.recipes.findMany({
  where: eq(recipes.userId, userId), // ❌ userId property doesn't exist
});

// ✅ CORRECT: Using snake_case property names
await db.query.recipes.findMany({
  where: eq(recipes.user_id, userId), // ✅ user_id exists
});
```

### 3. JSX Property Access

```tsx
// ❌ WRONG: Old property names
<div>{recipe.createdAt.toISOString()}</div>

// ✅ CORRECT: Snake_case property names
<div>{recipe.created_at.toISOString()}</div>
```

---

## Rollback Plan

If issues arise, rollback steps:

1. Revert schema files to previous commit
2. Revert action files to previous commit
3. Revert component files to previous commit
4. Run `pnpm db:push` to ensure schema sync
5. Restart development server

**Git Command**:
```bash
git revert <commit-hash>
# Or
git reset --hard <pre-migration-commit-hash>
```

---

## Support

For questions or issues with this migration:

1. Check TypeScript compilation errors: `pnpm tsc --noEmit`
2. Review this migration guide
3. Check `src/lib/types/snake-case.ts` for utilities
4. Consult recent git commits for examples

---

**Last Updated**: 2025-10-15
**Migration Owner**: Refactoring Engineer
**Status**: ✅ Schema | ⏳ Actions | ⏳ Components | ⏳ Tests
