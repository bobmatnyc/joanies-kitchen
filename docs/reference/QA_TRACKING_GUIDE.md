# QA Tracking Guide

**Purpose**: Track recipe quality assurance validation for 4,707 recipes in Joanie's Kitchen.

**Added**: v0.7.1 (Phase 6 Launch Preparation)
**Launch Date**: October 27, 2025

---

## Schema Fields

### qa_status
**Type**: `varchar(50)`, default `'pending'`
**Values**:
- `pending` - Recipe has not been QA validated yet
- `validated` - Recipe passed QA validation
- `flagged` - Issues found during QA
- `fixed` - Automated fixes applied to flagged recipe
- `needs_review` - Requires human review before approval

**Indexed**: Yes (`idx_recipes_qa_status`)

### qa_timestamp
**Type**: `timestamp`, nullable
**Purpose**: When QA was last performed
**Values**:
- `NULL` - Recipe has never been QA validated
- Timestamp - Last QA validation date/time

**Indexed**: Yes (`idx_recipes_qa_timestamp`)

### qa_method
**Type**: `varchar(100)`, nullable
**Purpose**: Track which QA process validated the recipe
**Values**:
- `'human'` - Manual human review
- `'qwen2.5-7b-instruct'` - Qwen 2.5 7B LLM validation
- `'gpt-4o-mini'` - GPT-4o Mini LLM validation
- `'automated-rules'` - Rule-based automated validation
- Custom model names as needed

**Indexed**: Yes (`idx_recipes_qa_method`)

### qa_confidence
**Type**: `decimal(3, 2)`, nullable
**Range**: 0.00 to 1.00
**Purpose**: Confidence score for LLM-based QA
**Values**:
- `NULL` - Not applicable (human review or automated rules)
- `0.00-1.00` - LLM confidence score
  - `0.95-1.00` - Very high confidence
  - `0.85-0.94` - High confidence
  - `0.70-0.84` - Medium confidence
  - `0.00-0.69` - Low confidence (flag for review)

### qa_notes
**Type**: `text`, nullable
**Purpose**: Free-form notes for human context
**Examples**:
- `"Reviewed by admin on 2025-10-24. All ingredients verified."`
- `"Auto-validated via GPT-4o-mini. High confidence (0.96)."`
- `"Instructions unclear. Flagged for chef review."`

### qa_issues_found
**Type**: `text` (JSON array), nullable
**Purpose**: Track specific issues discovered during QA
**Format**: JSON array of issue strings

**Examples**:
```json
[
  "missing_ingredient:salt",
  "instruction_mismatch:butter_not_in_ingredients",
  "unclear_quantity:flour",
  "duplicate_step:step_3_and_5_identical"
]
```

**Issue Format**: `{category}:{detail}`

**Common Categories**:
- `missing_ingredient` - Ingredient in instructions but not in ingredient list
- `instruction_mismatch` - Instruction references non-existent ingredient
- `unclear_quantity` - Ambiguous or missing quantity
- `duplicate_step` - Duplicate instruction steps
- `formatting_error` - JSON parsing or formatting issues
- `nutrition_missing` - Missing nutritional information
- `image_missing` - Missing or broken image URLs

### qa_fixes_applied
**Type**: `text` (JSON array), nullable
**Purpose**: Audit trail of automated fixes
**Format**: JSON array of fix strings

**Examples**:
```json
[
  "added_ingredient:salt:1_tsp",
  "updated_quantity:flour:2_cups",
  "removed_duplicate:step_5",
  "fixed_json_formatting:ingredients_array"
]
```

**Fix Format**: `{action}:{target}:{detail}`

**Common Actions**:
- `added_ingredient` - Added missing ingredient to list
- `updated_quantity` - Corrected quantity/unit
- `removed_duplicate` - Removed duplicate entry
- `fixed_json_formatting` - Corrected JSON structure
- `normalized_unit` - Standardized measurement unit
- `split_instruction` - Split compound instruction into steps

---

## QA Workflow

### Status Flow Diagram

```
┌─────────┐
│ pending │ (default for all recipes)
└────┬────┘
     │
     ├──────────────────┬─────────────────┐
     │                  │                 │
     ↓                  ↓                 ↓
┌───────────┐     ┌─────────┐     ┌──────────────┐
│ validated │     │ flagged │     │ needs_review │
└───────────┘     └────┬────┘     └──────┬───────┘
                       │                  │
                       ↓                  │
                  ┌────────┐              │
                  │ fixed  │              │
                  └────┬───┘              │
                       │                  │
                       └──────────────────┘
                                 │
                                 ↓
                          ┌───────────┐
                          │ validated │
                          └───────────┘
```

### Workflow Steps

#### 1. Initial State: `pending`
- All existing recipes default to `pending`
- New recipes created with `qa_status = 'pending'`
- `qa_timestamp = NULL` (never validated)

#### 2. Automated QA Pass → `validated`
```typescript
{
  qa_status: 'validated',
  qa_timestamp: new Date(),
  qa_method: 'qwen2.5-7b-instruct',
  qa_confidence: 0.96,
  qa_notes: 'Automated validation passed. High confidence.',
  qa_issues_found: null,
  qa_fixes_applied: null
}
```

#### 3. Automated QA Fail → `flagged`
```typescript
{
  qa_status: 'flagged',
  qa_timestamp: new Date(),
  qa_method: 'gpt-4o-mini',
  qa_confidence: 0.72,
  qa_notes: 'Issues detected. Review required.',
  qa_issues_found: JSON.stringify([
    'missing_ingredient:salt',
    'unclear_quantity:flour'
  ]),
  qa_fixes_applied: null
}
```

#### 4. Automated Fix → `fixed`
```typescript
{
  qa_status: 'fixed',
  qa_timestamp: new Date(),
  qa_method: 'automated-rules',
  qa_confidence: null,
  qa_notes: 'Automated fixes applied. Pending re-validation.',
  qa_issues_found: JSON.stringify(['missing_ingredient:salt']),
  qa_fixes_applied: JSON.stringify(['added_ingredient:salt:1_tsp'])
}
```

#### 5. Human Review Needed → `needs_review`
```typescript
{
  qa_status: 'needs_review',
  qa_timestamp: new Date(),
  qa_method: 'gpt-4o-mini',
  qa_confidence: 0.45,
  qa_notes: 'Low confidence. Chef review required.',
  qa_issues_found: JSON.stringify([
    'instruction_mismatch:butter_not_in_ingredients',
    'unclear_quantity:flour'
  ]),
  qa_fixes_applied: null
}
```

#### 6. Human Approval → `validated`
```typescript
{
  qa_status: 'validated',
  qa_timestamp: new Date(),
  qa_method: 'human',
  qa_confidence: null,
  qa_notes: 'Reviewed by Chef Joanie on 2025-10-24. Approved.',
  qa_issues_found: JSON.stringify([
    'instruction_mismatch:butter_not_in_ingredients'
  ]),
  qa_fixes_applied: JSON.stringify([
    'added_ingredient:butter:2_tbsp'
  ])
}
```

---

## Database Queries

### Count recipes by QA status
```sql
SELECT qa_status, COUNT(*) as count
FROM recipes
WHERE deleted_at IS NULL
GROUP BY qa_status
ORDER BY count DESC;
```

### Find all pending recipes
```sql
SELECT id, name, created_at
FROM recipes
WHERE qa_status = 'pending'
  AND deleted_at IS NULL
ORDER BY created_at DESC;
```

### Find flagged recipes needing attention
```sql
SELECT id, name, qa_timestamp, qa_method, qa_issues_found
FROM recipes
WHERE qa_status IN ('flagged', 'needs_review')
  AND deleted_at IS NULL
ORDER BY qa_timestamp DESC;
```

### Find recipes validated by specific method
```sql
SELECT id, name, qa_timestamp, qa_confidence
FROM recipes
WHERE qa_method = 'qwen2.5-7b-instruct'
  AND qa_status = 'validated'
  AND deleted_at IS NULL
ORDER BY qa_confidence DESC;
```

### Find low-confidence validations
```sql
SELECT id, name, qa_method, qa_confidence, qa_notes
FROM recipes
WHERE qa_confidence < 0.70
  AND qa_status = 'validated'
  AND deleted_at IS NULL
ORDER BY qa_confidence ASC;
```

### QA progress dashboard
```sql
SELECT
  COUNT(*) FILTER (WHERE qa_status = 'pending') as pending,
  COUNT(*) FILTER (WHERE qa_status = 'validated') as validated,
  COUNT(*) FILTER (WHERE qa_status = 'flagged') as flagged,
  COUNT(*) FILTER (WHERE qa_status = 'fixed') as fixed,
  COUNT(*) FILTER (WHERE qa_status = 'needs_review') as needs_review,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE qa_status = 'validated') / COUNT(*), 2) as pct_validated
FROM recipes
WHERE deleted_at IS NULL;
```

---

## TypeScript Usage

### Type Definitions
```typescript
// Auto-generated from Drizzle schema
type Recipe = {
  // ... existing fields
  qa_status: string | null;
  qa_timestamp: Date | null;
  qa_method: string | null;
  qa_confidence: string | null; // Decimal as string
  qa_notes: string | null;
  qa_issues_found: string | null; // JSON string
  qa_fixes_applied: string | null; // JSON string
};
```

### QA Issue Types
```typescript
type QAIssue =
  | `missing_ingredient:${string}`
  | `instruction_mismatch:${string}`
  | `unclear_quantity:${string}`
  | `duplicate_step:${string}`
  | `formatting_error:${string}`
  | `nutrition_missing`
  | `image_missing`;

type QAFix =
  | `added_ingredient:${string}:${string}`
  | `updated_quantity:${string}:${string}`
  | `removed_duplicate:${string}`
  | `fixed_json_formatting:${string}`
  | `normalized_unit:${string}:${string}`
  | `split_instruction:${string}`;
```

### Helper Functions
```typescript
/**
 * Parse QA issues from JSON string
 */
function parseQAIssues(qaIssuesFound: string | null): QAIssue[] {
  if (!qaIssuesFound) return [];
  try {
    return JSON.parse(qaIssuesFound);
  } catch {
    return [];
  }
}

/**
 * Parse QA fixes from JSON string
 */
function parseQAFixes(qaFixesApplied: string | null): QAFix[] {
  if (!qaFixesApplied) return [];
  try {
    return JSON.parse(qaFixesApplied);
  } catch {
    return [];
  }
}

/**
 * Mark recipe as validated
 */
async function markRecipeValidated(
  recipeId: string,
  method: string,
  confidence: number | null = null,
  notes: string = 'Validation passed'
) {
  await db.update(recipes)
    .set({
      qa_status: 'validated',
      qa_timestamp: new Date(),
      qa_method: method,
      qa_confidence: confidence?.toFixed(2) || null,
      qa_notes: notes,
    })
    .where(eq(recipes.id, recipeId));
}

/**
 * Flag recipe with issues
 */
async function flagRecipeWithIssues(
  recipeId: string,
  method: string,
  issues: QAIssue[],
  confidence: number | null = null,
  notes: string = 'Issues detected during validation'
) {
  await db.update(recipes)
    .set({
      qa_status: 'flagged',
      qa_timestamp: new Date(),
      qa_method: method,
      qa_confidence: confidence?.toFixed(2) || null,
      qa_notes: notes,
      qa_issues_found: JSON.stringify(issues),
    })
    .where(eq(recipes.id, recipeId));
}

/**
 * Apply automated fixes
 */
async function applyAutomatedFixes(
  recipeId: string,
  issues: QAIssue[],
  fixes: QAFix[],
  notes: string = 'Automated fixes applied'
) {
  await db.update(recipes)
    .set({
      qa_status: 'fixed',
      qa_timestamp: new Date(),
      qa_method: 'automated-rules',
      qa_confidence: null,
      qa_notes: notes,
      qa_issues_found: JSON.stringify(issues),
      qa_fixes_applied: JSON.stringify(fixes),
    })
    .where(eq(recipes.id, recipeId));
}
```

---

## Migration Information

**Migration File**: `drizzle/0018_good_sue_storm.sql`

**Generated SQL**:
```sql
-- Add QA tracking columns
ALTER TABLE "recipes" ADD COLUMN "qa_status" varchar(50) DEFAULT 'pending';
ALTER TABLE "recipes" ADD COLUMN "qa_timestamp" timestamp;
ALTER TABLE "recipes" ADD COLUMN "qa_method" varchar(100);
ALTER TABLE "recipes" ADD COLUMN "qa_confidence" numeric(3, 2);
ALTER TABLE "recipes" ADD COLUMN "qa_notes" text;
ALTER TABLE "recipes" ADD COLUMN "qa_issues_found" text;
ALTER TABLE "recipes" ADD COLUMN "qa_fixes_applied" text;

-- Create indexes for efficient QA queries
CREATE INDEX "idx_recipes_qa_status" ON "recipes" USING btree ("qa_status");
CREATE INDEX "idx_recipes_qa_timestamp" ON "recipes" USING btree ("qa_timestamp");
CREATE INDEX "idx_recipes_qa_method" ON "recipes" USING btree ("qa_method");
```

**Backward Compatibility**: ✅ Yes
- All new fields are nullable (except `qa_status` with default)
- Existing recipes get `qa_status = 'pending'` by default
- No existing data is modified
- No breaking changes to existing queries

---

## Launch Preparation Checklist

### Pre-Migration (Complete)
- [x] Schema design reviewed
- [x] Migration generated
- [x] SQL verified
- [x] Indexes created for performance
- [x] TypeScript types updated
- [x] Documentation created

### Migration (Pending)
- [ ] Review migration SQL
- [ ] Backup database
- [ ] Run migration: `pnpm drizzle-kit push`
- [ ] Verify columns created
- [ ] Verify indexes created
- [ ] Verify default values applied

### Post-Migration
- [ ] Run QA status count query to verify all recipes are `pending`
- [ ] Test QA workflow on sample recipes
- [ ] Implement QA automation scripts
- [ ] Create admin dashboard for QA monitoring
- [ ] Document QA processes for team

### Launch Day (October 27, 2025)
- [ ] QA validation complete for all 4,707 recipes
- [ ] Zero `flagged` or `needs_review` recipes
- [ ] QA dashboard live for monitoring
- [ ] QA metrics tracked in analytics

---

## Performance Considerations

### Index Strategy
Three indexes created for optimal query performance:

1. **`idx_recipes_qa_status`** - Filter by status
   - Most common query: "Get all pending recipes"
   - Expected usage: Admin dashboards, batch processing

2. **`idx_recipes_qa_timestamp`** - Sort by validation date
   - Query: "Recently validated recipes"
   - Expected usage: QA progress tracking, auditing

3. **`idx_recipes_qa_method`** - Filter by QA method
   - Query: "All recipes validated by GPT-4o-mini"
   - Expected usage: Method effectiveness analysis, A/B testing

### Query Performance Estimates
- **Count by status**: <10ms (indexed)
- **Filter pending recipes**: <50ms (indexed + pagination)
- **QA dashboard (aggregates)**: <100ms (3 indexes + FILTER)
- **Low-confidence search**: <75ms (indexed + numeric filter)

### Storage Impact
- **Per Recipe**: ~200 bytes (7 new columns, mostly NULL)
- **Total Impact**: ~940 KB for 4,707 recipes
- **Negligible** impact on database size or performance

---

## Security Considerations

### Access Control
- QA fields should be **read-only** for regular users
- Only **admins** can manually update QA fields
- API endpoints must validate admin permissions

### Data Integrity
- `qa_issues_found` and `qa_fixes_applied` must be valid JSON
- `qa_confidence` must be between 0.00 and 1.00
- `qa_status` must be one of the enum values
- Use Zod schemas for validation

### Audit Trail
- All QA updates should be logged
- `qa_timestamp` provides audit timestamp
- `qa_method` provides audit attribution
- Consider adding `qa_updated_by` for human attribution

---

## Future Enhancements

### v0.8.0+ Potential Features
1. **QA History Table** - Track all QA attempts, not just latest
2. **QA Confidence Trends** - Monitor model accuracy over time
3. **Automated Re-validation** - Periodic re-QA of old recipes
4. **QA Scoring System** - Composite quality score (0-100)
5. **QA Leaderboard** - Rank recipes by QA quality
6. **QA Notifications** - Alert admins when recipes need review
7. **QA Workflow Automation** - Auto-fix → auto-revalidate → auto-approve

---

**Document Version**: 1.0
**Last Updated**: 2025-10-24
**Status**: Ready for migration review
