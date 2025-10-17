/**
 * In-Memory LRU Cache for Search Results
 *
 * Simple, lightweight caching layer with:
 * - LRU (Least Recently Used) eviction policy
 * - TTL (Time-To-Live) expiration
 * - Zero external dependencies
 * - Type-safe with generics
 *
 * @example
 * ```typescript
 * const cache = new SearchCache<RecipeWithSimilarity[]>(100, 3600);
 *
 * // Store value with default TTL
 * cache.set('key', data);
 *
 * // Store value with custom TTL
 * cache.set('key', data, 1800);
 *
 * // Retrieve value
 * const cached = cache.get('key');
 * if (cached) {
 *   return cached;
 * }
 * ```
 */

import { createHash } from 'node:crypto';

/**
 * Cache entry with value and metadata
 */
interface CacheEntry<T> {
  value: T;
  expires: number; // Unix timestamp in milliseconds
  lastAccessed: number; // Unix timestamp in milliseconds
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
}

/**
 * LRU Cache with TTL support
 */
export class SearchCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize: number;
  private defaultTtl: number; // TTL in seconds
  private hits = 0;
  private misses = 0;

  /**
   * Create a new search cache
   *
   * @param maxSize - Maximum number of entries (default: 100)
   * @param defaultTtl - Default TTL in seconds (default: 3600 = 1 hour)
   */
  constructor(maxSize: number = 100, defaultTtl: number = 3600) {
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtl;
  }

  /**
   * Get value from cache
   * Returns null if key doesn't exist or has expired
   */
  get<T = any>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    const now = Date.now();

    // Check if expired
    if (now > entry.expires) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Update last accessed time (for LRU)
    entry.lastAccessed = now;
    this.hits++;
    return entry.value as T;
  }

  /**
   * Store value in cache with optional custom TTL
   *
   * @param key - Cache key
   * @param value - Value to store
   * @param ttl - Optional TTL in seconds (uses default if not provided)
   */
  set<T = any>(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const ttlSeconds = ttl ?? this.defaultTtl;
    const expires = now + ttlSeconds * 1000;

    // Evict LRU entry if at max size
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      expires,
      lastAccessed: now,
    });
  }

  /**
   * Check if key exists in cache (and hasn't expired)
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete specific entry from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate,
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  /**
   * Delete all keys matching a pattern
   *
   * @param pattern - Regex pattern to match keys
   * @returns Number of keys deleted
   *
   * @example
   * // Delete all semantic search caches
   * cache.deletePattern(/^semantic:/);
   */
  deletePattern(pattern: RegExp): number {
    let deleted = 0;
    const keys = Array.from(this.cache.keys());

    for (const key of keys) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    const entries = Array.from(this.cache.entries());

    for (const [key, entry] of entries) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clean up expired entries
   * Should be called periodically to free memory
   *
   * @returns Number of entries removed
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    const entries = Array.from(this.cache.entries());

    for (const [key, entry] of entries) {
      if (now > entry.expires) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

/**
 * Generate a consistent hash from any data
 * Used for creating cache keys from search parameters
 *
 * @param data - Any serializable data
 * @returns MD5 hash of the data
 *
 * @example
 * const key = generateHash({ query: 'pasta', limit: 10 });
 */
export function generateHash(data: any): string {
  const serialized = JSON.stringify(data, Object.keys(data).sort());
  return createHash('md5').update(serialized).digest('hex');
}

/**
 * Generate a cache key for semantic search
 *
 * @param query - Search query
 * @param options - Search options
 * @returns Cache key string
 */
export function generateSemanticSearchKey(
  query: string,
  options: Record<string, any> = {}
): string {
  const queryHash = generateHash(query.trim().toLowerCase());
  const optionsHash = generateHash(options);
  return `semantic:${queryHash}:${optionsHash}`;
}

/**
 * Generate a cache key for ingredient search
 *
 * @param ingredients - Array of ingredient names
 * @param options - Search options
 * @returns Cache key string
 */
export function generateIngredientSearchKey(
  ingredients: string[],
  options: Record<string, any> = {}
): string {
  const sortedIngredients = [...ingredients].sort().map((i) => i.trim().toLowerCase());
  const ingredientsHash = generateHash(sortedIngredients);
  const optionsHash = generateHash(options);
  return `ingredient:${ingredientsHash}:${optionsHash}`;
}

/**
 * Generate a cache key for similar recipes search
 *
 * @param recipeId - Recipe ID
 * @param limit - Result limit
 * @returns Cache key string
 */
export function generateSimilarRecipesKey(recipeId: string, limit: number): string {
  return `similar:${recipeId}:${limit}`;
}

/**
 * Generate a cache key for popular ingredients
 *
 * @param category - Optional category filter
 * @param limit - Result limit
 * @returns Cache key string
 */
export function generatePopularIngredientsKey(category: string | undefined, limit: number): string {
  return `popular_ingredients:${category || 'all'}:${limit}`;
}

/**
 * Generate a cache key for ingredient suggestions
 *
 * @param query - Search query
 * @param options - Search options
 * @returns Cache key string
 */
export function generateIngredientSuggestionsKey(
  query: string,
  options: Record<string, any> = {}
): string {
  const queryHash = generateHash(query.trim().toLowerCase());
  const optionsHash = generateHash(options);
  return `ingredient_suggestions:${queryHash}:${optionsHash}`;
}
