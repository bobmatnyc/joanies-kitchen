/**
 * Validation Tests
 *
 * Tests for recipe quality gate validation system
 */

import { sanitizeIngredients, validateParsedRecipe } from '../recipe-validation';
import { checkForObjectObject, validateSerialization } from '../serialization-validation';

// ============================================================================
// TEST DATA
// ============================================================================

const VALID_RECIPE = {
  name: 'Test Recipe',
  description: 'A test recipe',
  ingredients: [
    { name: 'flour', quantity: '2', unit: 'cups' },
    { name: 'sugar', quantity: '1', unit: 'cup' },
    { name: 'eggs', quantity: '2' },
  ],
  instructions: ['Mix dry ingredients', 'Add eggs', 'Bake at 350F for 30 minutes'],
  prep_time: 15,
  cook_time: 30,
  servings: 8,
  difficulty: 'easy' as const,
  cuisine: 'American',
  tags: ['baking', 'dessert'],
};

const RECIPE_WITH_OBJECT_OBJECT = {
  name: 'Bad Recipe',
  ingredients: [
    { name: '[object Object]' }, // Invalid
  ],
  instructions: ['Step 1'],
};

const RECIPE_MISSING_INGREDIENT_NAME = {
  name: 'Bad Recipe',
  ingredients: [
    { quantity: '2', unit: 'cups' }, // Missing name
  ],
  instructions: ['Step 1'],
};

const _RECIPE_WITH_STRING_INGREDIENTS = {
  name: 'Recipe with String Ingredients',
  ingredients: ['flour', 'sugar', 'eggs'], // Should be objects
  instructions: ['Mix and bake'],
};

// ============================================================================
// STRUCTURE VALIDATION TESTS
// ============================================================================

describe('validateParsedRecipe', () => {
  it('should pass validation for valid recipe', () => {
    const result = validateParsedRecipe(VALID_RECIPE);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail validation for [object Object] in ingredient name', () => {
    const result = validateParsedRecipe(RECIPE_WITH_OBJECT_OBJECT);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].code).toBe('IV-004');
  });

  it('should fail validation for missing ingredient name', () => {
    const result = validateParsedRecipe(RECIPE_MISSING_INGREDIENT_NAME);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].code).toBe('IV-001');
  });

  it('should fail validation for empty recipe name', () => {
    const recipe = { ...VALID_RECIPE, name: '' };
    const result = validateParsedRecipe(recipe);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe('SV-002');
  });

  it('should fail validation for missing ingredients', () => {
    const recipe = { ...VALID_RECIPE, ingredients: [] };
    const result = validateParsedRecipe(recipe);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe('SV-003');
  });

  it('should fail validation for missing instructions', () => {
    const recipe = { ...VALID_RECIPE, instructions: [] };
    const result = validateParsedRecipe(recipe);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe('SV-005');
  });
});

// ============================================================================
// SANITIZATION TESTS
// ============================================================================

describe('sanitizeIngredients', () => {
  it('should convert string ingredients to objects', () => {
    const result = sanitizeIngredients(['flour', 'sugar', 'eggs']);
    expect(result.modified).toBe(true);
    expect(result.sanitized).toEqual([{ name: 'flour' }, { name: 'sugar' }, { name: 'eggs' }]);
  });

  it('should preserve valid ingredient objects', () => {
    const validIngredients = [{ name: 'flour', quantity: '2', unit: 'cups' }, { name: 'sugar' }];
    const result = sanitizeIngredients(validIngredients);
    expect(result.modified).toBe(false);
    expect(result.sanitized).toEqual(validIngredients);
  });

  it('should handle objects with alternate property names', () => {
    const ingredients = [
      { ingredient: 'flour', quantity: '2', unit: 'cups' }, // 'ingredient' instead of 'name'
    ];
    const result = sanitizeIngredients(ingredients);
    expect(result.modified).toBe(true);
    expect(result.sanitized[0].name).toBe('flour');
  });

  it('should track changes made during sanitization', () => {
    const result = sanitizeIngredients(['flour', 'sugar']);
    expect(result.changes.length).toBe(2);
    expect(result.changes[0]).toContain('Converted string to object');
  });
});

// ============================================================================
// SERIALIZATION VALIDATION TESTS
// ============================================================================

describe('validateSerialization', () => {
  it('should pass serialization for valid recipe', () => {
    const result = validateSerialization(VALID_RECIPE);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail serialization if [object Object] appears in JSON', () => {
    const _badRecipe = {
      name: 'Bad Recipe',
      ingredients: [{ name: 'flour', nested: { data: 'value' } }], // Will serialize to [object Object]
      instructions: ['Step 1'],
    };

    // Manually create object with toString override to produce [object Object]
    const problematicRecipe = {
      name: 'Test',
      ingredients: [{ name: 'flour', quantity: {} as any }], // Object instead of string
      instructions: ['Step 1'],
    };

    const result = validateSerialization(problematicRecipe);
    // This should detect [object Object] in the serialized output
    expect(result.isValid).toBe(false);
  });

  it('should detect missing name after serialization round-trip', () => {
    const recipe = {
      name: 'Test',
      ingredients: [{ quantity: '2', unit: 'cups' }], // No name
      instructions: ['Step 1'],
    };

    const result = validateSerialization(recipe);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe('SR-003');
  });
});

describe('checkForObjectObject', () => {
  it('should detect [object Object] in data', () => {
    const data = { quantity: {} }; // Object as value
    const result = checkForObjectObject(data);
    expect(result).toBe(true);
  });

  it('should not detect [object Object] in clean data', () => {
    const data = { name: 'flour', quantity: '2', unit: 'cups' };
    const result = checkForObjectObject(data);
    expect(result).toBe(false);
  });
});
