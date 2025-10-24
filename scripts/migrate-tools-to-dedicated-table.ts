#!/usr/bin/env tsx
/**
 * Kitchen Tools Migration Script
 *
 * Migrates 31 kitchen tools from the `ingredients` table to the dedicated `tools` table.
 * Moves 65 recipe references from `recipe_ingredients` to `recipe_tools`.
 *
 * USAGE:
 *   # Dry run (default - shows what would be migrated)
 *   pnpm tsx scripts/migrate-tools-to-dedicated-table.ts
 *
 *   # Apply changes (production mode)
 *   APPLY_CHANGES=true pnpm tsx scripts/migrate-tools-to-dedicated-table.ts
 *
 * SAFETY:
 *   - Entire migration runs in a database transaction
 *   - Rolls back automatically on any error
 *   - Dry-run mode by default
 *   - Comprehensive validation checks
 *
 * @see docs/reference/KITCHEN_TOOLS_MIGRATION_ANALYSIS.md
 */

import { db, cleanup } from './db-with-transactions.js';
import { ingredients, recipeIngredients } from '../src/lib/db/ingredients-schema.js';
import { tools, recipeTools } from '../src/lib/db/schema.js';
import { eq, inArray, sql } from 'drizzle-orm';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DRY_RUN = process.env.APPLY_CHANGES !== 'true';

// Tool IDs from the analysis (31 tools currently in ingredients table)
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

// Canonical tool mapping for deduplication
interface CanonicalMapping {
  canonical: string;
  variant: string;
  category: string;
  type?: string;
  subtype?: string;
  is_essential?: boolean;
  is_specialized?: boolean;
  description?: string;
}

const CANONICAL_TOOLS: Record<string, CanonicalMapping> = {
  'bf4491e6-e3ad-4bd1-9b7b-39ef4f2d7473': {
    canonical: 'skewer',
    variant: 'Standard',
    category: 'utensils',
    type: 'CUTTING_PREP',
    subtype: 'prep_skewers',
    is_essential: true,
  },
  'ac46cc71-0d63-4076-96bc-d53261c68e2a': {
    canonical: 'skewer',
    variant: 'Bamboo',
    category: 'utensils',
    type: 'CUTTING_PREP',
    subtype: 'prep_skewers',
    is_essential: true,
  },
  '21644114-5795-491c-992e-6bf46ac13f7b': {
    canonical: 'thermometer',
    variant: 'Standard',
    category: 'measuring',
    type: 'MIXING_MEASURING',
    subtype: 'measuring_thermometer',
    is_essential: true,
  },
  '601c5898-e2dc-4f4d-8823-012599b27e31': {
    canonical: 'thermometer',
    variant: 'Deep-Fat',
    category: 'measuring',
    type: 'MIXING_MEASURING',
    subtype: 'measuring_thermometer',
    is_specialized: true,
  },
  'd60e504a-1412-424e-af29-98c9e2e1578f': {
    canonical: 'cookie-cutter',
    variant: 'Star',
    category: 'bakeware',
    type: 'CUTTING_PREP',
    subtype: 'prep_cutters',
    is_specialized: true,
  },
  '1519b8c7-7d9d-4661-90ed-fb851e1dad78': {
    canonical: 'cardboard-round',
    variant: 'Standard',
    category: 'bakeware',
    type: 'STORAGE_SERVING',
    subtype: 'serving_platters',
    is_specialized: true,
  },
  'a86979ca-295d-4a6e-9d74-6137b35f46c3': {
    canonical: 'lamb-rack',
    variant: 'Standard',
    category: 'cookware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_roasting',
    is_specialized: true,
  },
  '1310abfe-1cad-4618-871d-3d9c1400a9a0': {
    canonical: 'spatula',
    variant: 'Rubber',
    category: 'utensils',
    type: 'CUTTING_PREP',
    subtype: 'prep_spatulas',
    is_essential: true,
  },
  '7d16e6c8-bc34-4e7e-86a1-8b228f52cd95': {
    canonical: 'oven-roasting-bag',
    variant: 'Standard',
    category: 'cookware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_roasting',
    is_specialized: true,
  },
  '10637dd2-d9d6-4a1b-9c0c-1873c40da26d': {
    canonical: 'oven-roasting-bag',
    variant: 'Standard',
    category: 'cookware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_roasting',
    is_specialized: true,
  },
  '1e415be0-9d94-422c-8c7e-a7e036e8259c': {
    canonical: 'nonstick-cooking-spray',
    variant: 'Standard',
    category: 'other',
    type: 'PANTRY_STAPLES',
    subtype: 'pantry_oils',
    is_essential: true,
  },
  '6c3db2ec-56f1-44e7-b31f-9f75f83a1c0a': {
    canonical: 'nonstick-cooking-spray',
    variant: 'Vegetable Oil',
    category: 'other',
    type: 'PANTRY_STAPLES',
    subtype: 'pantry_oils',
    is_essential: true,
  },
  'bb5e796c-9bc7-4e7b-bc29-a276daa48e51': {
    canonical: 'measuring-spoon',
    variant: 'Singular',
    category: 'measuring',
    type: 'MIXING_MEASURING',
    subtype: 'measuring_spoons',
    is_essential: true,
  },
  'ac2374d5-3d07-479c-8393-0c71f0c47a5b': {
    canonical: 'measuring-spoon',
    variant: 'Plural',
    category: 'measuring',
    type: 'MIXING_MEASURING',
    subtype: 'measuring_spoons',
    is_essential: true,
  },
  '9f7b5dad-4fdd-4f5f-ba55-9c1cf5a962f3': {
    canonical: 'muddler',
    variant: 'Singular',
    category: 'utensils',
    type: 'MIXING_MEASURING',
    subtype: 'mixing_whisks',
    is_specialized: true,
  },
  '46cceb69-677a-4ef8-aace-32b8b1561d7a': {
    canonical: 'muddler',
    variant: 'Plural',
    category: 'utensils',
    type: 'MIXING_MEASURING',
    subtype: 'mixing_whisks',
    is_specialized: true,
  },
  '6b4ebbbf-9b80-4238-a619-42075377ad74': {
    canonical: 'muffin-liners',
    variant: 'Mini',
    category: 'bakeware',
    type: 'CUTTING_PREP',
    subtype: 'prep_other',
    is_essential: false,
  },
  '302d198d-f196-4ba5-a3f1-fd80b3218d9c': {
    canonical: 'storage-tub',
    variant: 'Plastic',
    category: 'serving',
    type: 'STORAGE_SERVING',
    subtype: 'storage_containers',
    is_essential: true,
  },
  '0c4d1a87-f4c7-452e-aea4-9167b4d40025': {
    canonical: 'tongs',
    variant: 'Long Metal',
    category: 'utensils',
    type: 'CUTTING_PREP',
    subtype: 'prep_tongs',
    is_essential: true,
  },
  '1216513e-b7b9-401e-8257-8341b2a77858': {
    canonical: 'wooden-stick',
    variant: 'Singular',
    category: 'utensils',
    type: 'CUTTING_PREP',
    subtype: 'prep_skewers',
    is_essential: false,
  },
  '5a23f573-b6ce-4240-bacb-6d0d836285c7': {
    canonical: 'wooden-stick',
    variant: 'Plural',
    category: 'utensils',
    type: 'CUTTING_PREP',
    subtype: 'prep_skewers',
    is_essential: false,
  },
  '2bdaa2f2-82ae-45ab-a3f2-1efbb98097fb': {
    canonical: 'ramekin',
    variant: 'Plural or Custard Cups',
    category: 'bakeware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_baking',
    is_essential: true,
  },
  '540a29c5-1792-4dd9-8859-73cb89812c76': {
    canonical: 'ramekin',
    variant: 'Singular',
    category: 'bakeware',
    type: 'COOKING_VESSELS',
    subtype: 'cooking_baking',
    is_essential: true,
  },
  '5c1d3bf1-4994-410f-bb8a-c45b80c4567c': {
    canonical: 'melon-ball-cutter',
    variant: 'Standard',
    category: 'utensils',
    type: 'CUTTING_PREP',
    subtype: 'prep_cutters',
    is_specialized: true,
  },
  '763ad899-1991-43d7-8a1f-05806c6044da': {
    canonical: 'spice-grinder',
    variant: 'Standard',
    category: 'appliances',
    type: 'HEAT_POWER',
    subtype: 'power_processors',
    is_specialized: true,
  },
  '3978a9c3-c8e0-4377-8512-09cd2312b06a': {
    canonical: 'wooden-spoon',
    variant: 'Standard',
    category: 'utensils',
    type: 'MIXING_MEASURING',
    subtype: 'mixing_spoons',
    is_essential: true,
  },
  'f2d67c0f-4f4e-49ca-b978-d0c855dea7b4': {
    canonical: 'ice-pop-molds',
    variant: 'Standard',
    category: 'bakeware',
    type: 'STORAGE_SERVING',
    subtype: 'storage_containers',
    is_specialized: true,
  },
  'bfa74904-f337-44ed-8756-a6c623bd69e8': {
    canonical: 'wooden-ice-pop-sticks',
    variant: 'Standard',
    category: 'utensils',
    type: 'CUTTING_PREP',
    subtype: 'prep_skewers',
    is_specialized: true,
  },
  'b1a5651c-8ca8-4a64-b522-117a9df74c9b': {
    canonical: 'pastry-bag',
    variant: 'Standard',
    category: 'bakeware',
    type: 'CUTTING_PREP',
    subtype: 'prep_other',
    is_specialized: true,
  },
  '630bb14d-39c6-4f73-ab18-3896baa6010e': {
    canonical: 'cake-stand',
    variant: '11-Inch Revolving',
    category: 'serving',
    type: 'STORAGE_SERVING',
    subtype: 'serving_platters',
    is_specialized: true,
  },
  'aef3b08c-8c37-4661-b1f8-ad48701988c9': {
    canonical: 'wooden-dowels',
    variant: 'Standard',
    category: 'bakeware',
    type: 'CUTTING_PREP',
    subtype: 'prep_other',
    is_specialized: true,
  },
};

// ============================================================================
// TYPES
// ============================================================================

interface MigrationStats {
  toolsFound: number;
  recipeReferencesFound: number;
  canonicalToolsCreated: number;
  duplicatesConsolidated: number;
  recipeToolsMigrated: number;
  toolsDeleted: number;
  recipeIngredientsDeleted: number;
}

interface ValidationResult {
  success: boolean;
  errors: string[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse quantity from amount string (e.g., "2", "1/2", "1-2")
 * Returns integer or 1 as default
 */
function parseQuantity(amount: string | null): number {
  if (!amount) return 1;

  // Handle fractions (e.g., "1/2" -> 1, "3/4" -> 1)
  if (amount.includes('/')) {
    return 1;
  }

  // Handle ranges (e.g., "1-2" -> 1, "8-10" -> 8)
  if (amount.includes('-')) {
    const parts = amount.split('-');
    const first = parseInt(parts[0], 10);
    return isNaN(first) ? 1 : first;
  }

  // Handle standard numbers
  const parsed = parseInt(amount, 10);
  return isNaN(parsed) ? 1 : parsed;
}

/**
 * Build notes from recipe_ingredients fields
 */
function buildNotes(recipeIngredient: any): string | null {
  const notes: string[] = [];

  if (recipeIngredient.unit) {
    notes.push(recipeIngredient.unit);
  }

  if (recipeIngredient.preparation) {
    notes.push(recipeIngredient.preparation);
  }

  return notes.length > 0 ? notes.join(', ') : null;
}

/**
 * Convert display name to slug format
 */
function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Capitalize each word
 */
function toDisplayName(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Log with emoji prefixes
 */
function logSection(emoji: string, title: string) {
  console.log(`\n${emoji} ${title}`);
  console.log('━'.repeat(80));
}

function logSuccess(message: string) {
  console.log(`  ✅ ${message}`);
}

function logInfo(message: string) {
  console.log(`  ℹ️  ${message}`);
}

function logWarning(message: string) {
  console.log(`  ⚠️  ${message}`);
}

function logError(message: string) {
  console.error(`  ❌ ${message}`);
}

// ============================================================================
// MIGRATION LOGIC
// ============================================================================

/**
 * Main migration function
 */
async function migrateTools(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    toolsFound: 0,
    recipeReferencesFound: 0,
    canonicalToolsCreated: 0,
    duplicatesConsolidated: 0,
    recipeToolsMigrated: 0,
    toolsDeleted: 0,
    recipeIngredientsDeleted: 0,
  };

  // Use transaction for safety
  await db.transaction(async (tx) => {
    // ========================================================================
    // PHASE 1: Fetch Tools from Ingredients Table
    // ========================================================================

    logSection('🔍', 'Phase 1: Fetching Tools from Ingredients Table');

    const toolsFromIngredients = await tx
      .select({
        id: ingredients.id,
        name: ingredients.name,
        display_name: ingredients.display_name,
        category: ingredients.category,
        image_url: ingredients.image_url,
        description: ingredients.description,
      })
      .from(ingredients)
      .where(inArray(ingredients.id, TOOL_IDS));

    stats.toolsFound = toolsFromIngredients.length;
    logSuccess(`Found ${stats.toolsFound} tools in ingredients table`);

    if (stats.toolsFound !== TOOL_IDS.length) {
      logWarning(`Expected ${TOOL_IDS.length} tools, found ${stats.toolsFound}`);
    }

    // ========================================================================
    // PHASE 2: Create Canonical Tools & Build ID Mapping
    // ========================================================================

    logSection('🔧', 'Phase 2: Creating Canonical Tools');

    // Group by canonical name
    const canonicalGroups = new Map<string, typeof toolsFromIngredients>();

    for (const tool of toolsFromIngredients) {
      const mapping = CANONICAL_TOOLS[tool.id];
      if (!mapping) {
        logWarning(`No canonical mapping for tool: ${tool.display_name} (${tool.id})`);
        continue;
      }

      const canonical = mapping.canonical;
      if (!canonicalGroups.has(canonical)) {
        canonicalGroups.set(canonical, []);
      }
      canonicalGroups.get(canonical)!.push(tool);
    }

    logInfo(`Grouped ${toolsFromIngredients.length} tools into ${canonicalGroups.size} canonical tools`);
    stats.duplicatesConsolidated = stats.toolsFound - canonicalGroups.size;
    logSuccess(`Consolidated ${stats.duplicatesConsolidated} duplicate variants`);

    // Create canonical tools and build ID mapping
    const idMapping = new Map<string, string>(); // old_ingredient_id -> new_tool_id

    for (const [canonicalName, variants] of canonicalGroups.entries()) {
      // Use the first variant as the base
      const baseVariant = variants[0];
      const mapping = CANONICAL_TOOLS[baseVariant.id];

      if (!mapping) continue;

      const displayName = toDisplayName(canonicalName);

      logInfo(`Creating tool: ${displayName} (${variants.length} variants)`);

      if (DRY_RUN) {
        // Generate fake UUID for dry run
        const fakeUuid = `NEW-TOOL-${canonicalName}`;
        for (const variant of variants) {
          idMapping.set(variant.id, fakeUuid);
        }
        stats.canonicalToolsCreated++;
      } else {
        // Create the tool
        const [newTool] = await tx
          .insert(tools)
          .values({
            name: canonicalName,
            display_name: displayName,
            category: mapping.category as any,
            type: mapping.type || null,
            subtype: mapping.subtype || null,
            is_essential: mapping.is_essential || false,
            is_specialized: mapping.is_specialized || false,
            description: mapping.description || baseVariant.description || null,
            alternatives: variants.length > 1
              ? JSON.stringify(variants.map(v => v.display_name))
              : null,
          })
          .returning();

        // Map all variant IDs to this canonical tool ID
        for (const variant of variants) {
          idMapping.set(variant.id, newTool.id);
        }

        stats.canonicalToolsCreated++;
      }
    }

    logSuccess(`Created ${stats.canonicalToolsCreated} canonical tools`);
    logInfo(`ID mapping: ${idMapping.size} old IDs -> ${stats.canonicalToolsCreated} new IDs`);

    // ========================================================================
    // PHASE 3: Migrate recipe_ingredients to recipe_tools
    // ========================================================================

    logSection('📋', 'Phase 3: Migrating Recipe References');

    const toolRecipeRefs = await tx
      .select()
      .from(recipeIngredients)
      .where(inArray(recipeIngredients.ingredient_id, TOOL_IDS));

    stats.recipeReferencesFound = toolRecipeRefs.length;
    logSuccess(`Found ${stats.recipeReferencesFound} recipe_ingredients entries referencing tools`);

    for (const ref of toolRecipeRefs) {
      const newToolId = idMapping.get(ref.ingredient_id);

      if (!newToolId) {
        logError(`No mapping found for ingredient_id: ${ref.ingredient_id}`);
        throw new Error(`Migration failed: Missing ID mapping for ${ref.ingredient_id}`);
      }

      const quantity = parseQuantity(ref.amount);
      const notes = buildNotes(ref);

      if (DRY_RUN) {
        // Just count
        stats.recipeToolsMigrated++;
      } else {
        await tx.insert(recipeTools).values({
          recipe_id: ref.recipe_id,
          tool_id: newToolId,
          quantity,
          is_optional: ref.is_optional,
          notes,
        });

        stats.recipeToolsMigrated++;
      }
    }

    logSuccess(`Migrated ${stats.recipeToolsMigrated} recipe_tools entries`);

    // ========================================================================
    // PHASE 4: Cleanup - Delete from recipe_ingredients
    // ========================================================================

    logSection('🧹', 'Phase 4: Cleanup - Delete Tool References from recipe_ingredients');

    if (DRY_RUN) {
      logInfo(`Would delete ${stats.recipeReferencesFound} entries from recipe_ingredients`);
      stats.recipeIngredientsDeleted = stats.recipeReferencesFound;
    } else {
      const deleteResult = await tx
        .delete(recipeIngredients)
        .where(inArray(recipeIngredients.ingredient_id, TOOL_IDS));

      stats.recipeIngredientsDeleted = stats.recipeReferencesFound;
      logSuccess(`Deleted ${stats.recipeIngredientsDeleted} tool entries from recipe_ingredients`);
    }

    // ========================================================================
    // PHASE 5: Cleanup - Delete Tools from ingredients
    // ========================================================================

    logSection('🧹', 'Phase 5: Cleanup - Delete Tools from ingredients');

    if (DRY_RUN) {
      logInfo(`Would delete ${stats.toolsFound} entries from ingredients`);
      stats.toolsDeleted = stats.toolsFound;
    } else {
      const deleteResult = await tx
        .delete(ingredients)
        .where(inArray(ingredients.id, TOOL_IDS));

      stats.toolsDeleted = stats.toolsFound;
      logSuccess(`Deleted ${stats.toolsDeleted} tools from ingredients table`);
    }

    if (DRY_RUN) {
      logWarning('DRY RUN MODE - No changes were made to the database');
      throw new Error('DRY_RUN_ROLLBACK'); // Rollback transaction
    }
  }).catch((error) => {
    if (error.message === 'DRY_RUN_ROLLBACK') {
      // Expected in dry-run mode
      return;
    }
    throw error; // Re-throw actual errors
  });

  return stats;
}

/**
 * Validation checks after migration
 */
async function validateMigration(): Promise<ValidationResult> {
  const errors: string[] = [];

  logSection('✅', 'Validation: Checking Migration Success');

  // Check 1: Tools table count
  const toolsCount = await db.select({ count: sql<number>`COUNT(*)` }).from(tools);
  const toolsTotal = Number(toolsCount[0]?.count || 0);

  if (toolsTotal === 0) {
    errors.push('Tools table is empty (expected ~25 tools)');
    logError(`Tools table: ${toolsTotal} entries (expected ~25)`);
  } else {
    logSuccess(`Tools table: ${toolsTotal} entries`);
  }

  // Check 2: Recipe tools count
  const recipeToolsCount = await db.select({ count: sql<number>`COUNT(*)` }).from(recipeTools);
  const recipeToolsTotal = Number(recipeToolsCount[0]?.count || 0);

  if (recipeToolsTotal === 0 && !DRY_RUN) {
    errors.push('Recipe_tools table is empty (expected 65 entries)');
    logError(`Recipe_tools table: ${recipeToolsTotal} entries (expected 65)`);
  } else {
    logSuccess(`Recipe_tools table: ${recipeToolsTotal} entries`);
  }

  // Check 3: No remaining tools in ingredients
  const remainingTools = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(ingredients)
    .where(inArray(ingredients.id, TOOL_IDS));
  const remainingCount = Number(remainingTools[0]?.count || 0);

  if (remainingCount > 0) {
    errors.push(`${remainingCount} tools still in ingredients table`);
    logError(`Remaining tools in ingredients: ${remainingCount} (expected 0)`);
  } else {
    logSuccess(`Remaining tools in ingredients: ${remainingCount} (expected 0)`);
  }

  // Check 4: No orphaned recipe_tools
  if (!DRY_RUN) {
    const orphanedRecipeTools = await db.execute(sql`
      SELECT COUNT(*)
      FROM recipe_tools rt
      WHERE NOT EXISTS (SELECT 1 FROM tools t WHERE t.id = rt.tool_id)
    `);
    const orphanedCount = Number(orphanedRecipeTools.rows[0]?.count || 0);

    if (orphanedCount > 0) {
      errors.push(`${orphanedCount} orphaned recipe_tools entries`);
      logError(`Orphaned recipe_tools: ${orphanedCount} (expected 0)`);
    } else {
      logSuccess(`Orphaned recipe_tools: ${orphanedCount} (expected 0)`);
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

/**
 * Print migration report
 */
function printReport(stats: MigrationStats, validation: ValidationResult) {
  console.log('\n');
  console.log('━'.repeat(80));
  console.log('🔧 Kitchen Tools Migration Report');
  console.log('━'.repeat(80));
  console.log('');

  console.log('Phase 1: Tool Migration');
  console.log(`  ✅ ${stats.toolsFound} tools migrated to tools table`);
  console.log(`  ✅ ${stats.duplicatesConsolidated} duplicate variants consolidated`);
  console.log(`  ✅ ${stats.canonicalToolsCreated} canonical tools created`);
  console.log('');

  console.log('Phase 2: Recipe References');
  console.log(`  ✅ ${stats.recipeReferencesFound} recipe_ingredients found`);
  console.log(`  ✅ ${stats.recipeToolsMigrated} recipe_tools entries created`);
  console.log('');

  console.log('Phase 3: Cleanup');
  console.log(`  ✅ ${stats.recipeIngredientsDeleted} tool entries removed from recipe_ingredients`);
  console.log(`  ✅ ${stats.toolsDeleted} tools removed from ingredients table`);
  console.log('');

  console.log('Validation:');
  if (validation.success) {
    console.log('  ✅ All validation checks passed!');
  } else {
    console.log('  ❌ Validation errors:');
    validation.errors.forEach(error => console.log(`     - ${error}`));
  }
  console.log('');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes were made to the database');
    console.log('   Run with APPLY_CHANGES=true to execute migration');
  } else {
    console.log('✨ Migration complete!');
  }

  console.log('━'.repeat(80));
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    console.log('🚀 Kitchen Tools Migration Script');
    console.log('━'.repeat(80));

    if (DRY_RUN) {
      logWarning('Running in DRY RUN mode - no changes will be made');
      logInfo('Set APPLY_CHANGES=true to execute migration');
    } else {
      logWarning('Running in PRODUCTION mode - changes will be applied!');
    }

    // Run migration
    const stats = await migrateTools();

    // Validate results
    const validation = await validateMigration();

    // Print report
    printReport(stats, validation);

    // Exit with appropriate code
    if (!validation.success && !DRY_RUN) {
      console.error('\n❌ Migration completed with errors');
      await cleanup();
      process.exit(1);
    }

    console.log('\n✅ Script completed successfully');
    await cleanup();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed with error:');
    console.error(error);
    console.error('\nℹ️  Database transaction was rolled back - no changes were made');
    await cleanup();
    process.exit(1);
  }
}

// Run the migration
main();
