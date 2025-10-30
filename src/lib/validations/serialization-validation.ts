/**
 * Serialization Validation (Level 3)
 *
 * JSON safety checks to prevent [object Object] in database.
 * Validates that recipe data can be safely serialized and round-tripped.
 *
 * @module lib/validations/serialization-validation
 */

import type { ValidationError, ValidationResult } from './validation-types';
import { SerializationErrorCode } from './validation-types';

// ============================================================================
// SERIALIZATION VALIDATION
// ============================================================================

/**
 * Validate that recipe can be safely serialized to JSON (Level 3)
 * CRITICAL: Prevents [object Object] in database
 *
 * @param recipe - Recipe object to validate for serialization
 * @returns Validation result with errors if serialization fails
 */
export function validateSerialization(recipe: any): ValidationResult {
  const errors: ValidationError[] = [];

  try {
    // 1. Serialize ingredients
    const ingredientsJson = JSON.stringify(recipe.ingredients);

    // 2. Check for [object Object] in serialized string
    if (ingredientsJson.includes('[object Object]')) {
      errors.push({
        field: 'ingredients',
        code: SerializationErrorCode.OBJECT_OBJECT_IN_JSON,
        message: 'Ingredients contain [object Object] when serialized',
        severity: 'critical',
        suggestion: 'Ensure all ingredient objects have string properties',
      });
    }

    // 3. Validate round-trip (serialize and deserialize)
    const parsed = JSON.parse(ingredientsJson);

    // 4. Verify parsed ingredients have name property
    if (Array.isArray(parsed)) {
      parsed.forEach((ingredient: any, index: number) => {
        if (typeof ingredient === 'object' && ingredient !== null && !ingredient.name) {
          errors.push({
            field: `ingredients[${index}]`,
            code: SerializationErrorCode.MISSING_NAME_AFTER_PARSE,
            message: 'Ingredient missing name after serialization',
            severity: 'critical',
          });
        }
      });
    }

    // 5. Check serialized length (database limit)
    const MAX_JSON_LENGTH = 50000;
    if (ingredientsJson.length > MAX_JSON_LENGTH) {
      errors.push({
        field: 'ingredients',
        code: SerializationErrorCode.EXCEEDS_DATABASE_LIMIT,
        message: `Ingredients JSON exceeds database limit (${ingredientsJson.length} > ${MAX_JSON_LENGTH} chars)`,
        severity: 'critical',
        suggestion: 'Recipe has too many ingredients or excessive text',
      });
    }

    // 6. Validate instructions serialization
    const instructionsJson = JSON.stringify(recipe.instructions);
    if (instructionsJson.includes('[object Object]')) {
      errors.push({
        field: 'instructions',
        code: SerializationErrorCode.INSTRUCTIONS_CORRUPTION,
        message: 'Instructions contain [object Object] when serialized',
        severity: 'critical',
      });
    }

    if (instructionsJson.length > MAX_JSON_LENGTH) {
      errors.push({
        field: 'instructions',
        code: SerializationErrorCode.EXCEEDS_DATABASE_LIMIT,
        message: `Instructions JSON exceeds database limit (${instructionsJson.length} > ${MAX_JSON_LENGTH} chars)`,
        severity: 'critical',
        suggestion: 'Recipe has too many steps or excessive text',
      });
    }
  } catch (error) {
    errors.push({
      field: 'recipe',
      code: SerializationErrorCode.SERIALIZATION_FAILED,
      message: `Serialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      severity: 'critical',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: [],
    canAutoFix: false,
  };
}

/**
 * Quick check for [object Object] in any serialized data
 *
 * Also detects nested objects that would serialize to [object Object]
 *
 * @param data - Data to check for serialization issues
 * @returns true if [object Object] detected or would appear after serialization, false otherwise
 */
export function checkForObjectObject(data: any): boolean {
  try {
    const json = JSON.stringify(data);

    // Direct check for [object Object] in serialized string
    if (json.includes('[object Object]')) {
      return true;
    }

    // Check for object properties that aren't primitives
    // These would serialize to [object Object] when converted to strings
    if (typeof data === 'object' && data !== null) {
      for (const key of Object.keys(data)) {
        const value = data[key];
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          // Found a nested object that will serialize to [object Object]
          return true;
        }
      }
    }

    return false;
  } catch {
    return true; // Consider serialization failure as a problem
  }
}

/**
 * Test round-trip serialization safety
 *
 * Ensures data can be serialized and deserialized without corruption
 *
 * @param data - Data to test
 * @returns true if round-trip succeeds, false otherwise
 */
export function testRoundTrip(data: any): boolean {
  try {
    const serialized = JSON.stringify(data);
    const parsed = JSON.parse(serialized);
    // Basic equality check (not deep equality)
    return serialized === JSON.stringify(parsed);
  } catch {
    return false;
  }
}
