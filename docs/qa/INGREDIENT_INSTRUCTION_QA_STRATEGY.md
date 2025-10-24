# Recipe Ingredient-Instruction QA Strategy
**Joanie's Kitchen - Zero-Waste Cooking Platform**

**Document Version**: 1.0
**Created**: 2025-10-24
**Launch Target**: October 27, 2025 (6 days)
**Status**: Research Complete - Implementation Pending

---

## Executive Summary

**Critical Finding**: 98.15% of recipes have normalized ingredients (4,620/4,707), but quality validation of ingredient-instruction matching has NOT been performed systematically.

**Recommendation**: Deploy automated LLM-based QA system to validate all 4,707 recipes before launch, prioritizing the 211 recipes with missing instructions and 67 recipes without normalized ingredients.

---

## 1. Database Schema Findings

### 1.1 Recipe Data Structure

**Storage Format** (from `src/lib/db/schema.ts`):
- **`recipes.ingredients`**: TEXT field storing JSON array of strings
- **`recipes.instructions`**: TEXT field storing JSON array of strings
- Both fields store raw recipe data as scraped/entered

**Example Recipe Structure**:
```json
{
  "id": "bcbec2bd-119f-4556-8ceb-83f8a896c686",
  "name": "Frisée, Radicchio, and Asian Pear Salad",
  "ingredients": "[\"8 cups torn frisée\", \"1 head of radicchio\", ...]",
  "instructions": "[\"In a bowl combine the frisée...\", \"Toast the hazelnuts...\"]"
}
```

### 1.2 Normalized Ingredient Relationships

**Dual Storage System** (from `src/lib/db/ingredients-schema.ts`):
1. **Legacy Format**: `recipes.ingredients` (JSON array) - always present
2. **Normalized Format**: `recipe_ingredients` join table - 98.15% coverage

**`recipeIngredients` Table Structure**:
```typescript
{
  recipe_id: string;
  ingredient_id: uuid;
  amount: string;       // e.g., "2", "1/2", "to taste"
  unit: string;         // e.g., "cups", "tablespoons"
  preparation: string;  // e.g., "chopped", "diced"
  is_optional: boolean;
  position: integer;    // Order in recipe
  ingredient_group: string; // e.g., "For the sauce"
}
```

**Master Ingredients Table**:
- 2,716 normalized ingredients in database
- Includes aliases, categories, common units
- Supports fuzzy search with trigram indexes

---

## 2. Data Quality Analysis

### 2.1 Current State (4,707 Recipes)

| Metric | Count | Percentage | Priority |
|--------|-------|------------|----------|
| **Total recipes** | 4,707 | 100% | - |
| **Missing ingredients** | 20 | 0.42% | 🔴 CRITICAL |
| **Missing instructions** | 211 | 4.48% | 🔴 CRITICAL |
| **No normalized ingredients** | 67 | 1.42% | 🟡 HIGH |
| **Normalized ingredient coverage** | 4,620 | 98.15% | ✅ GOOD |

### 2.2 Recipe Complexity Distribution

**Ingredient Count Distribution**:
- Most common: 8 ingredients (481 recipes)
- Median: 7-9 ingredients
- Range: 1-20+ ingredients
- Average: ~8.5 ingredients per recipe

**Instruction Step Distribution**:
- Most common: 1 step (745 recipes) - likely imported recipes with single paragraph
- Median: 3-4 steps
- Range: 1-20+ steps
- 745 recipes have single-step instructions (may need splitting)

### 2.3 Sample Validation Results

**Rule-based validation of 20 recipes found**:
- 9 recipes (45%) had potential issues
- Most common: "salt", "pepper", "water" mentioned in instructions but not in ingredient list
- Some recipes may use "to taste" or assume basic pantry items

**Known Issues**:
1. Some ingredients stored as objects instead of strings (causes parsing errors)
2. "Salt and pepper to taste" often omitted from ingredient lists
3. Water for boiling/cooking frequently not listed
4. Butter for greasing pans mentioned in instructions only

---

## 3. Issue Taxonomy

### 3.1 Critical Issues (BLOCK LAUNCH)

**Severity**: Must fix before October 27, 2025

| Issue Type | Impact | Count | Fix Approach |
|------------|--------|-------|--------------|
| **Missing ingredient lists** | Fridge feature unusable | 20 | LLM extraction from instructions |
| **Missing instructions** | Recipe unusable | 211 | Mark for manual review / hide from search |
| **Malformed JSON** | App crashes | Unknown | Validate and fix JSON structure |
| **Non-string ingredient entries** | Parsing errors | ~2-5 | Convert objects to strings |

### 3.2 High Priority Issues (FIX BEFORE LAUNCH)

**Severity**: Impacts core zero-waste feature accuracy

| Issue Type | Impact | Estimated Count | Fix Approach |
|------------|--------|-----------------|--------------|
| **Incomplete ingredient lists** | Fridge search misses recipes | 50-200 | LLM comparison + auto-fix |
| **Ingredient-instruction mismatch** | Missing ingredients in instructions | 200-500 | LLM extraction + validation |
| **No normalized ingredients** | Advanced features unavailable | 67 | Run ingredient extraction script |
| **Common pantry items omitted** | "Salt", "pepper", "water" missing | 300-800 | Rule-based + LLM addition |

### 3.3 Medium Priority Issues (POST-LAUNCH)

**Severity**: Quality improvements, not blocking

| Issue Type | Impact | Estimated Count | Fix Approach |
|------------|--------|-----------------|--------------|
| **Format inconsistencies** | UI display issues | 100-300 | Standardize formatting |
| **Extra ingredients listed** | Ingredient not used | 50-100 | Flag for manual review |
| **Unclear quantities** | "A handful", "some" | 50-150 | Suggest standardization |
| **Single-step instructions** | Needs splitting for better UX | 745 | LLM-based step splitting |

### 3.4 Low Priority Issues (NICE-TO-HAVE)

**Severity**: Polish and consistency

| Issue Type | Impact | Estimated Count | Fix Approach |
|------------|--------|-----------------|--------------|
| **Ingredient ordering** | Cosmetic | Many | Reorder by usage in instructions |
| **Capitalization** | Inconsistent display | Many | Normalize to Title Case |
| **Unit standardization** | "1 tbsp" vs "1 tablespoon" | Many | Normalize units |
| **Alias handling** | "Green onion" vs "scallion" | Many | Use ingredient aliases |

---

## 4. QA Strategy Design

### Phase 1: Automated Structure Detection (2 hours)

**Goal**: Identify all structural issues requiring immediate attention

**Process**:
1. Scan all 4,707 recipes for:
   - Missing ingredients field
   - Missing instructions field
   - Empty JSON arrays
   - Malformed JSON
   - Non-string array elements
   - Recipes without normalized ingredients

**Output**:
- Critical issue list (CSV)
- Automatic fixes applied where safe
- Manual review queue generated

**Tools**: TypeScript validation script (no LLM needed)

**Script**: `scripts/qa-phase1-structure-validation.ts`

---

### Phase 2: LLM-Based Content Validation (8-12 hours)

**Goal**: Validate ingredient-instruction matching using local LLM

**Process**:
1. **For each recipe**:
   - Extract ingredients from instructions using LLM
   - Compare with declared ingredient list
   - Identify missing ingredients
   - Flag mismatches for review
   - Generate suggested fixes

2. **LLM Prompt Template**:
```
You are a recipe data validator. Given the following recipe instructions, extract ALL ingredients mentioned.

INSTRUCTIONS:
{instructions_text}

DECLARED INGREDIENTS:
{ingredient_list}

TASK:
1. List all ingredients mentioned in the instructions
2. Compare with declared ingredient list
3. Identify missing ingredients
4. Output as JSON:
{
  "ingredients_in_instructions": ["ingredient1", "ingredient2", ...],
  "missing_from_list": ["missing1", "missing2", ...],
  "confidence": 0.95,
  "notes": "Additional context"
}
```

**Batch Processing**:
- Process 50-100 recipes per batch
- Parallel processing where possible
- Save progress after each batch
- Estimated time: 6-10 seconds per recipe on M-series MacBook

**Output**:
- Validation report (JSON)
- High-confidence auto-fixes
- Medium-confidence manual review queue
- Low-confidence flag for later review

**Script**: `scripts/qa-phase2-llm-validation.ts`

---

### Phase 3: High-Confidence Automated Fixes (2-4 hours)

**Goal**: Apply safe, high-confidence fixes to database

**Criteria for Automated Fixes**:
1. **Confidence ≥ 0.90**: LLM very confident
2. **Simple additions**: Adding 1-3 missing ingredients
3. **Common pantry items**: Salt, pepper, water, oil
4. **Structural fixes**: Converting objects to strings, fixing JSON

**Process**:
1. Review auto-fix candidates (human approval)
2. Apply fixes in transaction batches
3. Log all changes for audit trail
4. Update `updated_at` timestamp
5. Set flag: `ingredients_need_cleanup = false`

**Safety Measures**:
- Dry-run mode first
- Backup database before applying
- Rollback capability
- Manual approval for batches > 100 recipes

**Script**: `scripts/qa-phase3-apply-fixes.ts`

---

### Phase 4: Human Review Queue (4-8 hours)

**Goal**: Manual review of uncertain cases

**Review Tiers**:

**Tier 1 - Critical (Manual Fix Required)**:
- Missing ingredient lists (20 recipes)
- Missing instructions (211 recipes)
- Severe mismatches (LLM confidence < 0.5)

**Tier 2 - High Priority (Manual Verification)**:
- Moderate mismatches (confidence 0.5-0.75)
- Complex recipes (15+ ingredients)
- Recipes with specialized ingredients

**Tier 3 - Low Priority (Post-Launch)**:
- Minor formatting issues
- Cosmetic inconsistencies
- Edge cases

**Review Interface**:
- CSV export for Google Sheets
- Side-by-side comparison view
- Bulk approval/rejection
- Comments field for notes

**Output Format** (CSV):
```csv
recipe_id,recipe_name,issue_type,confidence,missing_ingredients,suggested_fix,review_status,notes
```

**Script**: `scripts/qa-phase4-generate-review-queue.ts`

---

## 5. Local LLM Recommendation

### 5.1 Evaluation Criteria

| Criterion | Weight | Rationale |
|-----------|--------|-----------|
| **Accuracy** | 40% | Must correctly extract ingredients from text |
| **Speed** | 30% | Must process 4,707 recipes in <12 hours |
| **Structured Output** | 20% | Must produce valid JSON consistently |
| **Resource Efficiency** | 10% | Run on MacBook without overheating |

### 5.2 Model Comparison

#### Option 1: **Qwen2.5-7B-Instruct** (RECOMMENDED)

**Pros**:
- Excellent structured output capability
- Fast inference on Apple Silicon (MPS)
- Strong instruction following
- Good at data extraction tasks
- 7B parameters = good accuracy/speed balance

**Cons**:
- Larger model (4.4GB GGUF Q4)
- May require more VRAM

**Performance Estimate**:
- Speed: ~5-8 tokens/sec on M1/M2
- Time per recipe: ~8-12 seconds
- Total time: ~10-14 hours for 4,707 recipes
- **Recommended batch size**: 50 recipes

**Implementation**:
```bash
# Using Ollama
ollama pull qwen2.5:7b-instruct

# Or llama.cpp
./main -m qwen2.5-7b-instruct-q4_k_m.gguf -n 512 --temp 0.1
```

---

#### Option 2: Llama 3.2-3B-Instruct

**Pros**:
- Fast inference (2x faster than 7B)
- Lightweight (1.9GB GGUF Q4)
- Good for simpler extraction tasks
- Lower VRAM requirements

**Cons**:
- Less accurate for complex recipes
- May struggle with nuanced ingredient mentions
- Less reliable structured output

**Performance Estimate**:
- Speed: ~12-15 tokens/sec
- Time per recipe: ~5-8 seconds
- Total time: ~6-10 hours for 4,707 recipes
- **Recommended batch size**: 100 recipes

---

#### Option 3: GPT-4o-mini via OpenRouter (FALLBACK)

**Pros**:
- Highest accuracy
- Best structured output
- No local compute needed
- Handles edge cases well

**Cons**:
- Cost: ~$0.15 per 1M tokens
- Estimated cost: ~$15-25 for all recipes
- Internet dependency
- Rate limiting considerations

**Performance Estimate**:
- Speed: Very fast (cloud)
- Time per recipe: ~2-3 seconds
- Total time: ~3-4 hours for 4,707 recipes
- **Cost-effective for launch deadline**

---

### 5.3 Final Recommendation

**Primary**: **Qwen2.5-7B-Instruct**
- Best balance of accuracy and speed
- Free and runs locally
- Structured output reliability

**Fallback**: **GPT-4o-mini via OpenRouter**
- If time-constrained (6 days to launch)
- If Qwen2.5 accuracy insufficient
- Budget-friendly ($15-25 total cost)

**Development**: Use GPT-4o-mini for testing, then switch to Qwen2.5 for production run

---

## 6. QA Script Specification

### 6.1 Script Architecture

```
scripts/qa/
├── 1-structure-validation.ts      # Phase 1: Structural issues
├── 2-llm-validation.ts            # Phase 2: LLM content validation
├── 3-apply-fixes.ts               # Phase 3: Apply automated fixes
├── 4-generate-review-queue.ts    # Phase 4: Human review CSV
├── lib/
│   ├── llm-client.ts              # LLM interface (Ollama/OpenRouter)
│   ├── ingredient-extractor.ts   # Ingredient extraction logic
│   ├── validation-types.ts       # TypeScript types
│   └── report-generator.ts       # Report generation utilities
└── config.ts                      # Configuration (model, batch size, etc.)
```

### 6.2 Input/Output Specification

#### Phase 1 Input:
- **Source**: Direct database query (`recipes` table)
- **Filter**: All 4,707 recipes

#### Phase 1 Output:
```json
{
  "timestamp": "2025-10-24T12:00:00Z",
  "total_recipes": 4707,
  "critical_issues": {
    "missing_ingredients": [
      {
        "recipe_id": "abc123",
        "recipe_name": "Example Recipe",
        "issue": "ingredients field is null"
      }
    ],
    "missing_instructions": [...],
    "malformed_json": [...],
    "non_string_elements": [...]
  },
  "auto_fixes_applied": 15,
  "manual_review_required": 231
}
```

**Output Location**: `tmp/qa-reports/phase1-structure-validation-{timestamp}.json`

---

#### Phase 2 Input:
- **Source**: All recipes with valid structure (4,476 recipes)
- **Batch size**: 50-100 recipes per batch
- **LLM**: Qwen2.5-7B or GPT-4o-mini

#### Phase 2 Output:
```json
{
  "timestamp": "2025-10-24T14:30:00Z",
  "total_recipes_analyzed": 4476,
  "validation_results": [
    {
      "recipe_id": "abc123",
      "recipe_name": "Example Recipe",
      "declared_ingredients": ["flour", "sugar", "eggs"],
      "extracted_ingredients": ["flour", "sugar", "eggs", "vanilla extract", "salt"],
      "missing_from_list": ["vanilla extract", "salt"],
      "confidence": 0.92,
      "recommended_action": "auto_fix",
      "notes": "Common pantry items missing"
    }
  ],
  "summary": {
    "perfect_matches": 3800,
    "minor_issues": 450,
    "major_issues": 226,
    "auto_fix_candidates": 380,
    "manual_review_required": 296
  },
  "processing_time_seconds": 41200
}
```

**Output Location**: `tmp/qa-reports/phase2-llm-validation-{timestamp}.json`

---

#### Phase 3 Input:
- **Source**: Phase 2 auto-fix candidates (confidence ≥ 0.90)
- **Human approval**: Required for batch review

#### Phase 3 Output:
```json
{
  "timestamp": "2025-10-24T18:00:00Z",
  "fixes_applied": 380,
  "recipes_updated": [
    {
      "recipe_id": "abc123",
      "changes": {
        "added_ingredients": ["vanilla extract", "salt"]
      },
      "before": "[\"flour\", \"sugar\", \"eggs\"]",
      "after": "[\"flour\", \"sugar\", \"eggs\", \"vanilla extract\", \"salt\"]"
      }
    }
  ],
  "rollback_data": {...}
}
```

**Output Location**: `tmp/qa-reports/phase3-fixes-applied-{timestamp}.json`

---

#### Phase 4 Input:
- **Source**: Phase 2 manual review required (confidence < 0.90 or critical issues)

#### Phase 4 Output (CSV):
```csv
recipe_id,recipe_name,issue_severity,declared_ingredients,missing_ingredients,llm_confidence,suggested_action,review_status,reviewer_notes,recipe_url
abc123,"Example Recipe",high,"flour; sugar; eggs","vanilla extract; salt",0.75,"Add missing ingredients","pending","","/recipes/abc123"
```

**Output Location**: `tmp/qa-reports/phase4-manual-review-queue-{timestamp}.csv`

---

### 6.3 Configuration File

```typescript
// scripts/qa/config.ts
export const QA_CONFIG = {
  // LLM Configuration
  llm: {
    provider: 'ollama', // 'ollama' | 'openrouter'
    model: 'qwen2.5:7b-instruct',
    temperature: 0.1,
    max_tokens: 512,
    timeout_ms: 30000,
  },

  // Processing Configuration
  processing: {
    batch_size: 50,
    max_concurrent: 3,
    retry_attempts: 3,
    retry_delay_ms: 1000,
  },

  // Confidence Thresholds
  thresholds: {
    auto_fix: 0.90,
    manual_review: 0.75,
    critical_issue: 0.50,
  },

  // Output Configuration
  output: {
    reports_dir: '/tmp/qa-reports',
    backup_before_fixes: true,
    dry_run: false, // Set to true for testing
  },

  // Filtering
  filters: {
    skip_user_recipes: false, // Include user-generated recipes
    only_system_recipes: false, // Only validate system recipes
    recipe_ids: null, // Array of specific IDs to process
  },
};
```

---

### 6.4 Error Handling

**Retry Logic**:
- LLM timeout: Retry up to 3 times
- Database connection: Reconnect and resume
- Parsing errors: Log and continue

**Failure Modes**:
- LLM unavailable: Fall back to OpenRouter
- Out of memory: Reduce batch size
- Network error: Save progress and resume

**Logging**:
```typescript
{
  "level": "error",
  "timestamp": "2025-10-24T12:34:56Z",
  "recipe_id": "abc123",
  "phase": "llm_validation",
  "error": "LLM timeout after 3 retries",
  "action": "skipped_for_manual_review"
}
```

**Output**: `tmp/qa-reports/error-log-{timestamp}.jsonl`

---

## 7. Estimated Timeline

### 7.1 Development (Day 1-2)

| Task | Duration | Deliverable |
|------|----------|-------------|
| **Script 1: Structure validation** | 2 hours | Working script |
| **Script 2: LLM validation** | 4 hours | Working script with Ollama |
| **Script 3: Apply fixes** | 2 hours | Database update script |
| **Script 4: Review queue** | 1 hour | CSV generator |
| **Testing & debugging** | 3 hours | Verified on sample data |
| **TOTAL DEVELOPMENT** | **12 hours** | All scripts ready |

### 7.2 Execution (Day 3)

| Task | Duration | Output |
|------|----------|--------|
| **Phase 1: Structure validation** | 30 min | Critical issue report |
| **Phase 1: Fix critical structural issues** | 1 hour | 20-50 recipes fixed |
| **Phase 2: LLM validation (4,707 recipes)** | 10-12 hours | Validation report |
| **Phase 3: Review auto-fix candidates** | 2 hours | Approve/reject fixes |
| **Phase 3: Apply automated fixes** | 1 hour | 300-500 recipes updated |
| **Phase 4: Generate review queue** | 30 min | CSV for manual review |
| **TOTAL EXECUTION** | **15-17 hours** | QA complete |

### 7.3 Manual Review (Day 4-5)

| Task | Duration | Output |
|------|----------|--------|
| **Review Tier 1 (critical)** | 4 hours | 231 recipes reviewed |
| **Review Tier 2 (high priority)** | 4 hours | 200-300 recipes reviewed |
| **Apply manual fixes** | 2 hours | Database updated |
| **TOTAL MANUAL REVIEW** | **10 hours** | All critical issues resolved |

### 7.4 Total Time to Launch-Ready

**Optimistic (with GPT-4o-mini)**: 2.5 days
**Realistic (with Qwen2.5-7B)**: 3-4 days
**Launch deadline**: October 27, 2025 (6 days)

**✅ FEASIBLE within launch timeline**

---

## 8. Risk Assessment

### 8.1 Risks for Automated Fixes

| Risk | Severity | Mitigation |
|------|----------|------------|
| **False positives** | 🟡 MEDIUM | Human review for confidence < 0.90 |
| **Data corruption** | 🔴 HIGH | Database backup before fixes |
| **LLM hallucination** | 🟡 MEDIUM | Cross-validate with rule-based checks |
| **Batch processing failure** | 🟢 LOW | Save progress after each batch |
| **Over-correction** | 🟡 MEDIUM | Dry-run mode + manual approval |

### 8.2 Mitigation Strategies

1. **Database Backup**: Full backup before Phase 3
2. **Dry-Run Mode**: Test all scripts on sample data first
3. **Audit Trail**: Log every change with rollback capability
4. **Confidence Thresholds**: Conservative (0.90) for auto-fix
5. **Human Approval**: Review batches before applying
6. **Incremental Deployment**: Fix critical issues first, then high-priority

### 8.3 Rollback Plan

**If automated fixes cause issues**:
1. Stop all processing immediately
2. Restore database from backup
3. Review error logs
4. Adjust confidence thresholds
5. Re-run with stricter criteria
6. Apply manual fixes instead

**Rollback Capability**: 100% (full database backup + change log)

---

## 9. Success Metrics

### 9.1 Quantitative Metrics

| Metric | Current | Target | Critical Threshold |
|--------|---------|--------|-------------------|
| **Recipes with ingredients** | 4,687 | 4,707 | 4,650 (98.8%) |
| **Recipes with instructions** | 4,496 | 4,650 | 4,450 (94.5%) |
| **Ingredient-instruction match rate** | Unknown | 95%+ | 90%+ |
| **Critical issues** | 231 | 0 | <20 |
| **High-priority issues** | Unknown | <100 | <200 |

### 9.2 Qualitative Metrics

- **Fridge feature accuracy**: Users find expected recipes
- **Recipe completeness**: All recipes have usable ingredient lists
- **User trust**: No complaints about missing ingredients
- **Zero-waste alignment**: Ingredient suggestions are accurate

### 9.3 Launch Readiness Criteria

**MUST HAVE (Launch Blockers)**:
- ✅ Zero recipes with missing ingredients
- ✅ <20 recipes with missing instructions (mark as draft)
- ✅ Zero malformed JSON structures
- ✅ 95%+ ingredient-instruction match rate (high confidence)

**SHOULD HAVE (Launch Day 1)**:
- ✅ <100 high-priority issues flagged
- ✅ Manual review queue documented
- ✅ Post-launch improvement plan

**NICE TO HAVE (Post-Launch)**:
- ✅ 100% ingredient-instruction validation
- ✅ All formatting inconsistencies resolved
- ✅ Single-step instructions split into detailed steps

---

## 10. Implementation Checklist

### Pre-Development
- [ ] Review this document with team
- [ ] Approve QA strategy and timeline
- [ ] Set up Ollama with Qwen2.5-7B model
- [ ] Test LLM on sample recipes
- [ ] Create backup of production database

### Development (Day 1-2)
- [ ] Script 1: Structure validation (`qa-phase1-structure-validation.ts`)
- [ ] Script 2: LLM validation (`qa-phase2-llm-validation.ts`)
- [ ] Script 3: Apply fixes (`qa-phase3-apply-fixes.ts`)
- [ ] Script 4: Review queue generator (`qa-phase4-generate-review-queue.ts`)
- [ ] LLM client library (`lib/llm-client.ts`)
- [ ] Ingredient extractor (`lib/ingredient-extractor.ts`)
- [ ] Report generator (`lib/report-generator.ts`)
- [ ] Configuration file (`config.ts`)
- [ ] Test all scripts on sample data (50 recipes)
- [ ] Verify output formats and accuracy
- [ ] Document execution instructions

### Execution (Day 3)
- [ ] Full database backup
- [ ] Run Phase 1: Structure validation
- [ ] Fix critical structural issues
- [ ] Run Phase 2: LLM validation (10-12 hours)
- [ ] Review auto-fix candidates
- [ ] Run Phase 3: Apply automated fixes
- [ ] Run Phase 4: Generate manual review queue
- [ ] Verify all outputs and logs

### Manual Review (Day 4-5)
- [ ] Review Tier 1 critical issues (231 recipes)
- [ ] Review Tier 2 high-priority issues
- [ ] Apply manual fixes to database
- [ ] Verify all critical issues resolved
- [ ] Run final validation check
- [ ] Update documentation

### Pre-Launch (Day 6)
- [ ] Final smoke test on staging
- [ ] Verify fridge feature accuracy
- [ ] Test recipe search with validated data
- [ ] Review launch readiness metrics
- [ ] Document post-launch improvement plan
- [ ] ✅ **LAUNCH READY**

---

## 11. Post-Launch Plan

### Week 1-2: Monitoring
- Monitor user feedback on recipe quality
- Track "missing ingredient" reports
- Identify patterns in user complaints
- Collect metrics on fridge feature usage

### Week 3-4: Continuous Improvement
- Review and fix Tier 2 issues
- Implement formatting standardization
- Split single-step instructions
- Add missing pantry items systematically

### Month 2: Advanced QA
- Implement automated QA pipeline
- Set up continuous validation
- Add unit/portion standardization
- Improve ingredient alias handling

---

## 12. Appendix

### A. Sample LLM Prompts

**Ingredient Extraction Prompt**:
```
You are an expert recipe data validator. Analyze the following recipe instructions and extract ALL ingredients mentioned, including implied ingredients like salt, pepper, and water.

RECIPE NAME:
{recipe_name}

INSTRUCTIONS:
{instructions_array}

DECLARED INGREDIENTS:
{ingredient_list}

OUTPUT FORMAT (JSON):
{
  "ingredients_found": [
    {"name": "flour", "mentioned_in_step": 1},
    {"name": "salt", "mentioned_in_step": 2}
  ],
  "missing_from_declared_list": ["salt"],
  "confidence": 0.95,
  "notes": "Salt is mentioned in step 2 but not in declared ingredients"
}

Be thorough but avoid hallucinating ingredients not mentioned.
```

### B. Database Queries

**Find recipes with specific issues**:
```sql
-- Recipes with missing ingredients
SELECT id, name, source
FROM recipes
WHERE ingredients IS NULL
   OR ingredients = ''
   OR ingredients = '[]';

-- Recipes with very short ingredient lists
SELECT id, name, jsonb_array_length(ingredients::jsonb) as count
FROM recipes
WHERE jsonb_array_length(ingredients::jsonb) <= 3
ORDER BY count;

-- Recipes without normalized ingredients
SELECT r.id, r.name, COUNT(ri.id) as normalized_count
FROM recipes r
LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
WHERE r.ingredients IS NOT NULL
GROUP BY r.id
HAVING COUNT(ri.id) = 0;
```

### C. Script Execution Commands

```bash
# Development environment
export NODE_ENV=development

# Phase 1: Structure validation
npx tsx scripts/qa/1-structure-validation.ts

# Phase 2: LLM validation (dry-run first)
npx tsx scripts/qa/2-llm-validation.ts --dry-run
npx tsx scripts/qa/2-llm-validation.ts --batch-size=50

# Phase 3: Apply fixes (requires approval)
npx tsx scripts/qa/3-apply-fixes.ts --review-file=tmp/qa-reports/auto-fix-candidates.json

# Phase 4: Generate review queue
npx tsx scripts/qa/4-generate-review-queue.ts
```

### D. Resources

**LLM Setup**:
- Ollama: https://ollama.ai
- Qwen2.5 model card: https://ollama.ai/library/qwen2.5
- OpenRouter: https://openrouter.ai (fallback)

**Database Tools**:
- Drizzle Studio: `pnpm db:studio`
- Direct SQL: `psql $DATABASE_URL`

**Monitoring**:
- Progress: `tail -f tmp/qa-reports/progress.log`
- Errors: `tail -f tmp/qa-reports/error-log.jsonl`

---

**Document Status**: ✅ Ready for Implementation
**Next Steps**: Team review → Approve → Begin development
**Questions**: Contact project maintainer

---

**End of Document**
