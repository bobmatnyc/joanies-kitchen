#!/usr/bin/env tsx
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';

async function main() {
  const allChefs = await db.select().from(chefs);
  console.log(`Total chefs: ${allChefs.length}\n`);

  for (const chef of allChefs) {
    console.log(`- ${chef.slug} (${chef.name || chef.display_name}) - Recipes: ${chef.recipe_count || 0}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
