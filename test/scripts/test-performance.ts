#!/usr/bin/env tsx
/**
 * Performance Testing for Recipe Quality Gate System
 * Validates that validation is fast and doesn't cause memory leaks
 */

import { validateParsedRecipe, sanitizeIngredients } from '@/lib/validations/recipe-validation';
import { validateSerialization } from '@/lib/validations/serialization-validation';

console.log('🧪 Test 6: Performance Testing\n');
console.log('=' .repeat(70));

// ============================================================================
// PERFORMANCE TARGETS
// ============================================================================
const TARGETS = {
  singleRecipeValidation: 100, // ms
  largeRecipeValidation: 100, // ms
  batchValidation: 500, // ms for 10 recipes
  sanitization: 50, // ms
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function measurePerformance(name: string, fn: () => void, target: number): boolean {
  const start = Date.now();
  fn();
  const end = Date.now();
  const duration = end - start;

  const passed = duration <= target;
  console.log(`\n${name}`);
  console.log(`   Duration: ${duration}ms`);
  console.log(`   Target: ${target}ms`);
  console.log(`   Status: ${passed ? '✓ PASS' : '✗ FAIL (too slow)'}`);

  return passed;
}

function createRecipe(ingredientCount: number) {
  return {
    name: `Test Recipe with ${ingredientCount} ingredients`,
    description: 'Performance test recipe',
    ingredients: Array.from({ length: ingredientCount }, (_, i) => ({
      name: `ingredient_${i}`,
      quantity: String(i + 1),
      unit: 'cup',
    })),
    instructions: ['Step 1', 'Step 2', 'Step 3'],
  };
}

let testsPassed = 0;
let testsFailed = 0;

// ============================================================================
// TEST 6.1: Single Small Recipe Validation
// ============================================================================
const test1Passed = measurePerformance(
  '6.1: Single small recipe (5 ingredients)',
  () => {
    const recipe = createRecipe(5);
    validateParsedRecipe(recipe);
    validateSerialization(recipe);
  },
  TARGETS.singleRecipeValidation
);
if (test1Passed) testsPassed++; else testsFailed++;

// ============================================================================
// TEST 6.2: Medium Recipe Validation
// ============================================================================
const test2Passed = measurePerformance(
  '6.2: Medium recipe (20 ingredients)',
  () => {
    const recipe = createRecipe(20);
    validateParsedRecipe(recipe);
    validateSerialization(recipe);
  },
  TARGETS.singleRecipeValidation
);
if (test2Passed) testsPassed++; else testsFailed++;

// ============================================================================
// TEST 6.3: Large Recipe Validation
// ============================================================================
const test3Passed = measurePerformance(
  '6.3: Large recipe (50 ingredients)',
  () => {
    const recipe = createRecipe(50);
    validateParsedRecipe(recipe);
    validateSerialization(recipe);
  },
  TARGETS.largeRecipeValidation
);
if (test3Passed) testsPassed++; else testsFailed++;

// ============================================================================
// TEST 6.4: Very Large Recipe Validation
// ============================================================================
const test4Passed = measurePerformance(
  '6.4: Very large recipe (100 ingredients)',
  () => {
    const recipe = createRecipe(100);
    validateParsedRecipe(recipe);
    validateSerialization(recipe);
  },
  TARGETS.largeRecipeValidation
);
if (test4Passed) testsPassed++; else testsFailed++;

// ============================================================================
// TEST 6.5: Batch Validation (10 Recipes)
// ============================================================================
const test5Passed = measurePerformance(
  '6.5: Batch validation (10 recipes, 15 ingredients each)',
  () => {
    for (let i = 0; i < 10; i++) {
      const recipe = createRecipe(15);
      validateParsedRecipe(recipe);
      validateSerialization(recipe);
    }
  },
  TARGETS.batchValidation
);
if (test5Passed) testsPassed++; else testsFailed++;

// ============================================================================
// TEST 6.6: Sanitization Performance
// ============================================================================
const test6Passed = measurePerformance(
  '6.6: Sanitization (50 string ingredients)',
  () => {
    const stringIngredients = Array.from({ length: 50 }, (_, i) => `ingredient_${i}`);
    sanitizeIngredients(stringIngredients);
  },
  TARGETS.sanitization
);
if (test6Passed) testsPassed++; else testsFailed++;

// ============================================================================
// TEST 6.7: Repeated Validation (Memory Leak Check)
// ============================================================================
console.log('\n6.7: Repeated validation (1000 iterations - memory leak check)');

const recipe = createRecipe(10);
const iterations = 1000;
const memBefore = process.memoryUsage().heapUsed;
const start = Date.now();

for (let i = 0; i < iterations; i++) {
  validateParsedRecipe(recipe);
  validateSerialization(recipe);
}

const end = Date.now();
const memAfter = process.memoryUsage().heapUsed;
const duration = end - start;
const avgTime = duration / iterations;
const memIncrease = (memAfter - memBefore) / 1024 / 1024; // MB

console.log(`   Iterations: ${iterations}`);
console.log(`   Total Duration: ${duration}ms`);
console.log(`   Average per validation: ${avgTime.toFixed(2)}ms`);
console.log(`   Memory before: ${(memBefore / 1024 / 1024).toFixed(2)} MB`);
console.log(`   Memory after: ${(memAfter / 1024 / 1024).toFixed(2)} MB`);
console.log(`   Memory increase: ${memIncrease.toFixed(2)} MB`);

// Memory increase should be minimal (< 10MB for 1000 iterations)
const noMemoryLeak = memIncrease < 10;
const fastEnough = avgTime < 1; // Less than 1ms per validation

console.log(`   ${noMemoryLeak ? '✓' : '✗'} Memory increase acceptable (< 10 MB)`);
console.log(`   ${fastEnough ? '✓' : '✗'} Average time acceptable (< 1ms)`);

const test7Passed = noMemoryLeak && fastEnough;
if (test7Passed) testsPassed++; else testsFailed++;

// ============================================================================
// TEST 6.8: Concurrent Validation
// ============================================================================
console.log('\n6.8: Concurrent validation (10 recipes in parallel)');

const recipes = Array.from({ length: 10 }, (_, i) => createRecipe(15));
const concurrentStart = Date.now();

// Simulate concurrent validation
const validationPromises = recipes.map((recipe) =>
  Promise.resolve().then(() => {
    validateParsedRecipe(recipe);
    validateSerialization(recipe);
  })
);

Promise.all(validationPromises).then(() => {
  const concurrentEnd = Date.now();
  const concurrentDuration = concurrentEnd - concurrentStart;

  console.log(`   Duration: ${concurrentDuration}ms`);
  console.log(`   Target: ${TARGETS.batchValidation}ms`);

  const test8Passed = concurrentDuration <= TARGETS.batchValidation;
  console.log(`   Status: ${test8Passed ? '✓ PASS' : '✗ FAIL'}`);

  if (test8Passed) testsPassed++; else testsFailed++;

  // ============================================================================
  // FINAL SUMMARY
  // ============================================================================
  console.log('\n' + '='.repeat(70));
  console.log('✅ Performance Testing Complete');
  console.log('='.repeat(70));
  console.log(`\nResults:`);
  console.log(`  ✓ Passed: ${testsPassed}`);
  console.log(`  ✗ Failed: ${testsFailed}`);
  console.log(`  Total: ${testsPassed + testsFailed}`);
  console.log(`  Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

  console.log(`\nPerformance Targets:`);
  console.log(`  Single Recipe: ${TARGETS.singleRecipeValidation}ms`);
  console.log(`  Large Recipe (50+ ingredients): ${TARGETS.largeRecipeValidation}ms`);
  console.log(`  Batch (10 recipes): ${TARGETS.batchValidation}ms`);
  console.log(`  Sanitization: ${TARGETS.sanitization}ms`);

  if (testsFailed === 0) {
    console.log('\n🎉 All performance tests passed!');
    console.log('✓ No memory leaks detected');
    console.log('✓ Validation is fast and scalable');
  } else {
    console.log(`\n⚠️  ${testsFailed} test(s) failed - performance optimization needed`);
  }
});
