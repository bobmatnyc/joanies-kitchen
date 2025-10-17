#!/usr/bin/env tsx

import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';

async function checkChefs() {
  const allChefs = await db
    .select({
      id: chefs.id,
      slug: chefs.slug,
      name: chefs.name,
      profile_image_url: chefs.profile_image_url,
      recipe_count: chefs.recipe_count,
    })
    .from(chefs)
    .orderBy(chefs.name);

  console.log('Current Chefs:');
  console.log('='.repeat(80));
  allChefs.forEach((chef) => {
    console.log(
      `${chef.name.padEnd(30)} | ${chef.slug.padEnd(25)} | Image: ${chef.profile_image_url || 'None'}`
    );
  });
  console.log('='.repeat(80));
  console.log(`Total: ${allChefs.length} chefs`);
}

checkChefs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
