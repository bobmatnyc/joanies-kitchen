/**
 * Validation Types
 *
 * TypeScript types for recipe quality gate validation system.
 * Used across all validation levels (Pre-Parse, Structure, Serialization, Display).
 *
 * @module lib/validations/validation-types
 */

// ============================================================================
// VALIDATION RESULTS
// ============================================================================

/**
 * Validation error with severity and field context
 */
export interface ValidationError {
  field: string;
  code: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  suggestion?: string;
}

/**
 * Validation warning (non-blocking issue)
 */
export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  severity: 'low';
  suggestion?: string;
}

/**
 * Standard validation result structure
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  sanitized?: any; // Auto-sanitized data if applicable
  canAutoFix: boolean;
}

// ============================================================================
// INGREDIENT TYPES
// ============================================================================

/**
 * Standard parsed ingredient structure
 */
export interface IngredientObject {
  name: string;
  quantity?: string;
  unit?: string;
  notes?: string;
  preparation?: string;
}

/**
 * Result of ingredient sanitization
 */
export interface SanitizationResult {
  sanitized: IngredientObject[];
  modified: boolean;
  changes: string[];
}

// ============================================================================
// ERROR CODE NAMESPACES
// ============================================================================

/**
 * Structure Validation error codes (SV-xxx)
 */
export enum StructureErrorCode {
  MISSING_NAME = 'SV-001',
  INVALID_NAME = 'SV-002',
  MISSING_INGREDIENTS = 'SV-003',
  INVALID_INGREDIENTS_ARRAY = 'SV-004',
  MISSING_INSTRUCTIONS = 'SV-005',
  INVALID_INSTRUCTIONS_ARRAY = 'SV-006',
  INVALID_NUMERIC_FIELD = 'SV-007',
  INVALID_ENUM_VALUE = 'SV-008',
}

/**
 * Ingredient Validation error codes (IV-xxx)
 */
export enum IngredientErrorCode {
  MISSING_NAME = 'IV-001',
  EMPTY_NAME = 'IV-002',
  INVALID_STRUCTURE = 'IV-003',
  OBJECT_OBJECT_DETECTED = 'IV-004',
  INVALID_QUANTITY = 'IV-005',
  INVALID_UNIT = 'IV-006',
  DUPLICATE_INGREDIENT = 'IV-007',
  EXCESSIVE_PREPARATION = 'IV-008',
}

/**
 * Instruction Validation error codes (IN-xxx)
 */
export enum InstructionErrorCode {
  INVALID_TYPE = 'IN-001',
  OBJECT_OBJECT_DETECTED = 'IN-002',
  EMPTY_INSTRUCTION = 'IN-003',
  INSTRUCTION_TOO_SHORT = 'IN-004',
  INSTRUCTION_TOO_LONG = 'IN-005',
}

/**
 * Serialization Validation error codes (SR-xxx)
 */
export enum SerializationErrorCode {
  SERIALIZATION_FAILED = 'SR-001',
  OBJECT_OBJECT_IN_JSON = 'SR-002',
  MISSING_NAME_AFTER_PARSE = 'SR-003',
  INSTRUCTIONS_CORRUPTION = 'SR-004',
  EXCEEDS_DATABASE_LIMIT = 'SR-005',
}
