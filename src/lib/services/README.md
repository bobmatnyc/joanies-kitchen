# Service Layer

Type-safe business logic layer for Joanie's Kitchen. Services provide stateless, testable operations that can be used by API routes, server actions, and background jobs.

## Overview

The service layer separates business logic from presentation logic, making the codebase:
- **More maintainable**: Business logic is centralized and reusable
- **More testable**: Services can be tested independently without HTTP mocking
- **Type-safe**: All operations use Drizzle ORM types for compile-time safety
- **Stateless**: No shared state, making services easy to reason about

## Architecture Principles

### 1. Authentication-Free
Services don't handle authentication. The caller (API route or server action) is responsible for:
- Authenticating the user
- Verifying permissions
- Providing userId when needed

```typescript
// ❌ DON'T: Services don't check auth
class ChefService {
  async create(data: NewChef) {
    await requireAdmin(); // Wrong! Services don't handle auth
    // ...
  }
}

// ✅ DO: Caller handles auth
export async function POST(request: NextRequest) {
  await requireScopes([SCOPES.ADMIN]); // Auth in API route
  const chef = await chefService.create(data);
  return apiSuccess(chef);
}
```

### 2. Error Throwing
Services throw errors for exceptional cases. The caller is responsible for:
- Catching errors
- Formatting error responses
- Logging errors

```typescript
// ✅ Service throws errors
class ChefService {
  async findBySlug(slug: string): Promise<Chef | null> {
    const chef = await db.query.chefs.findFirst({ where: eq(chefs.slug, slug) });
    return chef || null; // Returns null for "not found"
  }

  async create(data: NewChef): Promise<Chef> {
    const [chef] = await db.insert(chefs).values(data).returning();
    if (!chef) throw new Error('Failed to create chef'); // Throws for errors
    return chef;
  }
}

// ✅ Caller formats response
export async function POST(request: NextRequest) {
  try {
    const chef = await chefService.create(data);
    return apiSuccess(chef);
  } catch (error) {
    return apiError(toErrorMessage(error), 500);
  }
}
```

### 3. Type Safety
Services use Drizzle ORM types directly - no extra mapping layers:

```typescript
import { type Chef, type NewChef } from '@/lib/db/chef-schema';

class ChefService {
  async findById(id: string): Promise<Chef | null> { /* ... */ }
  async create(data: NewChef): Promise<Chef> { /* ... */ }
}
```

### 4. Stateless
Services have no instance state. All data is passed as parameters:

```typescript
// ✅ Stateless - userId passed explicitly
async findByUserId(userId: string): Promise<Collection[]>

// ❌ Stateful - would require instance per user
private userId: string;
async findMine(): Promise<Collection[]>
```

## Available Services

### ChefService
Chef CRUD operations and recipe associations.

```typescript
import { chefService } from '@/lib/services';

// Find chefs
const chef = await chefService.findBySlug('kenji-lopez-alt');
const allChefs = await chefService.findAll({ limit: 20 });

// Create/update (admin only - caller enforces)
const newChef = await chefService.create({ name: 'Gordon Ramsay', slug: 'gordon-ramsay' });
await chefService.update(chef.id, { bio: 'Updated bio' });

// Recipe associations
await chefService.linkRecipeToChef({ chefId: chef.id, recipeId: recipe.id });
const recipes = await chefService.findRecipesByChef(chef.id, { limit: 12 });
```

### CollectionService
User recipe collections (themed groupings).

```typescript
import { collectionService } from '@/lib/services';
import { auth } from '@clerk/nextjs/server';

const { userId } = await auth();
if (!userId) throw new Error('Unauthorized');

// Get user's collections
const collections = await collectionService.findByUserId(userId);

// Create collection
const collection = await collectionService.create(userId, {
  name: 'Sunday Dinners',
  description: 'My favorite Sunday recipes',
  is_public: true,
});

// Manage recipes
await collectionService.addRecipe(collection.id, recipeId);
const recipes = await collectionService.getRecipes(collection.id);
await collectionService.removeRecipe(collection.id, recipeId);
```

### InventoryService
Kitchen inventory management and recipe matching.

```typescript
import { inventoryService } from '@/lib/services';
import { auth } from '@clerk/nextjs/server';

const { userId } = await auth();
if (!userId) throw new Error('Unauthorized');

// Get inventory
const items = await inventoryService.findByUserId(userId, {
  status: 'expiring',
  expiringWithinDays: 3,
});

// Add items
const item = await inventoryService.create(userId, {
  ingredient_id: ingredientId,
  storage_location: 'fridge',
  quantity: '2',
  unit: 'lb',
  expiry_date: new Date('2025-03-01'),
});

// Match recipes
const matches = await inventoryService.matchRecipes(userId, {
  minMatchPercentage: 70,
  prioritizeExpiring: true,
  limit: 10,
});

// Track usage
await inventoryService.markAsUsed(item.id, 1.0, 'cooked', recipeId);
```

### IngredientService
Ingredient browsing and search (read-only for most operations).

```typescript
import { ingredientService } from '@/lib/services';

// Browse ingredients
const ingredients = await ingredientService.findAll({
  category: 'vegetables',
  sort: 'most-used',
  limit: 50,
});

// Search
const results = await ingredientService.search('tomato', 10);

// Get ingredient details
const ingredient = await ingredientService.findBySlug('san-marzano-tomato');

// Find recipes using ingredient
const recipes = await ingredientService.getRecipesUsingIngredient(ingredient.id, {
  sortBy: 'popular',
  limit: 20,
});
```

### SocialService
Social features: likes, comments, forks.

```typescript
import { socialService } from '@/lib/services';
import { auth } from '@clerk/nextjs/server';

const { userId } = await auth();
if (!userId) throw new Error('Unauthorized');

// Favorites (likes)
const favorites = await socialService.getFavorites(userId);
await socialService.addFavorite(userId, recipeId);
const isLiked = await socialService.isFavorite(userId, recipeId);
const likeCount = await socialService.getLikeCount(recipeId);

// Comments
const comments = await socialService.getComments(recipeId);
await socialService.addComment(userId, recipeId, 'This recipe is amazing!');
await socialService.updateComment(commentId, 'Updated: Still amazing!');

// Forks
const forkedRecipe = await socialService.forkRecipe(userId, originalRecipeId);
const forkCount = await socialService.getForkCount(recipeId);
```

## Testing Services

Services are designed to be easily testable without HTTP mocking:

```typescript
import { ChefService } from '@/lib/services';

describe('ChefService', () => {
  let service: ChefService;

  beforeEach(() => {
    service = new ChefService();
  });

  it('should find chef by slug', async () => {
    const chef = await service.findBySlug('kenji-lopez-alt');
    expect(chef).toBeDefined();
    expect(chef?.slug).toBe('kenji-lopez-alt');
  });

  it('should return null for non-existent chef', async () => {
    const chef = await service.findBySlug('does-not-exist');
    expect(chef).toBeNull();
  });
});
```

## Usage in API Routes

```typescript
// src/app/api/v1/chefs/route.ts
import { chefService } from '@/lib/services';
import { apiError, apiSuccess } from '@/lib/api';
import { requireScopes, SCOPES } from '@/lib/api-auth';

export const GET = requireScopes([SCOPES.READ_RECIPES], async (request) => {
  try {
    const chefs = await chefService.findAll({ limit: 100 });
    return apiSuccess(chefs);
  } catch (error) {
    return apiError(toErrorMessage(error), 500);
  }
});

export const POST = requireScopes([SCOPES.ADMIN], async (request) => {
  try {
    const data = await request.json();
    const chef = await chefService.create(data);
    return apiSuccess(chef, 201);
  } catch (error) {
    return apiError(toErrorMessage(error), 500);
  }
});
```

## Usage in Server Actions

```typescript
// src/app/actions/collections.ts
'use server';

import { auth } from '@clerk/nextjs/server';
import { collectionService } from '@/lib/services';
import { revalidatePath } from 'next/cache';

export async function createCollection(data: { name: string; description?: string }) {
  try {
    const { userId } = await auth();
    if (!userId) return { success: false, error: 'Unauthorized' };

    const collection = await collectionService.create(userId, data);
    revalidatePath('/collections');

    return { success: true, collection };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}
```

## Migration Guide

To migrate existing server actions to use services:

1. **Extract business logic** from server actions into service methods
2. **Keep auth in actions** - services don't check auth
3. **Keep cache revalidation in actions** - services don't know about Next.js cache
4. **Services throw errors** - actions catch and format them

Before:
```typescript
'use server';
export async function getChefBySlug(slug: string) {
  try {
    const chef = await db.query.chefs.findFirst({ where: eq(chefs.slug, slug) });
    if (!chef) return { success: false, error: 'Chef not found' };
    return { success: true, chef };
  } catch (error) {
    return { success: false, error: 'Failed to get chef' };
  }
}
```

After:
```typescript
'use server';
import { chefService } from '@/lib/services';

export async function getChefBySlug(slug: string) {
  try {
    const chef = await chefService.findBySlug(slug);
    if (!chef) return { success: false, error: 'Chef not found' };
    return { success: true, chef };
  } catch (error) {
    return { success: false, error: 'Failed to get chef' };
  }
}
```

## Best Practices

1. **Always handle null returns**: Services return `null` for not-found cases
2. **Catch service errors**: Services throw for exceptional cases
3. **Pass userId explicitly**: Don't rely on global auth context
4. **Use singleton instances**: Import `chefService`, not `new ChefService()`
5. **Keep services stateless**: No instance variables or shared state

## Next Steps

- Migrate existing server actions to use services
- Add comprehensive unit tests for services
- Create API endpoints using services
- Add integration tests for API routes
