#!/usr/bin/env tsx
/**
 * Count ingredients using Unsplash URLs vs local files
 */

import { db } from '../src/lib/db/index.js';
import { ingredients } from '../src/lib/db/ingredients-schema.js';
import { sql } from 'drizzle-orm';

async function countImageTypes() {
  const stats = await db.select({
    total: sql`COUNT(*)`,
    unsplash: sql`COUNT(CASE WHEN image_url LIKE 'https://images.unsplash.com%' THEN 1 END)`,
    local: sql`COUNT(CASE WHEN image_url LIKE '/images/ingredients/%' THEN 1 END)`,
    other: sql`COUNT(CASE WHEN image_url NOT LIKE 'https://images.unsplash.com%' AND image_url NOT LIKE '/images/ingredients/%' THEN 1 END)`
  }).from(ingredients);

  console.log('\n📊 Ingredient Image Sources:\n');
  console.log(`Total ingredients: ${stats[0].total}`);
  console.log(`Unsplash (external): ${stats[0].unsplash} (${((Number(stats[0].unsplash) / Number(stats[0].total)) * 100).toFixed(1)}%)`);
  console.log(`Local files: ${stats[0].local} (${((Number(stats[0].local) / Number(stats[0].total)) * 100).toFixed(1)}%)`);
  console.log(`Other: ${stats[0].other}\n`);

  process.exit(0);
}

countImageTypes().catch(console.error);
