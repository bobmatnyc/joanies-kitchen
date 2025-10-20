# Documentation Audit Report

**Date**: October 20, 2025
**Auditor**: Research Agent
**Project**: Joanie's Kitchen - Zero-Waste Transformation
**Current Status**: 80% complete (Phase 5 of 6)

---

## Executive Summary

### Overview
The docs/ directory contains **311 markdown files** across **25 subdirectories**. Following the zero-waste pivot in mid-October 2025, much of the documentation has become obsolete or misaligned with the current project direction.

### Key Findings
- **Total Files**: 311 markdown documents
- **Keep**: ~85 files (27%) - Currently relevant
- **Archive**: ~175 files (56%) - Obsolete but historically valuable
- **Delete**: ~35 files (11%) - Redundant or temporary
- **Consolidate**: ~16 files (5%) - Merge into existing docs

### Critical Issues
1. **Pre-pivot documentation** dominates (56% of files)
2. **Session notes** and temporary files not cleaned up
3. **Multiple fix reports** for issues now resolved
4. **Feature docs** for non-zero-waste features still prominent
5. **No clear zero-waste documentation index**

---

## Summary Statistics

| Category | Files | Percentage | Recommendation |
|----------|-------|------------|----------------|
| Keep | 85 | 27% | Current and relevant |
| Archive | 175 | 56% | Move to archive/ |
| Delete | 35 | 11% | Remove entirely |
| Consolidate | 16 | 5% | Merge with other docs |
| **Total** | **311** | **100%** | |

---

## Detailed Analysis by Directory

### 1. docs/archive/ ✅ KEEP (reorganize)
**Status**: KEEP - Already archived content
**Files**: 30 documents
**Action**: Reorganize subdirectories

**Current Structure**:
```
docs/archive/
├── pre-pivot/          # Social focus era (Aug-Oct 2025)
├── implementations/    # Old implementation reports
└── roadmaps/          # Superseded roadmaps
```

**Recommendations**:
1. Create clearer subdirectory structure
2. Add date prefixes to files (YYYY-MM format)
3. Update README.md with better organization
4. Add index linking to current equivalents

**Files to Keep**:
- All existing archived content (historical value)
- ROADMAP_SOCIAL_FOCUS.md (shows pre-pivot direction)
- roadmap-transformation-early-draft.md (pivot thinking)

---

### 2. docs/session-notes/ ❌ DELETE
**Status**: DELETE - Temporary development notes
**Files**: 2 files
**Reason**: Session notes are temporary and outdated

**Files**:
```
❌ SESSION_PAUSE_NOTE.md (Oct 16) - No longer relevant
❌ SESSION_SUMMARY_2025-10-16.md (Oct 16) - Pre-pivot work
```

**Action**:
```bash
rm -rf docs/session-notes/
```

**Rationale**: Session notes served their purpose during development but have no long-term value. Key insights should be in implementation docs.

---

### 3. docs/fixes/ 🗂️ ARCHIVE (90% of files)
**Status**: ARCHIVE - Historical bug fix documentation
**Files**: 19 fix reports
**Recommendation**: Archive most, keep only active fixes

**Archive** (15 files - bugs fixed before pivot):
```
ARCHIVE:
├── CHEF_AVATAR_FIX_2025-10-17.md
├── DATABASE_URL_FIX_SUMMARY.md
├── DEPLOYMENT_FIX_README.md
├── DOUBLE_NUMBERING_FIX_REPORT.md
├── DOUBLE_NUMBERING_FIX_SUMMARY.md
├── HTTP_500_FIX_SUMMARY.md
├── HYDRATION_AND_TYPE_FIXES.md
├── INA_GARTEN_IMAGE_UPDATE.md
├── INVALID_TIME_VALUE_FIX.md
├── RECIPE_CARD_LAYOUT_IMPROVEMENTS.md
├── ROASTED_TOMATO_SOUP_IMAGE_FIX.md
├── ROUTING_FIX_SUMMARY.md
├── SIMILAR_RECIPES_FIX_REPORT.md
├── VERCEL_DEPLOYMENT_FIX_REPORT.md
└── ENGAGEMENT_STATS_INLINE_DISPLAY.md
```

**Keep** (4 files - potentially relevant):
```
KEEP:
├── BROKEN_IMAGE_AUDIT_2025-10-19.md (recent, may need follow-up)
├── INGREDIENT_QUALIFIERS_FIX.md (ingredients still relevant)
```

**Action**:
```bash
mkdir -p docs/archive/fixes-pre-pivot/
mv docs/fixes/{most files} docs/archive/fixes-pre-pivot/
```

---

### 4. docs/features/ 🗂️ ARCHIVE (80% of files)
**Status**: CONSOLIDATE + ARCHIVE
**Files**: 18 feature documents
**Issue**: Many features are pre-pivot or non-zero-waste

**Archive** (14 files - pre-pivot features):
```
ARCHIVE (Social/Chef Features):
├── ADMIN_EDIT_UI_ARCHITECTURE.md (not zero-waste focused)
├── ADMIN_IMAGE_FLAGGING_SYSTEM.md (moderation, not core)
├── CHEF_BACK_NAVIGATION.md (chef system detail)
├── CHEF_LOCATION_MAP.md (chef feature)
├── CHEF_MAP_QUICK_START.md (chef feature)
├── MEAL_PAIRING_ACTIONS.md (not zero-waste focused)
├── MEALS_FEATURE_STATUS_REPORT.md (pre-pivot)
├── METADATA_DISPLAY_IMPROVEMENTS.md (minor UI)
├── NAVIGATION_RESTRUCTURE_SUMMARY.md (superseded)
├── RECIPE_CARD_LAYOUT_STANDARD.md (superseded)
├── RECIPE_CARD_TAG_IMPROVEMENTS.md (minor)
├── TOP_50_ANIMATED_BACKGROUND.md (non-core feature)
├── TOP_50_QUICK_REFERENCE.md (consumption-focused)
└── TOP_50_RECIPES_IMPLEMENTATION.md (consumption-focused)
```

**Keep** (3 files - zero-waste relevant):
```
KEEP:
├── fridge_feature_design.md ✅ (core zero-waste feature!)
├── RECIPE_LICENSE_ONTOLOGY.md (data quality)
└── SEMANTIC_TAGS_IMPLEMENTATION.md (if zero-waste tags)
```

**Consolidate** (1 file):
```
CONSOLIDATE:
└── TAG_SYSTEM_V2.md → merge into docs/reference/TAGGING_SYSTEM.md
```

---

### 5. docs/implementations/ 🗂️ ARCHIVE (100%)
**Status**: ARCHIVE - All pre-pivot implementations
**Files**: 16 implementation reports
**Reason**: Social features not part of zero-waste pivot

**Archive All**:
```
ARCHIVE (All Non-Zero-Waste):
├── ADMIN_EDIT_UI_IMPLEMENTATION.md
├── AI_PROMPT_STORE_IMPLEMENTATION.md
├── BUTTERNUT_SOUP_IMAGE_GENERATION.md
├── MANUAL_TAG_INPUT_REMOVAL.md
├── MEAL_BUILDER_IMPLEMENTATION_REPORT.md
├── MEAL_PAIRING_ACTIONS_SUMMARY.md
├── MEAL_PAIRING_ENGINE_IMPLEMENTATION.md
├── MEAL_PAIRING_INTEGRATION_SUMMARY.md
├── MEAL_PAIRING_SCHEMA_ADDITIONS.md
├── MEAL_PAIRING_UI_IMPLEMENTATION.md
├── meal-pairing-helpers.ts (code file - move to archive)
├── PERSONA_COLLECTIONS_SUMMARY.md
├── RECIPE_SOURCES_ONTOLOGY.md
├── SEMANTIC_TAGS_SUMMARY.md
├── SIMILAR_RECIPES_IMPLEMENTATION.md
└── TAG_SYSTEM_V2_IMPLEMENTATION.md
```

**Action**:
```bash
mv docs/implementations/ docs/archive/implementations-pre-pivot/
```

**Rationale**: These are detailed implementation reports for features built before the zero-waste pivot. While technically impressive, they don't align with current mission.

---

### 6. docs/guides/ 🔍 MIXED (consolidate needed)
**Status**: KEEP core guides, ARCHIVE others
**Files**: 79 guide documents (largest directory!)
**Issue**: Massive directory with mixed relevance

**Keep** (25 files - core zero-waste or infrastructure):
```
KEEP (Zero-Waste Core):
├── fridge_feature_design.md ✅ (CRITICAL - move to top-level)
├── AUTOMATIC_MEAL_TAGGING.md (if zero-waste tagging)
├── INGREDIENT_EXTRACTION_GUIDE.md (fridge feature support)
├── INGREDIENT_PARSER_GUIDE.md (fridge feature support)

KEEP (Infrastructure - Still Needed):
├── AUTHENTICATION_REQUIREMENTS.md
├── authentication.md
├── CLERK_DASHBOARD_SETUP.md
├── CLERK_PORT_FIX.md
├── CLERK_SETUP_GUIDE.md
├── CODE_QUALITY.md
├── DEV_SERVER_STABILITY.md
├── DUAL_ENVIRONMENT_SETUP.md
├── EMBEDDINGS_GENERATION_GUIDE.md
├── ENVIRONMENT_SETUP.md
├── GOOGLE_OAUTH_SETUP.md
├── MOBILE_DEVELOPMENT.md
├── MOBILE_PARITY_REQUIREMENTS.md ✅ (IMPORTANT)
├── PERFORMANCE_OPTIMIZATION.md
├── PRODUCTION_KEYS_LOCALHOST.md
├── RECIPE_ACCESS_CONTROL.md
├── SEARCH_CACHE_GUIDE.md
├── semantic-search.md
├── TYPE_SAFETY.md
├── VERSIONING_GUIDE.md
├── VERSIONING_QUICKSTART.md
├── VERSIONING_README.md
```

**Archive** (45 files - pre-pivot, chef system, social features):
```
ARCHIVE (Pre-Pivot Features):
├── admin-dashboard.md
├── admin-setup.md
├── AI_TOMATO_LOGO_MIGRATION.md
├── BUNDLE_OPTIMIZATION_QUICK_START.md
├── CHEF_PROFILE_IMAGES.md
├── CHEF_SYSTEM_IMPLEMENTATION.md
├── CHEF_SYSTEM_QUICK_START.md
├── CHEF_SYSTEM_README.md
├── continuous-scraping.md
├── data-acquisition-epicurious.md
├── data-acquisition-foodcom.md
├── data-acquisition-openrecipes.md
├── data-acquisition.md
├── EPICURIOUS_QUICK_START.md
├── FOODCOM_IMPLEMENTATION_SUMMARY.md
├── FOODCOM_QUICK_START.md
├── GUEST_MEAL_PLANNING_TESTING.md
├── INGREDIENT_AMOUNTS_FIX.md
├── INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md
├── INSTRUCTION_CLASSIFICATION_QUICKSTART.md
├── INVENTORY_SCHEMA_IMPLEMENTATION.md (if not zero-waste)
├── JOANIE_PORTRAIT_INTEGRATION.md
├── LOGO_UPDATE_SUMMARY.md
├── MEAL_BUILDER_AI_ENHANCEMENTS.md (not zero-waste focused)
├── OPENRECIPES_IMPLEMENTATION_SUMMARY.md
├── OPENRECIPES_QUICK_START.md
├── PAGINATION_GUIDE.md
├── PAGINATION_QUICK_START.md
├── pgvector-quickstart.md
├── pgvector-setup.md
├── PHASE_2_UI_IMPLEMENTATION.md
├── PLACEHOLDER_IMAGES.md
├── QUICK_START_GOOGLE_OAUTH.md
├── rating-system.md
├── RECIPE_CONTENT_CLEANUP_GUIDE.md
├── RECIPE_QUALITY_REVIEW_GUIDE.md
├── RECIPE_RATING_SYSTEM.md
├── RECIPE_SLUGS.md
├── RESUME_EPICURIOUS_IMPORT.md
├── SEO_OPTIMIZATION_PLAN.md
├── SERIOUS_EATS_SCRAPING_GUIDE.md
├── SETUP_COMPLETE.md
├── SIMILAR_RECIPES_IMPLEMENTATION.md
├── SNAKE_CASE_MIGRATION_GUIDE.md
├── SOCIAL_FEATURES_INVESTIGATION_REPORT.md
├── SOCIAL_FEATURES_POLISH_SUMMARY.md
├── THEMEALDB_QUICKSTART.md
├── themealdb-pipeline.md
├── TOP_50_RECIPES_FEATURE.md
├── USER_DISCOVERY_FEATURES.md
├── USER_DISCOVERY_INTEGRATION_GUIDE.md
├── VERCEL_CLERK_FIX.md
├── VERCEL_CLERK_QUICK_FIX.md
```

**Delete** (9 files - temporary or duplicate):
```
DELETE (Temporary/Duplicates):
├── CLERK_PORT_FIX.md (temporary fix, issue resolved)
├── INGREDIENT_AMOUNTS_FIX.md (duplicate of fixes/)
├── LOGO_UPDATE_SUMMARY.md (minor, one-time change)
├── SETUP_COMPLETE.md (temporary milestone)
├── VERCEL_CLERK_FIX.md (duplicate fix)
├── VERCEL_CLERK_QUICK_FIX.md (duplicate fix)
```

---

### 7. docs/developer/ ✅ KEEP (update needed)
**Status**: KEEP - Developer documentation hub
**Files**: 15 files (including subdirectories)
**Action**: Update to reflect zero-waste focus

**Keep All**:
- README.md ✅ (developer hub - needs zero-waste update)
- DOCUMENTATION_REORGANIZATION_SUMMARY.md
- implementation/ subdirectory (historical implementation docs)
- reports/ subdirectory (delivery reports)

**Action Required**:
1. Update README.md to emphasize zero-waste features
2. Archive pre-pivot implementation summaries
3. Create new section: "Zero-Waste Feature Implementation"

---

### 8. docs/reference/ ✅ KEEP (mostly)
**Status**: KEEP - Core reference documentation
**Files**: 75 reference documents
**Issue**: Contains both current and historical docs

**Keep** (60 files - current reference):
```
KEEP (Core References):
├── 1PASSWORD_SETUP.md
├── brand-guide.md
├── brand-reference.md
├── CHEF_AVATAR_SYSTEM.md
├── CHEF_IMAGES_QUICK_REFERENCE.md
├── CHEF_INSTRUCTIONS_FORMATTING.md
├── CHEF_PROFILES_QUICK_REFERENCE.md
├── DOCUMENTATION_REORGANIZATION_SUMMARY.md
├── embedding-reference.md
├── environment-variables.md
├── INGREDIENTS_IMPLEMENTATION_SUMMARY.md
├── INGREDIENTS_SCHEMA.md
├── INSTRUCTION_CLASSIFICATION_* (6 files - if still used)
├── INVENTORY_SCHEMA_QUICK_REF.md (if zero-waste)
├── ISR_COMPARISON.md
├── ISR_IMPLEMENTATION_SUMMARY.md
├── MEALS_IMPLEMENTATION_SUMMARY.md (if zero-waste)
├── MEALS_VALIDATION_IMPLEMENTATION.md
├── MOBILE_PARITY_QUICK_START.md ✅
├── MOBILE_PARITY_ROADMAP_UPDATE.md ✅
├── PAGINATION_IMPLEMENTATION.md
├── PAGINATION_README.md
├── PROJECT_ORGANIZATION.md ✅✅ (CRITICAL)
├── project-organization.md (duplicate - delete)
├── quality.md
├── RECIPE_CARD_IMPROVEMENTS.md
├── RECIPE_QUALITY_QUICK_REFERENCE.md
├── ROADMAP_BY_FUNCTIONAL_AREA.md (update to zero-waste)
├── STABILITY_REPORT.md
├── TYPE_MATCHING.md
├── USER_DISCOVERY_DATABASE_SCHEMA.md
├── VERSIONING_QUICK_REFERENCE.md
└── visual-guide.md
```

**Archive** (12 files - pre-pivot):
```
ARCHIVE:
├── admin-flow.md
├── admin-reference.md
├── CLEANUP_QUICK_REFERENCE.md
├── CLEANUP_TEST_RESULTS.md
├── COURSE_CLASSIFICATION_FIX.md
├── GORDON_RAMSAY_AVATAR_GENERATION.md
├── GUEST_MEAL_PLANNING_IMPLEMENTATION.md
├── IMPORT_SCRIPTS_SUMMARY.md
├── IMPORT_STATUS_REPORT.md
├── LICENSE_QUICK_REFERENCE.md
├── LOGO_MIGRATION_SUMMARY.md
└── LOGO_QUICK_REFERENCE.md
```

**Delete** (3 files - duplicates):
```
DELETE:
├── project-organization.md (duplicate of PROJECT_ORGANIZATION.md)
├── PARALLEL_DATA_FETCHING_IMPLEMENTATION.md (optimization detail)
└── SLUG_MIGRATION.md (one-time migration)
```

---

### 9. docs/getting-started/ ✅ KEEP
**Status**: KEEP - Essential onboarding docs
**Files**: 4 core documents
**Action**: Update to reflect zero-waste features

**Keep All**:
```
KEEP:
├── deployment.md ✅
├── environment-setup.md ✅
├── installation.md ✅
└── quick-start.md ✅
```

**Action Required**:
1. Update quick-start.md to showcase fridge feature first
2. Revise deployment.md for production readiness
3. Ensure environment-setup.md includes zero-waste config

---

### 10. docs/api/ ✅ KEEP
**Status**: KEEP - API documentation
**Files**: 3 API reference docs
**Action**: Keep all, update if needed

**Keep All**:
```
KEEP:
├── brave-search.md
├── crawl.md
└── overview.md
```

---

### 11. docs/roadmap/ ✅ KEEP
**Status**: KEEP - Roadmap documentation
**Files**: 2 roadmap documents
**Action**: Ensure current

**Keep**:
```
KEEP:
├── ROADMAP_PIVOT.md ✅ (detailed pivot plan - historical value)
└── roadmap_transformation.md (transformation details)
```

**Note**: Main ROADMAP.md is at project root (correct location)

---

### 12. docs/research/ ✅ KEEP
**Status**: KEEP - Research documentation
**Files**: 7 research documents
**Action**: Keep for reference

**Keep All**:
```
KEEP:
├── MEAL_PAIRING_INTEGRATION_PLAN.md (if relevant to zero-waste)
├── MEAL_PAIRING_QUICK_START.md
├── NEXT_SCRAPING_SOURCE_ANALYSIS.md
├── RECIPE_SOURCES_RESEARCH.md ✅
├── RECIPE_TAG_TAXONOMY_RESEARCH.md ✅
├── SCRIPT_TAG_INVESTIGATION_SUMMARY.md
├── TAG_HIERARCHY_EXAMPLES.md ✅
└── TAG_TAXONOMY_EXECUTIVE_SUMMARY.md ✅
```

---

### 13. docs/reports/ ✅ KEEP (recent) + ARCHIVE (old)
**Status**: KEEP recent reports, ARCHIVE old
**Files**: 6 report documents
**Action**: Archive pre-pivot reports

**Keep** (0 files - all pre-pivot):
```
(None - all reports are pre-pivot)
```

**Archive** (6 files):
```
ARCHIVE:
├── HYDRATION_ERROR_FIX.md
├── INGREDIENT_AMOUNTS_CLEANUP_REPORT.md
├── LIDIA_AUDIT_VISUAL_SUMMARY.md
├── LIDIA_CONTENT_QUALITY_REPORT.md
├── RECIPE_CARD_STANDARDIZATION_REPORT.md
└── RECIPE_CARD_STANDARDIZATION_SUMMARY.md
```

---

### 14. docs/scraping/ ✅ KEEP (if data acquisition continues)
**Status**: KEEP - Data source documentation
**Files**: 4 scraping documents
**Action**: Keep if recipe acquisition continues

**Keep All**:
```
KEEP:
├── lidia-bastianich-scraping-report.md
├── PROGRESS.md
├── recipe-extraction-technical-plan.md
└── usda-extraction-report.md
```

**Note**: Depends on whether recipe data acquisition is part of zero-waste strategy

---

### 15. docs/testing/ ✅ KEEP
**Status**: KEEP - Testing documentation
**Files**: 6 test documents
**Action**: Update test plans for zero-waste features

**Keep All**:
```
KEEP:
├── E2E_TEST_SETUP.md ✅
├── MEALS_TEST_SUMMARY.md
├── TEST_SIMILAR_RECIPES.md
├── UAT_QUICK_REFERENCE.md ✅
├── UAT_REPORT.md
└── UAT_SUMMARY.md
```

---

### 16. docs/uat/ ✅ KEEP (recent)
**Status**: KEEP - User acceptance testing
**Files**: 2 UAT documents
**Action**: Keep for QA reference

**Keep All**:
```
KEEP:
├── RECIPE_FORMS_ACTION_ITEMS.md
└── RECIPE_FORMS_UAT_REPORT.md
```

---

### 17. docs/troubleshooting/ 🗂️ ARCHIVE (most)
**Status**: ARCHIVE - Historical troubleshooting
**Files**: 6 troubleshooting docs
**Action**: Archive old fixes, keep current issues

**Keep** (2 files):
```
KEEP:
├── common-issues.md ✅ (general troubleshooting)
└── DEV_SERVER_STABILITY.md (if still relevant)
```

**Archive** (4 files):
```
ARCHIVE:
├── admin-fix.md
├── embedding-fix.md
├── schema-fix.md
└── security-fix.md
```

---

### 18. docs/analysis/ ✅ KEEP
**Status**: KEEP - Performance analysis
**Files**: 1 analysis document
**Action**: Keep

**Keep**:
```
KEEP:
└── BUNDLE_OPTIMIZATION_ANALYSIS.md ✅
```

---

### 19. docs/migrations/ ✅ KEEP
**Status**: KEEP - Database migration docs
**Files**: 1 migration document
**Action**: Keep for database history

**Keep**:
```
KEEP:
└── INVENTORY_SCHEMA_MIGRATION.md ✅ (if zero-waste inventory)
```

---

### 20. docs/performance/ ✅ KEEP
**Status**: KEEP - Performance documentation
**Files**: 3 performance docs
**Action**: Keep all

**Keep All**:
```
KEEP:
├── PERFORMANCE_AUDIT.md ✅
├── PERFORMANCE_FIX_SUMMARY.md ✅
└── QUICK_REFERENCE.md ✅
```

---

### 21. docs/releases/ ✅ KEEP
**Status**: KEEP - Release documentation
**Files**: 2 release docs
**Action**: Keep all

**Keep All**:
```
KEEP:
├── IMPLEMENTATION_COMPLETE.md
└── RELEASE_v0.6.0.md
```

---

### 22. docs/README.md ✅ KEEP (update needed)
**Status**: KEEP - Documentation hub
**Files**: 1 root README
**Action**: Major update required

**Action Required**:
1. Rewrite to emphasize zero-waste focus
2. Update navigation to prioritize zero-waste docs
3. Remove links to archived content
4. Add "Zero-Waste Features" section prominently
5. Clarify documentation structure post-cleanup

---

## Proposed Archive Structure

### Create New Archive Organization

```
docs/archive/
├── README.md (updated with better organization)
│
├── pre-pivot-2025-10/           # Social focus era
│   ├── roadmaps/
│   │   ├── ROADMAP_SOCIAL_FOCUS.md
│   │   ├── roadmap-by-area-social-focus.md
│   │   └── roadmap-transformation-early-draft.md
│   ├── features/
│   │   └── [14 archived feature docs]
│   ├── implementations/
│   │   └── [16 implementation reports]
│   └── guides/
│       └── [45 pre-pivot guides]
│
├── fixes-resolved/              # Historical bug fixes
│   └── [15 fix reports]
│
├── reports-historical/          # Old reports
│   └── [6 report documents]
│
├── troubleshooting-historical/  # Old troubleshooting
│   └── [4 troubleshooting docs]
│
└── deprecated/                  # Legacy technical docs
    ├── chef-system/
    ├── social-features/
    └── meal-pairing/
```

---

## Documentation Gaps (What's Missing)

### Critical Zero-Waste Documentation Needed

1. **docs/guides/FRIDGE_FEATURE_COMPREHENSIVE.md**
   - Complete guide to fridge feature implementation
   - How to extend and maintain
   - API documentation
   - User journey documentation

2. **docs/guides/ZERO_WASTE_PHILOSOPHY.md**
   - Joanie's philosophy explained in detail
   - How it drives technical decisions
   - Examples of philosophy-driven features

3. **docs/guides/SUBSTITUTION_SYSTEM.md**
   - How the substitution system works
   - Rule-based vs AI substitutions
   - Adding new substitution rules
   - Testing substitutions

4. **docs/guides/RESOURCEFULNESS_SCORING.md**
   - How resourcefulness scoring works
   - Algorithm details
   - Adjusting scores
   - Using scores in features

5. **docs/reference/ZERO_WASTE_API.md**
   - API reference for zero-waste features
   - Fridge search endpoint
   - Substitution endpoint
   - Rescue pages data

6. **docs/testing/ZERO_WASTE_FEATURE_TESTS.md**
   - Test plans for fridge feature
   - Substitution testing
   - Ingredient matching accuracy tests
   - User acceptance criteria

7. **docs/guides/RESCUE_PAGES.md**
   - How Rescue Ingredients pages work
   - Content guidelines
   - Adding new rescue categories
   - Recipe filtering logic

8. **docs/reference/ZERO_WASTE_SCHEMA.md**
   - Database schema for zero-waste features
   - New fields: resourcefulness_score, waste_reduction_tags
   - Relationships and indexes
   - Migration history

---

## Priority Actions

### Immediate (This Week)

1. **Create Archive Structure** (2 hours)
   ```bash
   mkdir -p docs/archive/{pre-pivot-2025-10,fixes-resolved,reports-historical,troubleshooting-historical,deprecated}
   mkdir -p docs/archive/pre-pivot-2025-10/{roadmaps,features,implementations,guides}
   ```

2. **Delete Session Notes** (5 minutes)
   ```bash
   rm -rf docs/session-notes/
   ```

3. **Move High-Priority Archives** (1 hour)
   ```bash
   # Move implementations
   mv docs/implementations/* docs/archive/pre-pivot-2025-10/implementations/

   # Move most fixes
   mv docs/fixes/{most-files} docs/archive/fixes-resolved/

   # Move old reports
   mv docs/reports/* docs/archive/reports-historical/
   ```

4. **Update Root README** (2 hours)
   - Rewrite docs/README.md for zero-waste focus
   - Add clear navigation
   - Link to archive with explanation

### Short-Term (Next Week)

5. **Archive Pre-Pivot Features** (3 hours)
   - Move non-zero-waste feature docs
   - Update internal links
   - Create redirect index

6. **Archive Pre-Pivot Guides** (4 hours)
   - Move 45 guides to archive
   - Keep 25 core guides
   - Update guide index

7. **Clean Reference Directory** (2 hours)
   - Remove duplicates
   - Archive pre-pivot references
   - Organize by topic

8. **Create Archive README** (1 hour)
   - Explain archive structure
   - Link archived docs to current equivalents
   - Add timeline of project evolution

### Medium-Term (Next Two Weeks)

9. **Write Missing Zero-Waste Docs** (16 hours)
   - Fridge feature comprehensive guide (4h)
   - Substitution system guide (3h)
   - Resourcefulness scoring reference (2h)
   - Zero-waste API reference (3h)
   - Rescue pages guide (2h)
   - Zero-waste schema reference (2h)

10. **Update Developer Hub** (4 hours)
    - Rewrite docs/developer/README.md
    - Emphasize zero-waste features
    - Remove pre-pivot implementation summaries

11. **Consolidate Duplicate Docs** (3 hours)
    - Merge TAG_SYSTEM_V2.md into reference
    - Consolidate authentication guides
    - Merge versioning docs

---

## Execution Plan

### Phase 1: Immediate Cleanup (Week 1)
**Goal**: Remove obvious obsolete content
**Time**: 6 hours

```bash
# Day 1 (2 hours)
# 1. Create archive structure
mkdir -p docs/archive/{pre-pivot-2025-10,fixes-resolved,reports-historical,troubleshooting-historical,deprecated}
mkdir -p docs/archive/pre-pivot-2025-10/{roadmaps,features,implementations,guides}

# 2. Delete session notes
rm -rf docs/session-notes/

# 3. Move implementations
mv docs/implementations docs/archive/pre-pivot-2025-10/implementations

# Day 2 (2 hours)
# 4. Move resolved fixes
mv docs/fixes/{15-files} docs/archive/fixes-resolved/

# 5. Move old reports
mv docs/reports/* docs/archive/reports-historical/

# Day 3 (2 hours)
# 6. Update docs/README.md
# 7. Create docs/archive/README.md
# 8. Test all internal links
```

### Phase 2: Feature Documentation Cleanup (Week 2)
**Goal**: Archive pre-pivot feature docs
**Time**: 8 hours

```bash
# Day 4-5 (4 hours)
# 1. Move pre-pivot feature docs
mv docs/features/{14-files} docs/archive/pre-pivot-2025-10/features/

# 2. Keep only zero-waste feature docs
# - fridge_feature_design.md
# - RECIPE_LICENSE_ONTOLOGY.md
# - SEMANTIC_TAGS_IMPLEMENTATION.md (verify)

# Day 6-7 (4 hours)
# 3. Move pre-pivot guides (45 files)
mv docs/guides/{45-files} docs/archive/pre-pivot-2025-10/guides/

# 4. Update guide index
# 5. Fix broken links
```

### Phase 3: Reference Cleanup (Week 3)
**Goal**: Clean and organize reference docs
**Time**: 6 hours

```bash
# Day 8-9 (3 hours)
# 1. Remove duplicates
rm docs/reference/project-organization.md  # Duplicate
rm docs/reference/PARALLEL_DATA_FETCHING_IMPLEMENTATION.md  # Detail
rm docs/reference/SLUG_MIGRATION.md  # One-time

# 2. Archive pre-pivot references (12 files)
mv docs/reference/{12-files} docs/archive/pre-pivot-2025-10/references/

# Day 10 (3 hours)
# 3. Reorganize reference/ by topic
# 4. Create reference/README.md with index
# 5. Update links
```

### Phase 4: Write Zero-Waste Documentation (Weeks 4-5)
**Goal**: Fill documentation gaps
**Time**: 20 hours

```
Week 4:
- FRIDGE_FEATURE_COMPREHENSIVE.md (4h)
- SUBSTITUTION_SYSTEM.md (3h)
- RESOURCEFULNESS_SCORING.md (2h)
- ZERO_WASTE_PHILOSOPHY.md (3h)

Week 5:
- ZERO_WASTE_API.md (3h)
- RESCUE_PAGES.md (2h)
- ZERO_WASTE_SCHEMA.md (2h)
- ZERO_WASTE_FEATURE_TESTS.md (1h)
```

---

## Success Metrics

### After Cleanup:
- ✅ **Documentation count**: 311 → ~120 files (61% reduction)
- ✅ **Archive size**: ~175 files properly organized
- ✅ **Zero duplicates**: All duplicate docs removed
- ✅ **Clear structure**: 3-tier hierarchy (getting-started → guides → reference)
- ✅ **Zero-waste focus**: 100% of docs aligned with mission
- ✅ **No broken links**: All internal links work
- ✅ **Up-to-date**: All docs reflect current state (Phase 5, 80% complete)

### New Documentation:
- ✅ **8 new zero-waste guides** created
- ✅ **Updated developer hub** with zero-waste focus
- ✅ **Archive README** with clear organization
- ✅ **Root README** rewritten for zero-waste emphasis

---

## Risk Assessment

### Low Risk
- Archiving pre-pivot documents (historical value preserved)
- Deleting session notes (temporary by nature)
- Removing duplicate files (originals kept)

### Medium Risk
- Moving 45 guides to archive (may break some internal links)
- Consolidating docs (need careful merge)

### Mitigation
1. **Create comprehensive redirect index** in archive README
2. **Test all internal links** after each phase
3. **Keep git history** (easy rollback if needed)
4. **Document all moves** in commit messages

---

## Recommended Commands

### Create Archive Structure
```bash
#!/bin/bash
# Create archive directory structure

mkdir -p docs/archive/pre-pivot-2025-10/{roadmaps,features,implementations,guides,references}
mkdir -p docs/archive/{fixes-resolved,reports-historical,troubleshooting-historical,deprecated}

# Create README files
touch docs/archive/README.md
touch docs/archive/pre-pivot-2025-10/README.md
```

### Move Files Script
```bash
#!/bin/bash
# Safe file moving with logging

ARCHIVE_DIR="docs/archive"
LOG_FILE="docs/archive/MIGRATION_LOG.md"

# Start log
echo "# Documentation Migration Log" > $LOG_FILE
echo "Date: $(date)" >> $LOG_FILE
echo "" >> $LOG_FILE

# Function to move and log
move_file() {
    src=$1
    dest=$2
    echo "Moving: $src → $dest" >> $LOG_FILE
    mv "$src" "$dest"
}

# Example moves
move_file "docs/session-notes/*" "$ARCHIVE_DIR/deprecated/"
move_file "docs/implementations/*" "$ARCHIVE_DIR/pre-pivot-2025-10/implementations/"
```

### Verify Links Script
```bash
#!/bin/bash
# Check for broken internal links in docs/

echo "Checking for broken links..."

# Find all markdown files
find docs -name "*.md" -exec grep -H '\[.*\](.*)' {} \; | \
  grep -E '\[.*\]\((?!http)' | \
  while read line; do
    # Extract file path and link
    file=$(echo $line | cut -d: -f1)
    link=$(echo $line | sed -n 's/.*\](\([^)]*\)).*/\1/p')

    # Check if linked file exists
    if [ ! -f "$link" ]; then
      echo "BROKEN: $file -> $link"
    fi
  done
```

---

## Conclusion

The documentation cleanup is **critical** for the zero-waste transformation. With 311 files, 56% of which are obsolete, the current state makes it difficult for developers to find relevant documentation.

**Key Benefits After Cleanup**:
1. **Clarity**: Developers see only zero-waste-relevant docs
2. **Speed**: Faster navigation with 60% fewer files
3. **Alignment**: 100% of docs support mission
4. **History**: Pre-pivot work preserved in archive
5. **Gaps filled**: 8 new guides for zero-waste features

**Timeline**: 4-5 weeks (concurrent with Phase 5 completion)

**Next Step**: Create archive structure and begin Phase 1 cleanup

---

**Report Generated**: October 20, 2025
**By**: Research Agent (Documentation Audit)
**Status**: Ready for implementation
**Estimated Cleanup Time**: 40 hours over 5 weeks
