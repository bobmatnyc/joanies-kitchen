# API Overview

Comprehensive API documentation for Joanie's Kitchen Recipe Manager.

## Architecture

The application uses a hybrid API architecture:

1. **Server Actions** - Preferred for mutations (Next.js App Router)
2. **REST API Routes** - Used for client-side data fetching
3. **Server Components** - Direct database access for SSR

## Server Actions

Located in `/src/app/actions/`

### Recipe Actions

**File:** `/src/app/actions/recipes.ts`

```typescript
// Create a new recipe
createRecipe(recipe: NewRecipe): Promise<Recipe>

// Update existing recipe
updateRecipe(id: string, updates: Partial<Recipe>): Promise<Recipe>

// Delete recipe
deleteRecipe(id: string): Promise<void>

// Get recipe by ID
getRecipeById(id: string): Promise<Recipe | null>

// Get user's recipes
getUserRecipes(userId: string): Promise<Recipe[]>

// Get public recipes
getPublicRecipes(): Promise<Recipe[]>

// Get system recipes
getSystemRecipes(): Promise<Recipe[]>
```

### AI Recipe Actions

**File:** `/src/app/actions/ai-recipes.ts`

```typescript
// Generate recipe from ingredients
generateRecipeFromIngredients(
  ingredients: string[],
  preferences?: Preferences
): Promise<Recipe>

// Generate recipe from description
generateRecipeFromDescription(
  description: string
): Promise<Recipe>

// Estimate nutrition info
estimateNutrition(recipe: Recipe): Promise<NutritionInfo>
```

### Rating Actions

**File:** `/src/app/actions/rate-recipe.ts`

```typescript
// Rate a recipe
rateRecipe(
  recipeId: string,
  rating: number,
  review?: string
): Promise<RatingResult>

// Get user's rating
getUserRating(recipeId: string): Promise<UserRating | null>

// Delete rating
deleteRating(recipeId: string): Promise<void>
```

### Semantic Search Actions

**File:** `/src/app/actions/semantic-search.ts`

```typescript
// Semantic search
semanticSearchRecipes(
  query: string,
  options?: SearchOptions
): Promise<SemanticSearchResult>

// Hybrid search (semantic + text)
hybridSearchRecipes(
  query: string,
  options?: SearchOptions
): Promise<HybridSearchResult>

// Find similar recipes
findSimilarToRecipe(
  recipeId: string,
  limit?: number
): Promise<SemanticSearchResult>

// Get search suggestions
getSearchSuggestions(
  partial: string,
  limit?: number
): Promise<string[]>
```

### Recipe Discovery Actions

**File:** `/src/app/actions/recipe-discovery.ts`

```typescript
// Discover recipes
discoverRecipes(options: {
  query?: string;
  weeksAgo?: number;
  maxResults?: number;
  autoApprove?: boolean;
}): Promise<DiscoveryResult>
```

## REST API Routes

Located in `/src/app/api/`

### Recipe Endpoints

**Base:** `/api/recipes`

```typescript
// GET /api/recipes
// List all recipes (with filters)
GET /api/recipes?userId=xxx&isPublic=true

// POST /api/recipes
// Create new recipe
POST /api/recipes
Body: NewRecipe

// GET /api/recipes/[id]
// Get specific recipe
GET /api/recipes/abc123

// PUT /api/recipes/[id]
// Update recipe
PUT /api/recipes/abc123
Body: Partial<Recipe>

// DELETE /api/recipes/[id]
// Delete recipe
DELETE /api/recipes/abc123
```

### Search Endpoints

**Base:** `/api/search`

```typescript
// GET /api/search/semantic
// Semantic search (vector-based)
GET /api/search/semantic?q=pasta&limit=10&minSimilarity=0.5

// POST /api/search/semantic
// Advanced semantic search
POST /api/search/semantic
Body: {
  query: string;
  mode: 'semantic' | 'hybrid';
  options: SearchOptions;
}
```

### Crawl Endpoints

**Base:** `/api/crawl`

```typescript
// POST /api/crawl/weekly
// Crawl recipes for specific week
POST /api/crawl/weekly
Body: {
  weeksAgo: number;
  maxResults: number;
  autoApprove: boolean;
}

// GET /api/crawl/status
// Get crawler status
GET /api/crawl/status
```

### Admin Endpoints

**Base:** `/api/admin`

```typescript
// Requires admin authentication

// GET /api/admin/stats
// Get system statistics
GET /api/admin/stats

// POST /api/admin/approve-recipe
// Approve pending recipe
POST /api/admin/approve-recipe
Body: { recipeId: string }
```

### Auth & Debug Endpoints

```typescript
// GET /api/debug-clerk
// Debug Clerk configuration
GET /api/debug-clerk

// GET /api/clerk-config
// Get current Clerk config
GET /api/clerk-config

// GET /api/security-audit
// Security validation
GET /api/security-audit

// GET /api/debug-session
// Debug user session
GET /api/debug-session
```

## Authentication

All API endpoints and server actions use Clerk authentication.

### Protected Routes

```typescript
import { auth } from '@clerk/nextjs';

export async function protectedAction() {
  const { userId } = auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  // Proceed with authenticated operation
}
```

### Admin Routes

```typescript
import { isAdmin } from '@/lib/admin';

export async function adminAction() {
  const admin = await isAdmin();

  if (!admin) {
    throw new Error('Forbidden: Admin access required');
  }

  // Proceed with admin operation
}
```

## Error Handling

### Standard Error Response

```typescript
{
  success: false,
  error: string,
  code?: string
}
```

### Success Response

```typescript
{
  success: true,
  data: any,
  metadata?: {
    count: number,
    page: number,
    // ...
  }
}
```

## Rate Limiting

Currently not implemented. Consider adding for production:

- Recipe generation: 10 requests/minute per user
- Search: 60 requests/minute per user
- Recipe creation: 20 requests/hour per user

## CORS Configuration

Configured in `/next.config.ts`:

```typescript
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
      ],
    },
  ];
}
```

## Type Definitions

See `/src/types/` for TypeScript type definitions:

- `recipe.ts` - Recipe types
- `search.ts` - Search types
- `user.ts` - User types
- `api.ts` - API response types

## Testing APIs

### Using curl

```bash
# Test recipe search
curl http://localhost:3004/api/search/semantic?q=pasta

# Test recipe creation
curl -X POST http://localhost:3004/api/recipes \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Recipe","ingredients":[],"instructions":[]}'
```

### Using Postman

Import the API collection (coming soon) or use the examples above.

## Related Documentation

- [Server Actions Reference](./server-actions.md)
- [Database Schema](../reference/database-schema.md)
- [Authentication Guide](../guides/authentication.md)

---

**Last Updated:** October 2025
**Version:** 1.0.0
