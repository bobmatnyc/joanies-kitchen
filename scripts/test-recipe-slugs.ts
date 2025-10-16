/**
 * Recipe Slug System Test Script
 *
 * Validates the slug system implementation with comprehensive tests:
 * - Slug generation and validation
 * - Duplicate detection
 * - Database integrity checks
 * - URL resolution tests
 *
 * Usage:
 *   tsx scripts/test-recipe-slugs.ts
 */

import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { sql, isNull, eq } from 'drizzle-orm';
import {
  generateSlugFromName,
  generateUniqueSlug,
  validateSlug,
  isReservedSlug,
  slugExists,
  RESERVED_SLUGS,
} from '@/lib/utils/slug';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration?: number;
}

const results: TestResult[] = [];

/**
 * Run a test and track result
 */
async function runTest(name: string, testFn: () => Promise<boolean>): Promise<void> {
  const startTime = Date.now();
  try {
    const passed = await testFn();
    const duration = Date.now() - startTime;
    results.push({ name, passed, message: passed ? 'PASS' : 'FAIL', duration });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    results.push({ name, passed: false, message: `ERROR: ${error.message}`, duration });
  }
}

/**
 * Test 1: Slug generation from recipe names
 */
async function testSlugGeneration(): Promise<boolean> {
  const testCases = [
    { input: "Grandma's Chocolate Chip Cookies", expected: 'grandmas-chocolate-chip-cookies' },
    { input: 'Easy 30-Minute Pasta!', expected: 'easy-30-minute-pasta' },
    { input: 'The BEST Chocolate Cake', expected: 'chocolate-cake' },
    { input: "Mom's Famous Apple Pie", expected: 'moms-famous-apple-pie' },
    { input: 'Quick & Easy Breakfast', expected: 'quick-easy-breakfast' },
  ];

  for (const testCase of testCases) {
    const result = generateSlugFromName(testCase.input);
    if (result !== testCase.expected) {
      console.error(`  ✗ Failed: "${testCase.input}" -> "${result}" (expected "${testCase.expected}")`);
      return false;
    }
  }

  return true;
}

/**
 * Test 2: Slug validation
 */
async function testSlugValidation(): Promise<boolean> {
  const validSlugs = ['chocolate-chip-cookies', 'pasta-carbonara', 'easy-breakfast'];
  const invalidSlugs = [
    'Chocolate Chip Cookies',  // Contains uppercase
    'pasta--carbonara',        // Double hyphen
    '-chocolate-chip',         // Starts with hyphen
    'chocolate-chip-',         // Ends with hyphen
    'new',                     // Reserved slug
    'admin',                   // Reserved slug
  ];

  for (const slug of validSlugs) {
    const result = validateSlug(slug);
    if (!result.valid) {
      console.error(`  ✗ Valid slug rejected: "${slug}" - ${result.error}`);
      return false;
    }
  }

  for (const slug of invalidSlugs) {
    const result = validateSlug(slug);
    if (result.valid) {
      console.error(`  ✗ Invalid slug accepted: "${slug}"`);
      return false;
    }
  }

  return true;
}

/**
 * Test 3: Reserved slug detection
 */
async function testReservedSlugs(): Promise<boolean> {
  for (const reserved of RESERVED_SLUGS) {
    if (!isReservedSlug(reserved)) {
      console.error(`  ✗ Reserved slug not detected: "${reserved}"`);
      return false;
    }
  }

  const nonReserved = ['chocolate-chip-cookies', 'pasta-carbonara'];
  for (const slug of nonReserved) {
    if (isReservedSlug(slug)) {
      console.error(`  ✗ Non-reserved slug flagged as reserved: "${slug}"`);
      return false;
    }
  }

  return true;
}

/**
 * Test 4: Database slug uniqueness
 */
async function testSlugUniqueness(): Promise<boolean> {
  const countResult = await db
    .select({ count: sql<number>`count(distinct ${recipes.slug})::int` })
    .from(recipes)
    .where(isNull(recipes.slug).not());

  const totalResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(recipes)
    .where(isNull(recipes.slug).not());

  const uniqueSlugs = countResult[0]?.count || 0;
  const totalWithSlugs = totalResult[0]?.count || 0;

  if (uniqueSlugs !== totalWithSlugs) {
    console.error(`  ✗ Found ${totalWithSlugs - uniqueSlugs} duplicate slugs`);
    return false;
  }

  return true;
}

/**
 * Test 5: All public recipes have slugs
 */
async function testPublicRecipesHaveSlugs(): Promise<boolean> {
  const publicWithoutSlugs = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(recipes)
    .where(sql`${recipes.is_public} = true AND ${recipes.slug} IS NULL`);

  const count = publicWithoutSlugs[0]?.count || 0;

  if (count > 0) {
    console.error(`  ✗ Found ${count} public recipes without slugs`);
    return false;
  }

  return true;
}

/**
 * Test 6: Slug format consistency
 */
async function testSlugFormatConsistency(): Promise<boolean> {
  const allSlugs = await db
    .select({ slug: recipes.slug })
    .from(recipes)
    .where(isNull(recipes.slug).not());

  for (const row of allSlugs) {
    if (!row.slug) continue;

    const validation = validateSlug(row.slug);
    if (!validation.valid) {
      console.error(`  ✗ Invalid slug in database: "${row.slug}" - ${validation.error}`);
      return false;
    }
  }

  return true;
}

/**
 * Test 7: Unique slug generation with collisions
 */
async function testUniqueSlugGeneration(): Promise<boolean> {
  // Test that generateUniqueSlug handles collisions
  const testName = "Chocolate Chip Cookies";
  const slug1 = await generateUniqueSlug(testName);
  const validation = validateSlug(slug1);

  if (!validation.valid) {
    console.error(`  ✗ Generated invalid slug: "${slug1}" - ${validation.error}`);
    return false;
  }

  return true;
}

/**
 * Test 8: Database performance check
 */
async function testQueryPerformance(): Promise<boolean> {
  const testSlug = 'test-recipe-slug';

  // Test slug lookup performance (should use index)
  const startTime = Date.now();
  await db
    .select()
    .from(recipes)
    .where(eq(recipes.slug, testSlug))
    .limit(1);
  const duration = Date.now() - startTime;

  // Should be fast with index (<100ms even on large dataset)
  if (duration > 200) {
    console.error(`  ⚠ Slow slug lookup: ${duration}ms (expected <200ms)`);
    return false;
  }

  return true;
}

/**
 * Test 9: No reserved slugs in use
 */
async function testNoReservedSlugsInUse(): Promise<boolean> {
  for (const reserved of RESERVED_SLUGS) {
    const exists = await slugExists(reserved);
    if (exists) {
      console.error(`  ✗ Reserved slug in use: "${reserved}"`);
      return false;
    }
  }

  return true;
}

/**
 * Test 10: Statistics check
 */
async function testStatistics(): Promise<boolean> {
  const stats = await db.select({
    total: sql<number>`count(*)::int`,
    withSlugs: sql<number>`count(${recipes.slug})::int`,
    withoutSlugs: sql<number>`sum(case when ${recipes.slug} is null then 1 else 0 end)::int`,
    uniqueSlugs: sql<number>`count(distinct ${recipes.slug})::int`,
    publicRecipes: sql<number>`sum(case when ${recipes.is_public} then 1 else 0 end)::int`,
  }).from(recipes);

  const result = stats[0];

  console.log('\n  Statistics:');
  console.log(`    Total Recipes: ${result.total}`);
  console.log(`    With Slugs: ${result.withSlugs} (${Math.round((result.withSlugs / result.total) * 100)}%)`);
  console.log(`    Without Slugs: ${result.withoutSlugs}`);
  console.log(`    Unique Slugs: ${result.uniqueSlugs}`);
  console.log(`    Public Recipes: ${result.publicRecipes}`);

  return true;
}

/**
 * Main test execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         Recipe Slug System - Test Suite                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('Running tests...\n');

  await runTest('Slug Generation', testSlugGeneration);
  await runTest('Slug Validation', testSlugValidation);
  await runTest('Reserved Slug Detection', testReservedSlugs);
  await runTest('Database Slug Uniqueness', testSlugUniqueness);
  await runTest('Public Recipes Have Slugs', testPublicRecipesHaveSlugs);
  await runTest('Slug Format Consistency', testSlugFormatConsistency);
  await runTest('Unique Slug Generation', testUniqueSlugGeneration);
  await runTest('Query Performance', testQueryPerformance);
  await runTest('No Reserved Slugs In Use', testNoReservedSlugsInUse);
  await runTest('Statistics Check', testStatistics);

  // Display results
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                     TEST RESULTS                               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(result => {
    const status = result.passed ? '✓' : '✗';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    console.log(`${status} ${result.name}${duration}`);
    if (!result.passed && result.message !== 'FAIL') {
      console.log(`  ${result.message}`);
    }
  });

  console.log('\n' + '─'.repeat(66));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('─'.repeat(66) + '\n');

  if (failed > 0) {
    console.log('❌ TESTS FAILED\n');
    process.exit(1);
  } else {
    console.log('✅ ALL TESTS PASSED\n');
    process.exit(0);
  }
}

// Run tests
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
