# API Reference - Joanie's Kitchen

**Version**: 0.7.1 (Build 93)
**Last Updated**: October 21, 2025

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Server Actions](#server-actions)
  - [Recipe Actions](#recipe-actions)
  - [Fridge/Ingredient Actions](#fridgeingredient-actions)
  - [Substitution Actions](#substitution-actions)
  - [AI Recipe Actions](#ai-recipe-actions)
  - [Recipe Import/Export](#recipe-importexport-actions)
  - [Search Actions](#search-actions)
  - [User Profile Actions](#user-profile-actions)
- [API Routes](#api-routes)
  - [Authentication Routes](#authentication-routes)
  - [Recipe Routes](#recipe-routes)
  - [Search Routes](#search-routes)
- [Performance Metrics](#performance-metrics)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

---

## Overview

Joanie's Kitchen uses **Next.js Server Actions** as the primary API interface, with traditional REST API routes for specific use cases. This hybrid approach provides:

- **Type safety**: Full TypeScript support
- **Server-side execution**: Secure API key handling
- **Client-side convenience**: Direct function calls from components
- **Performance**: Optimized with multi-layer caching

**Architecture**:
- **Server Actions**: `src/app/actions/` (preferred for mutations)
- **API Routes**: `src/app/api/` (for webhooks, third-party integrations)
- **Database**: Neon PostgreSQL (serverless)
- **ORM**: Drizzle ORM with Zod validation
- **Caching**: Multi-layer (ingredient, search, popular items)

---

## Authentication

### Middleware Protection

All authenticated endpoints require a valid Clerk session. The middleware (`src/middleware.ts`) automatically:

- Validates Clerk session tokens
- Extracts `userId` from session
- Protects routes (except public pages)
- Supports dual-environment (dev + production)

**Public routes** (no authentication):
- `/` (homepage)
- `/discover` (system recipes)
- `/shared/*` (shared recipes)
- `/sign-in`, `/sign-up`
- `/api/clerk-config`, `/api/security-audit`

**Protected routes** (authentication required):
- `/ingredients` (fridge feature)
- `/recipes/*` (user recipes)
- `/meal-plans/*`
- `/shopping-lists/*`
- `/user-profile/*`

### Getting User ID

**Server Actions**:
```typescript
import { auth } from '@/lib/auth';

export async function myServerAction() {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  // Use userId for database queries
}
```

**API Routes**:
```typescript
import { auth } from '@clerk/nextjs/server';

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use userId for database queries
}
```

---

## Server Actions

### Recipe Actions

**File**: `src/app/actions/recipes.ts`

#### `createRecipe(recipe: NewRecipe)`

Create a new recipe.

**Parameters**:
```typescript
interface NewRecipe {
  name: string;
  description?: string;
  ingredients: string; // JSON array
  instructions: string; // JSON array
  prepTime?: number; // minutes
  cookTime?: number; // minutes
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  cuisine?: string;
  tags?: string; // JSON array
  images?: string; // JSON array (max 6 URLs)
  isPublic?: boolean;
  nutritionInfo?: string; // JSON object
}
```

**Returns**:
```typescript
{
  success: boolean;
  recipe?: Recipe;
  error?: string;
}
```

**Example**:
```typescript
const result = await createRecipe({
  name: "Garlic Butter Shrimp",
  description: "Quick and easy weeknight dinner",
  ingredients: JSON.stringify(["1 lb shrimp", "4 cloves garlic", "2 tbsp butter"]),
  instructions: JSON.stringify(["Mince garlic", "Melt butter", "Cook shrimp"]),
  prepTime: 10,
  cookTime: 5,
  servings: 4,
  difficulty: "easy",
  cuisine: "American",
  isPublic: true
});
```

#### `updateRecipe(id: string, recipe: Partial<Recipe>)`

Update an existing recipe (user must own the recipe).

**Parameters**:
- `id`: Recipe UUID
- `recipe`: Partial recipe object (only fields to update)

**Returns**: Same as `createRecipe`

**Example**:
```typescript
await updateRecipe("recipe-uuid-123", {
  name: "Updated Recipe Name",
  difficulty: "medium"
});
```

#### `deleteRecipe(id: string)`

Delete a recipe (user must own the recipe).

**Returns**:
```typescript
{
  success: boolean;
  error?: string;
}
```

#### `getRecipeById(id: string)`

Get a single recipe by ID (respects visibility rules).

**Returns**:
```typescript
{
  success: boolean;
  recipe?: Recipe;
  error?: string;
}
```

#### `getUserRecipes(userId?: string)`

Get all recipes for a user (defaults to authenticated user).

**Returns**:
```typescript
{
  success: boolean;
  recipes: Recipe[];
  error?: string;
}
```

#### `getPublicRecipes(options?: { limit?: number; offset?: number })`

Get all public recipes (paginated).

**Default**: limit=20, offset=0
**Max limit**: 100

#### `getSystemRecipes()`

Get all system/curated recipes (Joanie's collection).

**Performance**: Cached for 1 hour

---

### Fridge/Ingredient Actions

**File**: `src/app/actions/ingredient-search.ts`

#### `searchRecipesByIngredients(ingredientNames: string[], options?)`

**Core zero-waste feature** - Find recipes by ingredients you have.

**Parameters**:
```typescript
ingredientNames: string[]; // e.g., ["chicken", "rice", "garlic"]

options?: {
  matchMode?: 'all' | 'any' | 'exact'; // Default: 'any'
  cuisine?: string; // Filter by cuisine
  difficulty?: 'easy' | 'medium' | 'hard';
  dietaryRestrictions?: string[]; // e.g., ['vegan', 'gluten-free']
  minMatchPercentage?: number; // 0-100, default: 0
  limit?: number; // Max 100, default: 20
  offset?: number; // Pagination, default: 0
  includePrivate?: boolean; // Include user's private recipes
  rankingMode?: 'balanced' | 'semantic' | 'quality' | 'popular' | 'trending';
  includeScoreBreakdown?: boolean; // Debug info
}
```

**Match Modes**:
- **`any`**: Recipe must have AT LEAST ONE ingredient (OR logic)
- **`all`**: Recipe must have ALL specified ingredients (AND logic)
- **`exact`**: Recipe must have ONLY these ingredients (perfect match)

**Returns**:
```typescript
{
  success: boolean;
  recipes: RecipeWithMatch[];
  totalCount: number;
  error?: string;
}

interface RecipeWithMatch extends Recipe {
  matchedIngredients: string[]; // Ingredients you have
  totalIngredients: number; // Total ingredients in recipe
  matchPercentage: number; // 0-100
  rankingScore: number; // 0-100 (weighted score)
}
```

**Ranking Algorithm**:
- **60% weight**: Match percentage (how many ingredients you have)
- **30% weight**: System rating (AI quality score)
- **10% weight**: User rating (community feedback)

**Performance**:
- **Response time**: 150-272ms average
- **Target**: <500ms
- **Caching**: Multi-layer (ingredient, suggestions, popular)

**Example**:
```typescript
// Find Italian recipes with tomatoes OR basil
const result = await searchRecipesByIngredients(
  ['tomatoes', 'basil'],
  {
    matchMode: 'any',
    cuisine: 'Italian',
    minMatchPercentage: 50,
    limit: 10
  }
);

console.log(`Found ${result.totalCount} recipes`);
result.recipes.forEach(recipe => {
  console.log(`${recipe.name}: ${recipe.matchPercentage}% match`);
});
```

#### `getIngredientSuggestions(query: string, options?)`

**Autocomplete** - Get ingredient suggestions for partial input.

**Parameters**:
```typescript
query: string; // Minimum 2 characters

options?: {
  limit?: number; // Max 50, default: 10
  category?: string; // Filter by category
  commonOnly?: boolean; // Only common ingredients
}
```

**Returns**:
```typescript
{
  success: boolean;
  suggestions: IngredientSuggestion[];
  error?: string;
}

interface IngredientSuggestion {
  id: string;
  name: string; // Normalized name (lowercase)
  displayName: string; // Properly capitalized
  category: string | null; // e.g., 'vegetables', 'proteins'
  isCommon: boolean;
  recipeCount: number; // Popularity
}
```

**Features**:
- **Fuzzy search**: Uses PostgreSQL pg_trgm extension
- **Typo tolerance**: "toma" finds "tomato"
- **Alias support**: "scallion" finds "green onion"
- **Sorted by**: Common ingredients first, then popularity, then alphabetically

**Example**:
```typescript
const result = await getIngredientSuggestions('chic', { limit: 5 });
// Returns: ['chicken', 'chicken breast', 'chicken thighs', 'chickpeas', ...]
```

#### `getIngredientsByCategory(categories: string | string[])`

Get all ingredients in specific categories.

**Parameters**:
- `categories`: Single category or array (e.g., `'vegetables'` or `['vegetables', 'herbs']`)

**Categories**:
- `vegetables`, `proteins`, `dairy`, `grains`, `spices`, `condiments`
- `herbs`, `fruits`, `nuts`, `oils`, `sweeteners`, `baking`
- `beverages`, `seafood`, `meat`, `poultry`, `legumes`, `pasta`, `other`

**Returns**: Array of ingredients with statistics

#### `getRecipeIngredients(recipeId: string)`

Get the full ingredient list for a specific recipe.

**Returns**:
```typescript
{
  success: boolean;
  ingredients: RecipeIngredientWithDetails[];
  error?: string;
}

interface RecipeIngredientWithDetails {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  amount: string | null; // e.g., "2", "1/2"
  unit: string | null; // e.g., "cups", "tablespoons"
  preparation: string | null; // e.g., "chopped", "diced"
  is_optional: boolean;
  position: number; // Order in recipe
  ingredient_group: string | null; // e.g., "For the sauce"
  ingredient: Ingredient; // Full ingredient details
}
```

#### `getPopularIngredients(limit?: number, category?: string)`

Get the most popular ingredients based on usage statistics.

**Parameters**:
- `limit`: Max 100, default: 20
- `category`: Optional filter by category

**Returns**: Array of ingredients with statistics

**Performance**: Cached for 1 hour

---

### Substitution Actions

**File**: `src/app/actions/substitutions.ts`

#### `getIngredientSubstitutions(ingredient: string, context?)`

Get substitution suggestions for a missing ingredient.

**Parameters**:
```typescript
ingredient: string; // e.g., "butter"

context?: {
  recipeName?: string; // e.g., "Chocolate Chip Cookies"
  cookingMethod?: string; // e.g., "baking", "sautéing"
  userIngredients?: string[]; // What you have available
  dietaryRestrictions?: string[]; // e.g., ['vegan', 'dairy-free']
}
```

**Returns**:
```typescript
{
  success: boolean;
  data?: SubstitutionResult;
  error?: string;
}

interface SubstitutionResult {
  ingredient: string;
  substitutions: Substitution[]; // 0-5 options
  source: 'rule-based' | 'ai' | 'hybrid';
}

interface Substitution {
  name: string; // e.g., "Coconut oil"
  ratio: string; // e.g., "1:1"
  notes?: string; // e.g., "Adds coconut flavor"
  impact?: string; // e.g., "Slightly different texture"
  dietaryTags?: string[]; // e.g., ['vegan', 'dairy-free']
  confidence?: number; // 0-100 (AI-generated only)
}
```

**Substitution Engine**:
- **Rule-based**: 200+ pre-programmed substitutions (instant)
- **AI-powered**: GPT-4o-mini for unusual ingredients (2-3 seconds)
- **Context-aware**: Considers recipe, cooking method, available ingredients
- **Quality-filtered**: Only viable substitutions returned

**Example**:
```typescript
const result = await getIngredientSubstitutions('butter', {
  recipeName: 'Chocolate Chip Cookies',
  cookingMethod: 'baking',
  userIngredients: ['coconut oil', 'olive oil'],
  dietaryRestrictions: ['vegan']
});

if (result.success && result.data) {
  console.log(`Substitutions for ${result.data.ingredient}:`);
  result.data.substitutions.forEach(sub => {
    console.log(`- ${sub.name} (${sub.ratio}): ${sub.notes}`);
  });
}
```

#### `getMultipleIngredientSubstitutions(ingredients: string[], context?)`

Get substitutions for multiple ingredients at once (batch operation).

**Performance**: Runs in parallel, faster than multiple single calls

---

### AI Recipe Actions

**File**: `src/app/actions/ai-recipes.ts`

#### `generateRecipeFromIngredients(ingredients: string[], preferences?)`

Generate a recipe using AI based on ingredients you have.

**Parameters**:
```typescript
ingredients: string[]; // Minimum 2 ingredients

preferences?: {
  cuisine?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  servings?: number;
  dietaryRestrictions?: string[];
  cookingTime?: number; // Max minutes
}
```

**AI Model**: OpenRouter API (primary: Gemini 2.0 Flash, fallback: GPT-4o)

**Returns**: Generated recipe with structured data

**Cost**: ~$0.001-0.01 per generation (OpenRouter pricing)

#### `generateRecipeFromDescription(description: string)`

Generate a recipe from a natural language description.

**Example**:
```typescript
const result = await generateRecipeFromDescription(
  "A quick and healthy vegan dinner with chickpeas and spinach"
);
```

#### `estimateNutrition(recipe: Recipe)`

Estimate nutritional information for a recipe using AI.

**Returns**: Calories, protein, carbs, fat, fiber, etc.

---

### Recipe Import/Export Actions

**File**: `src/app/actions/recipe-import.ts`, `recipe-export.ts`

#### `importRecipeFromUrl(url: string)`

Import a recipe from a URL (scrapes and parses with AI).

**Supported sites**: Most major recipe websites
**Processing time**: 3-10 seconds

#### `exportRecipeAsPdf(recipe: Recipe)`

Export recipe as PDF (downloadable file).

#### `exportRecipeAsJson(recipe: Recipe)`

Export recipe as JSON (structured data).

#### `exportRecipeAsMarkdown(recipe: Recipe)`

Export recipe as Markdown (human-readable).

#### `exportMultipleRecipes(recipes: Recipe[], format: 'pdf' | 'json' | 'markdown' | 'zip')`

Batch export multiple recipes.

**Format `zip`**: Creates ZIP file with all recipes in chosen format

---

### Search Actions

**File**: `src/app/actions/recipe-search.ts`, `semantic-search.ts`

#### `searchRecipes(query: string, options?)`

Full-text search across recipes.

**Options**:
- `cuisine`, `difficulty`, `tags`
- `sortBy`: 'relevance' | 'date' | 'rating'
- `limit`, `offset`

#### `semanticSearch(query: string, options?)`

AI-powered semantic search (understands intent).

**Example**: "healthy dinner for kids" finds relevant recipes even without exact keyword matches

**Performance**: 200-500ms (uses vector embeddings)

---

### User Profile Actions

**File**: `src/app/actions/user-profiles.ts`

#### `getUserProfile(userId?: string)`

Get user profile data.

#### `updateUserProfile(updates: Partial<UserProfile>)`

Update user profile (preferences, dietary restrictions, etc.).

#### `getUserStats(userId?: string)`

Get user statistics (recipes created, favorites, etc.).

---

## API Routes

### Authentication Routes

#### `GET /api/clerk-config`

Returns Clerk configuration for current environment (dev/prod).

**Response**:
```json
{
  "publishableKey": "pk_test_...",
  "environment": "development"
}
```

**Performance**: <50ms (cached)

#### `ALL /api/clerk-proxy/[...path]`

Proxies Clerk API requests with environment awareness.

**Use case**: Dual-environment setup (dev + prod on localhost)

#### `GET /api/debug-clerk`

Debug endpoint for Clerk configuration (development only).

#### `GET /api/security-audit`

Security validation and environment audit.

**Returns**:
```json
{
  "status": "secure",
  "checks": {
    "https": true,
    "environment": "production",
    "clerkConfigured": true,
    "databaseConnected": true
  }
}
```

---

### Recipe Routes

#### `GET /api/recipes`

List recipes (paginated).

**Query params**:
- `limit`: Max 100, default: 20
- `offset`: Pagination offset
- `userId`: Filter by user (optional)

#### `POST /api/recipes`

Create a new recipe (alternative to server action).

**Body**: NewRecipe object (JSON)

#### `GET /api/recipes/[id]`

Get recipe by ID.

#### `PUT /api/recipes/[id]`

Update recipe (user must own).

#### `DELETE /api/recipes/[id]`

Delete recipe (user must own).

#### `GET /api/recipes/paginated`

Paginated recipe listing with advanced filters.

**Query params**:
- All standard filters (cuisine, difficulty, tags)
- `sortBy`, `sortOrder`
- `includePrivate`, `includeSystem`

#### `POST /api/recipes/scrape`

Scrape recipe from URL (background job).

**Body**:
```json
{
  "url": "https://example.com/recipe",
  "userId": "user-123"
}
```

**Returns**: Job ID for status tracking

---

### Search Routes

#### `GET /api/search/semantic`

Semantic search API endpoint.

**Query params**:
- `q`: Search query
- `limit`, `offset`
- `filters`: JSON-encoded filters

**Response**:
```json
{
  "results": [...],
  "totalCount": 42,
  "query": "healthy dinner",
  "responseTime": 234
}
```

---

## Performance Metrics

### Production Benchmarks (October 2025)

**Endpoint Response Times** (95th percentile):

| Endpoint | Average | Target | Status |
|----------|---------|--------|--------|
| Homepage | 138ms | <800ms | ✅ 5.8x better |
| Fridge Search | 150-272ms | <500ms | ✅ Pass |
| Recipe Pages | 160-326ms | <2s | ✅ 6.1x better |
| Ingredients | 181-255ms | <2s | ✅ 7.8x better |
| Discover | 258ms | <2s | ✅ 7.7x better |

**Database Performance**:
- **Indexes**: 15+ active indexes
- **Connection pooling**: Neon PostgreSQL (50 connections)
- **Query optimization**: All critical queries use indexes
- **Edge routing**: Multi-region for low latency

**Caching**:
- **Multi-layer**: Ingredient cache, search cache, popular items cache
- **TTL**: 5-60 minutes depending on data type
- **Cache hit rate**: 60-80% (production)

**Bundle Sizes**:
- **Shared**: 103kB (target: <150kB) ✅
- **Homepage**: 149kB (target: <300kB) ✅
- **Fridge**: 115kB (target: <300kB) ✅
- **Ingredients**: 154kB (target: <300kB) ✅

---

## Error Handling

### Standard Error Response

All server actions return:
```typescript
{
  success: boolean;
  error?: string; // User-friendly error message
  // ... other fields
}
```

All API routes return HTTP status codes:
- **200**: Success
- **201**: Created
- **400**: Bad Request (validation error)
- **401**: Unauthorized (not authenticated)
- **403**: Forbidden (not authorized)
- **404**: Not Found
- **500**: Internal Server Error

### Error Types

**Validation Errors** (400):
```json
{
  "error": "Invalid input",
  "details": {
    "field": "ingredientNames",
    "message": "At least one ingredient required"
  }
}
```

**Authentication Errors** (401):
```json
{
  "error": "Not authenticated",
  "message": "Please sign in to continue"
}
```

**Authorization Errors** (403):
```json
{
  "error": "Access denied",
  "message": "You don't have permission to modify this recipe"
}
```

### Error Handling Best Practices

**Client-side**:
```typescript
const result = await searchRecipesByIngredients(['chicken']);

if (!result.success) {
  // Show user-friendly error
  toast.error(result.error || 'Something went wrong');
  return;
}

// Process results
console.log(`Found ${result.totalCount} recipes`);
```

**Server-side**:
```typescript
try {
  // Database operation
  const recipe = await db.select()...;

  return { success: true, recipe };
} catch (error) {
  console.error('Database error:', error);
  return { success: false, error: 'Failed to fetch recipe' };
}
```

---

## Rate Limiting

### Current Limits (v0.7.1)

**No rate limiting** currently enforced (pre-launch).

**Planned for v0.8.0** (post-launch):

**Anonymous users**:
- 100 requests/minute per IP
- 1,000 requests/hour per IP

**Authenticated users**:
- 300 requests/minute per user
- 10,000 requests/hour per user

**AI endpoints** (higher cost):
- 10 recipe generations/hour (anonymous)
- 50 recipe generations/hour (authenticated)

**Search endpoints**:
- 60 searches/minute (anonymous)
- 120 searches/minute (authenticated)

### Rate Limit Response

**HTTP 429 Too Many Requests**:
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60, // seconds
  "limit": 100,
  "remaining": 0,
  "resetAt": "2025-10-21T12:00:00Z"
}
```

**Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1729512000
Retry-After: 60
```

---

## Webhooks (Future)

### Planned for v0.9.0

#### `POST /api/webhooks/clerk`

Handle Clerk user events (signup, deletion, etc.).

#### `POST /api/webhooks/stripe`

Handle payment events (if premium features added).

---

## SDK / Client Libraries

### TypeScript/JavaScript (Native)

**Recommended**: Use server actions directly from React components.

```typescript
'use client';

import { searchRecipesByIngredients } from '@/app/actions/ingredient-search';

export function FridgeSearch() {
  const [results, setResults] = useState([]);

  async function handleSearch(ingredients: string[]) {
    const result = await searchRecipesByIngredients(ingredients);
    if (result.success) {
      setResults(result.recipes);
    }
  }

  return <div>...</div>;
}
```

### REST API (External)

For non-Next.js clients, use API routes:

```bash
# Get recipes
curl https://recipes.help/api/recipes?limit=10

# Search recipes
curl https://recipes.help/api/search/semantic?q=pasta

# Get recipe by ID
curl https://recipes.help/api/recipes/recipe-uuid-123
```

**Authentication**: Include Clerk session token in `Authorization` header

```bash
curl -H "Authorization: Bearer ${CLERK_TOKEN}" \
  https://recipes.help/api/recipes
```

---

## Changelog

### v0.7.1 (October 21, 2025) - Current

- ✅ Fridge feature ingredient search (4,644 recipes indexed)
- ✅ AI-powered substitutions (hybrid rule-based + GPT-4o-mini)
- ✅ Performance optimization (10/10 score, sub-200ms)
- ✅ SEO infrastructure (5,159 URLs, JSON-LD, OG tags)
- ✅ Analytics integration (Vercel + GA4)

### v0.7.0 (October 15, 2025)

- ✅ Zero-waste pivot complete
- ✅ Ingredient extraction (99.94% coverage)
- ✅ Mobile optimization (5-star code quality)

### v0.6.0 (October 10, 2025)

- Recipe import/export
- Meal planning
- Shopping lists

---

## Support

**Documentation**:
- Fridge Feature Guide: `/docs/guides/FRIDGE_FEATURE_GUIDE.md`
- Authentication Guide: `/docs/guides/AUTHENTICATION_GUIDE.md`
- Environment Setup: `/docs/guides/ENVIRONMENT_SETUP.md`

**Issues**:
- GitHub: [Repository Issues URL]
- Email: support@joanies.kitchen

**Community**:
- Twitter: @joanieskitchen
- Discord: [Coming soon]

---

## Appendix

### Database Schema Quick Reference

**Core tables**:
- `recipes` - User recipes (4,644 indexed)
- `ingredients` - Master ingredient list (4,641 extracted)
- `recipe_ingredients` - Recipe-ingredient relationships
- `ingredient_statistics` - Usage statistics

**Full schema**: `src/lib/db/schema.ts`, `src/lib/db/ingredients-schema.ts`

### Common Query Patterns

**Get recipes by ingredients**:
```typescript
const result = await searchRecipesByIngredients(
  ['chicken', 'rice', 'garlic'],
  { matchMode: 'any', limit: 20 }
);
```

**Get ingredient suggestions**:
```typescript
const suggestions = await getIngredientSuggestions('tom');
// Returns: tomato, tomatoes, cherry tomatoes, etc.
```

**Get substitutions**:
```typescript
const subs = await getIngredientSubstitutions('butter', {
  recipeName: 'Cookies',
  cookingMethod: 'baking'
});
```

**Create recipe**:
```typescript
const result = await createRecipe({
  name: "My Recipe",
  ingredients: JSON.stringify(["ingredient 1", "ingredient 2"]),
  instructions: JSON.stringify(["step 1", "step 2"]),
  // ... other fields
});
```

---

**API Reference Version**: 1.0
**Last Updated**: October 21, 2025
**Next Review**: Post-launch (October 28, 2025)
