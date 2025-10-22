/**
 * Fix Critical Ingredient Quality Issues
 *
 * Quick fixes before image generation:
 * 1. Rename vague ingredients
 * 2. Add is_suitable_for_image column
 * 3. Mark unsuitable ingredients
 * 4. Fix brand name
 *
 * Estimated runtime: 30 seconds
 */

import { eq, or, sql } from 'drizzle-orm';
import { boolean } from 'drizzle-orm/pg-core';
import { db, cleanup } from './db-with-transactions';
import { ingredients, recipeIngredients } from '../src/lib/db/ingredients-schema';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Vague ingredients to rename
const VAGUE_RENAMES = [
  { old: 'spices', new: 'pickling spices', display: 'Pickling Spices' },
  { old: 'seasoning', new: 'italian seasoning', display: 'Italian Seasoning' },
  { old: 'sauce', new: 'ancho chile sauce', display: 'Ancho Chile Sauce' },
  { old: 'vegetable', new: 'mixed vegetables', display: 'Mixed Vegetables' },
  { old: 'oil', new: 'cooking oil', display: 'Cooking Oil' },
];

// Brand name fix
const BRAND_FIXES = [
  {
    old: 'kraft macaroni and cheese',
    new: 'boxed macaroni and cheese',
    display: 'Boxed Macaroni and Cheese',
  },
];

// Ingredients unsuitable for image generation
const UNSUITABLE_PATTERNS = [
  // Abstract/Generic
  'to taste',
  'as needed',
  'optional',
  'for serving',
  'for garnish',
  'for dusting',

  // Too generic (but keep if they have modifiers)
  'powder',
  'liquid',
  'ingredient',
  'mixture',

  // Measurement-only phrases
  'pinch',
  'dash',
];

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

/**
 * Step 1: Rename or consolidate vague ingredients
 * If target name already exists, consolidate (merge) instead of rename
 */
async function renameVagueIngredients(): Promise<number> {
  console.log('📝 Step 1: Renaming/consolidating vague ingredients...');

  let renamedCount = 0;
  let consolidatedCount = 0;

  for (const rename of VAGUE_RENAMES) {
    // Check if source ingredient exists
    const sourceIngredient = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.name, rename.old))
      .limit(1);

    if (sourceIngredient.length === 0) {
      console.log(`   ℹ️  "${rename.old}" not found, skipping`);
      continue;
    }

    // Check if target name already exists
    const targetIngredient = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.name, rename.new))
      .limit(1);

    if (targetIngredient.length > 0) {
      // Target exists → CONSOLIDATE (merge source into target)
      console.log(`   🔄 "${rename.old}" → "${rename.new}" (target exists, consolidating...)`);

      const sourceId = sourceIngredient[0].id;
      const targetId = targetIngredient[0].id;

      try {
        await db.transaction(async (tx) => {
          // Update all recipe_ingredients to point to target
          const updateResult = await tx
            .update(recipeIngredients)
            .set({ ingredient_id: targetId })
            .where(eq(recipeIngredients.ingredient_id, sourceId));

          // Delete source ingredient
          await tx
            .delete(ingredients)
            .where(eq(ingredients.id, sourceId));

          console.log(`      ✓ Consolidated "${rename.old}" into "${rename.new}"`);
          consolidatedCount++;
        });
      } catch (error) {
        console.error(`      ❌ Failed to consolidate "${rename.old}":`, error);
        throw error;
      }
    } else {
      // Target doesn't exist → RENAME (simple update)
      await db
        .update(ingredients)
        .set({
          name: rename.new,
          display_name: rename.display,
          updated_at: new Date(),
        })
        .where(eq(ingredients.name, rename.old));

      console.log(`   ✓ Renamed "${rename.old}" → "${rename.new}"`);
      renamedCount++;
    }
  }

  console.log(`\n   Summary: ${renamedCount} renamed, ${consolidatedCount} consolidated`);
  return renamedCount + consolidatedCount;
}

/**
 * Step 2: Fix brand names (with consolidation support)
 */
async function fixBrandNames(): Promise<number> {
  console.log('\n🏷️  Step 2: Fixing brand names...');

  let renamedCount = 0;
  let consolidatedCount = 0;

  for (const fix of BRAND_FIXES) {
    // Check if source ingredient exists
    const sourceIngredient = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.name, fix.old))
      .limit(1);

    if (sourceIngredient.length === 0) {
      console.log(`   ℹ️  "${fix.old}" not found, skipping`);
      continue;
    }

    // Check if target name already exists
    const targetIngredient = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.name, fix.new))
      .limit(1);

    if (targetIngredient.length > 0) {
      // Target exists → CONSOLIDATE
      console.log(`   🔄 "${fix.old}" → "${fix.new}" (target exists, consolidating...)`);

      const sourceId = sourceIngredient[0].id;
      const targetId = targetIngredient[0].id;

      try {
        await db.transaction(async (tx) => {
          // Update all recipe_ingredients to point to target
          await tx
            .update(recipeIngredients)
            .set({ ingredient_id: targetId })
            .where(eq(recipeIngredients.ingredient_id, sourceId));

          // Delete source ingredient
          await tx
            .delete(ingredients)
            .where(eq(ingredients.id, sourceId));

          console.log(`      ✓ Consolidated "${fix.old}" into "${fix.new}"`);
          consolidatedCount++;
        });
      } catch (error) {
        console.error(`      ❌ Failed to consolidate "${fix.old}":`, error);
        throw error;
      }
    } else {
      // Target doesn't exist → RENAME
      await db
        .update(ingredients)
        .set({
          name: fix.new,
          display_name: fix.display,
          updated_at: new Date(),
        })
        .where(eq(ingredients.name, fix.old));

      console.log(`   ✓ Fixed "${fix.old}" → "${fix.new}"`);
      renamedCount++;
    }
  }

  console.log(`\n   Summary: ${renamedCount} renamed, ${consolidatedCount} consolidated`);
  return renamedCount + consolidatedCount;
}

/**
 * Step 3: Add is_suitable_for_image column
 * Note: This uses raw SQL since Drizzle schema might not have this column yet
 */
async function addImageSuitabilityColumn(): Promise<void> {
  console.log('\n🗂️  Step 3: Adding is_suitable_for_image column...');

  try {
    // Check if column exists
    const checkColumn = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ingredients'
      AND column_name = 'is_suitable_for_image'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('   ℹ️  Column already exists, skipping creation');
      return;
    }

    // Add column with default true
    await db.execute(sql`
      ALTER TABLE ingredients
      ADD COLUMN is_suitable_for_image BOOLEAN DEFAULT true
    `);

    console.log('   ✓ Added is_suitable_for_image column (default: true)');
  } catch (error) {
    console.error('   ❌ Error adding column:', error);
    throw error;
  }
}

/**
 * Step 4: Mark unsuitable ingredients
 */
async function markUnsuitableIngredients(): Promise<number> {
  console.log('\n🚫 Step 4: Marking unsuitable ingredients...');

  let totalMarked = 0;

  // Mark ingredients matching unsuitable patterns
  for (const pattern of UNSUITABLE_PATTERNS) {
    const result = await db.execute(sql`
      UPDATE ingredients
      SET is_suitable_for_image = false,
          updated_at = NOW()
      WHERE name ILIKE ${`%${pattern}%`}
      AND is_suitable_for_image = true
    `);

    const count = result.rowCount || 0;
    if (count > 0) {
      console.log(`   ✓ Marked ${count} ingredients matching "${pattern}"`);
      totalMarked += count;
    }
  }

  // Also mark very generic single-word ingredients
  const genericWords = ['spice', 'herb', 'fat', 'salt', 'pepper'];

  for (const word of genericWords) {
    const result = await db.execute(sql`
      UPDATE ingredients
      SET is_suitable_for_image = false,
          updated_at = NOW()
      WHERE name = ${word}
      AND is_suitable_for_image = true
    `);

    const count = result.rowCount || 0;
    if (count > 0) {
      console.log(`   ✓ Marked "${word}" as unsuitable`);
      totalMarked += count;
    }
  }

  return totalMarked;
}

/**
 * Step 5: Verification - check results
 */
async function verifyChanges(): Promise<void> {
  console.log('\n✅ Step 5: Verifying changes...\n');

  // Check renamed ingredients
  console.log('Renamed Ingredients:');
  for (const rename of [...VAGUE_RENAMES, ...BRAND_FIXES]) {
    const result = await db
      .select({
        name: ingredients.name,
        display_name: ingredients.display_name,
      })
      .from(ingredients)
      .where(eq(ingredients.name, rename.new));

    if (result.length > 0) {
      console.log(`   ✓ "${result[0].name}" → "${result[0].display_name}"`);
    } else {
      console.log(`   ⚠️  "${rename.new}" not found (might not exist)`);
    }
  }

  // Check unsuitable count
  const unsuitableCount = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM ingredients
    WHERE is_suitable_for_image = false
  `);

  console.log(`\nUnsuitable Ingredients: ${unsuitableCount.rows[0]?.count || 0}`);

  // Check image-ready count
  const readyCount = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM ingredients
    WHERE is_suitable_for_image = true
    AND (image_url IS NULL OR image_url = '')
  `);

  console.log(`Image-Ready Ingredients: ${readyCount.rows[0]?.count || 0}`);

  // Sample unsuitable ingredients
  const sampleUnsuitable = await db.execute(sql`
    SELECT name, display_name, category
    FROM ingredients
    WHERE is_suitable_for_image = false
    LIMIT 10
  `);

  console.log('\nSample Unsuitable Ingredients:');
  for (const row of sampleUnsuitable.rows) {
    console.log(`   - ${row.name} [${row.category}]`);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🚀 Starting ingredient quality fixes...\n');
  console.log('This will:');
  console.log('  1. Rename 5 vague ingredients');
  console.log('  2. Fix 1 brand name');
  console.log('  3. Add is_suitable_for_image column');
  console.log('  4. Mark ~250 unsuitable ingredients');
  console.log('  5. Verify all changes\n');
  console.log('Estimated time: 30 seconds\n');
  console.log('=' .repeat(80) + '\n');

  try {
    // Execute all fixes
    const renamedCount = await renameVagueIngredients();
    const brandFixCount = await fixBrandNames();
    await addImageSuitabilityColumn();
    const unsuitableCount = await markUnsuitableIngredients();
    await verifyChanges();

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`  ✅ Renamed ${renamedCount} vague ingredients`);
    console.log(`  ✅ Fixed ${brandFixCount} brand names`);
    console.log(`  ✅ Added is_suitable_for_image column`);
    console.log(`  ✅ Marked ${unsuitableCount} unsuitable ingredients`);
    console.log('\n🎉 All fixes completed successfully!');
    console.log('\n✨ Database is now ready for image generation.');
    console.log('=' .repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Fix failed:', error);
    throw error;
  } finally {
    await cleanup();
  }
}

main();
