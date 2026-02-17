#!/usr/bin/env tsx
/**
 * Manual test for recipe validation system
 * Run with: tsx scripts/test-validation.ts
 */

import { validateParsedRecipe, sanitizeIngredients } from '@/lib/validations/recipe-validation';
import { validateSerialization, checkForObjectObject } from '@/lib/validations/serialization-validation';

// ============================================================================
// TEST CASES
// ============================================================================

console.log('🧪 Testing Recipe Validation System\n');
console.log('=' .repeat(60));

// Test 1: Valid Recipe
console.log('\n✅ Test 1: Valid Recipe');
const validRecipe = {
  name: 'Chocolate Chip Cookies',
  description: 'Classic chocolate chip cookies',
  ingredients: [
    { name: 'all-purpose flour', quantity: '2', unit: 'cups' },
    { name: 'butter', quantity: '1', unit: 'cup', preparation: 'softened' },
    { name: 'chocolate chips', quantity: '2', unit: 'cups' },
  ],
  instructions: [
    'Preheat oven to 375F',
    'Mix butter and sugar until fluffy',
    'Add dry ingredients and chocolate chips',
    'Bake for 10-12 minutes',
  ],
  prep_time: 15,
  cook_time: 12,
  servings: 24,
  difficulty: 'easy' as const,
  cuisine: 'American',
  tags: ['dessert', 'baking'],
};

const validResult = validateParsedRecipe(validRecipe);
console.log('Structure validation:', validResult.isValid ? '✓ PASS' : '✗ FAIL');
if (!validResult.isValid) {
  console.log('Errors:', validResult.errors);
}

const validSerializationResult = validateSerialization(validRecipe);
console.log('Serialization validation:', validSerializationResult.isValid ? '✓ PASS' : '✗ FAIL');

// Test 2: Recipe with [object Object]
console.log('\n❌ Test 2: Recipe with [object Object] (should FAIL)');
const badRecipe = {
  name: 'Bad Recipe',
  ingredients: [
    { name: '[object Object]' }, // This should be caught
  ],
  instructions: ['Mix ingredients'],
};

const badResult = validateParsedRecipe(badRecipe);
console.log('Structure validation:', badResult.isValid ? '✗ UNEXPECTED PASS' : '✓ CORRECTLY FAILED');
if (!badResult.isValid) {
  console.log('Errors caught:');
  badResult.errors.forEach((err) => {
    console.log(`  - ${err.code}: ${err.message}`);
  });
}

// Test 3: String ingredients (auto-sanitization)
console.log('\n🔧 Test 3: String Ingredients (auto-sanitization)');
const stringIngredients = ['flour', 'sugar', 'eggs', 'vanilla extract'];
console.log('Before:', stringIngredients);

const sanitized = sanitizeIngredients(stringIngredients);
console.log('After:', sanitized.sanitized);
console.log('Modified:', sanitized.modified ? '✓ YES' : '✗ NO');
console.log('Changes:', sanitized.changes);

// Test 4: Missing ingredient name
console.log('\n❌ Test 4: Missing Ingredient Name (should FAIL)');
const missingNameRecipe = {
  name: 'Recipe with Missing Names',
  ingredients: [
    { quantity: '2', unit: 'cups' }, // Missing name
    { name: 'sugar' },
  ],
  instructions: ['Mix and bake'],
};

const missingNameResult = validateParsedRecipe(missingNameRecipe);
console.log('Structure validation:', missingNameResult.isValid ? '✗ UNEXPECTED PASS' : '✓ CORRECTLY FAILED');
if (!missingNameResult.isValid) {
  console.log('Errors caught:');
  missingNameResult.errors.forEach((err) => {
    console.log(`  - ${err.code}: ${err.message}`);
  });
}

// Test 5: Serialization check
console.log('\n🔍 Test 5: Serialization Check');
const cleanData = { name: 'flour', quantity: '2', unit: 'cups' };
const dirtyData = { name: 'flour', quantity: {} }; // Object instead of string

console.log('Clean data has [object Object]:', checkForObjectObject(cleanData) ? '✗ YES (BAD)' : '✓ NO (GOOD)');
console.log('Dirty data has [object Object]:', checkForObjectObject(dirtyData) ? '✓ YES (DETECTED)' : '✗ NO (MISSED)');

// Test 6: Auto-sanitization with alternate property names
console.log('\n🔧 Test 6: Auto-sanitization with Alternate Properties');
const alternateIngredients = [
  { ingredient: 'flour', quantity: '2', unit: 'cups' }, // 'ingredient' instead of 'name'
  { item: 'sugar' }, // 'item' instead of 'name'
  { text: 'vanilla' }, // 'text' instead of 'name'
];

const alternateSanitized = sanitizeIngredients(alternateIngredients);
console.log('Modified:', alternateSanitized.modified ? '✓ YES' : '✗ NO');
console.log('Results:');
alternateSanitized.sanitized.forEach((ing, idx) => {
  console.log(`  [${idx}] name: "${ing.name}"`);
});

// Test 7: Empty instructions
console.log('\n❌ Test 7: Empty Instructions (should FAIL)');
const emptyInstructionsRecipe = {
  name: 'Recipe with No Instructions',
  ingredients: [{ name: 'flour' }],
  instructions: [],
};

const emptyInstructionsResult = validateParsedRecipe(emptyInstructionsRecipe);
console.log('Structure validation:', emptyInstructionsResult.isValid ? '✗ UNEXPECTED PASS' : '✓ CORRECTLY FAILED');
if (!emptyInstructionsResult.isValid) {
  console.log('Error:', emptyInstructionsResult.errors[0].message);
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('✅ Validation System Test Complete');
console.log('='.repeat(60));
