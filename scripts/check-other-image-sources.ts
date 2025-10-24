#!/usr/bin/env tsx
/**
 * Find ingredients with "Other" image sources (not Unsplash or local)
 */

import { db } from '../src/lib/db/index.js';
import { ingredients } from '../src/lib/db/ingredients-schema.js';
import { sql } from 'drizzle-orm';

async function checkOtherSources() {
  const results = await db.select({
    name: ingredients.name,
    imageUrl: ingredients.image_url
  }).from(ingredients).where(
    sql`image_url NOT LIKE 'https://images.unsplash.com%' AND image_url NOT LIKE '/images/ingredients/%'`
  );

  console.log('\n🔍 Other Image Sources:\n');
  results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.name}: ${r.imageUrl}`);
  });
  console.log(`\nTotal: ${results.length}\n`);

  process.exit(0);
}

checkOtherSources().catch(console.error);
