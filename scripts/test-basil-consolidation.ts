#!/usr/bin/env tsx
/**
 * Test Basil Consolidation Mapping
 *
 * Validates that "basil" searches correctly consolidate to "basil leaves"
 * across multiple layers of the application:
 * 1. Consolidation map itself
 * 2. Normalization utilities
 * 3. Ingredient search (database queries)
 * 4. Ingredient suggestions (autocomplete)
 */

import { db } from '@/lib/db';
import { ingredients } from '@/lib/db/ingredients-schema';
import { ilike, or, sql } from 'drizzle-orm';
import {
  applyConsolidation,
  hasConsolidationMapping,
  getVariantsForCanonical,
  getConsolidationStats,
} from '@/lib/ingredients/consolidation-map';
import { normalizeIngredientName } from '@/lib/ingredients/normalization';

// Test results tracker
const results = {
  passed: 0,
  failed: 0,
  tests: [] as Array<{ name: string; status: 'PASS' | 'FAIL'; details?: string }>,
};

function test(name: string, condition: boolean, details?: string) {
  const status = condition ? 'PASS' : 'FAIL';
  results.tests.push({ name, status, details });

  if (condition) {
    results.passed++;
    console.log(`✅ ${name}`);
  } else {
    results.failed++;
    console.log(`❌ ${name}`);
    if (details) console.log(`   Details: ${details}`);
  }
}

async function runTests() {
  console.log('🧪 Testing Basil Consolidation Mapping\n');
  console.log('=' .repeat(60));

  // ============================================================================
  // Test 1: Consolidation Map Basic Functionality
  // ============================================================================
  console.log('\n📋 Test Suite 1: Consolidation Map\n');

  const stats = getConsolidationStats();
  test(
    'Consolidation map is initialized',
    stats.totalMappings > 0,
    `Found ${stats.totalMappings} mappings`
  );

  test(
    '"basil" has consolidation mapping',
    hasConsolidationMapping('basil'),
    'basil should map to basil leaves'
  );

  const basilConsolidation = applyConsolidation('basil');
  test(
    '"basil" consolidates to "basil leaves"',
    basilConsolidation === 'basil leaves',
    `Got: "${basilConsolidation}"`
  );

  const basilLeafConsolidation = applyConsolidation('basil leaf');
  test(
    '"basil leaf" consolidates to "basil leaves"',
    basilLeafConsolidation === 'basil leaves',
    `Got: "${basilLeafConsolidation}"`
  );

  const basilLeavesConsolidation = applyConsolidation('basil leaves');
  test(
    '"basil leaves" stays as "basil leaves" (already canonical)',
    basilLeavesConsolidation === 'basil leaves',
    `Got: "${basilLeavesConsolidation}"`
  );

  const variants = getVariantsForCanonical('basil leaves');
  test(
    'Can retrieve variants for "basil leaves"',
    variants.length === 2 && variants.includes('basil') && variants.includes('basil leaf'),
    `Got variants: [${variants.join(', ')}]`
  );

  // ============================================================================
  // Test 2: Normalization Integration
  // ============================================================================
  console.log('\n📋 Test Suite 2: Normalization Integration\n');

  const normalized1 = normalizeIngredientName('Basil', true);
  test(
    'normalizeIngredientName("Basil") returns "Basil Leaves"',
    normalized1.base === 'Basil Leaves',
    `Got: "${normalized1.base}"`
  );

  const normalized2 = normalizeIngredientName('basil leaf', true);
  test(
    'normalizeIngredientName("basil leaf") returns "Basil Leaves"',
    normalized2.base === 'Basil Leaves',
    `Got: "${normalized2.base}"`
  );

  // Note: "Fresh Basil" preserves "fresh" as a qualifier (it's in PRESERVE_PREFIXES)
  // This is EXPECTED behavior - "fresh" is an important distinction
  const normalized3 = normalizeIngredientName('Fresh Basil', true);
  test(
    'normalizeIngredientName("Fresh Basil") preserves "fresh" prefix (expected behavior)',
    normalized3.base === 'Fresh Basil' || normalized3.base === 'Fresh Basil Leaves',
    `Got base: "${normalized3.base}", preparation: "${normalized3.preparation}". NOTE: "fresh" is a PRESERVE_PREFIX, so "Fresh Basil" is distinct from "Basil"`
  );

  // Test with consolidation disabled
  const normalizedNoConsolidation = normalizeIngredientName('Basil', false);
  test(
    'normalizeIngredientName("Basil", false) does NOT consolidate',
    normalizedNoConsolidation.base === 'Basil',
    `Got: "${normalizedNoConsolidation.base}"`
  );

  // ============================================================================
  // Test 3: Database Integration
  // ============================================================================
  console.log('\n📋 Test Suite 3: Database Integration\n');

  // Check database state
  const basilVariantsInDb = await db
    .select()
    .from(ingredients)
    .where(
      or(
        ilike(ingredients.name, '%basil%'),
        ilike(ingredients.display_name, '%basil%')
      )
    );

  test(
    'Database contains basil-related ingredients',
    basilVariantsInDb.length > 0,
    `Found ${basilVariantsInDb.length} basil variants in database`
  );

  const hasBasilLeaves = basilVariantsInDb.some(
    (ing) => ing.name === 'basil leaves'
  );
  test(
    'Database contains "basil leaves" as canonical form',
    hasBasilLeaves,
    hasBasilLeaves
      ? 'Found "basil leaves" in database'
      : 'WARNING: "basil leaves" not found - consolidation will fail'
  );

  const hasBasilStandalone = basilVariantsInDb.some(
    (ing) => ing.name === 'basil'
  );
  test(
    'Database contains "basil" as variant',
    hasBasilStandalone,
    `Found: ${hasBasilStandalone}`
  );

  // ============================================================================
  // Test 4: Search Query Simulation
  // ============================================================================
  console.log('\n📋 Test Suite 4: Search Query Simulation\n');

  // Simulate search query logic from ingredient-search.ts
  const userQuery = 'basil';
  const normalized = userQuery.toLowerCase().trim();
  const consolidated = applyConsolidation(normalized);

  const searchNames = new Set<string>();
  searchNames.add(consolidated);
  getVariantsForCanonical(consolidated).forEach((v) => searchNames.add(v));
  searchNames.add(normalized);

  const allSearchNames = Array.from(searchNames);

  test(
    'Search query includes consolidated name',
    allSearchNames.includes('basil leaves'),
    `Search names: [${allSearchNames.join(', ')}]`
  );

  test(
    'Search query includes original name',
    allSearchNames.includes('basil'),
    `Search names: [${allSearchNames.join(', ')}]`
  );

  test(
    'Search query includes all variants',
    allSearchNames.includes('basil') &&
      allSearchNames.includes('basil leaf') &&
      allSearchNames.includes('basil leaves'),
    `Search names: [${allSearchNames.join(', ')}]`
  );

  // Execute actual database query
  const foundIngredients = await db
    .select()
    .from(ingredients)
    .where(
      or(
        ...allSearchNames.map((name) =>
          or(
            sql`${ingredients.name} = ${name}`,
            ilike(ingredients.display_name, name)
          )
        )
      )
    );

  test(
    'Database query finds ingredients for "basil" search',
    foundIngredients.length > 0,
    `Found ${foundIngredients.length} matching ingredients`
  );

  const foundBasilLeaves = foundIngredients.find(
    (ing) => ing.name === 'basil leaves'
  );
  test(
    'Query results include "basil leaves" (canonical form)',
    !!foundBasilLeaves,
    foundBasilLeaves
      ? `Found: ${foundBasilLeaves.display_name} (usage: ${foundBasilLeaves.usage_count})`
      : 'Not found'
  );

  // ============================================================================
  // Test 5: Case Sensitivity
  // ============================================================================
  console.log('\n📋 Test Suite 5: Case Sensitivity\n');

  test(
    '"BASIL" (uppercase) consolidates correctly',
    applyConsolidation('BASIL') === 'basil leaves'
  );

  test(
    '"Basil" (title case) consolidates correctly',
    applyConsolidation('Basil') === 'basil leaves'
  );

  test(
    '"  basil  " (with whitespace) consolidates correctly',
    applyConsolidation('  basil  ') === 'basil leaves'
  );

  // ============================================================================
  // Test Summary
  // ============================================================================
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary\n');
  console.log(`Total Tests: ${results.tests.length}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / results.tests.length) * 100).toFixed(1)}%\n`);

  if (results.failed > 0) {
    console.log('❌ Failed Tests:\n');
    results.tests
      .filter((t) => t.status === 'FAIL')
      .forEach((t) => {
        console.log(`- ${t.name}`);
        if (t.details) console.log(`  ${t.details}`);
      });
    console.log('');
  }

  // ============================================================================
  // Database State Report
  // ============================================================================
  console.log('📋 Database State for Basil Variants:\n');
  basilVariantsInDb
    .sort((a, b) => b.usage_count - a.usage_count)
    .forEach((ing) => {
      const isCanonical = ing.name === 'basil leaves' ? '⭐' : '  ';
      console.log(
        `${isCanonical} ${ing.display_name.padEnd(30)} | Usage: ${ing.usage_count.toString().padStart(3)} | Category: ${ing.category}`
      );
    });

  console.log('\n' + '='.repeat(60));

  process.exit(results.failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});
