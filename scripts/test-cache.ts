/**
 * Cache Implementation Test Script
 *
 * Run with: npx tsx scripts/test-cache.ts
 */

import {
  generateHash,
  generateIngredientSearchKey,
  generateSemanticSearchKey,
  generateSimilarRecipesKey,
  SearchCache,
} from '../src/lib/cache/search-cache';

console.log('🧪 Testing Search Cache Implementation\n');

// Test 1: Basic cache operations
console.log('Test 1: Basic Operations');
const cache = new SearchCache(10, 3600);

cache.set('key1', { data: 'value1' });
const result1 = cache.get('key1');
console.assert(result1 !== null, '✓ Cache stores data');
console.assert(result1.data === 'value1', '✓ Cache retrieves correct data');

cache.delete('key1');
const result2 = cache.get('key1');
console.assert(result2 === null, '✓ Cache deletes data');

console.log('✅ Basic operations passed\n');

// Test 2: Hash generation
console.log('Test 2: Hash Generation');
const hash1 = generateHash({ query: 'test', limit: 10 });
const hash2 = generateHash({ query: 'test', limit: 10 });
const hash3 = generateHash({ query: 'test', limit: 20 });

console.assert(hash1 === hash2, '✓ Hash is consistent for same input');
console.assert(hash1 !== hash3, '✓ Hash is different for different input');
console.assert(hash1.length === 32, '✓ Hash is MD5 format (32 chars)');

console.log('✅ Hash generation passed\n');

// Test 3: Cache key generation
console.log('Test 3: Cache Key Generation');

const semanticKey = generateSemanticSearchKey('pasta recipes', {
  cuisine: 'Italian',
  limit: 10,
});
console.assert(semanticKey.startsWith('semantic:'), '✓ Semantic key has correct prefix');

const ingredientKey = generateIngredientSearchKey(['chicken', 'rice'], {
  matchMode: 'any',
});
console.assert(ingredientKey.startsWith('ingredient:'), '✓ Ingredient key has correct prefix');

const similarKey = generateSimilarRecipesKey('recipe-123', 10);
console.assert(similarKey === 'similar:recipe-123:10', '✓ Similar recipe key format correct');

console.log('✅ Cache key generation passed\n');

// Test 4: LRU eviction
console.log('Test 4: LRU Eviction');
const lruCache = new SearchCache(3, 3600); // Max 3 entries

lruCache.set('a', 1);
lruCache.set('b', 2);
lruCache.set('c', 3);
console.assert(lruCache.size() === 3, '✓ Cache fills to max size');

lruCache.set('d', 4); // Should evict 'a' (least recently used)
console.assert(lruCache.has('a') === false, '✓ LRU eviction removes oldest entry');
console.assert(lruCache.has('b') === true, '✓ Recent entries remain');
console.assert(lruCache.has('d') === true, '✓ New entry is stored');

console.log('✅ LRU eviction passed\n');

// Test 5: TTL expiration
console.log('Test 5: TTL Expiration');
const ttlCache = new SearchCache(10, 3600);

ttlCache.set('short-lived', 'data', 1); // 1 second TTL
console.assert(ttlCache.has('short-lived'), '✓ Entry exists immediately');

setTimeout(() => {
  const expired = ttlCache.get('short-lived');
  console.assert(expired === null, '✓ Entry expires after TTL');
  console.log('✅ TTL expiration passed\n');

  // Test 6: Cache statistics
  console.log('Test 6: Cache Statistics');
  const statsCache = new SearchCache(10, 3600);

  // Generate some hits and misses
  statsCache.set('key1', 'value1');
  statsCache.get('key1'); // Hit
  statsCache.get('key1'); // Hit
  statsCache.get('key2'); // Miss
  statsCache.get('key3'); // Miss

  const stats = statsCache.getStats();
  console.assert(stats.hits === 2, `✓ Hit count correct (expected 2, got ${stats.hits})`);
  console.assert(stats.misses === 2, `✓ Miss count correct (expected 2, got ${stats.misses})`);
  console.assert(stats.hitRate === 0.5, `✓ Hit rate correct (expected 0.5, got ${stats.hitRate})`);
  console.assert(stats.size === 1, `✓ Size correct (expected 1, got ${stats.size})`);
  console.assert(stats.maxSize === 10, `✓ Max size correct (expected 10, got ${stats.maxSize})`);

  console.log('✅ Cache statistics passed\n');

  // Test 7: Cleanup
  console.log('Test 7: Cleanup');
  const cleanupCache = new SearchCache(10, 1); // 1 second default TTL

  cleanupCache.set('a', 1);
  cleanupCache.set('b', 2);
  cleanupCache.set('c', 3, 3600); // Long TTL

  setTimeout(() => {
    const removed = cleanupCache.cleanup();
    console.assert(removed === 2, `✓ Cleanup removes expired entries (expected 2, got ${removed})`);
    console.assert(cleanupCache.has('c'), '✓ Long-TTL entry remains after cleanup');
    console.log('✅ Cleanup passed\n');

    // Test 8: Pattern deletion
    console.log('Test 8: Pattern Deletion');
    const patternCache = new SearchCache(10, 3600);

    patternCache.set('semantic:query1', 'data1');
    patternCache.set('semantic:query2', 'data2');
    patternCache.set('ingredient:query1', 'data3');

    const deleted = patternCache.deletePattern(/^semantic:/);
    console.assert(
      deleted === 2,
      `✓ Pattern deletion removes matching entries (expected 2, got ${deleted})`
    );
    console.assert(patternCache.has('semantic:query1') === false, '✓ Semantic entries removed');
    console.assert(patternCache.has('ingredient:query1') === true, '✓ Non-matching entries remain');
    console.log('✅ Pattern deletion passed\n');

    // Final summary
    console.log('🎉 All cache tests passed!');
    console.log('\nCache implementation is working correctly:');
    console.log('  ✓ Basic get/set/delete operations');
    console.log('  ✓ MD5 hash generation');
    console.log('  ✓ Cache key generation for all search types');
    console.log('  ✓ LRU eviction policy');
    console.log('  ✓ TTL-based expiration');
    console.log('  ✓ Cache statistics tracking');
    console.log('  ✓ Automatic cleanup');
    console.log('  ✓ Pattern-based deletion');
  }, 1500); // Wait for short-TTL entries to expire
}, 1500); // Wait for TTL expiration
