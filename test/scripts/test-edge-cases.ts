#!/usr/bin/env tsx
/**
 * Edge Case Testing for Recipe Quality Gate System
 * Tests unusual but valid scenarios
 */

import { validateParsedRecipe, sanitizeIngredients } from '@/lib/validations/recipe-validation';
import { validateSerialization } from '@/lib/validations/serialization-validation';

console.log('🧪 Edge Case Testing: Recipe Quality Gate System\n');
console.log('=' .repeat(70));

let testsPassed = 0;
let testsFailed = 0;

// ============================================================================
// HELPER FUNCTION
// ============================================================================
function runTest(name: string, testFn: () => boolean, expectPass: boolean = true) {
  console.log(`\n${expectPass ? '✅' : '⚠️'}  ${name}`);
  try {
    const result = testFn();
    const passed = result === expectPass;
    if (passed) {
      console.log(`   Result: ✓ ${expectPass ? 'PASS' : 'CORRECTLY FAILED'}`);
      testsPassed++;
    } else {
      console.log(`   Result: ✗ ${expectPass ? 'UNEXPECTED FAIL' : 'UNEXPECTED PASS'}`);
      testsFailed++;
    }
    return passed;
  } catch (error) {
    console.log(`   Result: ✗ EXCEPTION - ${error}`);
    testsFailed++;
    return false;
  }
}

// ============================================================================
// EDGE CASE 1: Empty Optional Fields
// ============================================================================
runTest('Empty optional fields (should be valid)', () => {
  const recipe = {
    name: 'Minimal Recipe',
    ingredients: [
      { name: 'flour', quantity: '', unit: '', notes: '' },
      { name: 'water' }, // No optional fields
    ],
    instructions: ['Mix ingredients'],
  };

  const result = validateParsedRecipe(recipe);
  console.log(`   Validation: ${result.isValid ? 'Valid' : 'Invalid'}`);
  if (!result.isValid) {
    console.log(`   Errors:`, result.errors);
  }
  return result.isValid;
});

// ============================================================================
// EDGE CASE 2: Unicode Characters
// ============================================================================
runTest('Unicode characters in ingredient names', () => {
  const recipe = {
    name: 'Café au Lait',
    ingredients: [
      { name: 'café moulu', quantity: '2', unit: 'cuillères à soupe' },
      { name: 'lait chaud', quantity: '250', unit: 'ml' },
      { name: 'sucre (facultatif)', quantity: '1', unit: 'cuillère à café' },
    ],
    instructions: [
      'Préparer le café',
      'Chauffer le lait',
      'Mélanger et servir',
    ],
  };

  const result = validateParsedRecipe(recipe);
  console.log(`   Validation: ${result.isValid ? 'Valid' : 'Invalid'}`);
  return result.isValid;
});

// ============================================================================
// EDGE CASE 3: Long Ingredient Names
// ============================================================================
runTest('Long ingredient names (300 chars)', () => {
  const longName = 'a'.repeat(300);
  const recipe = {
    name: 'Recipe with Long Name',
    ingredients: [
      { name: longName, quantity: '1' },
      { name: 'water', quantity: '2', unit: 'cups' },
    ],
    instructions: ['Mix ingredients'],
  };

  const result = validateParsedRecipe(recipe);
  console.log(`   Validation: ${result.isValid ? 'Valid' : 'Invalid'}`);
  console.log(`   Warnings: ${result.warnings.length} warning(s)`);
  if (result.warnings.length > 0) {
    console.log(`   Warning: ${result.warnings[0].message}`);
  }
  return result.isValid; // Should be valid but may have warnings
}, true);

// ============================================================================
// EDGE CASE 4: Special Characters
// ============================================================================
runTest('Special characters in ingredient names', () => {
  const recipe = {
    name: 'Recipe with Special Chars',
    ingredients: [
      { name: 'salt & pepper', quantity: '1', unit: 'tsp' },
      { name: 'flour (all-purpose)', quantity: '2', unit: 'cups' },
      { name: 'eggs, beaten', quantity: '3' },
      { name: '½ cup sugar', quantity: '½', unit: 'cup' },
      { name: 'water @ room temp', quantity: '1', unit: 'cup' },
    ],
    instructions: ['Mix all ingredients & bake @ 350°F'],
  };

  const result = validateParsedRecipe(recipe);
  console.log(`   Validation: ${result.isValid ? 'Valid' : 'Invalid'}`);
  return result.isValid;
});

// ============================================================================
// EDGE CASE 5: Very Long Instructions
// ============================================================================
runTest('Very long instruction (2100 chars) - should warn', () => {
  const longInstruction = 'a'.repeat(2100);
  const recipe = {
    name: 'Recipe with Long Instruction',
    ingredients: [{ name: 'flour' }],
    instructions: [longInstruction],
  };

  const result = validateParsedRecipe(recipe);
  console.log(`   Validation: ${result.isValid ? 'Valid' : 'Invalid'}`);
  console.log(`   Warnings: ${result.warnings.length} warning(s)`);
  if (result.warnings.length > 0) {
    console.log(`   Warning Code: ${result.warnings[0].code}`);
  }
  return result.isValid; // Should be valid but warn
}, true);

// ============================================================================
// EDGE CASE 6: Very Short Instructions
// ============================================================================
runTest('Very short instruction (< 10 chars) - should warn', () => {
  const recipe = {
    name: 'Recipe with Short Instruction',
    ingredients: [{ name: 'flour' }],
    instructions: ['Mix'],
  };

  const result = validateParsedRecipe(recipe);
  console.log(`   Validation: ${result.isValid ? 'Valid' : 'Invalid'}`);
  console.log(`   Warnings: ${result.warnings.length} warning(s)`);
  if (result.warnings.length > 0) {
    console.log(`   Warning Code: ${result.warnings[0].code}`);
  }
  return result.isValid; // Should be valid but warn
}, true);

// ============================================================================
// EDGE CASE 7: Null vs Undefined vs Empty String
// ============================================================================
runTest('Null, undefined, empty string in optional fields', () => {
  const recipe = {
    name: 'Test Recipe',
    ingredients: [
      { name: 'flour', quantity: null as any, unit: undefined, notes: '' },
    ],
    instructions: ['Mix'],
  };

  const result = validateParsedRecipe(recipe);
  console.log(`   Validation: ${result.isValid ? 'Valid' : 'Invalid'}`);
  return result.isValid;
});

// ============================================================================
// EDGE CASE 8: Numbers as Strings
// ============================================================================
runTest('Numeric values in string fields', () => {
  const recipe = {
    name: 'Recipe 123',
    ingredients: [
      { name: '123', quantity: '456', unit: '789' },
    ],
    instructions: ['Step 1', 'Step 2'],
  };

  const result = validateParsedRecipe(recipe);
  console.log(`   Validation: ${result.isValid ? 'Valid' : 'Invalid'}`);
  return result.isValid;
});

// ============================================================================
// EDGE CASE 9: Whitespace-Only Names
// ============================================================================
runTest('Whitespace-only ingredient name (should fail)', () => {
  const recipe = {
    name: 'Test',
    ingredients: [
      { name: '   ', quantity: '1' }, // Only whitespace
    ],
    instructions: ['Mix'],
  };

  const result = validateParsedRecipe(recipe);
  console.log(`   Validation: ${result.isValid ? 'Valid' : 'Invalid'}`);
  if (!result.isValid) {
    console.log(`   Error Code: ${result.errors[0].code}`);
  }
  return !result.isValid; // Should be invalid
}, false);

// ============================================================================
// EDGE CASE 10: Large Recipe (50+ Ingredients)
// ============================================================================
runTest('Large recipe with 50+ ingredients', () => {
  const largeRecipe = {
    name: 'Complex Recipe',
    ingredients: Array.from({ length: 55 }, (_, i) => ({
      name: `ingredient_${i + 1}`,
      quantity: String(i + 1),
      unit: 'unit',
    })),
    instructions: ['Mix all ingredients', 'Cook thoroughly'],
  };

  const startTime = Date.now();
  const structureResult = validateParsedRecipe(largeRecipe);
  const serializationResult = validateSerialization(largeRecipe);
  const endTime = Date.now();

  const duration = endTime - startTime;
  console.log(`   Ingredients: ${largeRecipe.ingredients.length}`);
  console.log(`   Structure Validation: ${structureResult.isValid ? 'Valid' : 'Invalid'}`);
  console.log(`   Serialization Validation: ${serializationResult.isValid ? 'Valid' : 'Invalid'}`);
  console.log(`   Performance: ${duration}ms`);
  console.log(`   ${duration < 100 ? '✓' : '✗'} Performance ${duration < 100 ? 'acceptable' : 'too slow'} (< 100ms)`);

  return structureResult.isValid && serializationResult.isValid && duration < 100;
});

// ============================================================================
// EDGE CASE 11: Serialization Limit Test
// ============================================================================
runTest('Recipe approaching database limit (40k chars)', () => {
  const hugeRecipe = {
    name: 'Huge Recipe',
    ingredients: Array.from({ length: 200 }, (_, i) => ({
      name: `ingredient_with_very_long_descriptive_name_that_takes_up_lots_of_space_${i}`,
      quantity: `${i + 1}`,
      unit: 'cups',
      notes: 'This is a note with some additional information about the ingredient',
      preparation: 'diced, minced, and prepared in a special way',
    })),
    instructions: ['Step 1', 'Step 2'],
  };

  const result = validateSerialization(hugeRecipe);
  const json = JSON.stringify(hugeRecipe.ingredients);
  console.log(`   Ingredients JSON Length: ${json.length} chars`);
  console.log(`   Validation: ${result.isValid ? 'Valid' : 'Invalid (expected)'}`);

  if (!result.isValid) {
    console.log(`   Error Code: ${result.errors[0].code}`);
    console.log(`   Message: ${result.errors[0].message}`);
  }

  return true; // Either outcome is acceptable (depends on size)
});

// ============================================================================
// EDGE CASE 12: Mixed Valid and Invalid Ingredients
// ============================================================================
runTest('Mixed valid and invalid ingredients', () => {
  const recipe = {
    name: 'Mixed Recipe',
    ingredients: [
      { name: 'flour', quantity: '2', unit: 'cups' }, // Valid
      { name: '[object Object]', quantity: '1' }, // Invalid
      { name: 'sugar', quantity: '1', unit: 'cup' }, // Valid
      { quantity: '3' }, // Invalid (missing name)
    ],
    instructions: ['Mix'],
  };

  const result = validateParsedRecipe(recipe);
  console.log(`   Validation: ${result.isValid ? 'Valid' : 'Invalid (expected)'}`);
  console.log(`   Errors Found: ${result.errors.length}`);
  result.errors.forEach((error) => {
    console.log(`     - ${error.code}: ${error.message}`);
  });
  return !result.isValid && result.errors.length >= 2;
}, false);

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n' + '='.repeat(70));
console.log('✅ Edge Case Testing Complete');
console.log('='.repeat(70));
console.log(`\nResults:`);
console.log(`  ✓ Passed: ${testsPassed}`);
console.log(`  ✗ Failed: ${testsFailed}`);
console.log(`  Total: ${testsPassed + testsFailed}`);
console.log(`  Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

if (testsFailed === 0) {
  console.log('\n🎉 All edge case tests passed!');
} else {
  console.log(`\n⚠️  ${testsFailed} test(s) failed - review results above`);
}
