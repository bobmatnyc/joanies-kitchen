# Recipe Quality Gate System Design

**Version**: 1.0.0
**Date**: October 29, 2025
**Status**: Design Complete - Ready for Implementation

---

## Executive Summary

This document defines a comprehensive multi-level quality gate system to prevent data quality issues in scraped/imported recipes. The system implements validation at multiple stages of the ingestion pipeline to catch and block malformed data before it reaches the database or end users.

**Key Goals:**
- Eliminate "[object Object]" display issues
- Prevent malformed data structures from being saved
- Ensure all required fields are present and valid
- Flag suspicious data patterns for human review
- Maintain data quality standards across all ingestion sources

---

## 1. Current State Analysis

### 1.1 Recipe Ingestion Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    CURRENT INGESTION FLOW                     │
└──────────────────────────────────────────────────────────────┘

External URL
    ↓
[Firecrawl Scraper] (/lib/firecrawl)
    ↓ (markdown/html content)
[LLM Parser] (/lib/ai/recipe-ingestion-parser.ts)
    ↓ (IngestedRecipe object)
[Action Layer] (/app/actions/recipe-ingestion.ts)
    ↓ (serialized JSON)
[Database Insert] (Drizzle ORM)
    ↓
[Frontend Display] (RecipeCard, recipe/[slug]/page.tsx)
```

### 1.2 Current Validation

**Existing Validation Locations:**

1. **LLM Parser** (`recipe-ingestion-parser.ts`, lines 142-182):
   - ✅ Validates required fields (name, ingredients, instructions)
   - ✅ Validates ingredient names are non-empty
   - ✅ Validates numeric fields (prep_time, cook_time, servings)
   - ✅ Validates difficulty enum
   - ⚠️ Does NOT validate ingredient structure format
   - ⚠️ Does NOT validate instruction content
   - ⚠️ No deep validation of data types

2. **Action Layer** (`recipe-ingestion.ts`, lines 170-181):
   - ✅ Checks required fields exist
   - ✅ Checks ingredients/instructions arrays are non-empty
   - ❌ No format validation
   - ❌ No data type validation beyond existence

3. **API Route** (`/api/ingest-recipe/route.ts`, lines 161-169):
   - ✅ Serializes ingredients to JSON
   - ⚠️ Assumes structure is correct from parser
   - ❌ No validation of serialized output

### 1.3 Identified Gaps

**Critical Gaps:**
1. **Ingredient Structure**: No validation that ParsedIngredient objects have correct shape
2. **Serialization Safety**: No validation that JSON.stringify produces valid output
3. **Display Format**: No validation that ingredients will display correctly on frontend
4. **Data Type Consistency**: Objects can slip through as strings
5. **Content Quality**: No validation of ingredient/instruction content quality

**Recent Issues:**
- "[object Object]" display bug (fixed in recipe-utils.ts)
- Corrupted recipes with empty/placeholder ingredients
- HTML tags and URLs in content
- Encoding issues (â€™ instead of ')
- Missing spaces in quantities (2cups instead of 2 cups)

### 1.4 Legacy Validation in Scripts

**Python Scraper Validation** (scripts/ingest-*.py):
```python
def validate_recipe(recipe: Dict[str, Any]) -> tuple[bool, List[str]]:
    # Basic validation:
    - Check name exists
    - Check ingredients JSON is parseable
    - Check instructions exist
    - Check images exist
    - Check source URL exists
```

**TypeScript Detection Scripts**:
- `detect-recipe-issues.ts`: Pattern-based content validation (20+ regex patterns)
- `detect-corrupted-recipes.ts`: Database integrity checks
- `sample-ingredient-validation.ts`: Ingredient-instruction consistency checks

---

## 2. Quality Gate Architecture

### 2.1 Multi-Level Gate System

```
┌────────────────────────────────────────────────────────────┐
│                   QUALITY GATE LEVELS                       │
└────────────────────────────────────────────────────────────┘

LEVEL 1: PRE-PARSE VALIDATION (Content Quality)
    ↓ [BLOCK if fails]
LEVEL 2: POST-PARSE VALIDATION (Structure & Types)
    ↓ [BLOCK if fails]
LEVEL 3: PRE-SAVE VALIDATION (Serialization Safety)
    ↓ [BLOCK if fails]
LEVEL 4: POST-SAVE VERIFICATION (Display Safety)
    ↓ [FLAG if fails]
LEVEL 5: CONTINUOUS MONITORING (Pattern Detection)
    ↓ [LOG for analysis]
```

### 2.2 Decision Matrix

| Gate Level | Severity | Action | Impact |
|-----------|----------|--------|--------|
| Level 1 - Critical | ERROR | Block & Return Error | Recipe rejected immediately |
| Level 2 - Critical | ERROR | Block & Return Error | Recipe rejected after parse |
| Level 3 - Critical | ERROR | Block & Return Error | Recipe rejected before DB |
| Level 4 - Warning | WARN | Save but Flag | Recipe saved, marked for review |
| Level 5 - Info | INFO | Log Only | Recipe saved, logged for analytics |

---

## 3. Validation Specifications

### 3.1 Level 1: Pre-Parse Validation (Content Quality)

**Purpose**: Validate raw content before expensive LLM parsing

**Location**: New function in `recipe-ingestion-parser.ts`

```typescript
interface ContentValidationResult {
  isValid: boolean;
  errors: ContentValidationError[];
  warnings: ContentValidationWarning[];
}

interface ContentValidationError {
  code: string;
  message: string;
  severity: 'critical' | 'high';
}

function validateContentQuality(content: string, sourceUrl?: string): ContentValidationResult
```

**Critical Validations (Blockers):**

| Rule | Pattern | Error Code | Message |
|------|---------|-----------|---------|
| Minimum Length | content.length < 100 | `CONTENT_TOO_SHORT` | Content must be at least 100 characters |
| Not Empty | !content.trim() | `CONTENT_EMPTY` | Content is empty or whitespace only |
| Not Error Page | /404\|not found\|error/i | `ERROR_PAGE_DETECTED` | Content appears to be error page |
| Has Ingredient Markers | No "ingredient" word found | `NO_INGREDIENTS_DETECTED` | No ingredient section detected |
| Has Instruction Markers | No "step\|instruction\|method" | `NO_INSTRUCTIONS_DETECTED` | No instruction section detected |

**Warning Validations:**

| Rule | Pattern | Warning Code | Message |
|------|---------|-------------|---------|
| Excessive HTML | > 10 HTML tags | `EXCESSIVE_HTML` | Content contains many HTML tags |
| Excessive Links | > 5 URLs | `EXCESSIVE_URLS` | Content contains many URLs |
| Unusual Characters | Control characters | `UNUSUAL_CHARACTERS` | Content contains unusual characters |
| Paywall Detected | "subscribe\|login\|sign up" | `POTENTIAL_PAYWALL` | May be behind paywall |

### 3.2 Level 2: Post-Parse Validation (Structure & Types)

**Purpose**: Validate LLM output structure and data types

**Location**: New function in `recipe-ingestion-parser.ts`

```typescript
interface ParsedValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  sanitizedRecipe?: IngestedRecipe; // Auto-fixed version if possible
}

function validateParsedRecipe(recipe: IngestedRecipe): ParsedValidationResult
```

#### 3.2.1 Recipe Metadata Validation

**Critical Fields:**

```typescript
// Name Validation
- name: string (required)
  ✓ Length: 3-200 characters
  ✓ Not placeholder: !"Recipe Name", !"Untitled", !"Test"
  ✓ No HTML tags
  ✓ No URLs
  ✓ No control characters
  ✓ No "[object Object]"

// Description Validation
- description: string | null (optional but recommended)
  ✓ If present: 10-1000 characters
  ✓ No HTML tags
  ✓ No excessive URLs (max 1)

// Numeric Fields
- prep_time: number | null
  ✓ If present: >= 0 and <= 1440 (24 hours)
  ✓ Type: number (not string)

- cook_time: number | null
  ✓ If present: >= 0 and <= 1440 (24 hours)
  ✓ Type: number (not string)

- servings: number | null
  ✓ If present: >= 1 and <= 100
  ✓ Type: number (not string)

// Enum Fields
- difficulty: 'easy' | 'medium' | 'hard' | null
  ✓ If present: Must match enum values exactly
  ✓ Case-sensitive
```

#### 3.2.2 Ingredients Validation

**Critical Requirements:**

```typescript
// Array Structure
- ingredients: ParsedIngredient[]
  ✓ Must be array
  ✓ Length: 1-100 items
  ✓ No duplicate entries (case-insensitive)
  ✓ No null/undefined elements

// ParsedIngredient Structure
interface ParsedIngredient {
  quantity?: string;    // Optional
  unit?: string;        // Optional
  name: string;         // REQUIRED
  notes?: string;       // Optional
  preparation?: string; // Optional
}

// Per-Ingredient Validation
for each ingredient:
  ✓ Has 'name' property (string)
  ✓ name: 3-200 characters
  ✓ name: Not empty after trim
  ✓ name: Not "[object Object]"
  ✓ name: Not "undefined" or "null"
  ✓ name: No HTML tags
  ✓ name: No URLs
  ✓ quantity: If present, valid format (number or fraction)
  ✓ unit: If present, valid unit (cup, tbsp, tsp, oz, lb, g, kg, ml, l, etc.)
  ✓ All properties: string type (not nested objects)
```

**Warning Requirements:**

```typescript
⚠️ Unusual ingredient count (< 3 or > 30)
⚠️ Very short names (< 3 chars, except "egg", "oil", "ice")
⚠️ Missing quantity AND unit (both undefined)
⚠️ Quantity without unit (quantity exists but unit doesn't)
⚠️ Non-standard units (warn but allow)
⚠️ Excessive preparation text (> 100 chars)
```

**Format Validation Examples:**

```typescript
// VALID Formats:
✓ { name: "flour" }
✓ { name: "flour", quantity: "2", unit: "cups" }
✓ { name: "onion", quantity: "1", unit: "large", preparation: "diced" }
✓ { name: "olive oil", quantity: "1/4", unit: "cup", notes: "extra virgin" }

// INVALID Formats (BLOCK):
✗ { name: "[object Object]" }
✗ { name: "" }
✗ { name: undefined }
✗ { quantity: { amount: 2, unit: "cups" }, name: "flour" } // nested object
✗ "flour" // string instead of object
✗ { ingredient: "flour" } // wrong property name
✗ { name: "flour", quantity: true } // wrong type
```

#### 3.2.3 Instructions Validation

**Critical Requirements:**

```typescript
// Array Structure
- instructions: string[]
  ✓ Must be array
  ✓ Length: 1-50 steps
  ✓ All elements must be strings
  ✓ No null/undefined elements
  ✓ No empty strings

// Per-Instruction Validation
for each instruction:
  ✓ Type: string (not object)
  ✓ Length: 10-2000 characters
  ✓ Not "[object Object]"
  ✓ Not "undefined" or "null"
  ✓ Not just whitespace
  ✓ No excessive HTML (max 2 tags for formatting)
```

**Warning Requirements:**

```typescript
⚠️ Very short instruction (< 20 chars)
⚠️ Very long instruction (> 500 chars)
⚠️ Unusual step count (< 2 or > 30)
⚠️ Missing action verbs (heat, cook, add, mix, etc.)
⚠️ Contains URLs (might be reference links)
```

#### 3.2.4 Additional Fields Validation

**Images:**

```typescript
- image_url: string | null
  ✓ If present: Valid URL format
  ✓ If present: Starts with http:// or https://
  ✓ If present: Image extension (.jpg, .png, .webp) OR CDN URL
  ⚠️ External URL (not from known CDNs)
  ⚠️ Very long URL (> 500 chars)
```

**Tags:**

```typescript
- tags: string[]
  ✓ Must be array
  ✓ All elements must be strings
  ✓ Each tag: 2-50 characters
  ✓ Each tag: lowercase with hyphens (kebab-case)
  ✓ No duplicate tags
  ✓ Max 20 tags
  ⚠️ Non-standard tag format (not kebab-case)
```

**Cuisine:**

```typescript
- cuisine: string | null
  ✓ If present: 2-50 characters
  ✓ If present: Proper case (first letter capitalized)
  ✓ Known cuisine type (or custom)
```

### 3.3 Level 3: Pre-Save Validation (Serialization Safety)

**Purpose**: Validate that data will serialize correctly to database

**Location**: New function in `recipe-ingestion.ts` action

```typescript
interface SerializationValidationResult {
  isValid: boolean;
  errors: SerializationError[];
  serialized?: {
    ingredients: string;
    instructions: string;
    tags: string;
  };
}

function validateSerialization(recipeData: IngestedRecipe): SerializationValidationResult
```

**Critical Validations:**

```typescript
// Ingredients Serialization
const ingredientsJson = JSON.stringify(recipeData.ingredients);
  ✓ Result does not contain "[object Object]"
  ✓ Result is valid JSON (can be parsed back)
  ✓ Parsed result equals original (deep equality)
  ✓ Length < 50,000 characters (database limit)

// Instructions Serialization
const instructionsJson = JSON.stringify(recipeData.instructions);
  ✓ Result does not contain "[object Object]"
  ✓ Result is valid JSON (can be parsed back)
  ✓ Parsed result equals original (deep equality)
  ✓ Length < 50,000 characters (database limit)

// Round-Trip Test
const parsed = JSON.parse(ingredientsJson);
for each ingredient in parsed:
  ✓ Has 'name' property
  ✓ name is string
  ✓ name does not equal "[object Object]"
```

**Auto-Sanitization:**

If serialization produces "[object Object]", attempt to fix:

```typescript
function sanitizeIngredients(ingredients: any[]): ParsedIngredient[] {
  return ingredients.map(ing => {
    // If string, convert to object
    if (typeof ing === 'string') {
      return { name: ing };
    }

    // If object, ensure name property
    if (typeof ing === 'object' && ing !== null) {
      if ('name' in ing && typeof ing.name === 'string') {
        return ing as ParsedIngredient;
      }

      // Try common alternate properties
      if ('ingredient' in ing) {
        return { name: ing.ingredient, ...ing };
      }
      if ('item' in ing) {
        return { name: ing.item, ...ing };
      }

      // Last resort: stringify object as name (better than [object Object])
      return { name: JSON.stringify(ing) };
    }

    // Fallback
    return { name: String(ing) };
  });
}
```

### 3.4 Level 4: Post-Save Verification (Display Safety)

**Purpose**: Verify recipe will display correctly on frontend

**Location**: New function in `recipe-ingestion.ts` action (optional, after save)

```typescript
interface DisplayValidationResult {
  isValid: boolean;
  warnings: DisplayWarning[];
  flagForReview: boolean;
}

async function verifyDisplaySafety(recipeId: string): Promise<DisplayValidationResult>
```

**Verification Checks:**

```typescript
// Re-fetch saved recipe from database
const saved = await db.query.recipes.findFirst({ where: eq(recipes.id, recipeId) });

// Parse with frontend parsing logic
const parsed = parseRecipe(saved);

// Verify parsing
  ✓ parsed.ingredients is array
  ✓ parsed.instructions is array
  ⚠️ Any ingredient contains "[object Object]"
  ⚠️ Any instruction contains "[object Object]"
  ⚠️ Ingredients length differs from saved
  ⚠️ Instructions length differs from saved

// Test display formatting
for each ingredient:
  const formatted = formatIngredientForDisplay(ingredient);
  ⚠️ formatted contains "[object Object]"
  ⚠️ formatted is empty
  ⚠️ formatted exceeds 300 chars
```

**Action on Warnings:**

```typescript
if (warnings.length > 0) {
  // Flag recipe for admin review
  await db.update(recipes)
    .set({
      content_flagged_for_cleanup: true,
      qa_status: 'needs_review',
      qa_issues_found: JSON.stringify(warnings)
    })
    .where(eq(recipes.id, recipeId));
}
```

### 3.5 Level 5: Continuous Monitoring (Pattern Detection)

**Purpose**: Detect quality issues in existing recipes

**Location**: New scheduled job or admin endpoint

**Pattern Checks (from detect-recipe-issues.ts):**

1. Content Quality Issues (20+ patterns)
2. Structural Issues (empty fields, malformed JSON)
3. Display Issues ("[object Object]" detection)
4. Consistency Issues (ingredient-instruction mismatch)

---

## 4. Implementation Plan

### 4.1 Implementation Phases

#### Phase 1: Critical Blockers (Week 1) - Priority P0

**Goal**: Prevent [object Object] and data corruption issues

**Tasks:**
1. ✅ Implement Level 2 validation (Post-Parse Structure)
   - File: `src/lib/validation/recipe-validation.ts` (NEW)
   - Function: `validateParsedRecipe()`
   - Integration: `recipe-ingestion-parser.ts` (after LLM parse)

2. ✅ Implement Level 3 validation (Serialization Safety)
   - File: `src/lib/validation/recipe-validation.ts`
   - Function: `validateSerialization()`
   - Integration: `recipe-ingestion.ts` (before DB insert)

3. ✅ Add auto-sanitization for common issues
   - Function: `sanitizeIngredients()`, `sanitizeInstructions()`

4. ✅ Update API error responses
   - Return detailed validation errors
   - Include error codes for client handling

**Estimated Effort**: 2-3 days
**Impact**: Eliminates critical display bugs

#### Phase 2: Content Quality (Week 2) - Priority P1

**Goal**: Improve input validation and content quality

**Tasks:**
1. Implement Level 1 validation (Pre-Parse Content)
   - File: `src/lib/validation/content-validation.ts` (NEW)
   - Function: `validateContentQuality()`
   - Integration: `recipe-ingestion.ts` (before LLM call)

2. Add content sanitization
   - Remove HTML tags
   - Fix encoding issues
   - Remove URLs from content

3. Improve LLM prompt for better output
   - Add more examples
   - Emphasize structure requirements
   - Add output format validation instructions

**Estimated Effort**: 2-3 days
**Impact**: Reduces bad input, saves LLM costs

#### Phase 3: Display Safety & Monitoring (Week 3) - Priority P2

**Goal**: Add safety nets and monitoring

**Tasks:**
1. Implement Level 4 validation (Display Safety)
   - Post-save verification
   - Auto-flagging for review

2. Implement Level 5 monitoring
   - Scheduled job to scan recipes
   - Pattern detection for existing issues
   - Admin dashboard integration

3. Add validation metrics
   - Track validation failures by type
   - Monitor false positive rates
   - Generate quality reports

**Estimated Effort**: 3-4 days
**Impact**: Proactive issue detection

### 4.2 File Structure

```
src/lib/validation/
├── recipe-validation.ts         # Main validation functions
├── content-validation.ts        # Pre-parse content checks
├── serialization-validation.ts  # JSON serialization safety
├── display-validation.ts        # Frontend display checks
├── validation-types.ts          # TypeScript interfaces
└── validation-rules.ts          # Validation rule definitions

src/lib/validation/__tests__/
├── recipe-validation.test.ts
├── content-validation.test.ts
└── serialization-validation.test.ts

docs/quality-gates/
├── RECIPE_QUALITY_GATE_DESIGN.md  # This document
└── VALIDATION_RULES_REFERENCE.md  # Detailed rule catalog
```

### 4.3 Integration Points

#### 4.3.1 Recipe Ingestion Action

```typescript
// src/app/actions/recipe-ingestion.ts

import { validateContentQuality } from '@/lib/validation/content-validation';
import { validateSerialization } from '@/lib/validation/serialization-validation';

export async function ingestRecipeFromUrl(url: string) {
  // LEVEL 1: Pre-parse validation
  const content = await fetchRecipeFromUrl(url);
  const contentValidation = validateContentQuality(content.markdown);

  if (!contentValidation.isValid) {
    return {
      success: false,
      error: 'Content quality check failed',
      errors: contentValidation.errors,
    };
  }

  // Parse with LLM
  const parsed = await parseRecipeForIngestion(content.markdown, url);

  // LEVEL 2: Post-parse validation (already in parseRecipeForIngestion)

  // LEVEL 3: Serialization validation
  const serializationValidation = validateSerialization(parsed);

  if (!serializationValidation.isValid) {
    return {
      success: false,
      error: 'Serialization validation failed',
      errors: serializationValidation.errors,
    };
  }

  // Save to database
  const result = await saveIngestedRecipe(parsed);

  // LEVEL 4: Display validation (async, non-blocking)
  if (result.success && result.data) {
    verifyDisplaySafety(result.data.id).catch(console.error);
  }

  return result;
}
```

#### 4.3.2 LLM Parser Enhancement

```typescript
// src/lib/ai/recipe-ingestion-parser.ts

import { validateParsedRecipe, sanitizeRecipe } from '@/lib/validation/recipe-validation';

export async function parseRecipeForIngestion(content: string, sourceUrl?: string) {
  // ... existing LLM call ...

  const parsed = JSON.parse(jsonString) as IngestedRecipe;

  // LEVEL 2: Validate parsed structure
  const validation = validateParsedRecipe(parsed);

  if (!validation.isValid) {
    // Try auto-sanitization
    if (validation.sanitizedRecipe) {
      console.warn('Recipe required sanitization:', validation.errors);
      return validation.sanitizedRecipe;
    }

    // Cannot fix, throw error
    throw new Error(
      `Recipe validation failed: ${validation.errors.map(e => e.message).join(', ')}`
    );
  }

  if (validation.warnings.length > 0) {
    console.warn('Recipe has warnings:', validation.warnings);
  }

  return parsed;
}
```

#### 4.3.3 API Route Enhancement

```typescript
// src/app/api/ingest-recipe/route.ts

export const POST = requireScopes([SCOPES.WRITE_RECIPES], async (request, auth) => {
  try {
    const result = await ingestSingleRecipe(url, auth.userId!);

    if (!result.success) {
      // Return detailed validation errors
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          validationErrors: result.validationErrors, // NEW
          errorCode: result.errorCode, // NEW
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, recipe: result.recipe }, { status: 201 });
  } catch (error) {
    // ... error handling ...
  }
});
```

### 4.4 Error Response Format

```typescript
// Success Response
{
  "success": true,
  "recipe": {
    "id": "uuid",
    "name": "Recipe Name",
    "slug": "recipe-slug",
    "url": "/recipes/recipe-slug"
  }
}

// Validation Error Response
{
  "success": false,
  "error": "Recipe validation failed",
  "errorCode": "INVALID_INGREDIENT_STRUCTURE",
  "validationErrors": [
    {
      "field": "ingredients[2].name",
      "code": "EMPTY_NAME",
      "message": "Ingredient name cannot be empty",
      "severity": "critical"
    },
    {
      "field": "instructions",
      "code": "TOO_FEW_STEPS",
      "message": "Recipe must have at least 2 instruction steps",
      "severity": "high"
    }
  ],
  "warnings": [
    {
      "field": "prep_time",
      "code": "MISSING_PREP_TIME",
      "message": "Prep time not specified",
      "severity": "low"
    }
  ]
}

// Content Quality Error Response
{
  "success": false,
  "error": "Content quality check failed",
  "errorCode": "CONTENT_TOO_SHORT",
  "validationErrors": [
    {
      "code": "CONTENT_TOO_SHORT",
      "message": "Content must be at least 100 characters",
      "severity": "critical"
    }
  ]
}
```

---

## 5. Validation Rules Reference

### 5.1 Error Code Taxonomy

```
Content Validation (CV-xxx)
├── CV-001: CONTENT_EMPTY
├── CV-002: CONTENT_TOO_SHORT
├── CV-003: ERROR_PAGE_DETECTED
├── CV-004: NO_INGREDIENTS_DETECTED
└── CV-005: NO_INSTRUCTIONS_DETECTED

Structure Validation (SV-xxx)
├── SV-001: MISSING_NAME
├── SV-002: INVALID_NAME
├── SV-003: MISSING_INGREDIENTS
├── SV-004: INVALID_INGREDIENTS_ARRAY
├── SV-005: MISSING_INSTRUCTIONS
├── SV-006: INVALID_INSTRUCTIONS_ARRAY
├── SV-007: INVALID_NUMERIC_FIELD
└── SV-008: INVALID_ENUM_VALUE

Ingredient Validation (IV-xxx)
├── IV-001: MISSING_INGREDIENT_NAME
├── IV-002: EMPTY_INGREDIENT_NAME
├── IV-003: INVALID_INGREDIENT_STRUCTURE
├── IV-004: OBJECT_OBJECT_DETECTED
├── IV-005: INVALID_QUANTITY_FORMAT
├── IV-006: INVALID_UNIT
├── IV-007: DUPLICATE_INGREDIENT
└── IV-008: EXCESSIVE_PREPARATION_TEXT

Instruction Validation (IN-xxx)
├── IN-001: EMPTY_INSTRUCTION
├── IN-002: INSTRUCTION_TOO_SHORT
├── IN-003: INSTRUCTION_TOO_LONG
├── IN-004: INVALID_INSTRUCTION_TYPE
└── IN-005: OBJECT_OBJECT_IN_INSTRUCTION

Serialization Validation (SR-xxx)
├── SR-001: SERIALIZATION_FAILED
├── SR-002: OBJECT_OBJECT_IN_JSON
├── SR-003: INVALID_JSON_OUTPUT
├── SR-004: ROUND_TRIP_FAILED
└── SR-005: EXCEEDS_DATABASE_LIMIT

Display Validation (DV-xxx)
├── DV-001: DISPLAY_PARSE_FAILED
├── DV-002: OBJECT_OBJECT_IN_DISPLAY
├── DV-003: EMPTY_DISPLAY_OUTPUT
└── DV-004: DISPLAY_LENGTH_EXCEEDED
```

### 5.2 Validation Rule Examples

**Rule: Ingredient Name Required**
```typescript
{
  code: 'IV-001',
  severity: 'critical',
  check: (ingredient) => 'name' in ingredient,
  message: 'Ingredient must have a name property',
  fix: (ingredient) => ({ name: 'unknown ingredient', ...ingredient })
}
```

**Rule: No [object Object] in Ingredients**
```typescript
{
  code: 'IV-004',
  severity: 'critical',
  check: (ingredient) => {
    const json = JSON.stringify(ingredient);
    return !json.includes('[object Object]');
  },
  message: 'Ingredient contains [object Object] after serialization',
  fix: null // Cannot auto-fix, must reject
}
```

**Rule: Valid Quantity Format**
```typescript
{
  code: 'IV-005',
  severity: 'warning',
  check: (ingredient) => {
    if (!ingredient.quantity) return true;
    const validFormats = /^[\d\/\s.]+$/;
    return validFormats.test(ingredient.quantity);
  },
  message: 'Quantity should be numeric or fraction format',
  fix: (ingredient) => ({
    ...ingredient,
    quantity: ingredient.quantity.replace(/[^0-9\/.\s]/g, '')
  })
}
```

---

## 6. Testing Strategy

### 6.1 Unit Tests

**Coverage Requirements**: 90%+ for validation functions

**Test Files**:
- `recipe-validation.test.ts`
- `content-validation.test.ts`
- `serialization-validation.test.ts`

**Test Categories**:

1. **Happy Path Tests**
   - Valid recipe passes all validations
   - Valid ingredients in various formats
   - Valid instructions in various lengths

2. **Error Case Tests**
   - Missing required fields
   - Invalid data types
   - [object Object] scenarios
   - Empty arrays
   - Null values

3. **Edge Case Tests**
   - Very long content
   - Very short content
   - Unicode characters
   - HTML in content
   - URLs in content

4. **Sanitization Tests**
   - Auto-fix empty names
   - Auto-fix encoding issues
   - Auto-fix nested objects
   - Fallback to original if cannot fix

### 6.2 Integration Tests

**Test Scenarios**:

1. **Full Ingestion Flow**
   - Valid URL → successful save
   - Invalid content → rejected at Level 1
   - Malformed parse → rejected at Level 2
   - Bad serialization → rejected at Level 3

2. **Error Propagation**
   - Validation errors reach API response
   - Error codes are correct
   - Error messages are helpful

3. **Display Safety**
   - Saved recipes display correctly
   - No [object Object] in frontend
   - Parsed arrays match saved arrays

### 6.3 E2E Tests

**Test Scenarios**:

1. **API Ingestion Test**
   ```bash
   curl -X POST /api/ingest-recipe \
     -H "Authorization: Bearer $API_KEY" \
     -d '{"url": "https://example.com/recipe"}'
   ```
   - Expect 201 Created
   - Verify recipe in database
   - Verify recipe displays correctly

2. **Admin UI Test**
   - Upload recipe via admin form
   - See validation errors in real-time
   - Auto-fix suggestions work

3. **Regression Test**
   - Ingest known problematic recipes
   - Verify they are blocked or fixed
   - No [object Object] in output

### 6.4 Test Data Sets

**Valid Recipes**:
- Simple recipe (5 ingredients, 3 steps)
- Complex recipe (20 ingredients, 10 steps)
- Recipe with fractions (½ cup, ¼ tsp)
- Recipe with unicode (café, naïve)

**Invalid Recipes**:
- Empty ingredient names
- [object Object] in ingredients
- Missing instructions
- HTML tags in content
- Too many ingredients (> 100)

**Edge Cases**:
- Single ingredient recipe
- 50-step recipe
- Recipe with no prep time
- Recipe with only optional ingredients

---

## 7. Monitoring & Metrics

### 7.1 Key Metrics to Track

**Validation Metrics**:
```typescript
{
  "validation_failures": {
    "total": 15,
    "by_level": {
      "level_1_content": 3,
      "level_2_structure": 8,
      "level_3_serialization": 2,
      "level_4_display": 2
    },
    "by_error_code": {
      "IV-001": 5,  // Missing ingredient name
      "SV-003": 3,  // Missing ingredients array
      "CV-002": 2   // Content too short
    }
  },
  "validation_warnings": {
    "total": 47,
    "by_warning_code": {
      "IV-008": 20,  // Excessive preparation text
      "IN-002": 15,  // Instruction too short
      "CV-005": 12   // No instructions detected
    }
  },
  "auto_fixes_applied": {
    "total": 23,
    "by_fix_type": {
      "sanitize_ingredient": 12,
      "sanitize_instruction": 8,
      "fix_encoding": 3
    }
  }
}
```

**Quality Metrics**:
```typescript
{
  "recipe_quality": {
    "total_ingested": 1000,
    "passed_all_gates": 932,
    "flagged_for_review": 53,
    "rejected": 15,
    "success_rate": 0.932
  },
  "average_validation_time_ms": {
    "level_1": 5,
    "level_2": 15,
    "level_3": 8,
    "total": 28
  }
}
```

### 7.2 Dashboard Integration

**Admin Dashboard Sections**:

1. **Validation Health**
   - Success rate over time
   - Common failure reasons
   - Recipes pending review

2. **Error Analysis**
   - Most common error codes
   - Error trends by source
   - Auto-fix effectiveness

3. **Quality Trends**
   - Recipe completeness scores
   - Flagged recipe queue
   - Review backlog

### 7.3 Alerting Rules

**Critical Alerts**:
- Validation failure rate > 20% (sends alert)
- [object Object] detected in production (immediate alert)
- Serialization failures > 5 in 1 hour (sends alert)

**Warning Alerts**:
- Flagged recipes queue > 50 (weekly digest)
- Content quality issues > 30% (daily digest)

---

## 8. Migration Strategy

### 8.1 Existing Recipe Validation

**Goal**: Validate and fix existing recipes in database

**Approach**:
1. Run detection script to identify issues
2. Categorize by severity
3. Auto-fix where possible
4. Flag rest for manual review

**Scripts**:
- `scripts/validate-existing-recipes.ts` (NEW)
- `scripts/fix-existing-recipes.ts` (NEW)

### 8.2 Rollout Plan

**Phase 1**: New Recipes Only (Week 1)
- Enable validation for new ingestions only
- Monitor metrics
- Tune validation rules based on feedback

**Phase 2**: Backfill Critical Issues (Week 2)
- Fix [object Object] issues in existing recipes
- Fix empty ingredients/instructions
- Fix serialization issues

**Phase 3**: Full Backfill (Week 3)
- Apply all validation rules to existing recipes
- Generate quality report
- Flag low-quality recipes for review

---

## 9. Future Enhancements

### 9.1 Advanced Validation (Phase 4)

**Semantic Validation**:
- Check ingredient-instruction consistency
- Detect missing common ingredients (salt, oil, etc.)
- Validate cooking times are reasonable
- Cross-reference ingredient usage in instructions

**Nutrition Validation**:
- Estimate nutrition based on ingredients
- Flag unrealistic nutrition values
- Suggest missing nutrition data

**Image Validation**:
- Validate image URLs are accessible
- Check image dimensions
- Verify image is food-related (ML model)

### 9.2 LLM-Powered Validation

**Use LLM for**:
- Recipe completeness scoring
- Instruction clarity rating
- Ingredient substitution suggestions
- Missing step detection

### 9.3 User Feedback Loop

**Integration with User Reports**:
- Users can flag incorrect recipes
- Validation learns from user feedback
- Auto-improve validation rules

---

## 10. Summary & Recommendations

### 10.1 Priority Matrix

| Priority | Phase | Effort | Impact | Status |
|----------|-------|--------|--------|--------|
| P0 | Phase 1: Critical Blockers | 2-3 days | High | Ready |
| P1 | Phase 2: Content Quality | 2-3 days | Medium | Ready |
| P2 | Phase 3: Display & Monitoring | 3-4 days | Medium | Ready |
| P3 | Phase 4: Advanced Features | 1-2 weeks | Low | Future |

### 10.2 Immediate Actions

**Week 1 - Must Have**:
1. ✅ Create validation modules (recipe-validation.ts, serialization-validation.ts)
2. ✅ Integrate Level 2 & 3 validation into ingestion flow
3. ✅ Add validation error responses to API
4. ✅ Write unit tests for validation functions
5. ✅ Deploy to staging and test with real URLs

**Week 2 - Should Have**:
1. Add Level 1 content validation
2. Implement auto-sanitization
3. Add validation metrics
4. Create admin dashboard section
5. Run backfill script on existing recipes

**Week 3 - Nice to Have**:
1. Add Level 4 display validation
2. Implement continuous monitoring
3. Create quality reports
4. Fine-tune validation rules
5. Document lessons learned

### 10.3 Success Criteria

**Primary Goals**:
- ✅ Zero [object Object] issues in production
- ✅ < 5% validation failure rate
- ✅ All recipes have valid structure
- ✅ Serialization always succeeds

**Secondary Goals**:
- 90%+ recipe completeness score
- < 50 recipes flagged for review
- Auto-fix rate > 50%
- Validation time < 100ms

### 10.4 Risk Mitigation

**Risk**: Validation too strict, blocks valid recipes
- **Mitigation**: Start with warnings, tune based on metrics

**Risk**: Performance impact from validation
- **Mitigation**: Async validation for non-critical checks

**Risk**: False positives in [object Object] detection
- **Mitigation**: Comprehensive test suite with real data

**Risk**: LLM parsing inconsistencies
- **Mitigation**: Multiple validation layers, auto-sanitization

---

## Appendix A: Code Examples

### A.1 Validation Function Template

```typescript
// src/lib/validation/recipe-validation.ts

export interface ValidationError {
  code: string;
  field: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface ValidationWarning {
  code: string;
  field: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  sanitizedRecipe?: IngestedRecipe;
}

export function validateParsedRecipe(recipe: IngestedRecipe): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate name
  if (!recipe.name || recipe.name.trim().length === 0) {
    errors.push({
      code: 'SV-001',
      field: 'name',
      message: 'Recipe name is required',
      severity: 'critical',
    });
  } else if (recipe.name.length < 3 || recipe.name.length > 200) {
    errors.push({
      code: 'SV-002',
      field: 'name',
      message: 'Recipe name must be 3-200 characters',
      severity: 'high',
    });
  }

  // Validate ingredients
  if (!Array.isArray(recipe.ingredients)) {
    errors.push({
      code: 'SV-004',
      field: 'ingredients',
      message: 'Ingredients must be an array',
      severity: 'critical',
    });
  } else if (recipe.ingredients.length === 0) {
    errors.push({
      code: 'SV-003',
      field: 'ingredients',
      message: 'Recipe must have at least one ingredient',
      severity: 'critical',
    });
  } else {
    // Validate each ingredient
    recipe.ingredients.forEach((ing, idx) => {
      const fieldPath = `ingredients[${idx}]`;

      if (typeof ing !== 'object' || ing === null) {
        errors.push({
          code: 'IV-003',
          field: fieldPath,
          message: 'Ingredient must be an object',
          severity: 'critical',
        });
        return;
      }

      if (!('name' in ing)) {
        errors.push({
          code: 'IV-001',
          field: `${fieldPath}.name`,
          message: 'Ingredient must have a name property',
          severity: 'critical',
        });
      } else if (typeof ing.name !== 'string') {
        errors.push({
          code: 'IV-003',
          field: `${fieldPath}.name`,
          message: 'Ingredient name must be a string',
          severity: 'critical',
        });
      } else if (ing.name.trim().length === 0) {
        errors.push({
          code: 'IV-002',
          field: `${fieldPath}.name`,
          message: 'Ingredient name cannot be empty',
          severity: 'critical',
        });
      } else if (ing.name === '[object Object]') {
        errors.push({
          code: 'IV-004',
          field: `${fieldPath}.name`,
          message: 'Ingredient name contains [object Object]',
          severity: 'critical',
        });
      }

      // Validate optional fields
      if (ing.quantity !== undefined && typeof ing.quantity !== 'string') {
        warnings.push({
          code: 'IV-005',
          field: `${fieldPath}.quantity`,
          message: 'Ingredient quantity should be a string',
        });
      }
    });
  }

  // Validate instructions
  if (!Array.isArray(recipe.instructions)) {
    errors.push({
      code: 'SV-006',
      field: 'instructions',
      message: 'Instructions must be an array',
      severity: 'critical',
    });
  } else if (recipe.instructions.length === 0) {
    errors.push({
      code: 'SV-005',
      field: 'instructions',
      message: 'Recipe must have at least one instruction',
      severity: 'critical',
    });
  } else {
    recipe.instructions.forEach((inst, idx) => {
      const fieldPath = `instructions[${idx}]`;

      if (typeof inst !== 'string') {
        errors.push({
          code: 'IN-004',
          field: fieldPath,
          message: 'Instruction must be a string',
          severity: 'critical',
        });
      } else if (inst.trim().length === 0) {
        errors.push({
          code: 'IN-001',
          field: fieldPath,
          message: 'Instruction cannot be empty',
          severity: 'critical',
        });
      } else if (inst === '[object Object]') {
        errors.push({
          code: 'IN-005',
          field: fieldPath,
          message: 'Instruction contains [object Object]',
          severity: 'critical',
        });
      } else if (inst.length < 10) {
        warnings.push({
          code: 'IN-002',
          field: fieldPath,
          message: 'Instruction is very short (< 10 chars)',
          suggestion: 'Consider adding more detail',
        });
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
```

### A.2 Sanitization Example

```typescript
export function sanitizeIngredients(ingredients: any[]): ParsedIngredient[] {
  return ingredients.map((ing, idx) => {
    // Handle string format
    if (typeof ing === 'string') {
      return { name: ing };
    }

    // Handle object format
    if (typeof ing === 'object' && ing !== null) {
      // Has correct structure
      if ('name' in ing && typeof ing.name === 'string' && ing.name.trim().length > 0) {
        return {
          name: ing.name,
          quantity: ing.quantity || undefined,
          unit: ing.unit || undefined,
          notes: ing.notes || undefined,
          preparation: ing.preparation || undefined,
        };
      }

      // Missing name, try alternate properties
      if ('ingredient' in ing) {
        return { name: ing.ingredient, ...ing };
      }

      if ('item' in ing) {
        return { name: ing.item, ...ing };
      }

      // Last resort: stringify
      console.warn(`Ingredient ${idx} has no name property, stringifying:`, ing);
      return { name: JSON.stringify(ing) };
    }

    // Fallback
    console.warn(`Ingredient ${idx} is invalid type, converting to string:`, ing);
    return { name: String(ing) };
  });
}
```

---

## Appendix B: Related Documentation

- **Test Report**: `/TEST_REPORT_CRITICAL_BUGS.md`
- **Content Cleanup**: `/docs/guides/RECIPE_CONTENT_CLEANUP.md`
- **Recipe Ingestion API**: `/docs/api/recipe-ingestion-api.md`
- **Database Schema**: `/src/lib/db/schema.ts`
- **Recipe Utils**: `/src/lib/utils/recipe-utils.ts`

---

**Document Version**: 1.0.0
**Last Updated**: October 29, 2025
**Author**: Research Agent
**Status**: ✅ Ready for Implementation
