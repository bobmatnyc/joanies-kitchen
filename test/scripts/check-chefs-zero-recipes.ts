#!/usr/bin/env tsx
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

async function checkChefs() {
  console.log('=== CHEFS WITH 0 RECIPES ===\n');

  // Get chefs with recipe_count = 0
  const allChefs = await db.select().from(chefs);
  const chefsNoRecipes = allChefs.filter(c => !c.recipe_count || c.recipe_count === 0);

  console.log(`Total chefs: ${allChefs.length}`);
  console.log(`Chefs with 0 recipes: ${chefsNoRecipes.length}\n`);

  for (const chef of chefsNoRecipes) {
    console.log(`- ${chef.slug} (${chef.displayName || chef.name})`);
    console.log(`  ID: ${chef.id}`);
  }

  // Check if these chefs actually have recipes in the DB
  console.log('\n=== CHECKING ACTUAL RECIPE COUNTS ===\n');
  for (const chef of chefsNoRecipes.slice(0, 5)) {
    const recipeCount = await db.select({ count: sql<number>`count(*)` })
      .from(recipes)
      .where(sql`${recipes.chefId} = ${chef.id}`);

    console.log(`${chef.slug}: recipe_count=${chef.recipe_count}, actual=${recipeCount[0].count}`);
  }
}

checkChefs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
