#!/usr/bin/env tsx

/**
 * Fix Chef Recipe Counts
 *
 * Updates all chef recipe_count values from the chef_recipes join table
 * (the authoritative source of truth for chef-recipe relationships).
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefRecipes, chefs } from '@/lib/db/chef-schema';

async function fixChefRecipeCounts() {
  console.log('\n🔧 Fixing Chef Recipe Counts\n');
  console.log('='.repeat(90));
  console.log('\nSource of Truth: chef_recipes join table\n');
  console.log('='.repeat(90));

  const allChefs = await db.select().from(chefs);

  console.log(`\nFound ${allChefs.length} chefs to process\n`);

  let updated = 0;
  let unchanged = 0;

  console.log('Processing updates...\n');
  console.log('-'.repeat(90));
  console.log('Chef Name                         Old Count   New Count   Change');
  console.log('-'.repeat(90));

  for (const chef of allChefs) {
    const oldCount = chef.recipe_count || 0;

    // Update chef's recipe count using SQL subquery
    await db
      .update(chefs)
      .set({
        recipe_count: sql`(
          SELECT COUNT(*)::int
          FROM ${chefRecipes}
          WHERE ${chefRecipes.chef_id} = ${chef.id}
        )`,
        updated_at: new Date(),
      })
      .where(eq(chefs.id, chef.id));

    // Get updated count
    const [updatedChef] = await db.select().from(chefs).where(eq(chefs.id, chef.id)).limit(1);
    const newCount = updatedChef.recipe_count || 0;

    if (oldCount !== newCount) {
      updated++;
      const change = newCount - oldCount;
      const changeStr = change > 0 ? `+${change}` : `${change}`;
      console.log(
        `${chef.name.padEnd(33)} ${String(oldCount).padStart(9)}   ${String(newCount).padStart(9)}   ${changeStr.padStart(7)}`
      );
    } else {
      unchanged++;
      console.log(
        `${chef.name.padEnd(33)} ${String(oldCount).padStart(9)}   ${String(newCount).padStart(9)}   --`
      );
    }
  }

  console.log('\n' + '='.repeat(90));
  console.log('\n📊 SUMMARY:\n');
  console.log(`   Total chefs processed: ${allChefs.length}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Unchanged: ${unchanged}`);

  if (updated > 0) {
    console.log('\n✅ Chef recipe counts have been synchronized!');
    console.log('\n💡 Next steps:');
    console.log('   1. Verify counts: npx tsx scripts/verify-chef-recipe-counts.ts');
    console.log('   2. Check the website to confirm counts display correctly');
  } else {
    console.log('\n✅ All chef recipe counts were already accurate!');
  }

  console.log('\n' + '='.repeat(90) + '\n');
}

fixChefRecipeCounts()
  .then(() => {
    console.log('✅ Script completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
