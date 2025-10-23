# Kitchen Tools Migration Analysis

**Analysis Date**: 2025-10-22
**Analyst**: Research Agent
**Status**: 🔴 MIGRATION REQUIRED

---

## Executive Summary

The Joanie's Kitchen application currently stores kitchen tools/equipment in the `ingredients` table, but a dedicated `tools` table schema exists and is ready for migration. This analysis provides a complete assessment of the current state, migration requirements, and recommended implementation strategy.

### Key Findings

- **31 kitchen tools** currently stored in `ingredients` table
- **0 tools** in dedicated `tools` table (table is empty but schema exists)
- **65 recipe_ingredients references** need to be migrated to `recipe_tools`
- **Migration complexity**: MODERATE (requires multi-table data movement)
- **Risk level**: MEDIUM (active recipe references, no foreign key to recipe_tools)

---

## 1. Current State Analysis

### 1.1 Database Schema Assessment

#### Existing `tools` Table (Ready for Use)
Location: `/src/lib/db/schema.ts` (lines 456-489)

```typescript
export const tools = pgTable('tools', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),           // Canonical name (e.g., "large-pot")
  display_name: text('display_name').notNull(),    // Display name (e.g., "Large Pot")
  category: text('category', {
    enum: [
      'cookware', 'bakeware', 'knives', 'utensils', 'appliances',
      'measuring', 'prep', 'serving', 'other'
    ]
  }).notNull(),

  // Ontology categorization (5 types, 48 subtypes)
  type: varchar('type', { length: 50 }),           // CUTTING_PREP, COOKING_VESSELS, etc.
  subtype: varchar('subtype', { length: 100 }),    // knives_chef, pots_sauce, etc.

  // Tool characteristics
  is_essential: boolean('is_essential').default(false),
  is_specialized: boolean('is_specialized').default(false),
  alternatives: text('alternatives'),               // JSON array of alternatives

  // Metadata
  typical_price_usd: decimal('typical_price_usd', { precision: 8, scale: 2 }),
  description: text('description'),

  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});
```

**Schema Status**: ✅ COMPLETE - No changes needed

#### Existing `recipeTools` Table (Ready for Use)
Location: `/src/lib/db/schema.ts` (lines 492-509)

```typescript
export const recipeTools = pgTable('recipe_tools', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipe_id: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  tool_id: uuid('tool_id')
    .notNull()
    .references(() => tools.id, { onDelete: 'cascade' }),

  is_optional: boolean('is_optional').default(false),
  quantity: integer('quantity').default(1),        // How many needed
  notes: text('notes'),                           // Special notes

  created_at: timestamp('created_at').notNull().defaultNow(),
});
```

**Schema Status**: ✅ COMPLETE - Ready for data

### 1.2 Tools Currently in Ingredients Table

**Total Count**: 31 tools identified

**Tool Distribution by Usage**:
| Rank | Tool Name | Usage Count | ID |
|------|-----------|-------------|-----|
| 1 | Skewers | 9 | bf4491e6-e3ad-4bd1-9b7b-39ef4f2d7473 |
| 2 | Thermometer | 6 | 21644114-5795-491c-992e-6bf46ac13f7b |
| 3 | Bamboo Skewers | 6 | ac46cc71-0d63-4076-96bc-d53261c68e2a |
| 4 | Star Cookie Cutter | 3 | d60e504a-1412-424e-af29-98c9e2e1578f |
| 5 | Cardboard Round | 2 | 1519b8c7-7d9d-4661-90ed-fb851e1dad78 |
| 6-8 | Various (Lamb Rack, Oven-Roasting Bag, Rubber Spatula) | 1 | ... |
| 9-31 | Various tools | 0 | ... |

**Total Recipe References**: 65 entries in `recipe_ingredients` table

**Full List of Tool IDs**:
```typescript
// From src/app/actions/tools.ts (lines 8-40)
const TOOL_IDS = [
  'bf4491e6-e3ad-4bd1-9b7b-39ef4f2d7473', // skewers
  'ac46cc71-0d63-4076-96bc-d53261c68e2a', // bamboo skewers
  '21644114-5795-491c-992e-6bf46ac13f7b', // thermometer
  'd60e504a-1412-424e-af29-98c9e2e1578f', // cookie cutter
  '1519b8c7-7d9d-4661-90ed-fb851e1dad78', // cardboard round
  'a86979ca-295d-4a6e-9d74-6137b35f46c3', // lamb rack
  '1310abfe-1cad-4618-871d-3d9c1400a9a0', // spatula
  '7d16e6c8-bc34-4e7e-86a1-8b228f52cd95', // oven-roasting bag
  '1e415be0-9d94-422c-8c7e-a7e036e8259c', // nonstick cooking spray
  'bb5e796c-9bc7-4e7b-bc29-a276daa48e51', // measuring spoon
  '9f7b5dad-4fdd-4f5f-ba55-9c1cf5a962f3', // muddler
  '6b4ebbbf-9b80-4238-a619-42075377ad74', // muffin liners
  '601c5898-e2dc-4f4d-8823-012599b27e31', // deep-fat thermometer
  '302d198d-f196-4ba5-a3f1-fd80b3218d9c', // plastic storage tub
  '0c4d1a87-f4c7-452e-aea4-9167b4d40025', // tongs
  '1216513e-b7b9-401e-8257-8341b2a77858', // wooden stick
  '2bdaa2f2-82ae-45ab-a3f2-1efbb98097fb', // ramekins
  '5c1d3bf1-4994-410f-bb8a-c45b80c4567c', // cutter
  '540a29c5-1792-4dd9-8859-73cb89812c76', // ramekin
  '763ad899-1991-43d7-8a1f-05806c6044da', // spice grinder
  '10637dd2-d9d6-4a1b-9c0c-1873c40da26d', // oven cooking bag
  '5a23f573-b6ce-4240-bacb-6d0d836285c7', // wooden sticks
  '3978a9c3-c8e0-4377-8512-09cd2312b06a', // wooden spoon
  'f2d67c0f-4f4e-49ca-b978-d0c855dea7b4', // ice pop molds
  'bfa74904-f337-44ed-8756-a6c623bd69e8', // wooden ice pop sticks
  'ac2374d5-3d07-479c-8393-0c71f0c47a5b', // measuring spoons
  '46cceb69-677a-4ef8-aace-32b8b1561d7a', // muddlers
  'b1a5651c-8ca8-4a64-b522-117a9df74c9b', // pastry bag
  '630bb14d-39c6-4f73-ab18-3896baa6010e', // cake stand
  'aef3b08c-8c37-4661-b1f8-ad48701988c9', // wooden dowels
  '6c3db2ec-56f1-44e7-b31f-9f75f83a1c0a', // nonstick vegetable oil spray
];
```

### 1.3 Canonical Tool Mapping

The application already has canonical tool names mapped for deduplication:

```typescript
// From src/app/actions/tools.ts (lines 42-75)
const CANONICAL_TOOLS: Record<string, { canonical: string; variant: string }> = {
  'bf4491e6-e3ad-4bd1-9b7b-39ef4f2d7473': { canonical: 'Skewer', variant: 's' },
  'ac46cc71-0d63-4076-96bc-d53261c68e2a': { canonical: 'Skewer', variant: 'Bamboo s' },
  '21644114-5795-491c-992e-6bf46ac13f7b': { canonical: 'Thermometer', variant: 'Standard' },
  // ... 28 more mappings
};
```

**Deduplication Opportunities**:
- `Skewer` (2 variants: standard, bamboo)
- `Thermometer` (2 variants: standard, deep-fat)
- `Ramekin` (2 variants: standard, with custard cups)
- `Measuring Spoon` (2 variants: singular, plural)
- `Muddler` (2 variants: singular, plural)
- `Wooden Stick` (2 variants: singular, plural)

---

## 2. Code Dependencies Analysis

### 2.1 Files Directly Affected

#### Server Actions
- **`src/app/actions/tools.ts`** (lines 1-274)
  - `getAllTools()` - Queries ingredients table with hardcoded TOOL_IDS
  - `getToolsByCanonical()` - Groups tools by canonical name
  - **Impact**: 🔴 HIGH - Core functionality, needs complete rewrite

#### UI Components
- **`src/app/tools/page.tsx`** (lines 1-134)
  - Main tools directory page
  - Uses `getAllTools()` action
  - **Note**: Lines 21-22 explicitly mention migration: *"Note: Tools are currently stored in the ingredients table and will be migrated to a dedicated kitchen_tools table in Phase 2."*
  - **Impact**: 🟡 MEDIUM - UI updates after action rewrite

- **`src/components/tool/ToolCard.tsx`** (lines 1-84)
  - Renders individual tool cards
  - Uses `KitchenTool` type from actions
  - **Impact**: 🟢 LOW - Type changes only

- **`src/components/tool/ToolFilters.tsx`**
  - Tool search and filtering UI
  - **Impact**: 🟢 LOW - No changes needed

- **`src/components/tool/ToolList.tsx`**
  - Grid layout for tools
  - **Impact**: 🟢 LOW - No changes needed

#### Scripts
- **`scripts/analyze-ingredient-anomalies.ts`** (lines 1-500+)
  - Tool detection patterns (lines 18-67)
  - Canonical name generation (lines 147-193)
  - **Note**: Line 395 mentions: *"Migrate X tool entries from ingredients table"*
  - **Impact**: 🟡 MEDIUM - Update after migration

- **`scripts/seed-common-ingredients-tools.ts`** (lines 525-765)
  - Seeds 40 essential tools to `tools` table
  - **Status**: ✅ Ready to use (already targets correct table)
  - **Impact**: 🟢 LOW - Can be used as-is

- **`scripts/query-tools-in-ingredients.ts`** (NEW)
  - Analysis script created for this research
  - **Impact**: 🟢 LOW - Temporary script

### 2.2 Files Indirectly Affected

#### Meal Planning Features
- **`src/lib/meal-planning/aggregator.ts`**
  - Mentions "Tool/equipment requirements and conflicts"
  - Currently uses instruction parsing, not tool table
  - **Impact**: 🟢 LOW - Future enhancement opportunity

#### Instruction Classification
- **`src/types/instruction-metadata.ts`**
  - Defines `Tool` enum for instruction classification
  - Separate from kitchen tools table
  - **Impact**: ⚪ NONE - Different system

### 2.3 Database Query Patterns

**Current Pattern** (Ingredients Table):
```typescript
// Query tools from ingredients table
const tools = await db
  .select({
    id: ingredients.id,
    name: ingredients.name,
    displayName: ingredients.display_name,
    category: ingredients.category,
    usageCount: ingredients.usage_count,
  })
  .from(ingredients)
  .where(inArray(ingredients.id, TOOL_IDS))  // Hardcoded list!
  .orderBy(sql`${ingredients.usage_count} DESC NULLS LAST`);
```

**Future Pattern** (Tools Table):
```typescript
// Query from dedicated tools table
const tools = await db
  .select({
    id: tools.id,
    name: tools.name,
    displayName: tools.display_name,
    category: tools.category,
    type: tools.type,
    subtype: tools.subtype,
  })
  .from(tools)
  .orderBy(tools.display_name);

// Get usage counts from recipe_tools
const toolUsage = await db
  .select({
    tool_id: recipeTools.tool_id,
    count: sql<number>`COUNT(*)`.as('count'),
  })
  .from(recipeTools)
  .groupBy(recipeTools.tool_id);
```

---

## 3. Migration Requirements

### 3.1 Data Mapping Strategy

#### Step 1: Create Tools in `tools` Table

**Field Mapping**:
| Source (ingredients) | Target (tools) | Transformation |
|---------------------|----------------|----------------|
| `id` | NEW `uuid()` | Generate new ID |
| `name` | `name` | Normalize to slug format |
| `display_name` | `display_name` | Direct copy |
| `category` | `category` | Map to tool categories |
| `image_url` | N/A | Store separately or reference |
| `usage_count` | N/A | Derive from recipe_tools count |

**Category Mapping**:
```typescript
// Ingredients category → Tools category
const categoryMapping = {
  'kitchen_tools': 'utensils',  // Default fallback
  'baking': 'bakeware',
  'cooking': 'cookware',
  // Manual review needed for edge cases
};
```

**Ontology Classification** (NEW FIELDS):
- `type`: Map to 5 main types (CUTTING_PREP, COOKING_VESSELS, MIXING_MEASURING, HEAT_POWER, STORAGE_SERVING)
- `subtype`: Map to 48 subtypes based on tool function
- **Requires**: Manual review or AI classification for accuracy

#### Step 2: Migrate `recipe_ingredients` → `recipe_tools`

**Field Mapping**:
| Source (recipe_ingredients) | Target (recipe_tools) | Transformation |
|-----------------------------|----------------------|----------------|
| `recipe_id` | `recipe_id` | Direct copy |
| `ingredient_id` | `tool_id` | Map old ingredient_id → new tool_id |
| `amount` | `quantity` | Parse to integer (e.g., "2" → 2) |
| `is_optional` | `is_optional` | Direct copy |
| `preparation` | `notes` | Copy as notes |
| `unit` | `notes` | Append to notes if present |

**Example Migration**:
```sql
-- Old recipe_ingredients entry
{
  recipe_id: "abc-123",
  ingredient_id: "bf4491e6-e3ad-4bd1-9b7b-39ef4f2d7473",  -- Skewers
  amount: "8",
  unit: "pieces",
  is_optional: false
}

-- New recipe_tools entry
{
  recipe_id: "abc-123",
  tool_id: "NEW-TOOL-UUID",  -- New skewers tool ID
  quantity: 8,
  is_optional: false,
  notes: "pieces"
}
```

### 3.2 Deduplication Strategy

**Canonical Tools to Create**:
1. **Skewer** (merge 2 variants)
2. **Thermometer** (merge 2 variants)
3. **Ramekin** (merge 2 variants)
4. **Measuring Spoon** (merge 2 variants)
5. **Muddler** (merge 2 variants)
6. **Wooden Stick** (merge 2 variants)

**Approach**:
- Create 1 canonical tool for each base type
- Store variant info in `notes` or `alternatives` field
- Map all variant IDs to single canonical tool_id

---

## 4. Risk Assessment

### 4.1 Data Integrity Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Loss of recipe-tool relationships | 🔴 HIGH | Use transaction, validate before commit |
| ID mapping errors | 🔴 HIGH | Create mapping table, verify all references |
| Usage count discrepancies | 🟡 MEDIUM | Recalculate from recipe_tools after migration |
| Image URL loss | 🟢 LOW | Copy image_urls or regenerate |
| Category misclassification | 🟡 MEDIUM | Manual review before migration |

### 4.2 Application Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `/tools` page breaks | 🔴 HIGH | Deploy action + page updates together |
| Search functionality breaks | 🟡 MEDIUM | Update search to query tools table |
| Analytics/tracking breaks | 🟢 LOW | Update analytics if tracking tool views |

### 4.3 Migration Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Migration script failure mid-process | 🔴 HIGH | Use database transaction, rollback on error |
| Production downtime | 🟡 MEDIUM | Run migration during low-traffic window |
| Foreign key constraint violations | 🟡 MEDIUM | Validate all recipe_ids exist before insert |

---

## 5. Recommended Migration Strategy

### 5.1 Migration Approach: **Automated Script with Manual Review**

**Rationale**:
- Dataset is small (31 tools, 65 references)
- Canonical mappings already defined
- Schema is ready and complete
- Low risk with proper transaction handling

### 5.2 Step-by-Step Migration Plan

#### Phase 1: Pre-Migration Preparation (30 minutes)

**Task 1.1**: Create ID mapping table
```sql
CREATE TABLE IF NOT EXISTS tool_id_migration_map (
  old_ingredient_id UUID PRIMARY KEY,
  new_tool_id UUID NOT NULL,
  canonical_name TEXT NOT NULL,
  variant TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Task 1.2**: Review and finalize tool categorization
- Manual review of 31 tools
- Assign `type` and `subtype` based on ontology
- Verify `category` mapping is correct

**Task 1.3**: Back up affected tables
```bash
pg_dump $DATABASE_URL \
  --table=ingredients \
  --table=recipe_ingredients \
  > backup_before_tool_migration_$(date +%Y%m%d).sql
```

#### Phase 2: Data Migration (Database Transaction)

**Task 2.1**: Create migration script (`scripts/migrate-tools-to-dedicated-table.ts`)

```typescript
import { db } from '../src/lib/db/index.js';
import { ingredients, recipeIngredients } from '../src/lib/db/ingredients-schema.js';
import { tools, recipeTools } from '../src/lib/db/schema.js';
import { sql } from 'drizzle-orm';

async function migrateTools() {
  await db.transaction(async (tx) => {
    // Step 1: Create tools and build ID map
    const idMap = new Map<string, string>();

    for (const toolData of TOOL_MIGRATION_DATA) {
      const newTool = await tx.insert(tools).values({
        name: toolData.name,
        display_name: toolData.display_name,
        category: toolData.category,
        type: toolData.type,
        subtype: toolData.subtype,
        is_essential: toolData.is_essential,
        description: toolData.description,
      }).returning();

      idMap.set(toolData.old_ingredient_id, newTool[0].id);
    }

    // Step 2: Migrate recipe_ingredients → recipe_tools
    const toolRecipeRefs = await tx
      .select()
      .from(recipeIngredients)
      .where(inArray(recipeIngredients.ingredient_id, TOOL_IDS));

    for (const ref of toolRecipeRefs) {
      const newToolId = idMap.get(ref.ingredient_id);

      await tx.insert(recipeTools).values({
        recipe_id: ref.recipe_id,
        tool_id: newToolId,
        quantity: parseQuantity(ref.amount),
        is_optional: ref.is_optional,
        notes: buildNotes(ref),
      });
    }

    // Step 3: Delete from recipe_ingredients
    await tx.delete(recipeIngredients)
      .where(inArray(recipeIngredients.ingredient_id, TOOL_IDS));

    // Step 4: Delete from ingredients
    await tx.delete(ingredients)
      .where(inArray(ingredients.id, TOOL_IDS));
  });
}
```

**Task 2.2**: Run migration with validation
```bash
# Dry run mode
pnpm tsx scripts/migrate-tools-to-dedicated-table.ts --dry-run

# Review output, verify counts

# Production run
pnpm tsx scripts/migrate-tools-to-dedicated-table.ts --production
```

**Task 2.3**: Verify migration success
```sql
-- Count checks
SELECT COUNT(*) FROM tools;  -- Should be ~25 (after deduplication)
SELECT COUNT(*) FROM recipe_tools;  -- Should be 65
SELECT COUNT(*) FROM recipe_ingredients
WHERE ingredient_id IN (...TOOL_IDS...);  -- Should be 0
```

#### Phase 3: Code Updates (Application Changes)

**Task 3.1**: Update `src/app/actions/tools.ts`

**Before** (lines 100-197):
```typescript
export async function getAllTools() {
  // Queries ingredients table with hardcoded TOOL_IDS
  const results = await db
    .select({...})
    .from(ingredients)
    .where(inArray(ingredients.id, TOOL_IDS));
}
```

**After**:
```typescript
export async function getAllTools() {
  // Query tools table with usage counts from recipe_tools
  const results = await db
    .select({
      id: tools.id,
      name: tools.name,
      displayName: tools.display_name,
      category: tools.category,
      type: tools.type,
      subtype: tools.subtype,
      isEssential: tools.is_essential,
    })
    .from(tools)
    .orderBy(tools.display_name);

  // Get usage counts
  const usageCounts = await db
    .select({
      toolId: recipeTools.tool_id,
      count: sql<number>`COUNT(*)`.as('count'),
    })
    .from(recipeTools)
    .groupBy(recipeTools.tool_id);

  // Merge results
  return results.map(tool => ({
    ...tool,
    usageCount: usageCounts.find(u => u.toolId === tool.id)?.count || 0,
  }));
}
```

**Task 3.2**: Remove hardcoded constants
- Delete `TOOL_IDS` array (lines 8-40)
- Delete `CANONICAL_TOOLS` mapping (lines 42-75) - now in database

**Task 3.3**: Update UI components
- `src/app/tools/page.tsx` - Update note on lines 21-22
- No other component changes needed (type-safe)

**Task 3.4**: Update scripts
- `scripts/analyze-ingredient-anomalies.ts` - Remove tool detection (no longer needed)
- `scripts/seed-common-ingredients-tools.ts` - Already correct ✅

#### Phase 4: Testing & Validation (1 hour)

**Task 4.1**: Unit tests
- Test `getAllTools()` returns correct data
- Test `getToolsByCanonical()` deduplication
- Verify usage counts match

**Task 4.2**: Integration tests
- Load `/tools` page
- Search for tools
- Sort by usage, alphabetical, canonical
- Verify all 25 tools display correctly

**Task 4.3**: Database consistency checks
```sql
-- Verify no orphaned recipe_tools
SELECT COUNT(*)
FROM recipe_tools rt
WHERE NOT EXISTS (SELECT 1 FROM tools t WHERE t.id = rt.tool_id);

-- Verify no orphaned recipes
SELECT COUNT(*)
FROM recipe_tools rt
WHERE NOT EXISTS (SELECT 1 FROM recipes r WHERE r.id = rt.recipe_id);

-- Verify usage counts
SELECT
  t.display_name,
  COUNT(rt.id) as usage_count
FROM tools t
LEFT JOIN recipe_tools rt ON t.id = rt.tool_id
GROUP BY t.id, t.display_name
ORDER BY usage_count DESC;
```

#### Phase 5: Deployment (30 minutes)

**Task 5.1**: Deploy to production
```bash
# Build and test
pnpm build
pnpm start

# Verify /tools page works

# Deploy to Vercel
git add .
git commit -m "feat: Migrate kitchen tools to dedicated table

- Migrate 31 tools from ingredients to tools table
- Move 65 recipe references to recipe_tools
- Update getAllTools() to query tools table
- Remove hardcoded TOOL_IDS constants
- Implement canonical tool deduplication

Migration completed successfully:
- 25 canonical tools created
- 65 recipe_tools relationships migrated
- Zero downtime migration"

git push origin main
```

**Task 5.2**: Monitor for errors
- Check Vercel logs
- Test `/tools` page in production
- Verify no 500 errors

**Task 5.3**: Clean up
- Archive migration script
- Update documentation
- Remove temporary migration table

---

## 6. Alternative Migration Approaches (Considered & Rejected)

### Approach A: Manual CSV Export/Import
**Rejected**: Too error-prone for maintaining relationships

### Approach B: Gradual Migration (Dual-Table Support)
**Rejected**: Added complexity, risk of data inconsistency

### Approach C: Zero-Downtime Blue-Green Migration
**Rejected**: Overkill for 31 records, added unnecessary complexity

---

## 7. Post-Migration Opportunities

### 7.1 Enhanced Tool Features

**Now Possible**:
1. **Tool Equipment Lists** - Generate "tools needed" for recipes
2. **Essential vs Specialized** - Filter recipes by tool availability
3. **Tool Substitutions** - Use `alternatives` field for suggestions
4. **Tool Price Estimation** - Sum `typical_price_usd` for shopping lists
5. **Ontology-Based Search** - Filter by `type`/`subtype` (e.g., "all bakeware")

### 7.2 Instruction Classification Integration

**Future Enhancement**:
- Link `instruction_metadata.tools` to `recipe_tools` table
- Validate instruction-detected tools against recipe_tools
- Auto-suggest tools based on instruction analysis

### 7.3 Meal Planning Tool Conflicts

**Future Enhancement** (from `src/lib/meal-planning/aggregator.ts`):
- Detect tool conflicts (e.g., multiple recipes need oven)
- Schedule recipes to avoid equipment conflicts
- Generate equipment checklists for meal prep

---

## 8. Migration Checklist

### Pre-Migration
- [ ] Review all 31 tools for correct categorization
- [ ] Assign `type` and `subtype` to each tool
- [ ] Create backup of `ingredients` and `recipe_ingredients` tables
- [ ] Create ID mapping table
- [ ] Write migration script with dry-run mode
- [ ] Test migration script on dev database

### Migration Day
- [ ] Announce maintenance window (if needed)
- [ ] Run migration script with transaction
- [ ] Verify tool count (should be ~25 after dedup)
- [ ] Verify recipe_tools count (should be 65)
- [ ] Verify no tools remain in ingredients table
- [ ] Run database consistency checks

### Post-Migration
- [ ] Update `src/app/actions/tools.ts`
- [ ] Remove hardcoded TOOL_IDS
- [ ] Update `/tools` page note
- [ ] Run unit tests
- [ ] Test `/tools` page functionality
- [ ] Deploy to production
- [ ] Monitor for errors
- [ ] Update documentation
- [ ] Archive migration script

---

## 9. Timeline Estimate

| Phase | Duration | Details |
|-------|----------|---------|
| **Preparation** | 1 hour | Review categorization, create mapping |
| **Script Development** | 2 hours | Write migration script with validation |
| **Testing** | 1 hour | Dry run, verify counts, test rollback |
| **Code Updates** | 2 hours | Rewrite actions, update UI |
| **Integration Testing** | 1 hour | Full app testing |
| **Deployment** | 30 minutes | Production deployment |
| **Monitoring** | 1 hour | Post-deploy verification |
| **TOTAL** | **8.5 hours** | Single developer, sequential work |

**Recommended Schedule**: 1 business day with testing buffer

---

## 10. Success Criteria

### Migration Success
- ✅ All 31 tools migrated to `tools` table
- ✅ ~25 canonical tools created (after deduplication)
- ✅ All 65 recipe_tools relationships migrated
- ✅ Zero orphaned records in any table
- ✅ Zero tools remaining in `ingredients` table

### Application Success
- ✅ `/tools` page loads without errors
- ✅ Tool search returns correct results
- ✅ Usage counts display accurately
- ✅ No regression in recipe display
- ✅ No production errors in logs

### Code Quality Success
- ✅ No hardcoded tool IDs
- ✅ Type-safe queries using Drizzle ORM
- ✅ Proper error handling
- ✅ Migration script is idempotent (can be re-run safely)

---

## 11. Rollback Plan

**If migration fails**:

1. **Stop migration immediately**
   ```sql
   ROLLBACK;  -- If still in transaction
   ```

2. **Restore from backup**
   ```bash
   psql $DATABASE_URL < backup_before_tool_migration_YYYYMMDD.sql
   ```

3. **Revert code changes**
   ```bash
   git revert HEAD
   git push origin main
   ```

4. **Investigate failure**
   - Check migration logs
   - Identify error cause
   - Fix and retry

---

## 12. Conclusion

The migration from `ingredients` to dedicated `tools` table is:

- **READY**: Schema is complete, no changes needed
- **FEASIBLE**: Small dataset (31 tools, 65 references)
- **LOW RISK**: Transaction-based, easily reversible
- **HIGH VALUE**: Enables tool-specific features, cleaner data model

**Recommendation**: ✅ **PROCEED WITH MIGRATION**

**Next Steps**:
1. Schedule 1-day migration sprint
2. Assign engineer to implement script
3. Conduct dry-run on staging database
4. Execute production migration during low-traffic window
5. Monitor for 24 hours post-migration

---

**Document Version**: 1.0
**Last Updated**: 2025-10-22
**Prepared By**: Research Agent
**Review Status**: Pending Engineering Review
