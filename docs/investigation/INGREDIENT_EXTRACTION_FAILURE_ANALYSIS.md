# Ingredient Extraction Failure Analysis

**Date**: October 20, 2025
**Investigator**: Research Agent
**Priority**: 🔴 CRITICAL (Blocks core fridge feature)

---

## Executive Summary

**PROBLEM**: Ingredient extraction has achieved only **5.7% coverage** (265 of 4,644 recipes), not the reported 10% (460 recipes). The extraction script has failed for **94.3% of recipes** due to two critical issues:

1. **🔴 PRIMARY CAUSE: API Credit Exhaustion** - OpenRouter API credits depleted (HTTP 402 errors)
2. **🟡 SECONDARY CAUSE: Data Format Incompatibility** - TheMealDB recipes (298 recipes, 6.4%) use object format incompatible with extraction script

**IMPACT**: Fridge-to-recipe matching is non-functional, blocking Phase 6 content audit and launch readiness.

---

## Database State Analysis

### Current Statistics

| Metric | Count | Percentage |
|--------|-------|------------|
| **Total Recipes** | 4,644 | 100% |
| **Ingredients Extracted** | 460 | 9.9% |
| **Recipe-Ingredient Links** | 459 | - |
| **Recipes WITH Ingredients** | 265 | 5.7% |
| **Recipes WITHOUT Ingredients** | 4,379 | 94.3% |

**Key Finding**: The discrepancy between 460 ingredients and 265 recipes indicates:
- Successful extractions created ~1.7 ingredients per recipe on average
- This is **abnormally low** (expected: 8-12 ingredients per recipe)
- Suggests partial/incomplete extractions before API credits ran out

### Recipe Source Distribution

| Source | Count | Percentage | Format |
|--------|-------|------------|--------|
| **Epicurious** | 3,241 | 69.8% | Array of strings ✅ |
| **Other/Manual** | 1,094 | 23.6% | Mixed formats ⚠️ |
| **TheMealDB** | 298 | 6.4% | Object format ❌ |
| **Serious Eats** | 11 | 0.2% | Array of strings ✅ |

---

## Root Cause Analysis

### 🔴 PRIMARY ISSUE: API Credit Exhaustion

**Evidence**:
```json
{
  "error": "402 Insufficient credits. Add more using https://openrouter.ai/settings/credits"
}
```

**Impact**:
- Latest error log (`ingredient-extraction-errors-2025-10-21T02-08-58.json`) contains **23,216 lines**
- Estimated **4,400+ failed extractions** due to API credit depletion
- Script attempted to process all recipes but ran out of credits early in execution

**Timeline Reconstruction**:
1. Script started processing 4,644 recipes
2. Successfully extracted ~265 recipes (first ~6% of dataset)
3. OpenRouter API credits exhausted
4. Remaining 4,379 recipes failed with HTTP 402 errors
5. Script continued attempting extractions, logging errors but not stopping

**Cost Analysis**:
- Estimated cost per recipe: ~$0.002-0.005 (using Claude Sonnet 4.5)
- Total cost for 4,644 recipes: ~$9.28 - $23.20
- Actual credits available: Unknown (ran out after ~265 recipes = ~$0.53 - $1.33)

**Why This Wasn't Detected Earlier**:
- Script has retry logic for rate limits (429) but **not for credit exhaustion (402)**
- Error logging is comprehensive but script doesn't halt on payment errors
- Checkpoint system saves progress but doesn't flag critical payment failures

---

### 🟡 SECONDARY ISSUE: TheMealDB Format Incompatibility

**Evidence**:
```typescript
// Current script expects (line 581):
ingredientStrings = JSON.parse(recipe.ingredients as string);
// Type: string[]

// TheMealDB provides:
[
  {"item": "Green Pepper", "quantity": "4 whole"},
  {"item": "Self-raising Flour", "quantity": "750g"}
]
// Type: Array<{item: string, quantity: string}>
```

**Impact**:
- 298 TheMealDB recipes (6.4% of database) have incompatible format
- Script's type assertion `string[]` causes runtime issues when processing objects
- LLM receives object format instead of plain strings, reducing extraction quality

**Why This Format Exists**:
- TheMealDB API returns structured ingredient data with separate fields
- Import script preserved original API format
- Extraction script was written assuming Epicurious/Tasty format (plain strings)

**Affected Recipes**:
- "Stuffed Bell Peppers with Quinoa and Black Beans"
- "Home-made Mandazi"
- "Mulukhiyah"
- "Tortang Talong"
- "Chicken Basquaise"
- +293 more TheMealDB recipes

---

## Technical Analysis

### Extraction Script Logic Flow

```typescript
1. Fetch all recipes from database
2. For each recipe in batches of 10:
   a. Parse ingredients JSON → Expects string[]
   b. Validate array format
   c. Call LLM to extract structured data
   d. Find or create normalized ingredients
   e. Create recipe-ingredient relationships
   f. Save checkpoint every 50 recipes
3. Generate final statistics
```

**Critical Gaps**:
1. ❌ No pre-flight credit check
2. ❌ No handling for HTTP 402 (payment required)
3. ❌ No format normalization for TheMealDB recipes
4. ❌ No halt-on-critical-error logic
5. ❌ No mid-run credit monitoring

### Data Format Patterns

#### ✅ Standard Format (93.6% of recipes)
```json
[
  "2 cups all-purpose flour, sifted",
  "1/2 teaspoon salt",
  "3 cloves garlic, minced"
]
```
**Handled by**: Current extraction script

#### ❌ TheMealDB Format (6.4% of recipes)
```json
[
  {"item": "All-Purpose Flour", "quantity": "2 cups"},
  {"item": "Salt", "quantity": "1/2 teaspoon"},
  {"item": "Garlic", "quantity": "3 cloves"}
]
```
**Requires**: Format conversion before extraction

---

## Failure Mode Classification

### Type 1: API Credit Exhaustion (94.3% of failures)
- **Symptom**: HTTP 402 errors from OpenRouter
- **Affected**: 4,379 recipes
- **Severity**: 🔴 Critical
- **Reversible**: Yes (add credits + re-run)
- **Data Loss**: None (checkpoint system preserved progress)

### Type 2: Format Incompatibility (6.4% of all recipes)
- **Symptom**: Type mismatch, poor LLM extraction quality
- **Affected**: 298 TheMealDB recipes
- **Severity**: 🟡 High
- **Reversible**: Yes (format normalization)
- **Data Loss**: Potential (if extractions occurred with wrong format)

### Type 3: Silent Partial Extractions (~1.7% of database)
- **Symptom**: Recipe linked but very few ingredients extracted
- **Affected**: Unknown count (requires audit)
- **Severity**: 🟡 High
- **Reversible**: Yes (re-run with more credits)
- **Data Loss**: Incomplete data (only partial ingredients)

---

## Proposed Fix Strategy

### Phase 1: Immediate Fixes (1-2 hours)

#### 1.1 Add OpenRouter Credits
**Action**: Purchase $25-50 in OpenRouter credits
**Cost**: ~$25-50
**Impact**: Unblocks extraction for all 4,379 pending recipes
**Steps**:
1. Visit https://openrouter.ai/settings/credits
2. Add $25-50 credits (covers full extraction + buffer)
3. Verify credit balance before resuming

#### 1.2 Update Extraction Script - Credit Monitoring
**File**: `scripts/extract-ingredients.ts`
**Changes**:
```typescript
// Add pre-flight credit check
async function checkOpenRouterCredits() {
  const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
    headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` }
  });
  const data = await response.json();
  if (data.data.usage.balance < 5.00) {
    throw new Error('Insufficient credits (< $5.00). Add more before proceeding.');
  }
}

// Add 402 error handling in retry logic (line 306)
if (error.status === 402) {
  console.error('❌ API CREDITS EXHAUSTED - Halting extraction');
  throw new Error('Payment required: Add OpenRouter credits to continue');
}
```

#### 1.3 Update Extraction Script - Format Normalization
**File**: `scripts/extract-ingredients.ts`
**Changes**:
```typescript
// Replace ingredient parsing (line 578-589)
let ingredientStrings: string[];
try {
  const parsed = JSON.parse(recipe.ingredients as string);

  if (!Array.isArray(parsed)) {
    throw new Error('Ingredients is not an array');
  }

  // Normalize TheMealDB format to string array
  if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
    // TheMealDB format: [{item, quantity}] → ["quantity item"]
    ingredientStrings = parsed.map((ing: any) =>
      `${ing.quantity} ${ing.item}`.trim()
    );
    console.log(`  🔄 Converted TheMealDB format (${parsed.length} ingredients)`);
  } else {
    // Standard format: already string array
    ingredientStrings = parsed as string[];
  }
} catch (error) {
  console.log(`  ✗ Failed to parse ingredients JSON`);
  stats.skipped++;
  continue;
}
```

### Phase 2: Resume Extraction (2-3 hours)

**Command**:
```bash
npx tsx scripts/extract-ingredients.ts --execute --resume
```

**Expected Outcome**:
- Resume from checkpoint (last processed ID)
- Process remaining 4,379 recipes
- Normalize TheMealDB recipes during processing
- Complete full database extraction

**Estimated Cost**: $9-18 (for remaining recipes)
**Estimated Runtime**: 2-3 hours (at ~25 recipes/minute with rate limiting)

### Phase 3: Validation & Cleanup (30 minutes)

#### 3.1 Verify Extraction Coverage
```bash
npx tsx scripts/diagnostic-query.ts
```
**Expected**:
- Coverage: >95% (4,400+/4,644 recipes)
- Unique ingredients: 1,200-1,500
- Recipe-ingredient links: 40,000-50,000

#### 3.2 Audit Partial Extractions
**Query**:
```sql
SELECT r.id, r.name, COUNT(ri.id) as ingredient_count
FROM recipes r
JOIN recipe_ingredients ri ON r.id = ri.recipe_id
GROUP BY r.id, r.name
HAVING COUNT(ri.id) < 3
ORDER BY ingredient_count ASC;
```
**Action**: Re-run extraction for recipes with <3 ingredients (likely partial failures)

#### 3.3 Verify TheMealDB Recipes
**Query**:
```sql
SELECT r.id, r.name, COUNT(ri.id) as ingredient_count
FROM recipes r
LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
WHERE r.source LIKE '%TheMealDB%'
GROUP BY r.id, r.name
ORDER BY ingredient_count DESC
LIMIT 20;
```
**Action**: Verify TheMealDB recipes have proper ingredient extraction

---

## Alternative Fix Strategy (If Budget Constrained)

### Option A: Use Free/Cheaper Model
**Model**: `google/gemini-2.0-flash-exp:free` (currently used in app)
**Cost**: $0 (free tier)
**Tradeoff**: Lower extraction quality, may require manual cleanup
**Estimated Runtime**: 3-4 hours (slower due to free tier rate limits)

**Implementation**:
```typescript
// Update MODEL constant (line 50)
const MODEL = 'google/gemini-2.0-flash-exp:free';
```

### Option B: Batch Processing with Manual Review
**Approach**: Extract 500 recipes at a time, review quality, adjust
**Cost**: ~$1-2 per batch
**Tradeoff**: Longer timeline, requires manual oversight
**Estimated Timeline**: 5-7 days (at 1-2 batches per day)

### Option C: Hybrid Approach (RECOMMENDED if budget <$25)
1. Use free model for bulk extraction (4,400 recipes)
2. Use Claude Sonnet 4.5 for TheMealDB recipes only (298 recipes = ~$0.60)
3. Manually review and fix top 100 most-used recipes

**Estimated Cost**: $0.60
**Estimated Runtime**: 4-6 hours
**Quality**: 85-90% (vs 95%+ with full Claude extraction)

---

## Risk Assessment

### If Not Fixed

| Risk | Impact | Likelihood | Severity |
|------|--------|------------|----------|
| **Fridge feature unusable** | Users cannot search by ingredients | 100% | 🔴 Critical |
| **Phase 6 audit blocks** | Cannot complete content audit | 100% | 🔴 Critical |
| **Launch delayed** | Zero-waste pivot incomplete | High | 🔴 Critical |
| **User trust damaged** | Core feature advertised but broken | High | 🟡 High |
| **Manual data entry required** | 4,400 recipes need manual ingredient tagging | Medium | 🟡 High |

### If Fixed with Proposed Strategy

| Risk | Impact | Likelihood | Severity |
|------|--------|------------|----------|
| **Extraction quality issues** | Some ingredients incorrectly parsed | Low | 🟢 Medium |
| **Additional cost overrun** | More than $25 needed | Very Low | 🟢 Low |
| **TheMealDB format issues** | Format conversion introduces errors | Low | 🟢 Medium |
| **Partial extractions remain** | Some recipes with incomplete data | Low | 🟢 Low |

---

## Recommended Next Steps

### For Engineer Agent (Immediate - 1 hour)

1. **Update extraction script** with:
   - Pre-flight credit check function
   - HTTP 402 error handling (halt-on-payment-required)
   - TheMealDB format normalization
   - Credit balance monitoring during execution

2. **Test updated script** on 10 recipes:
   ```bash
   npx tsx scripts/extract-ingredients.ts --limit=10 --execute
   ```

3. **Verify fixes**:
   - TheMealDB recipes convert properly
   - Credit check runs before processing
   - 402 errors halt execution (not just log)

### For PM/User (Immediate - 15 minutes)

1. **Add OpenRouter credits**:
   - Visit: https://openrouter.ai/settings/credits
   - Add: $25-50 (recommended: $50 for buffer)
   - Verify balance appears in dashboard

2. **Notify Engineer** when credits added

### For Engineer Agent (After Credits Added - 2-3 hours)

1. **Resume extraction**:
   ```bash
   npx tsx scripts/extract-ingredients.ts --execute --resume
   ```

2. **Monitor progress**:
   - Check logs every 30 minutes
   - Verify no 402 errors
   - Confirm checkpoint saves

3. **Validate results**:
   ```bash
   npx tsx scripts/diagnostic-query.ts
   ```

4. **Report to PM**:
   - Extraction coverage achieved
   - Unique ingredients count
   - Any remaining issues

---

## Success Criteria

### Phase 1 (Script Updates)
- ✅ Pre-flight credit check implemented
- ✅ HTTP 402 error handling added
- ✅ TheMealDB format normalization working
- ✅ Test extraction on 10 recipes successful

### Phase 2 (Full Extraction)
- ✅ Coverage ≥95% (4,400+ recipes with ingredients)
- ✅ Unique ingredients: 1,200-1,500
- ✅ Recipe-ingredient links: 40,000-50,000
- ✅ No HTTP 402 errors during run
- ✅ TheMealDB recipes properly extracted

### Phase 3 (Validation)
- ✅ Fridge search returns results for common ingredients
- ✅ Manual spot-check of 20 recipes confirms accuracy
- ✅ Phase 6 content audit can proceed
- ✅ No critical errors in extraction logs

---

## Appendix: Investigation Methodology

### Data Collection
1. Queried database for recipe counts, ingredient counts, and link counts
2. Analyzed checkpoint files and error logs
3. Examined recipe data formats across different sources
4. Traced extraction script logic flow
5. Reviewed API error patterns

### Tools Used
- Direct database queries via Drizzle ORM
- Custom diagnostic scripts
- Error log analysis (23,216 line log file)
- Checkpoint file inspection
- Format analysis across recipe sources

### Files Generated
- `/scripts/diagnostic-query.ts` - Database state analysis
- `/scripts/analyze-recipe-formats.ts` - Format pattern detection
- `/scripts/count-themealdb-recipes.ts` - Source distribution analysis
- `/tmp/ingredient-extraction-checkpoint.json` - Progress state
- Multiple error logs with HTTP 402 failures

---

**Report Generated**: October 20, 2025
**Next Review**: After extraction script updates deployed
**Estimated Fix Timeline**: 3-4 hours (1 hour updates + 2-3 hours extraction)
**Estimated Cost**: $25-50 (OpenRouter credits)
