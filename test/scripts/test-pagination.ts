#!/usr/bin/env tsx

/**
 * Test pagination implementation with various scenarios
 *
 * Usage:
 *   pnpm tsx scripts/test-pagination.ts
 */

import chalk from 'chalk';
import { sql } from 'drizzle-orm';
import { getRecipesPaginated } from '@/app/actions/recipes';
import { db } from '@/lib/db';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function log(message: string, level: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const icons = {
    info: chalk.blue('ℹ'),
    success: chalk.green('✓'),
    error: chalk.red('✗'),
    warn: chalk.yellow('⚠'),
  };
  console.log(`${icons[level]} ${message}`);
}

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    log(`${name} (${duration}ms)`, 'success');
  } catch (error: any) {
    const duration = Date.now() - start;
    results.push({
      name,
      passed: false,
      duration,
      error: error.message,
    });
    log(`${name} - ${error.message}`, 'error');
  }
}

async function testDatabaseIndexes() {
  await runTest('Database indexes exist', async () => {
    const result = await db.execute(sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'recipes'
        AND indexname LIKE 'idx_recipes_%'
      ORDER BY indexname;
    `);

    const indexes = result.rows.map((r: any) => r.indexname);
    const expectedIndexes = [
      'idx_recipes_created',
      'idx_recipes_cuisine',
      'idx_recipes_difficulty',
      'idx_recipes_discovery_week',
      'idx_recipes_public_system',
      'idx_recipes_rating',
      'idx_recipes_system',
      'idx_recipes_user_public',
    ];

    expectedIndexes.forEach((expected) => {
      if (!indexes.includes(expected)) {
        throw new Error(`Missing index: ${expected}`);
      }
    });

    log(`  Found ${indexes.length} indexes`, 'info');
  });
}

async function testBasicPagination() {
  await runTest('Basic pagination (first page)', async () => {
    const result = await getRecipesPaginated({
      page: 1,
      limit: 10,
    });

    if (!result.success) {
      throw new Error(result.error || 'Pagination failed');
    }

    if (!result.data) {
      throw new Error('No data returned');
    }

    if (result.data.recipes.length > 10) {
      throw new Error(`Expected max 10 recipes, got ${result.data.recipes.length}`);
    }

    if (result.data.pagination.page !== 1) {
      throw new Error(`Expected page 1, got ${result.data.pagination.page}`);
    }

    log(
      `  Returned ${result.data.recipes.length} recipes, total: ${result.data.pagination.total}`,
      'info'
    );
  });
}

async function testPaginationMetadata() {
  await runTest('Pagination metadata accuracy', async () => {
    const result = await getRecipesPaginated({
      page: 1,
      limit: 24,
    });

    if (!result.success || !result.data) {
      throw new Error('Failed to get recipes');
    }

    const { pagination } = result.data;

    // Check calculated values
    const expectedTotalPages = Math.ceil(pagination.total / pagination.limit);
    if (pagination.totalPages !== expectedTotalPages) {
      throw new Error(`Total pages mismatch: ${pagination.totalPages} !== ${expectedTotalPages}`);
    }

    const expectedHasMore = pagination.page * pagination.limit < pagination.total;
    if (pagination.hasMore !== expectedHasMore) {
      throw new Error(`hasMore mismatch: ${pagination.hasMore} !== ${expectedHasMore}`);
    }

    log(
      `  Total: ${pagination.total}, Pages: ${pagination.totalPages}, Has more: ${pagination.hasMore}`,
      'info'
    );
  });
}

async function testSorting() {
  await runTest('Sorting by rating', async () => {
    const result = await getRecipesPaginated({
      page: 1,
      limit: 5,
      sort: 'rating',
    });

    if (!result.success || !result.data) {
      throw new Error('Failed to get recipes');
    }

    // Check that ratings are descending (or null)
    const ratings = result.data.recipes.map((r) =>
      r.systemRating ? parseFloat(r.systemRating.toString()) : -1
    );

    for (let i = 0; i < ratings.length - 1; i++) {
      if (ratings[i] < ratings[i + 1] && ratings[i] !== -1) {
        throw new Error(`Ratings not sorted: ${ratings[i]} < ${ratings[i + 1]}`);
      }
    }

    log(`  Ratings: ${ratings.join(', ')}`, 'info');
  });

  await runTest('Sorting by recent', async () => {
    const result = await getRecipesPaginated({
      page: 1,
      limit: 5,
      sort: 'recent',
    });

    if (!result.success || !result.data) {
      throw new Error('Failed to get recipes');
    }

    // Check that dates are descending
    const dates = result.data.recipes.map((r) => new Date(r.createdAt).getTime());

    for (let i = 0; i < dates.length - 1; i++) {
      if (dates[i] < dates[i + 1]) {
        throw new Error(`Dates not sorted: ${new Date(dates[i])} < ${new Date(dates[i + 1])}`);
      }
    }

    log(`  Recent recipes in correct order`, 'info');
  });
}

async function testFiltering() {
  await runTest('Filter by cuisine', async () => {
    const result = await getRecipesPaginated({
      page: 1,
      limit: 10,
      filters: { cuisine: 'Italian' },
    });

    if (!result.success || !result.data) {
      throw new Error('Failed to get recipes');
    }

    result.data.recipes.forEach((recipe) => {
      if (recipe.cuisine !== 'Italian') {
        throw new Error(`Expected Italian, got ${recipe.cuisine}`);
      }
    });

    log(`  Found ${result.data.recipes.length} Italian recipes`, 'info');
  });

  await runTest('Filter by difficulty', async () => {
    const result = await getRecipesPaginated({
      page: 1,
      limit: 10,
      filters: { difficulty: 'easy' },
    });

    if (!result.success || !result.data) {
      throw new Error('Failed to get recipes');
    }

    result.data.recipes.forEach((recipe) => {
      if (recipe.difficulty !== 'easy') {
        throw new Error(`Expected easy, got ${recipe.difficulty}`);
      }
    });

    log(`  Found ${result.data.recipes.length} easy recipes`, 'info');
  });

  await runTest('Filter by minimum rating', async () => {
    const result = await getRecipesPaginated({
      page: 1,
      limit: 10,
      filters: { minRating: 4.0 },
    });

    if (!result.success || !result.data) {
      throw new Error('Failed to get recipes');
    }

    result.data.recipes.forEach((recipe) => {
      if (recipe.systemRating) {
        const rating = parseFloat(recipe.systemRating.toString());
        if (rating < 4.0) {
          throw new Error(`Expected rating >= 4.0, got ${rating}`);
        }
      }
    });

    log(`  Found ${result.data.recipes.length} recipes rated 4.0+`, 'info');
  });

  await runTest('Filter by public recipes', async () => {
    const result = await getRecipesPaginated({
      page: 1,
      limit: 10,
      filters: { isPublic: true },
    });

    if (!result.success || !result.data) {
      throw new Error('Failed to get recipes');
    }

    result.data.recipes.forEach((recipe) => {
      if (!recipe.isPublic) {
        throw new Error(`Expected public recipe, got private`);
      }
    });

    log(`  Found ${result.data.recipes.length} public recipes`, 'info');
  });
}

async function testSearchQuery() {
  await runTest('Search query filter', async () => {
    const result = await getRecipesPaginated({
      page: 1,
      limit: 10,
      filters: { searchQuery: 'chicken' },
    });

    if (!result.success || !result.data) {
      throw new Error('Failed to get recipes');
    }

    // At least one recipe should contain "chicken" in name or description
    const hasMatch = result.data.recipes.some(
      (recipe) =>
        recipe.name.toLowerCase().includes('chicken') ||
        recipe.description?.toLowerCase().includes('chicken')
    );

    if (result.data.recipes.length > 0 && !hasMatch) {
      throw new Error('Search query did not match any results');
    }

    log(`  Found ${result.data.recipes.length} recipes matching "chicken"`, 'info');
  });
}

async function testCombinedFilters() {
  await runTest('Combined filters', async () => {
    const result = await getRecipesPaginated({
      page: 1,
      limit: 10,
      filters: {
        difficulty: 'easy',
        minRating: 3.5,
        isPublic: true,
      },
      sort: 'rating',
    });

    if (!result.success || !result.data) {
      throw new Error('Failed to get recipes');
    }

    result.data.recipes.forEach((recipe) => {
      if (recipe.difficulty !== 'easy') {
        throw new Error(`Expected easy difficulty`);
      }
      if (!recipe.isPublic) {
        throw new Error(`Expected public recipe`);
      }
      if (recipe.systemRating && parseFloat(recipe.systemRating.toString()) < 3.5) {
        throw new Error(`Expected rating >= 3.5`);
      }
    });

    log(`  Found ${result.data.recipes.length} recipes matching all filters`, 'info');
  });
}

async function testPaginationConsistency() {
  await runTest('Pagination consistency across pages', async () => {
    // Get first two pages
    const page1 = await getRecipesPaginated({ page: 1, limit: 5, sort: 'name' });
    const page2 = await getRecipesPaginated({ page: 2, limit: 5, sort: 'name' });

    if (!page1.success || !page1.data || !page2.success || !page2.data) {
      throw new Error('Failed to get pages');
    }

    // Check no duplicate IDs between pages
    const ids1 = new Set(page1.data.recipes.map((r) => r.id));
    const ids2 = new Set(page2.data.recipes.map((r) => r.id));

    ids2.forEach((id) => {
      if (ids1.has(id)) {
        throw new Error(`Duplicate recipe ID across pages: ${id}`);
      }
    });

    // Check alphabetical order
    const names = [
      ...page1.data.recipes.map((r) => r.name),
      ...page2.data.recipes.map((r) => r.name),
    ];

    for (let i = 0; i < names.length - 1; i++) {
      if (names[i].localeCompare(names[i + 1]) > 0) {
        throw new Error(`Names not sorted: ${names[i]} > ${names[i + 1]}`);
      }
    }

    log(`  No duplicates, consistent ordering`, 'info');
  });
}

async function testPerformance() {
  await runTest('Query performance', async () => {
    const iterations = 5;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await getRecipesPaginated({ page: 1, limit: 24 });
      durations.push(Date.now() - start);
    }

    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const max = Math.max(...durations);
    const min = Math.min(...durations);

    if (avg > 500) {
      throw new Error(`Average query time too slow: ${avg}ms`);
    }

    log(`  Avg: ${avg.toFixed(0)}ms, Min: ${min}ms, Max: ${max}ms`, 'info');
  });
}

async function testEdgeCases() {
  await runTest('Empty results', async () => {
    const result = await getRecipesPaginated({
      page: 1,
      limit: 10,
      filters: {
        cuisine: 'NonexistentCuisine12345',
      },
    });

    if (!result.success || !result.data) {
      throw new Error('Failed to get recipes');
    }

    if (result.data.recipes.length !== 0) {
      throw new Error('Expected empty results');
    }

    if (result.data.pagination.total !== 0) {
      throw new Error('Expected zero total');
    }

    if (result.data.pagination.hasMore !== false) {
      throw new Error('Expected hasMore to be false');
    }

    log(`  Correctly handled empty results`, 'info');
  });

  await runTest('Large page number', async () => {
    const result = await getRecipesPaginated({
      page: 9999,
      limit: 24,
    });

    if (!result.success || !result.data) {
      throw new Error('Failed to get recipes');
    }

    if (result.data.recipes.length !== 0) {
      log(`  Unexpected recipes on page 9999`, 'warn');
    }

    log(`  Handled large page number gracefully`, 'info');
  });

  await runTest('Large page size', async () => {
    const result = await getRecipesPaginated({
      page: 1,
      limit: 100, // Max limit
    });

    if (!result.success || !result.data) {
      throw new Error('Failed to get recipes');
    }

    if (result.data.recipes.length > 100) {
      throw new Error(`Expected max 100 recipes, got ${result.data.recipes.length}`);
    }

    log(`  Correctly capped at 100 recipes`, 'info');
  });
}

async function main() {
  console.log(chalk.bold('\n🧪 Pagination Test Suite\n'));

  // Run all test categories
  await testDatabaseIndexes();
  await testBasicPagination();
  await testPaginationMetadata();
  await testSorting();
  await testFiltering();
  await testSearchQuery();
  await testCombinedFilters();
  await testPaginationConsistency();
  await testPerformance();
  await testEdgeCases();

  // Summary
  console.log(chalk.bold('\n📊 Test Summary\n'));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(`Total tests: ${total}`);
  console.log(chalk.green(`Passed: ${passed}`));
  if (failed > 0) {
    console.log(chalk.red(`Failed: ${failed}`));
  }

  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  console.log(`Average duration: ${avgDuration.toFixed(0)}ms\n`);

  if (failed > 0) {
    console.log(chalk.bold.red('❌ Some tests failed:\n'));
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(chalk.red(`  - ${r.name}`));
        console.log(chalk.gray(`    ${r.error}\n`));
      });
    process.exit(1);
  } else {
    console.log(chalk.bold.green('✅ All tests passed!\n'));
    process.exit(0);
  }
}

main();
