#!/usr/bin/env tsx
/**
 * Delete Duplicate Recipes Script
 *
 * Deletes duplicate recipes identified by find-duplicate-recipes.ts
 * Uses the list of IDs from /tmp/duplicate-recipe-ids.json
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';

const sql = neon(process.env.DATABASE_URL!);

interface DeletionResult {
  id: string;
  name: string;
  success: boolean;
  error?: string;
}

async function main() {
  console.log('🗑️  Duplicate Recipe Deletion Script\n');

  // Read the duplicate IDs
  const duplicateIdsPath = '/tmp/duplicate-recipe-ids.json';

  if (!fs.existsSync(duplicateIdsPath)) {
    console.error('❌ Error: Duplicate IDs file not found!');
    console.error(`   Expected: ${duplicateIdsPath}`);
    console.error('\n   Run find-duplicate-recipes.ts first to generate the list.');
    process.exit(1);
  }

  const duplicateIds: string[] = JSON.parse(fs.readFileSync(duplicateIdsPath, 'utf-8'));

  console.log(`Found ${duplicateIds.length} duplicate recipes to delete\n`);
  console.log('='.repeat(80));

  const results: DeletionResult[] = [];
  let successCount = 0;
  let errorCount = 0;

  // First, get the names of recipes we're about to delete
  console.log('\n📋 Recipes to be deleted:\n');

  for (const id of duplicateIds) {
    try {
      const recipe = await sql`
        SELECT id, name
        FROM recipes
        WHERE id = ${id}
      `;

      if (recipe.length === 0) {
        console.log(`   ⚠️  ${id} - Recipe not found (may have been already deleted)`);
        results.push({
          id,
          name: 'Unknown',
          success: false,
          error: 'Recipe not found'
        });
        errorCount++;
      } else {
        console.log(`   • ${recipe[0].name}`);
        results.push({
          id,
          name: recipe[0].name,
          success: false
        });
      }
    } catch (error: any) {
      console.error(`   ❌ Error fetching ${id}: ${error.message}`);
      results.push({
        id,
        name: 'Unknown',
        success: false,
        error: error.message
      });
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n⚠️  WARNING: This will permanently delete these recipes!');
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');

  // Wait 5 seconds
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('🚀 Starting deletion...\n');

  // Delete each recipe
  for (let i = 0; i < results.length; i++) {
    const result = results[i];

    // Skip if we already know it doesn't exist
    if (result.error === 'Recipe not found') {
      continue;
    }

    try {
      console.log(`   [${i + 1}/${duplicateIds.length}] Deleting: ${result.name}`);

      // Delete the recipe
      await sql`
        DELETE FROM recipes
        WHERE id = ${result.id}
      `;

      result.success = true;
      successCount++;
      console.log(`       ✅ Deleted successfully`);

    } catch (error: any) {
      result.success = false;
      result.error = error.message;
      errorCount++;
      console.error(`       ❌ Error: ${error.message}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Deletion Summary:\n');
  console.log(`   ✅ Successfully deleted: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📝 Total processed: ${duplicateIds.length}`);

  if (errorCount > 0) {
    console.log('\n❌ Errors encountered:');
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`   • ${r.name} (${r.id})`);
        console.log(`     Error: ${r.error || 'Unknown error'}`);
      });
  }

  // Save results log
  const logPath = '/tmp/duplicate-deletion-log.json';
  fs.writeFileSync(logPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Detailed log saved to: ${logPath}`);

  console.log('\n✅ Deletion complete!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
