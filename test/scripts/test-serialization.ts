#!/usr/bin/env tsx
/**
 * Serialization Safety Test
 * Verifies that serialization validation catches [object Object] issues
 */

import {
  validateSerialization,
  checkForObjectObject,
  testRoundTrip,
} from '@/lib/validations/serialization-validation';

console.log('🧪 Test 4: Serialization Safety Verification\n');
console.log('=' .repeat(70));

let testsPassed = 0;
let testsFailed = 0;

function runTest(name: string, testFn: () => boolean) {
  console.log(`\n${name}`);
  try {
    const result = testFn();
    if (result) {
      console.log('   Status: ✓ PASS');
      testsPassed++;
    } else {
      console.log('   Status: ✗ FAIL');
      testsFailed++;
    }
    return result;
  } catch (error) {
    console.log(`   Status: ✗ EXCEPTION - ${error}`);
    testsFailed++;
    return false;
  }
}

// ============================================================================
// TEST 4.1: Clean Data (No [object Object])
// ============================================================================
runTest('4.1: Clean data without nested objects', () => {
  const cleanRecipe = {
    name: 'Clean Recipe',
    ingredients: [
      { name: 'flour', quantity: '2', unit: 'cups' },
      { name: 'sugar', quantity: '1', unit: 'cup' },
    ],
    instructions: ['Mix ingredients', 'Bake at 350F'],
  };

  const result = validateSerialization(cleanRecipe);
  const hasObjectObject = checkForObjectObject(cleanRecipe);

  console.log(`   Serialization Valid: ${result.isValid}`);
  console.log(`   Has [object Object]: ${hasObjectObject}`);
  console.log(`   Round-trip: ${testRoundTrip(cleanRecipe)}`);

  return result.isValid && !hasObjectObject && testRoundTrip(cleanRecipe);
});

// ============================================================================
// TEST 4.2: Nested Object Issue
// ============================================================================
runTest('4.2: Nested object in ingredient (should detect)', () => {
  const nestedRecipe = {
    name: 'Recipe with Nested Object',
    ingredients: [
      {
        name: 'flour',
        metadata: { organic: true, source: 'local' }, // Will cause [object Object]
      },
    ],
    instructions: ['Mix'],
  };

  const result = checkForObjectObject(nestedRecipe.ingredients[0]);
  console.log(`   Detected nested object: ${result}`);

  return result === true; // Should detect the issue
});

// ============================================================================
// TEST 4.3: Object as Quantity Value
// ============================================================================
runTest('4.3: Object as quantity value (should detect)', () => {
  const badRecipe = {
    name: 'Bad Recipe',
    ingredients: [
      {
        name: 'flour',
        quantity: { amount: 2, unit: 'cups' } as any, // Invalid
      },
    ],
    instructions: ['Mix'],
  };

  const result = checkForObjectObject(badRecipe.ingredients[0]);
  console.log(`   Detected [object Object]: ${result}`);

  return result === true;
});

// ============================================================================
// TEST 4.4: Array Values (Should Pass)
// ============================================================================
runTest('4.4: Array values are allowed', () => {
  const recipeWithArray = {
    name: 'Recipe',
    ingredients: [{ name: 'flour' }],
    instructions: ['Step 1', 'Step 2', 'Step 3'], // Array is fine
    tags: ['baking', 'dessert'], // Array is fine
  };

  const ingredientCheck = checkForObjectObject(recipeWithArray.ingredients[0]);
  const serializationResult = validateSerialization(recipeWithArray);

  console.log(`   Ingredient has [object Object]: ${ingredientCheck}`);
  console.log(`   Serialization valid: ${serializationResult.isValid}`);

  return !ingredientCheck && serializationResult.isValid;
});

// ============================================================================
// TEST 4.5: String That Looks Like [object Object]
// ============================================================================
runTest('4.5: Literal string "[object Object]" (should detect)', () => {
  const recipe = {
    name: 'Test',
    ingredients: [
      { name: '[object Object]' }, // Literal string (bad)
    ],
    instructions: ['Mix'],
  };

  const serializationResult = validateSerialization(recipe);
  const json = JSON.stringify(recipe.ingredients);
  const hasLiteralString = json.includes('[object Object]');

  console.log(`   JSON contains "[object Object]": ${hasLiteralString}`);
  console.log(`   Serialization valid: ${serializationResult.isValid}`);

  // Serialization should detect this
  return hasLiteralString && !serializationResult.isValid;
});

// ============================================================================
// TEST 4.6: Deep Nested Object
// ============================================================================
runTest('4.6: Deep nested object structure', () => {
  const deepNestedRecipe = {
    name: 'Recipe',
    ingredients: [
      {
        name: 'flour',
        nested: {
          level1: {
            level2: {
              level3: 'value',
            },
          },
        },
      } as any,
    ],
    instructions: ['Mix'],
  };

  const result = checkForObjectObject(deepNestedRecipe.ingredients[0]);
  console.log(`   Detected deep nesting issue: ${result}`);

  return result === true;
});

// ============================================================================
// TEST 4.7: Round-Trip Test
// ============================================================================
runTest('4.7: Round-trip serialization test', () => {
  const recipe = {
    name: 'Test Recipe',
    ingredients: [
      { name: 'flour', quantity: '2', unit: 'cups' },
    ],
    instructions: ['Mix and bake'],
  };

  const roundTripSuccess = testRoundTrip(recipe);
  console.log(`   Round-trip successful: ${roundTripSuccess}`);

  // Additional check: serialize and parse manually
  const serialized = JSON.stringify(recipe);
  const parsed = JSON.parse(serialized);
  const matches = JSON.stringify(parsed) === serialized;

  console.log(`   Manual round-trip matches: ${matches}`);

  return roundTripSuccess && matches;
});

// ============================================================================
// TEST 4.8: Database Limit Check
// ============================================================================
runTest('4.8: Database size limit validation', () => {
  // Create a recipe that exceeds 50k character limit
  const largeRecipe = {
    name: 'Large Recipe',
    ingredients: Array.from({ length: 250 }, (_, i) => ({
      name: `ingredient_with_very_long_descriptive_name_that_consumes_lots_of_json_space_${i}`,
      quantity: `${i + 1}`,
      unit: 'cups',
      notes: 'Additional notes that add to the JSON size',
      preparation: 'Detailed preparation instructions that increase the serialized size',
    })),
    instructions: ['Step 1'],
  };

  const result = validateSerialization(largeRecipe);
  const json = JSON.stringify(largeRecipe.ingredients);

  console.log(`   JSON Length: ${json.length} chars`);
  console.log(`   Exceeds 50k limit: ${json.length > 50000}`);
  console.log(`   Validation caught it: ${!result.isValid}`);

  if (!result.isValid) {
    const sizeError = result.errors.find((e) => e.code === 'SR-005');
    console.log(`   Error Code: ${sizeError?.code}`);
    return sizeError !== undefined;
  }

  return json.length <= 50000; // Pass if under limit
});

// ============================================================================
// TEST 4.9: Undefined vs Null Handling
// ============================================================================
runTest('4.9: Undefined and null handling in serialization', () => {
  const recipe = {
    name: 'Test',
    ingredients: [
      { name: 'flour', quantity: undefined, unit: null } as any,
    ],
    instructions: ['Mix'],
  };

  const json = JSON.stringify(recipe);
  console.log(`   Serialized:`, json);
  console.log(`   Contains [object Object]: ${json.includes('[object Object]')}`);

  const result = validateSerialization(recipe);
  console.log(`   Serialization valid: ${result.isValid}`);

  return result.isValid;
});

// ============================================================================
// TEST 4.10: Function in Data (Should Fail)
// ============================================================================
runTest('4.10: Function in ingredient data', () => {
  const recipeWithFunction = {
    name: 'Test',
    ingredients: [
      {
        name: 'flour',
        calculate: function() { return 2; }, // Function (will be dropped)
      } as any,
    ],
    instructions: ['Mix'],
  };

  try {
    const json = JSON.stringify(recipeWithFunction);
    console.log(`   Serialized (function dropped):`, json.substring(0, 100));

    // Functions are silently dropped by JSON.stringify
    const parsed = JSON.parse(json);
    const hasFunction = typeof parsed.ingredients[0].calculate === 'function';

    console.log(`   Function preserved: ${hasFunction}`);
    return !hasFunction; // Function should be gone
  } catch (error) {
    console.log(`   Serialization failed (expected):`, error);
    return true;
  }
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n' + '='.repeat(70));
console.log('✅ Serialization Safety Test Complete');
console.log('='.repeat(70));
console.log(`\nResults:`);
console.log(`  ✓ Passed: ${testsPassed}`);
console.log(`  ✗ Failed: ${testsFailed}`);
console.log(`  Total: ${testsPassed + testsFailed}`);
console.log(`  Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

if (testsFailed === 0) {
  console.log('\n🎉 All serialization tests passed!');
  console.log('Serialization validation is working correctly.');
} else {
  console.log(`\n⚠️  ${testsFailed} test(s) failed - review results above`);
}
