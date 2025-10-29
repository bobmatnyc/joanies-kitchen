#!/usr/bin/env tsx

import { sql } from 'drizzle-orm';
import { db } from '../src/lib/db/index.js';

async function findBrokenImages() {
  console.log('Searching for recipes with broken image URLs...\n');

  // Check for various problematic patterns
  const patterns = [
    { name: 'example.com', pattern: '%example.com%' },
    { name: 'placeholder', pattern: '%placeholder%' },
    { name: 'dummy', pattern: '%dummy%' },
    { name: 'localhost', pattern: '%localhost%' },
    { name: 'test', pattern: '%test.jpg%' },
  ];

  let totalFound = 0;

  for (const { name, pattern } of patterns) {
    const result = await db.execute(sql`
      SELECT id, name, images, slug
      FROM recipes
      WHERE images::text LIKE ${pattern}
      LIMIT 10
    `);

    if (result.rows.length > 0) {
      console.log(`\nFound ${result.rows.length} recipes with ${name} in images:`);
      console.log('='.repeat(80));

      for (const row of result.rows) {
        console.log(`\nRecipe: ${row.name}`);
        console.log(`ID: ${row.id}`);
        console.log(`Slug: ${row.slug || 'N/A'}`);
        console.log(`Images: ${JSON.stringify(row.images, null, 2)}`);
        totalFound++;
      }
    }
  }

  if (totalFound === 0) {
    console.log('No broken images found!\n');
    console.log('Showing sample of recipes with valid images:\n');

    const samples = await db.execute(sql`
      SELECT name, images
      FROM recipes
      WHERE images IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 5
    `);

    for (const row of samples.rows) {
      const imgs = row.images as string[];
      if (imgs && imgs.length > 0) {
        console.log(`- ${row.name}`);
        console.log(`  ${imgs[0]}\n`);
      }
    }
  } else {
    console.log(`\n\nTotal recipes with broken images: ${totalFound}`);
  }

  process.exit(0);
}

findBrokenImages().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
