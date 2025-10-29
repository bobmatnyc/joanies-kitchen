/**
 * Recipe Validation (Level 2)
 *
 * Structure validation for parsed recipes.
 * Prevents [object Object] by ensuring proper ingredient and instruction structure.
 *
 * @module lib/validations/recipe-validation
 */

import type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  IngredientObject,
  SanitizationResult,
} from './validation-types';
import {
  StructureErrorCode,
  IngredientErrorCode,
  InstructionErrorCode,
} from './validation-types';

// ============================================================================
// CORE VALIDATION
// ============================================================================

/**
 * Validate parsed recipe structure (Level 2)
 * Prevents [object Object] by ensuring proper ingredient structure
 *
 * @param recipe - Parsed recipe object
 * @returns Validation result with errors and warnings
 */
export function validateParsedRecipe(recipe: any): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 1. Validate name
  if (!recipe.name || typeof recipe.name !== 'string') {
    errors.push({
      field: 'name',
      code: StructureErrorCode.MISSING_NAME,
      message: 'Recipe name is required',
      severity: 'critical',
    });
  } else if (recipe.name.trim().length === 0) {
    errors.push({
      field: 'name',
      code: StructureErrorCode.INVALID_NAME,
      message: 'Recipe name cannot be empty',
      severity: 'critical',
    });
  } else if (recipe.name.includes('[object Object]')) {
    errors.push({
      field: 'name',
      code: StructureErrorCode.INVALID_NAME,
      message: 'Recipe name contains [object Object]',
      severity: 'critical',
    });
  }

  // 2. Validate ingredients array
  if (!Array.isArray(recipe.ingredients)) {
    errors.push({
      field: 'ingredients',
      code: StructureErrorCode.INVALID_INGREDIENTS_ARRAY,
      message: 'Ingredients must be an array',
      severity: 'critical',
    });
  } else if (recipe.ingredients.length === 0) {
    errors.push({
      field: 'ingredients',
      code: StructureErrorCode.MISSING_INGREDIENTS,
      message: 'Recipe must have at least one ingredient',
      severity: 'critical',
    });
  } else {
    // Validate each ingredient
    recipe.ingredients.forEach((ingredient: any, index: number) => {
      const ingredientErrors = validateIngredient(ingredient, index);
      errors.push(...ingredientErrors);
    });

    // Check for duplicates (warning only)
    const names = recipe.ingredients
      .map((ing: any) => ing?.name?.toLowerCase())
      .filter(Boolean);
    const duplicates = names.filter(
      (name: string, index: number) => names.indexOf(name) !== index
    );
    if (duplicates.length > 0) {
      warnings.push({
        field: 'ingredients',
        code: IngredientErrorCode.DUPLICATE_INGREDIENT,
        message: `Duplicate ingredients detected: ${duplicates.join(', ')}`,
        severity: 'low',
      });
    }
  }

  // 3. Validate instructions array
  if (!Array.isArray(recipe.instructions)) {
    errors.push({
      field: 'instructions',
      code: StructureErrorCode.INVALID_INSTRUCTIONS_ARRAY,
      message: 'Instructions must be an array',
      severity: 'critical',
    });
  } else if (recipe.instructions.length === 0) {
    errors.push({
      field: 'instructions',
      code: StructureErrorCode.MISSING_INSTRUCTIONS,
      message: 'Recipe must have at least one instruction',
      severity: 'critical',
    });
  } else {
    recipe.instructions.forEach((instruction: any, index: number) => {
      if (typeof instruction !== 'string') {
        errors.push({
          field: `instructions[${index}]`,
          code: InstructionErrorCode.INVALID_TYPE,
          message: 'Instruction must be a string',
          severity: 'critical',
        });
      } else if (instruction.trim().length === 0) {
        errors.push({
          field: `instructions[${index}]`,
          code: InstructionErrorCode.EMPTY_INSTRUCTION,
          message: 'Instruction cannot be empty',
          severity: 'critical',
        });
      } else if (instruction.includes('[object Object]')) {
        errors.push({
          field: `instructions[${index}]`,
          code: InstructionErrorCode.OBJECT_OBJECT_DETECTED,
          message: 'Instruction contains [object Object]',
          severity: 'critical',
        });
      } else if (instruction.length < 10) {
        warnings.push({
          field: `instructions[${index}]`,
          code: InstructionErrorCode.INSTRUCTION_TOO_SHORT,
          message: 'Instruction is very short (< 10 characters)',
          severity: 'low',
          suggestion: 'Consider adding more detail to the instruction',
        });
      } else if (instruction.length > 2000) {
        warnings.push({
          field: `instructions[${index}]`,
          code: InstructionErrorCode.INSTRUCTION_TOO_LONG,
          message: 'Instruction is very long (> 2000 characters)',
          severity: 'low',
          suggestion: 'Consider breaking into multiple steps',
        });
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    canAutoFix: false,
  };
}

// ============================================================================
// INGREDIENT VALIDATION
// ============================================================================

/**
 * Validate individual ingredient structure
 *
 * @param ingredient - Ingredient object to validate
 * @param index - Index in ingredients array (for error messages)
 * @returns Array of validation errors (empty if valid)
 */
function validateIngredient(ingredient: any, index: number): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check if ingredient is an object
  if (typeof ingredient !== 'object' || ingredient === null) {
    errors.push({
      field: `ingredients[${index}]`,
      code: IngredientErrorCode.INVALID_STRUCTURE,
      message: 'Ingredient must be an object with name property',
      severity: 'critical',
    });
    return errors;
  }

  // Check for 'name' property (CRITICAL)
  if (!ingredient.name || typeof ingredient.name !== 'string') {
    errors.push({
      field: `ingredients[${index}].name`,
      code: IngredientErrorCode.MISSING_NAME,
      message: 'Ingredient must have a name property',
      severity: 'critical',
    });
  } else if (ingredient.name.trim().length === 0) {
    errors.push({
      field: `ingredients[${index}].name`,
      code: IngredientErrorCode.EMPTY_NAME,
      message: 'Ingredient name cannot be empty',
      severity: 'critical',
    });
  } else if (ingredient.name.includes('[object Object]')) {
    errors.push({
      field: `ingredients[${index}].name`,
      code: IngredientErrorCode.OBJECT_OBJECT_DETECTED,
      message: 'Ingredient name contains [object Object]',
      severity: 'critical',
    });
  } else if (ingredient.name === 'undefined' || ingredient.name === 'null') {
    errors.push({
      field: `ingredients[${index}].name`,
      code: IngredientErrorCode.EMPTY_NAME,
      message: 'Ingredient name is placeholder value',
      severity: 'critical',
    });
  }

  // Validate optional fields
  if (ingredient.quantity !== undefined && typeof ingredient.quantity !== 'string') {
    errors.push({
      field: `ingredients[${index}].quantity`,
      code: IngredientErrorCode.INVALID_QUANTITY,
      message: 'Ingredient quantity must be a string',
      severity: 'high',
    });
  }

  if (ingredient.unit !== undefined && typeof ingredient.unit !== 'string') {
    errors.push({
      field: `ingredients[${index}].unit`,
      code: IngredientErrorCode.INVALID_UNIT,
      message: 'Ingredient unit must be a string',
      severity: 'high',
    });
  }

  if (ingredient.preparation && ingredient.preparation.length > 100) {
    errors.push({
      field: `ingredients[${index}].preparation`,
      code: IngredientErrorCode.EXCESSIVE_PREPARATION,
      message: 'Preparation text is excessively long (> 100 characters)',
      severity: 'medium',
      suggestion: 'Move detailed preparation to instructions',
    });
  }

  return errors;
}

// ============================================================================
// AUTO-SANITIZATION
// ============================================================================

/**
 * Auto-sanitize common ingredient issues
 *
 * Attempts to fix common problems:
 * - Strings converted to objects
 * - Missing 'name' property (tries alternate keys)
 * - Nested objects flattened
 *
 * @param ingredients - Raw ingredients array
 * @returns Sanitization result with modified flag
 */
export function sanitizeIngredients(ingredients: any[]): SanitizationResult {
  let modified = false;
  const changes: string[] = [];

  const sanitized = ingredients.map((ingredient: any, index: number) => {
    // If ingredient is a string, convert to object
    if (typeof ingredient === 'string') {
      modified = true;
      changes.push(`Converted string to object at index ${index}`);
      return { name: ingredient };
    }

    // If ingredient is not an object, convert to string then object
    if (typeof ingredient !== 'object' || ingredient === null) {
      modified = true;
      changes.push(`Converted non-object to string at index ${index}`);
      return { name: String(ingredient) };
    }

    // If ingredient is object but missing name, try alternatives
    if (!ingredient.name) {
      // Try common alternate property names
      const alternates = ['ingredient', 'item', 'text', 'description'];
      for (const alt of alternates) {
        if (ingredient[alt] && typeof ingredient[alt] === 'string') {
          modified = true;
          changes.push(`Used '${alt}' as name at index ${index}`);
          return {
            name: ingredient[alt],
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            notes: ingredient.notes,
            preparation: ingredient.preparation,
          };
        }
      }

      // Last resort: use first string property or stringify
      const firstStringKey = Object.keys(ingredient).find(
        (key) => typeof ingredient[key] === 'string'
      );
      if (firstStringKey) {
        modified = true;
        changes.push(`Used first string property '${firstStringKey}' as name at index ${index}`);
        return {
          name: ingredient[firstStringKey],
          ...ingredient,
        };
      }

      // Ultimate fallback: stringify the object
      modified = true;
      changes.push(`Stringified unknown object structure at index ${index}`);
      return { name: JSON.stringify(ingredient) };
    }

    // Valid ingredient with name property
    return ingredient;
  });

  return { sanitized, modified, changes };
}

/**
 * Auto-sanitize instructions array
 *
 * Ensures all instructions are strings
 *
 * @param instructions - Raw instructions array
 * @returns Sanitization result with string array
 */
export function sanitizeInstructions(instructions: any[]): {
  sanitized: string[];
  modified: boolean;
  changes: string[];
} {
  let modified = false;
  const changes: string[] = [];

  const sanitized = instructions.map((instruction: any, index: number) => {
    if (typeof instruction !== 'string') {
      modified = true;
      changes.push(`Converted non-string instruction at index ${index}`);
      return String(instruction);
    }
    return instruction;
  });

  return { sanitized, modified, changes };
}
