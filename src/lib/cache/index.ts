/**
 * Search Cache Module
 *
 * Provides in-memory LRU caching for recipe search operations:
 * - Semantic search (vector embeddings)
 * - Ingredient-based search
 * - Similar recipes lookup
 * - Popular ingredients
 * - Ingredient autocomplete suggestions
 *
 * Features:
 * - Zero external dependencies
 * - Type-safe with generics
 * - LRU eviction policy
 * - TTL-based expiration
 * - Automatic cleanup
 * - Performance monitoring
 *
 * @example
 * ```typescript
 * import { searchCaches, invalidateRecipeCaches } from '@/lib/cache';
 *
 * // Use cache in search function
 * const cacheKey = generateSemanticSearchKey(query, options);
 * const cached = searchCaches.semantic.get(cacheKey);
 * if (cached) return cached;
 *
 * // ... perform search ...
 *
 * searchCaches.semantic.set(cacheKey, results);
 *
 * // Invalidate on recipe CRUD
 * await createRecipe(data);
 * invalidateRecipeCaches();
 * ```
 */

import { CACHE_CLEANUP_INTERVAL, ENABLE_CACHE_STATS, getCacheConfig } from './cache-config';
import { SearchCache } from './search-cache';

export {
  CACHE_CLEANUP_INTERVAL,
  CACHE_CONFIG,
  type CacheConfig,
  DEV_CACHE_CONFIG,
  ENABLE_CACHE_STATS,
  getCacheConfig,
} from './cache-config';
// Export cache utilities
export {
  type CacheStats,
  generateHash,
  generateIngredientSearchKey,
  generateIngredientSuggestionsKey,
  generatePopularIngredientsKey,
  generateSemanticSearchKey,
  generateSimilarRecipesKey,
  SearchCache,
} from './search-cache';

// Initialize cache instances
const config = getCacheConfig();

/**
 * Global cache instances for different search types
 */
export const searchCaches = {
  semantic: new SearchCache(config.semanticSearch.maxSize, config.semanticSearch.ttl),
  ingredient: new SearchCache(config.ingredientSearch.maxSize, config.ingredientSearch.ttl),
  similar: new SearchCache(config.similarRecipes.maxSize, config.similarRecipes.ttl),
  popularIngredients: new SearchCache(
    config.popularIngredients.maxSize,
    config.popularIngredients.ttl
  ),
  ingredientSuggestions: new SearchCache(
    config.ingredientSuggestions.maxSize,
    config.ingredientSuggestions.ttl
  ),
  hybrid: new SearchCache(config.hybridSearch.maxSize, config.hybridSearch.ttl),
};

/**
 * Invalidate all recipe-related caches
 * Call this after recipe CRUD operations
 *
 * @example
 * ```typescript
 * await createRecipe(data);
 * invalidateRecipeCaches();
 * ```
 */
export function invalidateRecipeCaches(): void {
  searchCaches.semantic.clear();
  searchCaches.ingredient.clear();
  searchCaches.similar.clear();
  searchCaches.hybrid.clear();
  // Don't clear popularIngredients and suggestions as they're less affected by single recipe changes

  if (ENABLE_CACHE_STATS) {
    console.log('[Cache] Invalidated all recipe caches after mutation');
  }
}

/**
 * Invalidate semantic search caches only
 * Use when recipe content changes but structure remains
 */
export function invalidateSemanticCaches(): void {
  searchCaches.semantic.clear();
  searchCaches.hybrid.clear();
  searchCaches.similar.clear();

  if (ENABLE_CACHE_STATS) {
    console.log('[Cache] Invalidated semantic search caches');
  }
}

/**
 * Invalidate ingredient-related caches only
 * Use when ingredient data changes
 */
export function invalidateIngredientCaches(): void {
  searchCaches.ingredient.clear();
  searchCaches.popularIngredients.clear();
  searchCaches.ingredientSuggestions.clear();

  if (ENABLE_CACHE_STATS) {
    console.log('[Cache] Invalidated ingredient caches');
  }
}

/**
 * Invalidate caches for a specific recipe
 * Useful for targeted invalidation
 *
 * @param recipeId - ID of the recipe that changed
 */
export function invalidateRecipeById(recipeId: string): void {
  // Delete all similar recipe caches for this recipe
  searchCaches.similar.deletePattern(new RegExp(`^similar:${recipeId}:`));

  if (ENABLE_CACHE_STATS) {
    console.log(`[Cache] Invalidated caches for recipe ${recipeId}`);
  }
}

/**
 * Get cache statistics for all caches
 * Useful for monitoring and debugging
 */
export function getAllCacheStats() {
  return {
    semantic: searchCaches.semantic.getStats(),
    ingredient: searchCaches.ingredient.getStats(),
    similar: searchCaches.similar.getStats(),
    popularIngredients: searchCaches.popularIngredients.getStats(),
    ingredientSuggestions: searchCaches.ingredientSuggestions.getStats(),
    hybrid: searchCaches.hybrid.getStats(),
  };
}

/**
 * Log cache statistics to console (development only)
 */
export function logCacheStats(): void {
  if (!ENABLE_CACHE_STATS) {
    return;
  }

  const stats = getAllCacheStats();
  console.log('[Cache Stats]', {
    semantic: `${stats.semantic.hits}/${stats.semantic.hits + stats.semantic.misses} (${(stats.semantic.hitRate * 100).toFixed(1)}%)`,
    ingredient: `${stats.ingredient.hits}/${stats.ingredient.hits + stats.ingredient.misses} (${(stats.ingredient.hitRate * 100).toFixed(1)}%)`,
    similar: `${stats.similar.hits}/${stats.similar.hits + stats.similar.misses} (${(stats.similar.hitRate * 100).toFixed(1)}%)`,
    popularIngredients: `${stats.popularIngredients.hits}/${stats.popularIngredients.hits + stats.popularIngredients.misses} (${(stats.popularIngredients.hitRate * 100).toFixed(1)}%)`,
    ingredientSuggestions: `${stats.ingredientSuggestions.hits}/${stats.ingredientSuggestions.hits + stats.ingredientSuggestions.misses} (${(stats.ingredientSuggestions.hitRate * 100).toFixed(1)}%)`,
    hybrid: `${stats.hybrid.hits}/${stats.hybrid.hits + stats.hybrid.misses} (${(stats.hybrid.hitRate * 100).toFixed(1)}%)`,
  });
}

/**
 * Periodic cleanup of expired cache entries
 * Runs automatically on a timer
 */
function setupCacheCleanup(): void {
  setInterval(() => {
    const removed = {
      semantic: searchCaches.semantic.cleanup(),
      ingredient: searchCaches.ingredient.cleanup(),
      similar: searchCaches.similar.cleanup(),
      popularIngredients: searchCaches.popularIngredients.cleanup(),
      ingredientSuggestions: searchCaches.ingredientSuggestions.cleanup(),
      hybrid: searchCaches.hybrid.cleanup(),
    };

    const totalRemoved = Object.values(removed).reduce((sum, count) => sum + count, 0);

    if (ENABLE_CACHE_STATS && totalRemoved > 0) {
      console.log(`[Cache Cleanup] Removed ${totalRemoved} expired entries`, removed);
    }
  }, CACHE_CLEANUP_INTERVAL);
}

// Initialize cleanup timer
setupCacheCleanup();

// Log stats periodically in development
if (ENABLE_CACHE_STATS) {
  setInterval(() => {
    logCacheStats();
  }, 60000); // Every minute
}
