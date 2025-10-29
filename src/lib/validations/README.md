# Recipe Validation System

Multi-level quality gate system to prevent `[object Object]` display bugs and data corruption in recipe ingestion.

## Overview

This validation system implements **Phase 1 (Critical Blockers)** of the Recipe Quality Gate Design, providing two critical validation levels:

- **Level 2**: Structure validation (post-LLM parse)
- **Level 3**: Serialization safety (pre-database insert)

## Quick Start

### Basic Usage

```typescript
import { validateParsedRecipe, sanitizeIngredients } from '@/lib/validations/recipe-validation';
import { validateSerialization } from '@/lib/validations/serialization-validation';

// After LLM parses recipe
const parsed = await parseRecipeWithLLM(content);

// Level 2: Validate structure
const validation = validateParsedRecipe(parsed);

if (!validation.isValid) {
  // Try auto-sanitization
  const { sanitized, modified } = sanitizeIngredients(parsed.ingredients);

  if (modified) {
    parsed.ingredients = sanitized;
    // Re-validate
    const revalidation = validateParsedRecipe(parsed);
    if (!revalidation.isValid) {
      throw new Error('Validation failed');
    }
  }
}

// Level 3: Validate serialization
const serializationCheck = validateSerialization(parsed);

if (!serializationCheck.isValid) {
  throw new Error('Cannot serialize recipe safely');
}

// Safe to save to database
await saveRecipe(parsed);
```

## Modules

### validation-types.ts

TypeScript types and error code enums.

**Key Types:**
- `ValidationResult` - Standard validation result structure
- `ValidationError` - Error with field, code, message, severity
- `ValidationWarning` - Non-blocking warning
- `IngredientObject` - Proper ingredient structure
- `SanitizationResult` - Auto-sanitization result

**Error Code Namespaces:**
- `SV-xxx` - Structure validation errors
- `IV-xxx` - Ingredient validation errors
- `IN-xxx` - Instruction validation errors
- `SR-xxx` - Serialization validation errors

### recipe-validation.ts

Structure validation and auto-sanitization.

**Functions:**

#### `validateParsedRecipe(recipe: any): ValidationResult`

Validates recipe structure after LLM parsing.

**Checks:**
- Recipe name is valid string
- Ingredients is array of objects with `name` property
- Instructions is array of strings
- No `[object Object]` in any field

**Returns:**
```typescript
{
  isValid: boolean,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  canAutoFix: boolean
}
```

#### `sanitizeIngredients(ingredients: any[]): SanitizationResult`

Auto-fixes common ingredient issues.

**Fixes:**
- Converts string ingredients to objects
- Maps alternate properties (`ingredient`, `item`) to `name`
- Handles non-object values

**Returns:**
```typescript
{
  sanitized: IngredientObject[],
  modified: boolean,
  changes: string[]  // Description of changes made
}
```

#### `sanitizeInstructions(instructions: any[]): SanitizationResult`

Auto-fixes instruction array issues.

**Fixes:**
- Converts non-string instructions to strings

### serialization-validation.ts

JSON serialization safety checks.

**Functions:**

#### `validateSerialization(recipe: any): ValidationResult`

Validates recipe can be safely serialized to JSON.

**Checks:**
- No `[object Object]` in serialized JSON
- Round-trip serialization works
- Doesn't exceed database limits (50,000 chars)
- All ingredients have `name` after deserialization

**Returns:**
```typescript
{
  isValid: boolean,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  canAutoFix: boolean
}
```

#### `checkForObjectObject(data: any): boolean`

Quick check for `[object Object]` issues.

**Returns:** `true` if `[object Object]` detected or would appear

#### `testRoundTrip(data: any): boolean`

Tests serialization round-trip safety.

**Returns:** `true` if round-trip succeeds

## Error Codes

### Structure Validation (SV-xxx)

| Code | Description |
|------|-------------|
| SV-001 | Missing recipe name |
| SV-002 | Invalid recipe name |
| SV-003 | Missing ingredients array |
| SV-004 | Invalid ingredients array type |
| SV-005 | Missing instructions array |
| SV-006 | Invalid instructions array type |

### Ingredient Validation (IV-xxx)

| Code | Description |
|------|-------------|
| IV-001 | Missing ingredient name property |
| IV-002 | Empty ingredient name |
| IV-003 | Invalid ingredient structure |
| IV-004 | [object Object] in ingredient name |
| IV-005 | Invalid quantity type |
| IV-006 | Invalid unit type |
| IV-007 | Duplicate ingredient |
| IV-008 | Excessive preparation text |

### Instruction Validation (IN-xxx)

| Code | Description |
|------|-------------|
| IN-001 | Invalid instruction type |
| IN-002 | [object Object] in instruction |
| IN-003 | Empty instruction |
| IN-004 | Instruction too short |
| IN-005 | Instruction too long |

### Serialization Validation (SR-xxx)

| Code | Description |
|------|-------------|
| SR-001 | Serialization failed |
| SR-002 | [object Object] in JSON output |
| SR-003 | Missing name after parse |
| SR-004 | Instructions corruption |
| SR-005 | Exceeds database limit |

## Examples

### Example 1: Valid Recipe

```typescript
const recipe = {
  name: 'Chocolate Chip Cookies',
  ingredients: [
    { name: 'flour', quantity: '2', unit: 'cups' },
    { name: 'chocolate chips', quantity: '2', unit: 'cups' }
  ],
  instructions: [
    'Mix ingredients',
    'Bake at 375F for 12 minutes'
  ]
};

const result = validateParsedRecipe(recipe);
// result.isValid === true
```

### Example 2: Invalid Recipe (Detected)

```typescript
const recipe = {
  name: 'Bad Recipe',
  ingredients: [
    { name: '[object Object]' }  // INVALID
  ],
  instructions: ['Step 1']
};

const result = validateParsedRecipe(recipe);
// result.isValid === false
// result.errors[0].code === 'IV-004'
// result.errors[0].message === 'Ingredient name contains [object Object]'
```

### Example 3: Auto-Sanitization

```typescript
const ingredients = ['flour', 'sugar', 'eggs'];

const { sanitized, modified, changes } = sanitizeIngredients(ingredients);
// sanitized === [
//   { name: 'flour' },
//   { name: 'sugar' },
//   { name: 'eggs' }
// ]
// modified === true
```

### Example 4: Alternate Property Names

```typescript
const ingredients = [
  { ingredient: 'flour', quantity: '2', unit: 'cups' }
];

const { sanitized } = sanitizeIngredients(ingredients);
// sanitized[0].name === 'flour'
```

## Testing

### Run Manual Tests

```bash
npx tsx scripts/test-validation.ts
```

### Run Unit Tests

```bash
npm test src/lib/validations/__tests__/validation.test.ts
```

## Integration

This validation system is integrated into:

- `/src/lib/ai/recipe-ingestion-parser.ts` - After LLM parsing
- `/src/app/actions/recipe-ingestion.ts` - Before database insert

## Performance

- **Structure validation**: ~1ms per recipe
- **Serialization validation**: ~2ms per recipe
- **Total overhead**: ~3ms (negligible impact)

## Future Enhancements (Phase 2 & 3)

Not yet implemented:

- **Level 1**: Pre-parse content validation
- **Level 4**: Post-save display verification
- **Level 5**: Continuous monitoring

See `/docs/quality-gates/RECIPE_QUALITY_GATE_DESIGN.md` for complete design.

## References

- Design Document: `/docs/quality-gates/RECIPE_QUALITY_GATE_DESIGN.md`
- Implementation Summary: `/PHASE_1_VALIDATION_IMPLEMENTATION.md`
- Test Report: Run `npx tsx scripts/test-validation.ts`
