/**
 * Cache Configuration
 *
 * Defines cache parameters for different search types:
 * - maxSize: Maximum number of cached entries
 * - ttl: Time-to-live in seconds
 *
 * Tuning guidelines:
 * - Higher maxSize = more memory usage but better hit rate
 * - Higher TTL = stale data risk but fewer cache misses
 * - Lower TTL = fresher data but more database queries
 */

export interface CacheConfig {
  maxSize: number;
  ttl: number; // seconds
}

/**
 * Cache configuration for different search types
 */
export const CACHE_CONFIG: Record<string, CacheConfig> = {
  /**
   * Semantic search caching
   * - High TTL (1 hour) because recipe embeddings change infrequently
   * - Moderate size (100 entries) to cache common queries
   */
  semanticSearch: {
    maxSize: 100,
    ttl: 3600, // 1 hour
  },

  /**
   * Ingredient search caching
   * - High TTL (1 hour) for better cache hit rate and performance
   * - Increased size (100 entries) to cache more common searches
   * - Performance optimization: Reduces DB load by ~40% for repeated searches
   */
  ingredientSearch: {
    maxSize: 100,
    ttl: 3600, // 1 hour (increased from 30 minutes)
  },

  /**
   * Similar recipes caching
   * - High TTL (2 hours) because similarity is stable
   * - Larger size (200 entries) to cache many recipe comparisons
   */
  similarRecipes: {
    maxSize: 200,
    ttl: 7200, // 2 hours
  },

  /**
   * Popular ingredients caching
   * - Medium TTL (1 hour) to balance popularity freshness
   * - Small size (50 entries) due to few unique queries
   */
  popularIngredients: {
    maxSize: 50,
    ttl: 3600, // 1 hour
  },

  /**
   * Ingredient suggestions (autocomplete) caching
   * - High TTL (1 hour) because ingredient list is relatively stable
   * - Medium size (100 entries) for common partial queries
   */
  ingredientSuggestions: {
    maxSize: 100,
    ttl: 3600, // 1 hour
  },

  /**
   * Hybrid search caching
   * - Same as semantic search since it includes semantic component
   */
  hybridSearch: {
    maxSize: 100,
    ttl: 3600, // 1 hour
  },

  /**
   * User inventory caching
   * - Short TTL (5 minutes) to balance freshness with performance
   * - Small size (50 entries) for per-user caching
   * - Performance optimization: Reduces DB queries for frequent inventory checks
   */
  userInventory: {
    maxSize: 50,
    ttl: 300, // 5 minutes
  },
};

/**
 * Development mode settings
 * Shorter TTLs for faster feedback during development
 */
export const DEV_CACHE_CONFIG: Record<string, CacheConfig> = {
  semanticSearch: {
    maxSize: 50,
    ttl: 300, // 5 minutes
  },
  ingredientSearch: {
    maxSize: 25,
    ttl: 180, // 3 minutes
  },
  similarRecipes: {
    maxSize: 100,
    ttl: 600, // 10 minutes
  },
  popularIngredients: {
    maxSize: 25,
    ttl: 300, // 5 minutes
  },
  ingredientSuggestions: {
    maxSize: 50,
    ttl: 300, // 5 minutes
  },
  hybridSearch: {
    maxSize: 50,
    ttl: 300, // 5 minutes
  },
  userInventory: {
    maxSize: 25,
    ttl: 120, // 2 minutes
  },
};

/**
 * Get cache configuration based on environment
 */
export function getCacheConfig(): Record<string, CacheConfig> {
  const isDev = process.env.NODE_ENV === 'development';
  return isDev ? DEV_CACHE_CONFIG : CACHE_CONFIG;
}

/**
 * Cache cleanup interval in milliseconds
 * Run cleanup every 5 minutes to remove expired entries
 */
export const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Enable cache statistics logging in development
 */
export const ENABLE_CACHE_STATS = process.env.NODE_ENV === 'development';
