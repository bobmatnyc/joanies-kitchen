#!/usr/bin/env tsx
import 'dotenv/config';
import { db } from '../src/lib/db';
import { chefRecipes, chefs } from '../src/lib/db/chef-schema';
import { recipes } from '../src/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

async function checkChefLinks() {
  console.log('='.repeat(70));
  console.log('CHEF-RECIPE LINKS CHECK');
  console.log('='.repeat(70));

  // Count total chef-recipe links
  const totalLinks = await db.select({ count: sql`count(*)` }).from(chefRecipes);
  console.log(`\n📊 Total chef-recipe links: ${totalLinks[0].count}`);

  // Get all chefs
  const allChefs = await db.select().from(chefs);
  console.log(`\n👨‍🍳 Chefs in database: ${allChefs.length}`);

  // For each chef, count linked recipes
  for (const chef of allChefs) {
    const links = await db
      .select({ count: sql`count(*)` })
      .from(chefRecipes)
      .where(eq(chefRecipes.chef_id, chef.id));

    console.log(`   ${chef.name}: ${links[0].count} recipes`);
  }

  console.log('\n✅ Check complete!\n');
  process.exit(0);
}

checkChefLinks().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
