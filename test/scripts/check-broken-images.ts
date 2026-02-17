#!/usr/bin/env tsx

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/index.js';

async function checkBrokenImages() {
  console.log('Checking for recipes with broken images...\n');

  const result = await db.execute(sql`
    SELECT id, name, images, description
    FROM recipes
    WHERE images::text LIKE '%example.com%'
       OR images::text LIKE '%placeholder%'
       OR images::text LIKE '%dummy%'
  `);

  console.log(`Found ${result.rows.length} recipe(s) with potentially broken images:\n`);

  for (const row of result.rows) {
    console.log('---');
    console.log('ID:', row.id);
    console.log('Name:', row.name);
    console.log('Images:', row.images);
    console.log('Description:', row.description ? row.description.substring(0, 100) : 'N/A');
    console.log('');
  }

  if (result.rows.length === 0) {
    console.log('No broken images found. Checking sample of valid recipes...\n');

    const samples = await db.execute(sql`
      SELECT name, images
      FROM recipes
      WHERE images IS NOT NULL
        AND jsonb_array_length(images) > 0
      LIMIT 5
    `);

    console.log('Sample recipes with images:');
    for (const row of samples.rows) {
      console.log(`- ${row.name}: ${row.images[0]}`);
    }
  }

  process.exit(0);
}

checkBrokenImages().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
