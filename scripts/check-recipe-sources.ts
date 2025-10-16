#!/usr/bin/env tsx

import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

async function checkSources() {
  console.log('Checking recipe sources in database...\n');

  // Get unique sources and their counts
  const sources = await db
    .select({
      source: recipes.source,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(recipes)
    .where(sql`${recipes.source} IS NOT NULL AND ${recipes.source} != ''`)
    .groupBy(recipes.source)
    .orderBy(sql`count(*) DESC`)
    .limit(20);

  console.log('Top 20 Recipe Sources:');
  console.log('='.repeat(80));
  sources.forEach(s => {
    console.log(`${String(s.count).padStart(6)} recipes | ${s.source}`);
  });
  console.log('='.repeat(80));

  // Sample Serious Eats recipes
  console.log('\n\nSample Serious Eats recipes:');
  console.log('='.repeat(80));
  const seRecipes = await db
    .select({ name: recipes.name, source: recipes.source })
    .from(recipes)
    .where(sql`${recipes.source} LIKE '%seriouseats%'`)
    .limit(10);

  seRecipes.forEach(r => {
    console.log(`${r.name}`);
    console.log(`  Source: ${r.source}\n`);
  });
}

checkSources()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
