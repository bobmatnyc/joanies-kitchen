#!/usr/bin/env tsx
/**
 * Check ingredient image coverage in database
 */

import { db } from '../src/lib/db/index.js';
import { ingredients } from '../src/lib/db/ingredients-schema.js';
import { sql } from 'drizzle-orm';

async function checkCoverage() {
  const stats = await db.select({
    total: sql`COUNT(*)`,
    withImages: sql`COUNT(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 END)`,
    withoutImages: sql`COUNT(CASE WHEN image_url IS NULL OR image_url = '' THEN 1 END)`
  }).from(ingredients);

  console.log('\n📊 Ingredient Image Coverage:\n');
  console.log(`Total ingredients: ${stats[0].total}`);
  console.log(`With images: ${stats[0].withImages}`);
  console.log(`Without images: ${stats[0].withoutImages}`);
  console.log(`Coverage: ${((Number(stats[0].withImages) / Number(stats[0].total)) * 100).toFixed(1)}%\n`);

  process.exit(0);
}

checkCoverage().catch(console.error);
