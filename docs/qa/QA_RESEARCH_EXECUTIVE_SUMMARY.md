# Recipe QA Research - Executive Summary
**Joanie's Kitchen Zero-Waste Platform**

**Date**: October 24, 2025
**Launch Target**: October 27, 2025 (6 days)
**Research Status**: ✅ Complete

---

## 🎯 Mission-Critical Findings

### Database Status (4,707 Recipes)

| Metric | Count | Status | Action Required |
|--------|-------|--------|-----------------|
| **Total recipes** | 4,707 | ✅ | - |
| **Missing ingredients** | 20 (0.42%) | 🔴 CRITICAL | Fix before launch |
| **Missing instructions** | 211 (4.48%) | 🔴 CRITICAL | Fix or hide |
| **Normalized ingredients** | 4,620 (98.15%) | ✅ GOOD | - |
| **Validation status** | 0% validated | ⚠️ UNKNOWN | Run QA system |

### Key Discovery

**The platform has never systematically validated that ingredient lists match recipe instructions.** This is critical for the fridge feature's zero-waste mission.

**Example Issue Found**: 45% of sampled recipes mention "salt", "pepper", or "water" in instructions but NOT in ingredient lists.

---

## 📊 Database Architecture Analysis

### How Recipes Store Data

**Dual Storage System**:

1. **Legacy JSON Format** (`recipes.ingredients` and `recipes.instructions`):
   ```json
   {
     "ingredients": "[\"2 cups flour\", \"1 tsp salt\", ...]",
     "instructions": "[\"Mix flour and salt\", \"Add water\", ...]"
   }
   ```
   - Storage: TEXT fields with JSON arrays
   - Coverage: 4,687 recipes (99.6%) have ingredients
   - Format: Simple string arrays

2. **Normalized Relational Format** (`recipeIngredients` join table):
   ```typescript
   {
     recipe_id: "abc123",
     ingredient_id: "uuid-456",
     amount: "2",
     unit: "cups",
     preparation: "sifted",
     position: 1
   }
   ```
   - Storage: Proper relational table with 2,716 master ingredients
   - Coverage: 4,620 recipes (98.15%)
   - Benefits: Enables advanced search, substitutions, nutrition tracking

### Data Quality Issues Discovered

**Critical (Launch Blockers)**:
- 20 recipes with NO ingredient lists
- 211 recipes with NO instructions
- Some recipes have non-string ingredient entries (causes parsing errors)

**High Priority (Impacts Core Feature)**:
- Estimated 200-500 recipes with incomplete ingredient lists
- Common pantry items (salt, pepper, water) often omitted
- 67 recipes have JSON but no normalized ingredients

**Medium Priority (Post-Launch)**:
- 745 recipes have single-step instructions (should be split)
- Format inconsistencies across sources

---

## 🔍 Sample Recipe Analysis

### Well-Formed Recipe Example

**"Salmon With Potato Salad and Horseradish Yogurt"**
- ✅ 21 ingredients properly listed
- ✅ 7 detailed instruction steps
- ⚠️ Issue: "water" mentioned in instructions but not in list

### Problematic Recipe Pattern

**Common Issue**: Implied ingredients not listed
```
Instructions: "Season with salt and pepper to taste"
Ingredient List: [flour, eggs, milk]  ← Missing salt & pepper
```

**Impact**: Fridge feature won't suggest this recipe to users who have salt and pepper but are missing the listed ingredients.

---

## 🎯 Recommended QA Strategy

### 4-Phase Automated Approach

**Phase 1: Structure Validation** (2 hours)
- Scan all 4,707 recipes
- Fix JSON parsing errors
- Identify critical missing data
- **Output**: Critical issue report

**Phase 2: LLM-Based Validation** (10-12 hours)
- Use local LLM (Qwen2.5-7B) to extract ingredients from instructions
- Compare with declared ingredient lists
- Identify missing ingredients with confidence scores
- **Output**: Comprehensive validation report

**Phase 3: Automated Fixes** (2-4 hours)
- Apply high-confidence fixes (≥90% confidence)
- Add missing common ingredients
- Fix structural issues
- **Output**: 300-500 recipes auto-corrected

**Phase 4: Manual Review Queue** (4-8 hours)
- Generate CSV for human review
- Prioritize critical issues
- Review uncertain cases
- **Output**: Launch-ready database

---

## 🤖 LLM Recommendation

### Primary: Qwen2.5-7B-Instruct

**Why This Model**:
- ✅ Best structured output capability
- ✅ Fast on Apple Silicon (MPS)
- ✅ Free and runs locally
- ✅ Strong data extraction accuracy

**Performance**:
- Speed: 5-8 seconds per recipe
- Total time: 10-12 hours for all 4,707 recipes
- Cost: $0 (fully local)

**Setup**:
```bash
ollama pull qwen2.5:7b-instruct
```

### Fallback: GPT-4o-mini via OpenRouter

**When to Use**:
- Time-constrained (6 days to launch)
- Qwen2.5 accuracy insufficient
- Need fastest possible processing

**Performance**:
- Speed: 2-3 seconds per recipe
- Total time: 3-4 hours for all recipes
- Cost: ~$15-25 total

---

## 📅 Implementation Timeline

### Development (Day 1-2): 12 hours
- Build 4 validation scripts
- Set up LLM client
- Test on sample data
- Debug and verify

### Execution (Day 3): 15-17 hours
- Run structure validation (30 min)
- Fix critical issues (1 hour)
- Run LLM validation (10-12 hours)
- Review and apply auto-fixes (3 hours)
- Generate manual review queue (30 min)

### Manual Review (Day 4-5): 10 hours
- Review 231 critical issues
- Fix high-priority mismatches
- Apply manual corrections

### Pre-Launch (Day 6): 2 hours
- Final validation
- Smoke testing
- Launch readiness verification

**Total Time**: 3-4 days
**Launch Deadline**: October 27, 2025 (6 days)

**✅ FEASIBLE within timeline**

---

## ⚠️ Risk Assessment

### Automated Fix Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **False positives** | 🟡 MEDIUM | Human review for confidence < 90% |
| **Data corruption** | 🔴 HIGH | Full database backup before fixes |
| **LLM hallucination** | 🟡 MEDIUM | Conservative confidence thresholds |
| **Over-correction** | 🟡 MEDIUM | Dry-run mode + manual approval |

### Mitigation Strategy

1. **Database Backup**: Full backup before applying any fixes
2. **Dry-Run Mode**: Test all scripts on sample data first
3. **Confidence Thresholds**: Only auto-fix if ≥90% confident
4. **Audit Trail**: Log every change with rollback capability
5. **Incremental Deployment**: Fix critical → high → medium → low

**Rollback Capability**: 100% (full backup + change logs)

---

## 🎯 Launch Readiness Criteria

### Must Have (Launch Blockers)

- ✅ Zero recipes with missing ingredients
- ✅ <20 recipes with missing instructions (mark as draft/hide)
- ✅ Zero malformed JSON structures
- ✅ 95%+ ingredient-instruction match rate (validated)

### Should Have (Day 1)

- ✅ <100 high-priority issues flagged
- ✅ Manual review queue documented
- ✅ Post-launch improvement plan

### Nice to Have (Post-Launch)

- ✅ 100% ingredient-instruction validation
- ✅ All formatting inconsistencies resolved
- ✅ Single-step instructions split for better UX

---

## 💰 Resource Requirements

### Development Resources

- **Developer Time**: 12 hours (scripts + testing)
- **Compute**: MacBook M-series (local LLM)
- **Storage**: ~500MB for QA reports/logs

### Operational Resources

- **LLM Processing**: 10-12 hours (local) OR $15-25 (cloud)
- **Manual Review**: 10 hours (human time)
- **Database Backup**: ~2GB storage

**Total Budget**: $0-25 (if using cloud LLM)
**Total Time**: 3-4 days of focused work

---

## 📈 Success Metrics

### Quantitative

| Metric | Current | Target | Critical Threshold |
|--------|---------|--------|-------------------|
| **Recipes with ingredients** | 4,687 (99.6%) | 4,707 (100%) | 4,650 (98.8%) |
| **Recipes with instructions** | 4,496 (95.5%) | 4,650 (98.8%) | 4,450 (94.5%) |
| **Match rate** | Unknown | 95%+ | 90%+ |
| **Critical issues** | 231 | 0 | <20 |

### Qualitative

- **Fridge Feature Accuracy**: Users reliably find expected recipes
- **Recipe Completeness**: All recipes usable without confusion
- **User Trust**: Zero complaints about missing ingredients
- **Zero-Waste Alignment**: Accurate ingredient suggestions prevent food waste

---

## 🚀 Recommended Action Plan

### Immediate (Today)

1. ✅ **Approve this QA strategy**
2. 🔄 **Set up Ollama + Qwen2.5-7B model**
3. 🔄 **Create database backup**
4. 🔄 **Begin script development**

### Short-Term (This Week)

1. 🔄 **Complete Phase 1-4 scripts** (Day 1-2)
2. 🔄 **Execute automated QA system** (Day 3)
3. 🔄 **Manual review of critical issues** (Day 4-5)
4. 🔄 **Final validation & testing** (Day 6)

### Long-Term (Post-Launch)

1. 🔄 **Monitor user feedback on recipe quality**
2. 🔄 **Implement continuous QA pipeline**
3. 🔄 **Address Tier 2 and Tier 3 issues**
4. 🔄 **Build automated validation into recipe import**

---

## 📋 Deliverables

### Documentation

- ✅ **Comprehensive QA Strategy** (`INGREDIENT_INSTRUCTION_QA_STRATEGY.md`)
- ✅ **Executive Summary** (this document)
- 🔄 **Script Implementation Guide** (to be created)
- 🔄 **Launch Readiness Report** (post-execution)

### Code

- 🔄 **Phase 1 Script**: Structure validation
- 🔄 **Phase 2 Script**: LLM validation
- 🔄 **Phase 3 Script**: Automated fixes
- 🔄 **Phase 4 Script**: Review queue generator
- 🔄 **Supporting Libraries**: LLM client, ingredient extractor, report generator

### Reports

- 🔄 **Structure Validation Report** (JSON)
- 🔄 **LLM Validation Report** (JSON)
- 🔄 **Fixes Applied Log** (JSON with rollback data)
- 🔄 **Manual Review Queue** (CSV)

---

## 📞 Next Steps

### For Project Manager

1. **Review this document** and comprehensive strategy
2. **Approve timeline and approach**
3. **Allocate developer resources** (12 hours development + 10 hours review)
4. **Decide on LLM**: Qwen2.5 (free, 10-12 hours) vs GPT-4o-mini ($15-25, 3-4 hours)
5. **Schedule execution window** (Day 3 requires 15-17 hours)

### For Developer

1. **Read full QA strategy document** (`INGREDIENT_INSTRUCTION_QA_STRATEGY.md`)
2. **Set up local LLM environment** (Ollama + Qwen2.5-7B)
3. **Begin script development** following specifications in strategy doc
4. **Test on sample data** (50-100 recipes) before full run
5. **Coordinate with PM** on manual review timing

### For Stakeholders

1. **Understand the risk** of launching without validation
2. **Acknowledge the timeline** is tight but feasible
3. **Prepare for manual review** (10 hours human time required)
4. **Plan post-launch monitoring** of recipe quality metrics

---

## 🎓 Key Learnings

### Technical Insights

1. **Dual storage is powerful**: JSON for flexibility, relational for advanced features
2. **98.15% normalized coverage is excellent**: Shows good data engineering practices
3. **Common pantry items often omitted**: Industry-wide recipe data challenge
4. **LLM validation is necessary**: Rule-based alone insufficient for this task

### Business Insights

1. **Recipe quality is brand quality**: Users trust platform based on data accuracy
2. **Zero-waste mission depends on accuracy**: Fridge feature only works with complete data
3. **Launch deadline is achievable**: 6 days sufficient with focused effort
4. **Post-launch improvement essential**: Initial QA sets foundation for continuous quality

---

## 📚 References

**Full Strategy Document**:
`/Users/masa/Projects/joanies-kitchen/docs/qa/INGREDIENT_INSTRUCTION_QA_STRATEGY.md`

**Database Schema**:
- `/Users/masa/Projects/joanies-kitchen/src/lib/db/schema.ts`
- `/Users/masa/Projects/joanies-kitchen/src/lib/db/ingredients-schema.ts`

**Sample Scripts Created**:
- `/Users/masa/Projects/joanies-kitchen/scripts/analyze-recipe-data.ts`
- `/Users/masa/Projects/joanies-kitchen/scripts/analyze-ingredient-relationships.ts`
- `/Users/masa/Projects/joanies-kitchen/scripts/sample-ingredient-validation.ts`

---

**Status**: ✅ Research Complete - Ready for Implementation
**Decision Needed**: Approve strategy and begin development
**Timeline**: 3-4 days to launch-ready

---

**Prepared By**: Claude Code Research Agent
**Date**: October 24, 2025
**For**: Joanie's Kitchen Development Team
