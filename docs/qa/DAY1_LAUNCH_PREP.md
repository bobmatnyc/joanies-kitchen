# Day 1 Launch Preparation - Quick Start

**Prepare Joanie's Kitchen for October 27, 2025 Launch**

## Overview
This guide walks through Day 1 launch preparation by hiding incomplete recipes from search and generating comprehensive launch readiness reports.

## Problem Statement
Phase 1 quality assurance identified 231 incomplete recipes:
- **211 recipes** missing instructions (4.48% of total)
- **20 recipes** missing ingredients (0.42% of total)

These edge cases represent data quality issues from automated ingestion and will be fixed post-launch. For launch, we hide them from search to ensure users only see complete, validated recipes.

## Solution
- Hide 211 recipes with missing instructions (`qa_status = 'needs_review'`)
- Flag 20 recipes with missing ingredients (`qa_status = 'flagged'`)
- Validate 4,476 searchable recipes (95.09% validation rate)
- Generate launch readiness report

---

## Prerequisites

### 1. Phase 1 Complete
```bash
# Verify Phase 1 report exists
ls -lh tmp/qa-structure-report.json
```

If not found, run Phase 1 first:
```bash
pnpm qa:phase1
```

### 2. Database Backup Created
```bash
# Recommended: Create database backup before making changes
# (Add your backup command here)
```

### 3. QA Tracking Fields Applied
QA tracking fields should already be in your database schema:
- `qa_status` (varchar)
- `qa_timestamp` (timestamp)
- `qa_method` (varchar)
- `qa_notes` (text)
- `qa_issues_found` (text/JSON)

These are defined in `src/lib/db/schema.ts` and should have been applied via migrations.

---

## Execution Steps

### Step 1: Hide Incomplete Recipes (5 minutes)

**What it does:**
- Updates database to hide 211 recipes with missing instructions
- Flags 20 recipes with missing ingredients
- Sets appropriate QA status and tracking metadata

**Command:**
```bash
pnpm qa:hide-incomplete
```

**Expected Output:**
```
🔒 Hiding Incomplete Recipes from Search

📋 Loading Phase 1 report...
✅ Found 231 recipes to update

🚫 Hiding 211 recipes with missing instructions...
  ✓ Updated recipe: "How to Make Simple and Effective Zero Waste Mouthwash"
  ✓ Updated recipe: "Roasted cauliflower & burnt aubergine with salsa"
  ... and 206 more

⚠️  Flagging 20 recipes with missing ingredients...
  ✓ Flagged recipe: "Beef Wellington"
  ✓ Flagged recipe: "Roast Turkey with Lemon, Parsley & Garlic"
  ... and 15 more

📊 Summary:
────────────────────────────────────────────────────
Total Updated:             231
  Hidden (missing instr):  211
  Flagged (missing ingr):  20
────────────────────────────────────────────────────

✅ Report saved to: tmp/hide-incomplete-report.json
✅ Database updated successfully

🎉 Complete! Recipes hidden from search.
```

**Database Changes:**
- 211 recipes: `qa_status = 'needs_review'` (hidden from search)
- 20 recipes: `qa_status = 'flagged'` (searchable, flagged for post-launch fix)
- All: `qa_timestamp` set to current time
- All: `qa_method = 'automated-rules'`

---

### Step 2: Verify Searchable Recipes (1 minute)

**What it does:**
- Queries database to count searchable vs. hidden recipes
- Validates no incomplete recipes are searchable
- Confirms QA status properly set

**Command:**
```bash
pnpm qa:verify-searchable
```

**Expected Output:**
```
✅ Verifying Searchable Recipes

📊 Querying database...

✅ Searchable Recipes: 4,476
🚫 Hidden Recipes:     211
⚠️  Flagged Recipes:   20
────────────────────────────────────────────────────
Total:                 4,707

🔍 Validation Checks:
  ✓ No incomplete recipes in search results
  ✓ All searchable recipes have ingredients
  ✓ All searchable recipes have instructions
  ✓ QA status properly set

✅ Report saved to: tmp/searchable-recipes-report.json
✅ Verification complete - LAUNCH READY
```

**Success Criteria:**
- Searchable count: **4,476** (95.09%)
- Hidden count: **211**
- Flagged count: **20**
- All validation checks: ✅ PASS

---

### Step 3: Generate Launch Report (1 minute)

**What it does:**
- Aggregates data from all previous reports
- Calculates launch readiness metrics
- Generates executive summary (JSON + Markdown)

**Command:**
```bash
pnpm qa:launch-report
```

**Expected Output:**
```
📊 Generating Launch QA Report

📋 Loading Phase 1 structure report...
📋 Loading hide incomplete report...
📋 Loading searchable recipes report...
✅ All reports loaded

📊 Launch QA Report Summary

════════════════════════════════════════════════════
Launch Date:           October 27, 2025 (3 days)
Status:                ✅ LAUNCH READY
════════════════════════════════════════════════════

📈 Key Metrics:
  Total Recipes:       4,707
  Searchable:          4,476 (95.09%)
  Hidden:              211
  Flagged:             20
  Quality Grade:       A

🔍 Validation:
  ✅ All checks passed

🚀 Launch Recommendation:
  ✅ APPROVED FOR LAUNCH
  Risk Level: LOW

Rationale:
  - 95.09% validation rate exceeds MVP requirements
  - Incomplete recipes hidden from search (no user impact)
  - Post-launch fix plan documented for edge cases
  - Risk: LOW - All critical systems validated

📁 Reports Generated:
  ✓ tmp/launch-qa-report.json
  ✓ tmp/launch-qa-report.md

✅ Launch QA report generation complete
```

**Reports Generated:**
- `tmp/launch-qa-report.json` (structured data)
- `tmp/launch-qa-report.md` (executive summary)

---

### All-in-One Command (7 minutes)

Run all three steps sequentially:

```bash
pnpm qa:day1
```

This executes:
1. `pnpm qa:hide-incomplete`
2. `pnpm qa:verify-searchable`
3. `pnpm qa:launch-report`

If any step fails, the process stops and returns an error code.

---

## Expected Results

### Database State
- **4,476 searchable recipes** (95.09%)
  - All have valid ingredients
  - All have valid instructions
  - `qa_status` is NULL or not in `('needs_review', 'flagged')`

- **211 hidden recipes** (4.48%)
  - Missing instructions
  - `qa_status = 'needs_review'`
  - Not visible in search results

- **20 flagged recipes** (0.42%)
  - Missing ingredients
  - `qa_status = 'flagged'`
  - Still searchable (have instructions)
  - Flagged for post-launch manual review

### Reports Generated
1. **tmp/hide-incomplete-report.json**
   - List of updated recipes
   - Count by issue type

2. **tmp/searchable-recipes-report.json**
   - Searchable recipe count
   - Validation check results
   - Launch readiness status

3. **tmp/launch-qa-report.json**
   - Complete launch metrics
   - Quality assessment
   - Launch approval status

4. **tmp/launch-qa-report.md**
   - Executive summary (human-readable)
   - Post-launch action items

---

## Rollback Plan

If issues arise during Day 1 preparation, you can rollback the changes:

### Reset All QA Status
```sql
-- Rollback: Reset all recipes to pending QA status
UPDATE recipes
SET qa_status = 'pending',
    qa_notes = NULL,
    qa_timestamp = NULL,
    qa_method = NULL,
    qa_issues_found = NULL
WHERE qa_status IN ('needs_review', 'flagged');
```

### Verify Rollback
```bash
# Count recipes by QA status
psql $DATABASE_URL -c "SELECT qa_status, COUNT(*) FROM recipes GROUP BY qa_status;"
```

### Re-run Day 1
After rollback, you can re-run Day 1 preparation:
```bash
pnpm qa:day1
```

---

## Post-Launch Action Items

### Week 1-2: Fix Flagged Recipes (20 recipes)
1. Manual review of 20 recipes with missing ingredients
2. Derive ingredients from instructions where possible
3. Test and validate fixes
4. Update `qa_status = 'validated'`

**Priority:** HIGH - These are searchable and need ingredient data

### Week 3-4: Fix Hidden Recipes (211 recipes)
1. Evaluate 211 recipes with missing instructions
2. Options:
   - Source original instructions from recipe URL
   - Remove unfixable recipes from database
   - Run Phase 2 LLM extraction (background task)
3. Update `qa_status = 'validated'` or delete

**Priority:** MEDIUM - Not visible to users, can be fixed gradually

---

## Verification Checklist

Before launch, verify:

- [ ] Phase 1 report exists (`tmp/qa-structure-report.json`)
- [ ] All Day 1 scripts executed successfully
- [ ] 4,476 searchable recipes confirmed
- [ ] 211 recipes hidden from search
- [ ] 20 recipes flagged for post-launch fix
- [ ] Launch report shows "✅ LAUNCH READY"
- [ ] Launch report shows "Risk Level: LOW"
- [ ] All validation checks passed
- [ ] Database backup created

---

## Troubleshooting

### Script Fails: "Phase 1 report not found"
**Problem:** Phase 1 hasn't been run yet

**Solution:**
```bash
pnpm qa:phase1
```

Wait for completion, then re-run Day 1 scripts.

---

### Script Fails: "Database connection error"
**Problem:** Can't connect to PostgreSQL database

**Solution:**
```bash
# Verify DATABASE_URL is set
echo $DATABASE_URL

# Test database connection
pnpm db:studio
```

If `db:studio` works, database is accessible. Re-run Day 1 scripts.

---

### Verification Shows Issues Found
**Problem:** `qa:verify-searchable` reports validation issues

**Example Output:**
```
⚠️  Verification complete - ISSUES FOUND

Issues:
  - 5 incomplete recipes still searchable
```

**Solution:**
1. Check database state:
```bash
# Query for incomplete searchable recipes
psql $DATABASE_URL -c "
  SELECT id, name, qa_status
  FROM recipes
  WHERE (ingredients = '[]' OR instructions = '[]')
    AND (qa_status IS NULL OR qa_status NOT IN ('needs_review', 'flagged'))
  LIMIT 10;
"
```

2. Re-run hide script:
```bash
pnpm qa:hide-incomplete
pnpm qa:verify-searchable
```

---

### Launch Report Shows "NOT APPROVED"
**Problem:** Launch readiness check failed

**Solution:**
1. Review issues in `tmp/launch-qa-report.json`
2. Check validation status in `tmp/searchable-recipes-report.json`
3. Fix identified issues
4. Re-run verification and report generation:
```bash
pnpm qa:verify-searchable && pnpm qa:launch-report
```

---

## Technical Details

### QA Status Values
- `NULL` or `'pending'`: Not yet QA'd (searchable by default)
- `'validated'`: Passed QA validation (searchable)
- `'needs_review'`: Failed validation, hidden from search
- `'flagged'`: Minor issues, searchable but flagged for review
- `'fixed'`: Issues resolved, searchable

### Search Exclusion Logic
Recipes are hidden from search when:
```sql
qa_status IN ('needs_review')
```

Flagged recipes remain searchable:
```sql
qa_status IN ('flagged')  -- Still searchable
```

### QA Metadata
Each QA update sets:
- `qa_timestamp`: When QA was performed
- `qa_method`: How QA was performed (e.g., 'automated-rules')
- `qa_notes`: Human-readable description
- `qa_issues_found`: JSON array of specific issues

---

## Support

For issues or questions:
1. Check this documentation
2. Review script output and error messages
3. Check generated reports in `tmp/` directory
4. Consult Phase 6 documentation in `docs/phase-6/`

---

**Last Updated:** October 24, 2025
**Launch Date:** October 27, 2025 (3 days)
**Status:** Ready for Execution
