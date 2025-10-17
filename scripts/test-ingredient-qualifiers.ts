#!/usr/bin/env tsx
/**
 * Test script for ingredient qualifier handling
 * Tests the hasValidAmountOrQualifier and normalizeIngredient functions
 */

import { hasValidAmountOrQualifier, normalizeIngredient } from '../src/lib/utils/recipe-utils';

// Test cases with expected results
const testCases = [
  // Valid ingredients with amounts
  {
    ingredient: '2 cups all-purpose flour',
    shouldPass: true,
    normalized: '2 cups all-purpose flour',
  },
  { ingredient: '1 tablespoon olive oil', shouldPass: true, normalized: '1 tablespoon olive oil' },
  { ingredient: '½ cup milk', shouldPass: true, normalized: '½ cup milk' },
  { ingredient: 'A pinch of nutmeg', shouldPass: true, normalized: 'A pinch of nutmeg' },

  // Valid ingredients with qualifiers (should normalize)
  { ingredient: 'Salt to taste', shouldPass: true, normalized: 'Salt, to taste' },
  { ingredient: 'Salt, to taste', shouldPass: true, normalized: 'Salt, to taste' },
  { ingredient: 'Black pepper to taste', shouldPass: true, normalized: 'Black pepper, to taste' },
  { ingredient: 'Fresh herbs as needed', shouldPass: true, normalized: 'Fresh herbs, as needed' },
  { ingredient: 'Garnish optional', shouldPass: true, normalized: 'Garnish, optional' },
  { ingredient: 'Parsley for garnish', shouldPass: true, normalized: 'Parsley, for garnish' },

  // Invalid ingredients (no amount or qualifier)
  { ingredient: 'Salt', shouldPass: false, normalized: 'Salt' },
  { ingredient: 'Black pepper', shouldPass: false, normalized: 'Black pepper' },
  { ingredient: 'Garlic', shouldPass: false, normalized: 'Garlic' },
];

console.log('🧪 Testing Ingredient Qualifier Handling\n');
console.log('='.repeat(80));

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const normalized = normalizeIngredient(test.ingredient);
  const hasValid = hasValidAmountOrQualifier(normalized);

  const passedValidation = hasValid === test.shouldPass;
  const passedNormalization = normalized === test.normalized;
  const overallPassed = passedValidation && passedNormalization;

  if (overallPassed) {
    passed++;
    console.log(`✅ Test ${index + 1}: PASSED`);
  } else {
    failed++;
    console.log(`❌ Test ${index + 1}: FAILED`);
  }

  console.log(`   Input:      "${test.ingredient}"`);
  console.log(`   Expected:   "${test.normalized}" (valid: ${test.shouldPass})`);
  console.log(`   Got:        "${normalized}" (valid: ${hasValid})`);

  if (!passedValidation) {
    console.log(`   ⚠️  Validation mismatch: expected ${test.shouldPass}, got ${hasValid}`);
  }
  if (!passedNormalization) {
    console.log(`   ⚠️  Normalization mismatch`);
  }

  console.log('');
});

console.log('='.repeat(80));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

if (failed === 0) {
  console.log('\n🎉 All tests passed!\n');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed. Please review the implementation.\n');
  process.exit(1);
}
