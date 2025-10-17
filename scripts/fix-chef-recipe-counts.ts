#!/usr/bin/env tsx

/**
 * Fix chef recipe counts
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefRecipes, chefs } from '@/lib/db/chef-schema';

async function fixChefRecipeCounts() {
  console.log('🔧 Fixing chef recipe counts...\n');

  const allChefs = await db.select().from(chefs);

  for (const chef of allChefs) {
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

    console.log(`✅ ${chef.name.padEnd(25)}: ${updatedChef.recipe_count} recipes`);
  }

  console.log('\n🎉 All chef recipe counts updated!');
}

fixChefRecipeCounts()
  .then(() => {
    console.log('\n✅ Script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
