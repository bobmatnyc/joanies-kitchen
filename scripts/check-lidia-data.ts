#!/usr/bin/env tsx

import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';
import { like, or, isNull, isNotNull } from 'drizzle-orm';

async function main() {
  console.log('Checking for Lidia recipes...\n');

  // Check by tags
  const byTags = await db
    .select()
    .from(recipes)
    .where(like(recipes.tags, '%Lidia%'))
    .limit(5);

  console.log(`Found ${byTags.length} recipes with "Lidia" in tags`);
  if (byTags.length > 0) {
    console.log('Sample:');
    for (const r of byTags) {
      console.log(`  - ${r.name}`);
      console.log(`    ID: ${r.id}`);
      console.log(`    chef_id: ${r.chef_id}`);
      console.log(`    tags: ${r.tags}`);
      console.log(`    source: ${r.source}`);
      console.log();
    }
  }

  // Check by source
  const bySource = await db
    .select()
    .from(recipes)
    .where(like(recipes.source, '%lidia%'))
    .limit(5);

  console.log(`\nFound ${bySource.length} recipes with "lidia" in source`);
  if (bySource.length > 0) {
    console.log('Sample:');
    for (const r of bySource) {
      console.log(`  - ${r.name}`);
      console.log(`    ID: ${r.id}`);
      console.log(`    chef_id: ${r.chef_id}`);
      console.log(`    source: ${r.source}`);
      console.log();
    }
  }

  // Count all recipes with null chef_id
  const allRecipes = await db.select().from(recipes).where(isNull(recipes.chef_id));
  console.log(`\nTotal recipes with NULL chef_id: ${allRecipes.length}`);

  // Count all recipes with non-null chef_id
  const linkedRecipes = await db.select().from(recipes).where(isNotNull(recipes.chef_id));
  console.log(`Total recipes with chef_id set: ${linkedRecipes.length}`);
}

main().catch(console.error);
