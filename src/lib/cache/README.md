# Search Cache Implementation

**In-Memory LRU Cache for Recipe Manager**

## Quick Start

```typescript
import { searchCaches, generateSemanticSearchKey } from '@/lib/cache';

// Cache is automatically integrated in server actions
// Just use the search functions as normal:
const results = await semanticSearchRecipes(query, options);
```

## Features

- ✅ Zero external dependencies (uses Node.js built-ins only)
- ✅ LRU (Least Recently Used) eviction policy
- ✅ TTL (Time-To-Live) automatic expiration
- ✅ Type-safe with TypeScript generics
- ✅ Automatic cleanup of expired entries
- ✅ Performance monitoring and statistics
- ✅ Environment-aware configuration (dev/prod)

## Cache Instances

| Cache | Max Size | TTL | Purpose |
|-------|----------|-----|---------|
| `semantic` | 100 | 1 hour | Vector embedding searches |
| `ingredient` | 50 | 30 min | Ingredient-based searches |
| `similar` | 200 | 2 hours | Similar recipe lookups |
| `popularIngredients` | 50 | 1 hour | Popular ingredient lists |
| `ingredientSuggestions` | 100 | 1 hour | Autocomplete suggestions |
| `hybrid` | 100 | 1 hour | Hybrid search results |

## Usage Examples

### Automatic Integration

Cache is automatically used in all search server actions:

```typescript
// src/app/actions/semantic-search.ts
export async function semanticSearchRecipes(query, options) {
  const cacheKey = generateSemanticSearchKey(query, options);
  const cached = searchCaches.semantic.get(cacheKey);
  if (cached) return cached; // Cache hit!

  // ... perform search ...

  searchCaches.semantic.set(cacheKey, result);
  return result;
}
```

### Manual Cache Operations

```typescript
import { searchCaches } from '@/lib/cache';

// Direct cache access (if needed)
const key = 'my-custom-key';
const data = searchCaches.semantic.get(key);

if (!data) {
  const freshData = await fetchData();
  searchCaches.semantic.set(key, freshData, 1800); // Custom TTL: 30 min
}
```

### Cache Invalidation

```typescript
import {
  invalidateRecipeCaches,
  invalidateSemanticCaches,
  invalidateIngredientCaches,
  invalidateRecipeById,
} from '@/lib/cache';

// After recipe mutations
await createRecipe(data);
invalidateRecipeCaches(); // Clear all recipe caches

await updateRecipe(id, data);
invalidateRecipeById(id); // Clear specific recipe
invalidateRecipeCaches(); // Clear all searches

await deleteRecipe(id);
invalidateRecipeById(id);
invalidateRecipeCaches();
```

### Monitoring

```typescript
import { getAllCacheStats, logCacheStats } from '@/lib/cache';

// Get stats programmatically
const stats = getAllCacheStats();
console.log(stats.semantic);
// { hits: 45, misses: 15, hitRate: 0.75, size: 38, maxSize: 100 }

// Log all stats (development only)
logCacheStats();
```

## Configuration

### Environment-Based Settings

**Production** (long TTLs, larger sizes):
```typescript
// In CACHE_CONFIG
semanticSearch: { maxSize: 100, ttl: 3600 }  // 1 hour
```

**Development** (short TTLs for faster feedback):
```typescript
// In DEV_CACHE_CONFIG
semanticSearch: { maxSize: 50, ttl: 300 }  // 5 minutes
```

### Custom Configuration

Edit `/src/lib/cache/cache-config.ts`:

```typescript
export const CACHE_CONFIG = {
  semanticSearch: {
    maxSize: 150,  // Increase capacity
    ttl: 7200,     // 2 hours
  },
};
```

## Performance Impact

Expected improvements with cache enabled:

| Operation | Without Cache | With Cache | Speedup |
|-----------|---------------|------------|---------|
| Semantic Search | 250-400ms | 2-5ms | **50-200x** |
| Ingredient Search | 150-300ms | 1-3ms | **50-300x** |
| Similar Recipes | 200-350ms | 2-4ms | **50-175x** |

Target cache hit rates:
- Semantic: 60-80%
- Ingredient: 40-60%
- Similar: 70-90%
- Popular: 90%+

## Implementation Files

```
src/lib/cache/
├── search-cache.ts       # Core LRU cache class
├── cache-config.ts       # Configuration and settings
├── index.ts              # Public API and instances
└── README.md             # This file
```

## Cache Key Generation

Keys are MD5 hashes of normalized parameters:

```typescript
// Semantic search
generateSemanticSearchKey(query, options)
// → "semantic:a3f2b1...:c9e4d2..."

// Ingredient search
generateIngredientSearchKey(ingredients, options)
// → "ingredient:d8f9a2...:b7c3e1..."

// Similar recipes
generateSimilarRecipesKey(recipeId, limit)
// → "similar:recipe-uuid:10"
```

## Automatic Cleanup

- **Expired Entries**: Every 5 minutes
- **Statistics Logging**: Every 1 minute (dev only)
- **LRU Eviction**: On-demand when cache is full

## Development Logging

In development mode (`NODE_ENV=development`), cache operations are logged:

```
[Cache HIT] Semantic search: spicy pasta recipes
[Cache MISS] Ingredient search: chicken, rice
[Cache] Invalidated all recipe caches after mutation
[Cache Cleanup] Removed 5 expired entries
[Cache Stats] {
  semantic: "45/60 (75.0%)",
  ingredient: "20/30 (66.7%)",
  ...
}
```

## Best Practices

### ✅ DO

- Include `userId` in cache keys for access control
- Invalidate caches after recipe mutations
- Monitor cache hit rates in development
- Adjust TTLs based on data volatility

### ❌ DON'T

- Cache user-specific sensitive data
- Set TTL longer than data stability period
- Ignore cache statistics
- Forget to invalidate on mutations

## Troubleshooting

### Low Hit Rate (<50%)

**Causes**: Query diversity too high, TTL too short, cache too small

**Solutions**:
- Increase `maxSize` in config
- Increase `ttl` for stable data
- Normalize query parameters

### Stale Data

**Causes**: TTL too long, missing invalidation

**Solutions**:
- Decrease `ttl` in config
- Add invalidation after mutations
- Force clear: `searchCaches.semantic.clear()`

### High Memory Usage

**Causes**: Cache sizes too large, cleanup not running

**Solutions**:
- Decrease `maxSize` in config
- Verify cleanup timer
- Monitor: `getAllCacheStats()`

## Documentation

- **Detailed Guide**: `/docs/guides/SEARCH_CACHE_GUIDE.md`
- **Implementation**: This directory (`/src/lib/cache/`)
- **Integration**: `/src/app/actions/semantic-search.ts`, `/src/app/actions/ingredient-search.ts`

## Testing

```typescript
import { SearchCache } from '@/lib/cache/search-cache';

// Test basic operations
const cache = new SearchCache(10, 3600);
cache.set('key', 'value');
assert(cache.get('key') === 'value');

// Test TTL expiration
cache.set('key2', 'value2', 1); // 1 second
await sleep(1100);
assert(cache.get('key2') === null);

// Test LRU eviction
const small = new SearchCache(2, 3600);
small.set('a', 1);
small.set('b', 2);
small.set('c', 3); // Evicts 'a'
assert(small.has('a') === false);
```

---

**Version**: 1.0.0
**Last Updated**: 2025-10-17
**Author**: Recipe Manager Team
