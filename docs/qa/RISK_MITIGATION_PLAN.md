# Recipe QA System - Risk Mitigation Plan
**Joanie's Kitchen - Launch Risk Management**

**Date**: October 24, 2025
**Launch**: October 27, 2025 (6 days)

---

## 🎯 Overview

This document outlines potential risks in the automated recipe QA process and provides concrete mitigation strategies for each scenario.

---

## 🔴 Critical Risks (Could Block Launch)

### Risk 1: Data Corruption from Automated Fixes

**Scenario**: Automated fixes incorrectly modify recipe data, corrupting the database.

**Impact**:
- Recipes become unusable
- User trust destroyed
- Manual recovery required
- Launch delayed

**Probability**: 🟡 MEDIUM (10-20%)
**Mitigation Level**: 🔴 CRITICAL

**Mitigation Strategy**:

1. **Full Database Backup** (BEFORE any fixes):
   ```bash
   # Create backup with timestamp
   pg_dump $DATABASE_URL > /tmp/joanies-kitchen-backup-$(date +%Y%m%d-%H%M%S).sql

   # Verify backup integrity
   pg_restore --list /tmp/joanies-kitchen-backup-*.sql

   # Store backup in multiple locations
   cp /tmp/joanies-kitchen-backup-*.sql ~/Backups/
   ```

2. **Dry-Run Mode** (Test all scripts first):
   ```typescript
   // In config.ts
   export const QA_CONFIG = {
     output: {
       dry_run: true,  // NO database writes
     }
   };
   ```

3. **Incremental Changes** (Small batches):
   - Start with 10 recipes
   - Verify results manually
   - Increase to 50, 100, then full batch

4. **Transaction Rollback Support**:
   ```typescript
   await db.transaction(async (tx) => {
     try {
       // Apply fixes
       await tx.update(recipes).set({...});
       // If error, transaction auto-rolls back
     } catch (error) {
       throw error; // Rollback
     }
   });
   ```

5. **Change Logging** (Audit trail):
   ```typescript
   // Log every change
   {
     timestamp: '2025-10-24T12:34:56Z',
     recipe_id: 'abc123',
     field: 'ingredients',
     before: '["flour", "eggs"]',
     after: '["flour", "eggs", "salt"]',
     reason: 'LLM detected missing salt (confidence: 0.92)'
   }
   ```

6. **Rollback Script** (Emergency recovery):
   ```bash
   # If issues detected, immediate rollback
   psql $DATABASE_URL < /tmp/joanies-kitchen-backup-*.sql
   ```

**Rollback Time**: 5-10 minutes
**Success Indicator**: Can restore to pre-QA state within 10 minutes

---

### Risk 2: LLM Hallucination (False Positives)

**Scenario**: LLM "hallucinates" ingredients that aren't actually in the recipe, adding incorrect ingredients to the list.

**Example**:
- Instructions: "Serve hot"
- LLM adds: "hot sauce" ← INCORRECT

**Impact**:
- Inaccurate ingredient lists
- User confusion
- Fridge feature suggests wrong recipes
- Brand trust erosion

**Probability**: 🟡 MEDIUM (15-25%)
**Mitigation Level**: 🔴 CRITICAL

**Mitigation Strategy**:

1. **Conservative Confidence Thresholds**:
   ```typescript
   thresholds: {
     auto_fix: 0.90,  // Very high threshold
     manual_review: 0.75,  // Review anything uncertain
     reject: 0.50,  // Auto-reject low confidence
   }
   ```

2. **Cross-Validation with Rules**:
   ```typescript
   // Before accepting LLM suggestion, verify:
   function validateSuggestion(ingredient: string, instructions: string): boolean {
     // Check if ingredient is actually mentioned in text
     const normalized = instructions.toLowerCase();
     const ingLower = ingredient.toLowerCase();

     // Must be explicit mention, not just substring
     return normalized.includes(` ${ingLower} `) ||
            normalized.includes(` ${ingLower},`) ||
            normalized.includes(` ${ingLower}.`);
   }
   ```

3. **Prompt Engineering** (Reduce hallucination):
   ```
   CRITICAL: Only extract ingredients EXPLICITLY MENTIONED in the instructions.
   Do NOT infer or guess ingredients.
   If uncertain, set confidence to 0.0.

   Example:
   Instruction: "Serve hot"
   DO NOT add: "hot sauce" (not mentioned)

   Instruction: "Add hot sauce to taste"
   DO add: "hot sauce" (explicitly mentioned)
   ```

4. **Human Review Queue** (Uncertain cases):
   - Any ingredient addition with confidence < 0.90 → manual review
   - Any unusual ingredient → manual review
   - Any recipe with >5 missing ingredients → manual review

5. **Spot Checks** (Random sampling):
   ```bash
   # After automated fixes, randomly sample 50 recipes
   # Manually verify LLM additions are correct
   npx tsx scripts/qa/spot-check.ts --sample=50
   ```

**Prevention**: 90%+ accuracy expected with these controls
**Detection**: Human review catches remaining 10%

---

### Risk 3: Time Overrun (Miss Launch Deadline)

**Scenario**: QA process takes longer than expected, delaying launch.

**Impact**:
- Launch date pushed back
- Loss of momentum
- Team morale impact
- Stakeholder disappointment

**Probability**: 🟡 MEDIUM (20-30%)
**Mitigation Level**: 🟡 HIGH

**Mitigation Strategy**:

1. **Parallel Processing** (Faster execution):
   ```typescript
   processing: {
     batch_size: 50,
     max_concurrent: 5,  // Process 5 batches in parallel
   }
   ```

2. **Cloud LLM Fallback** (GPT-4o-mini):
   ```bash
   # If local LLM too slow, switch to OpenRouter
   # Cost: ~$15-25, Time saved: 6-8 hours
   export USE_OPENROUTER=true
   npx tsx scripts/qa/2-llm-validation.ts
   ```

3. **Phased Approach** (Critical first):
   - **Day 1**: Fix missing ingredients (20 recipes) → LAUNCH BLOCKER
   - **Day 2**: Fix missing instructions (211 recipes) → CRITICAL
   - **Day 3**: Validate all others → IMPORTANT but not blocking
   - **Launch**: With 231 critical issues resolved (5% of total)
   - **Post-Launch**: Continue validation in background

4. **Reduced Scope Option** (If time-critical):
   - Validate ONLY system/public recipes (4,620 recipes)
   - Skip user-generated recipes (87 recipes)
   - Post-launch: Validate user recipes

5. **Timeline Buffers**:
   ```
   Planned:  3-4 days
   Buffer:   +1 day contingency
   Deadline: 6 days (October 27)
   Margin:   1-2 days extra
   ```

**Contingency**: Can launch with 95% validation if time runs out

---

## 🟡 High Priority Risks (Could Impact Quality)

### Risk 4: LLM Service Unavailable

**Scenario**: Ollama crashes or OpenRouter API is down during validation.

**Impact**: Processing halted, time wasted waiting

**Probability**: 🟢 LOW (5-10%)
**Mitigation Level**: 🟡 HIGH

**Mitigation Strategy**:

1. **Dual LLM Support**:
   ```typescript
   async function callLLM(prompt: string): Promise<string> {
     try {
       return await ollamaClient.call(prompt);
     } catch (ollamaError) {
       console.log('Ollama failed, falling back to OpenRouter');
       return await openrouterClient.call(prompt);
     }
   }
   ```

2. **Checkpoint System** (Resume capability):
   ```typescript
   // Save progress after each batch
   await saveCheckpoint({
     last_processed_recipe: 'abc123',
     batch_number: 42,
     timestamp: new Date(),
   });

   // On restart, resume from checkpoint
   const checkpoint = await loadCheckpoint();
   ```

3. **Retry Logic**:
   ```typescript
   retry_attempts: 3,
   retry_delay_ms: 2000,  // 2 second delay between retries
   exponential_backoff: true,
   ```

4. **Health Checks**:
   ```bash
   # Before starting long run, verify LLM works
   npx tsx scripts/qa/health-check.ts
   ```

**Recovery Time**: <5 minutes to switch providers

---

### Risk 5: Inconsistent LLM Output

**Scenario**: LLM produces inconsistent results for similar recipes, reducing data quality.

**Impact**: Some recipes get better validation than others

**Probability**: 🟡 MEDIUM (10-15%)
**Mitigation Level**: 🟡 HIGH

**Mitigation Strategy**:

1. **Fixed Temperature** (Deterministic output):
   ```typescript
   llm: {
     temperature: 0.1,  // Very low = more consistent
   }
   ```

2. **Structured Output Format** (JSON schema):
   ```typescript
   // Enforce JSON schema
   output_schema: {
     type: 'object',
     required: ['ingredients_found', 'confidence'],
     properties: {
       ingredients_found: { type: 'array' },
       missing_from_list: { type: 'array' },
       confidence: { type: 'number', minimum: 0, maximum: 1 }
     }
   }
   ```

3. **Consistent Prompting**:
   - Same prompt template for all recipes
   - No variations in instructions
   - Clear output format requirements

4. **Validation Checks**:
   ```typescript
   // After LLM response, validate structure
   function validateLLMOutput(output: any): boolean {
     return (
       Array.isArray(output.ingredients_found) &&
       typeof output.confidence === 'number' &&
       output.confidence >= 0 && output.confidence <= 1
     );
   }
   ```

**Consistency Target**: >90% of outputs follow expected format

---

### Risk 6: Database Performance Degradation

**Scenario**: Thousands of UPDATE queries slow down database, affecting production.

**Impact**:
- Slow website for users
- Longer processing time
- Potential timeouts

**Probability**: 🟢 LOW (5-10%)
**Mitigation Level**: 🟡 HIGH

**Mitigation Strategy**:

1. **Batch Updates** (Fewer queries):
   ```typescript
   // Instead of 500 individual UPDATEs
   // Do 1 batch update per 50 recipes
   await db.update(recipes)
     .set({ ingredients: sql`CASE
       WHEN id = 'abc1' THEN '["new", "list"]'
       WHEN id = 'abc2' THEN '["another", "list"]'
       ...
     END` })
     .where(inArray(recipes.id, batchIds));
   ```

2. **Off-Peak Processing** (If production DB):
   ```bash
   # Run during low-traffic hours
   # Schedule for 2 AM - 6 AM
   ```

3. **Connection Pooling**:
   ```typescript
   // Drizzle already handles this
   // But verify settings
   max_connections: 10,
   idle_timeout: 30000,
   ```

4. **Index Optimization**:
   ```sql
   -- Ensure indexes exist before bulk updates
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recipes_id
   ON recipes(id);
   ```

5. **Monitor Performance**:
   ```bash
   # Watch database load during processing
   psql $DATABASE_URL -c "
     SELECT * FROM pg_stat_activity
     WHERE datname = 'joanies_kitchen';
   "
   ```

**Performance Target**: <500ms per batch update

---

## 🟢 Medium Priority Risks (Quality Improvements)

### Risk 7: Manual Review Bottleneck

**Scenario**: Manual review queue too large, team can't process in time.

**Impact**: Some uncertain cases not reviewed before launch

**Probability**: 🟡 MEDIUM (30-40%)
**Mitigation Level**: 🟢 MEDIUM

**Mitigation Strategy**:

1. **Prioritization Tiers**:
   ```
   Tier 1: MUST review (critical issues) - 231 recipes
   Tier 2: SHOULD review (high priority) - 200 recipes
   Tier 3: NICE TO HAVE (post-launch) - 300 recipes
   ```

2. **Automated Pre-Screening**:
   - Auto-approve common cases (salt, pepper, water)
   - Flag unusual cases only
   - Reduce manual queue by 50%

3. **Review Tools** (Faster processing):
   ```csv
   # CSV with one-click approve/reject
   recipe_id,recipe_name,missing,suggested_fix,APPROVE/REJECT
   ```

4. **Team Distribution**:
   - Assign recipes to multiple reviewers
   - Each person reviews 50-100 recipes
   - Parallelize human work

5. **Post-Launch Option**:
   - Launch with Tier 1 completed
   - Continue Tier 2-3 after launch
   - Low risk (non-critical issues)

**Minimum Viable**: Review 231 critical + 100 high-priority = 331 recipes

---

### Risk 8: False Negatives (Missed Issues)

**Scenario**: Validation system misses real problems, launching with undetected issues.

**Impact**: User reports bugs after launch

**Probability**: 🟡 MEDIUM (20-30%)
**Mitigation Level**: 🟢 MEDIUM

**Mitigation Strategy**:

1. **Multi-Layer Validation**:
   - Layer 1: Rule-based checks (structure)
   - Layer 2: LLM validation (content)
   - Layer 3: Human spot checks (quality)

2. **Sampling Strategy**:
   ```bash
   # After automated QA, manually review:
   - 50 random recipes
   - 20 high-complexity recipes (15+ ingredients)
   - 20 AI-generated recipes
   - 10 user-generated recipes
   ```

3. **User Feedback Loop** (Post-launch):
   - Add "Report Issue" button on recipes
   - Monitor reports for patterns
   - Quick-fix mechanism for user-reported issues

4. **Continuous Validation**:
   - Run validation weekly after launch
   - Catch issues that slip through
   - Improve validation rules over time

**Acceptance**: 90% accuracy at launch, improve to 98% within 2 months

---

## 📊 Risk Matrix Summary

| Risk | Probability | Impact | Mitigation | Status |
|------|-------------|--------|------------|--------|
| **Data Corruption** | 🟡 MEDIUM | 🔴 CRITICAL | Full backup + dry-run | ✅ READY |
| **LLM Hallucination** | 🟡 MEDIUM | 🔴 CRITICAL | High threshold + review | ✅ READY |
| **Time Overrun** | 🟡 MEDIUM | 🟡 HIGH | Cloud fallback + phasing | ✅ READY |
| **LLM Unavailable** | 🟢 LOW | 🟡 HIGH | Dual provider + checkpoints | ✅ READY |
| **Inconsistent Output** | 🟡 MEDIUM | 🟡 HIGH | Low temp + validation | ✅ READY |
| **DB Performance** | 🟢 LOW | 🟡 HIGH | Batch updates + off-peak | ✅ READY |
| **Review Bottleneck** | 🟡 MEDIUM | 🟢 MEDIUM | Prioritization + tools | ✅ READY |
| **False Negatives** | 🟡 MEDIUM | 🟢 MEDIUM | Multi-layer + sampling | ✅ READY |

---

## 🚨 Emergency Response Plan

### Scenario: Critical Failure During Execution

**If major issue detected during processing**:

1. **STOP IMMEDIATELY**:
   ```bash
   # Kill running processes
   pkill -f "qa-phase"

   # Stop Ollama
   brew services stop ollama
   ```

2. **ASSESS DAMAGE**:
   ```sql
   -- Check how many recipes were modified
   SELECT COUNT(*) FROM recipes
   WHERE updated_at > '2025-10-24 12:00:00';
   ```

3. **ROLLBACK IF NEEDED**:
   ```bash
   # Restore from backup
   psql $DATABASE_URL < /tmp/joanies-kitchen-backup-*.sql
   ```

4. **DIAGNOSE ROOT CAUSE**:
   - Review error logs: `tmp/qa-reports/error-log.jsonl`
   - Check LLM outputs: `tmp/qa-reports/debug-*.json`
   - Identify failure pattern

5. **FIX AND RESUME**:
   - Correct the issue
   - Test on small batch (10 recipes)
   - Resume from checkpoint

**Recovery Time**: 15-30 minutes

---

### Scenario: Launch Deadline at Risk

**If running out of time (1 day before launch)**:

1. **PRIORITY FOCUS**: Fix only critical issues
   - Missing ingredients (20 recipes)
   - Missing instructions (211 recipes)
   - Total: 231 recipes (manageable in 4 hours)

2. **DEFER NON-CRITICAL**:
   - Ingredient-instruction matching → post-launch
   - Formatting issues → post-launch
   - Complex validations → post-launch

3. **MINIMUM VIABLE LAUNCH**:
   - 95%+ recipes usable
   - Fridge feature functional (may miss some matches)
   - Zero crashes from malformed data
   - Known issues documented

4. **POST-LAUNCH PLAN**:
   - Continue validation in background
   - Weekly quality improvements
   - User feedback integration

**Minimum Time Needed**: 8 hours (critical issues only)

---

## ✅ Pre-Flight Checklist

**Before executing Phase 2-3 (automated fixes)**:

- [ ] Full database backup created and verified
- [ ] Dry-run mode tested on 50 sample recipes
- [ ] LLM health check passed
- [ ] Confidence thresholds configured (≥0.90)
- [ ] Change logging enabled
- [ ] Rollback script tested
- [ ] Emergency stop procedure documented
- [ ] Team notified of processing window
- [ ] Monitoring tools ready (tail logs, database)
- [ ] Checkpoint system functioning

**Only proceed when ALL boxes checked**

---

## 📈 Success Metrics

**Process Quality**:
- ✅ Zero data corruption incidents
- ✅ <5% false positive rate (LLM hallucinations)
- ✅ 95%+ confidence in automated fixes
- ✅ All critical issues resolved before launch

**Timeline Success**:
- ✅ Complete within 6-day window
- ✅ Launch on October 27, 2025
- ✅ No emergency delays

**Quality Success**:
- ✅ 0 missing ingredient lists
- ✅ <20 missing instruction lists
- ✅ 95%+ ingredient-instruction match rate
- ✅ <10 user-reported issues in first week

---

## 📞 Escalation Path

**If critical risk occurs**:

1. **Developer**: Stop processing, assess damage
2. **Technical Lead**: Review issue, decide rollback/continue
3. **Project Manager**: Adjust timeline if needed
4. **Stakeholders**: Inform if launch date at risk

**Decision Authority**:
- **Rollback**: Technical Lead
- **Launch Delay**: Project Manager + Stakeholders
- **Scope Reduction**: Project Manager

---

**Document Status**: ✅ Complete
**Review Date**: Before Phase 3 execution
**Update Frequency**: As risks materialize or change

---

**END OF RISK MITIGATION PLAN**
