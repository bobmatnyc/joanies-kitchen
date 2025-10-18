#!/usr/bin/env tsx
/**
 * Restore Instructions from Backup
 *
 * Restores instructions from instructions_backup field and clears backup.
 * Use this to retry formatting with different approach.
 *
 * Usage:
 *   pnpm tsx scripts/restore-from-backup.ts --chef="nancy-silverton"        # Dry run
 *   pnpm tsx scripts/restore-from-backup.ts --chef="nancy-silverton" --apply
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const DRY_RUN = !process.argv.includes('--apply');
const CHEF_FILTER = process.argv.find((arg) => arg.startsWith('--chef='))?.split('=')[1];

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log('🔄 Restore Instructions from Backup');
  console.log('='.repeat(80));
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN' : '✍️  APPLY'}`);
  if (CHEF_FILTER) {
    console.log(`Filter: Chef slug = "${CHEF_FILTER}"`);
  }
  console.log('');

  let recipes;

  if (CHEF_FILTER) {
    recipes = await sql`
      SELECT r.id, r.name, r.instructions, r.instructions_backup, c.name as chef_name
      FROM recipes r
      INNER JOIN chef_recipes cr ON r.id = cr.recipe_id
      INNER JOIN chefs c ON cr.chef_id = c.id
      WHERE c.slug = ${CHEF_FILTER} AND r.instructions_backup IS NOT NULL
    `;
  } else {
    recipes = await sql`
      SELECT r.id, r.name, r.instructions, r.instructions_backup
      FROM recipes r
      WHERE r.instructions_backup IS NOT NULL
    `;
  }

  console.log(`Found ${recipes.length} recipes with backups\n`);

  let restored = 0;

  for (const recipe of recipes) {
    console.log(`${recipe.name} (${recipe.chef_name || 'N/A'})`);
    console.log(`  Current: ${recipe.instructions.substring(0, 80)}...`);
    console.log(`  Backup:  ${recipe.instructions_backup.substring(0, 80)}...`);

    if (!DRY_RUN) {
      await sql`
        UPDATE recipes
        SET instructions = ${recipe.instructions_backup},
            instructions_backup = NULL,
            updated_at = NOW()
        WHERE id = ${recipe.id}
      `;
      console.log('  ✅ Restored\n');
      restored++;
    } else {
      console.log('  ℹ️  Would restore\n');
    }
  }

  console.log(`\n📊 Summary: ${restored} recipes restored`);
  if (DRY_RUN) {
    console.log('💡 Run with --apply to restore');
  }
}

main().catch(console.error);
