#!/usr/bin/env tsx

/**
 * Add is_purchaseable Field to Ingredients Table
 *
 * This script adds the is_purchaseable column to the ingredients table
 * and marks non-purchaseable items (water, ice) as false.
 *
 * Phase 2 of shopping list improvements - filters out items that cannot
 * be purchased (ambient water, ice from tap).
 *
 * Run with:
 *   pnpm tsx scripts/add-purchaseable-field.ts              # Dry run (preview only)
 *   APPLY_CHANGES=true pnpm tsx scripts/add-purchaseable-field.ts  # Live mode
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

/**
 * Non-purchaseable items that should be filtered from shopping lists
 * These are ambient/utility items that users already have access to
 */
const NON_PURCHASEABLE_ITEMS = [
  // Water variations
  'water',
  'tap water',
  'cold water',
  'hot water',
  'warm water',
  'boiling water',
  'filtered water',
  'room temperature water',

  // Ice variations
  'ice',
  'ice cubes',
  'crushed ice',
  'ice water',
];

interface IngredientUpdate {
  id: string;
  name: string;
  display_name: string;
}

async function main() {
  const dryRun = process.env.APPLY_CHANGES !== 'true';

  console.log('\n' + '='.repeat(70));
  console.log('🛒 ADD IS_PURCHASEABLE FIELD TO INGREDIENTS');
  console.log('='.repeat(70) + '\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
    console.log('   Set APPLY_CHANGES=true to execute\n');
  } else {
    console.log('🚀 LIVE MODE - Database will be updated\n');
  }

  // Step 1: Check if column exists
  console.log('📋 Step 1: Checking if is_purchaseable column exists...\n');

  const columnCheck = await sql`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'ingredients'
      AND column_name = 'is_purchaseable'
  `;

  const columnExists = columnCheck.length > 0;

  if (columnExists) {
    console.log('✅ Column is_purchaseable already exists');
    console.log(`   Type: ${columnCheck[0].data_type}`);
    console.log(`   Default: ${columnCheck[0].column_default || 'none'}\n`);
  } else {
    console.log('⚠️  Column is_purchaseable does not exist\n');

    if (dryRun) {
      console.log('   Would execute:');
      console.log('   ALTER TABLE ingredients ADD COLUMN is_purchaseable BOOLEAN NOT NULL DEFAULT true;\n');
    } else {
      console.log('🔄 Adding is_purchaseable column...');
      await sql`
        ALTER TABLE ingredients
        ADD COLUMN is_purchaseable BOOLEAN NOT NULL DEFAULT true
      `;
      console.log('✅ Column added successfully\n');
    }
  }

  // Step 2: Find ingredients to mark as non-purchaseable
  console.log('📋 Step 2: Finding non-purchaseable items...\n');

  // Only query is_purchaseable if column exists
  let nonPurchaseableIngredients;
  if (columnExists) {
    nonPurchaseableIngredients = await sql`
      SELECT id, name, display_name, is_purchaseable
      FROM ingredients
      WHERE LOWER(name) = ANY(${NON_PURCHASEABLE_ITEMS})
      ORDER BY name
    `;
  } else {
    // Column doesn't exist yet, just get id, name, display_name
    nonPurchaseableIngredients = await sql`
      SELECT id, name, display_name
      FROM ingredients
      WHERE LOWER(name) = ANY(${NON_PURCHASEABLE_ITEMS})
      ORDER BY name
    `;
  }

  console.log(`📊 Found ${nonPurchaseableIngredients.length} non-purchaseable items in database\n`);

  if (nonPurchaseableIngredients.length === 0) {
    console.log('ℹ️  No matching ingredients found. This could mean:');
    console.log('   - These ingredients were never imported');
    console.log('   - They use different naming conventions');
    console.log('   - They have already been removed\n');
  } else {
    console.log('📝 Items to mark as non-purchaseable:\n');
    for (const ing of nonPurchaseableIngredients) {
      const currentStatus =
        columnExists && ing.is_purchaseable !== undefined
          ? ing.is_purchaseable
            ? '(currently purchaseable)'
            : '(already marked)'
          : '(will be marked)';
      console.log(`   - ${ing.display_name} (${ing.name}) ${currentStatus}`);
    }
    console.log('');
  }

  // Step 3: Get current counts
  console.log('📋 Step 3: Current database statistics...\n');

  let stats;
  if (columnExists) {
    const beforeStats = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_purchaseable = true) as purchaseable,
        COUNT(*) FILTER (WHERE is_purchaseable = false) as non_purchaseable
      FROM ingredients
    `;
    stats = beforeStats[0];
  } else {
    const beforeStats = await sql`
      SELECT COUNT(*) as total FROM ingredients
    `;
    stats = {
      total: beforeStats[0].total,
      purchaseable: beforeStats[0].total,
      non_purchaseable: 0,
    };
  }

  console.log(`   Total ingredients: ${stats.total}`);
  console.log(`   Purchaseable: ${stats.purchaseable}`);
  console.log(`   Non-purchaseable: ${stats.non_purchaseable}\n`);

  // Step 4: Apply updates
  if (nonPurchaseableIngredients.length > 0) {
    // Filter to only items that need updating (only relevant if column exists)
    const needsUpdate = columnExists
      ? nonPurchaseableIngredients.filter((ing) => ing.is_purchaseable !== false)
      : nonPurchaseableIngredients; // If column doesn't exist, all need updating after column is added

    if (columnExists && needsUpdate.length === 0) {
      console.log('✅ All non-purchaseable items are already marked correctly\n');
      process.exit(0);
    }

    console.log(`📋 Step 4: Marking ${needsUpdate.length} items as non-purchaseable...\n`);

    if (dryRun) {
      console.log('   Would execute:');
      console.log('   UPDATE ingredients');
      console.log('   SET is_purchaseable = false, updated_at = NOW()');
      console.log(`   WHERE LOWER(name) IN (${NON_PURCHASEABLE_ITEMS.map((n) => `'${n}'`).join(', ')});\n`);
    } else {
      let successCount = 0;
      let errorCount = 0;

      for (const ing of needsUpdate) {
        try {
          await sql`
            UPDATE ingredients
            SET
              is_purchaseable = false,
              updated_at = NOW()
            WHERE id = ${ing.id}
          `;

          console.log(`   ✅ Marked: ${ing.display_name}`);
          successCount++;
        } catch (error: any) {
          console.error(`   ❌ Failed to update ${ing.display_name}:`, error.message);
          errorCount++;
        }
      }

      console.log('');

      // Get updated stats
      const afterStats = await sql`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_purchaseable = true) as purchaseable,
          COUNT(*) FILTER (WHERE is_purchaseable = false) as non_purchaseable
        FROM ingredients
      `;

      const newStats = afterStats[0];

      console.log('='.repeat(70));
      console.log('✨ UPDATE COMPLETE');
      console.log('='.repeat(70) + '\n');
      console.log('📊 Results:\n');
      console.log('   Before:');
      console.log(`     - Purchaseable: ${stats.purchaseable}`);
      console.log(`     - Non-purchaseable: ${stats.non_purchaseable}`);
      console.log('');
      console.log('   After:');
      console.log(`     - Purchaseable: ${newStats.purchaseable} (${Number(stats.purchaseable) - Number(newStats.purchaseable)} removed)`);
      console.log(`     - Non-purchaseable: ${newStats.non_purchaseable} (${Number(newStats.non_purchaseable) - Number(stats.non_purchaseable)} added)`);
      console.log('');
      console.log('   Update Summary:');
      console.log(`     ✅ Successfully updated: ${successCount}`);
      console.log(`     ❌ Failed: ${errorCount}\n`);

      if (errorCount > 0) {
        process.exit(1);
      }
    }
  } else {
    console.log('📋 Step 4: No items to update\n');
  }

  if (dryRun) {
    console.log('='.repeat(70));
    console.log('🔍 DRY RUN COMPLETE');
    console.log('='.repeat(70) + '\n');
    console.log('No changes were made to the database.');
    console.log('Run with APPLY_CHANGES=true to apply these changes.\n');
  }
}

main().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
