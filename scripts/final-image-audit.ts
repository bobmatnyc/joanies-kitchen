#!/usr/bin/env tsx

import { sql } from 'drizzle-orm';
import { db } from '../src/lib/db/index.js';

async function finalImageAudit() {
  console.log('\nCOMPREHENSIVE IMAGE AUDIT REPORT');
  console.log('='.repeat(80));
  console.log('Date:', new Date().toISOString());
  console.log('');

  // 1. Total recipes
  const totalResult = await db.execute(sql`SELECT COUNT(*) as count FROM recipes`);
  const totalRecipes = Number(totalResult.rows[0].count);
  console.log(`Total Recipes: ${totalRecipes.toLocaleString()}`);

  // 2. Recipes with non-empty images
  const withImagesResult = await db.execute(sql`
    SELECT COUNT(*) as count 
    FROM recipes 
    WHERE images IS NOT NULL 
      AND images::text != '[]'
      AND images::text != 'null'
  `);
  const withImages = Number(withImagesResult.rows[0].count);
  console.log(
    `Recipes with Images: ${withImages.toLocaleString()} (${((withImages / totalRecipes) * 100).toFixed(1)}%)`
  );
  console.log('');

  // 3. Check for problematic patterns
  console.log('CHECKING FOR BROKEN IMAGE PATTERNS:');
  console.log('-'.repeat(80));

  const patterns = [
    { name: 'example.com URLs', query: '%example.com%' },
    { name: 'placeholder images', query: '%placeholder%' },
    { name: 'dummy images', query: '%dummy%' },
    { name: 'localhost URLs', query: '%localhost%' },
  ];

  let totalProblematic = 0;
  const problematicRecipes = [];

  for (const { name, query } of patterns) {
    const result = await db.execute(sql`
      SELECT id, name, slug, images
      FROM recipes
      WHERE images::text LIKE ${query}
      LIMIT 5
    `);

    if (result.rows.length > 0) {
      console.log(`\n❌ Found ${result.rows.length} recipe(s) with ${name}:`);
      for (const row of result.rows) {
        console.log(`  - ${row.name} (${row.slug || row.id})`);
        problematicRecipes.push(row);
      }
      totalProblematic += result.rows.length;
    }
  }

  if (totalProblematic === 0) {
    console.log('✅ No broken image patterns found!');
  }
  console.log('');

  // 4. Verify Roasted Tomato Soup specifically
  console.log('ROASTED TOMATO SOUP STATUS:');
  console.log('-'.repeat(80));

  const soupResult = await db.execute(sql`
    SELECT name, slug, images, updated_at
    FROM recipes
    WHERE slug = 'roasted-tomato-soup'
    LIMIT 1
  `);

  if (soupResult.rows.length > 0) {
    const soup = soupResult.rows[0];
    const images = soup.images as string[];
    const hasExampleDotCom = images.some((img) => img.includes('example.com'));

    console.log(`Recipe: ${soup.name}`);
    console.log(`Status: ${hasExampleDotCom ? '❌ BROKEN' : '✅ FIXED'}`);
    console.log(`Images: ${JSON.stringify(images, null, 2)}`);
  } else {
    console.log('Recipe not found');
  }
  console.log('');

  // 5. Summary
  console.log('='.repeat(80));
  console.log('SUMMARY:');
  console.log(`  Total Recipes: ${totalRecipes.toLocaleString()}`);
  console.log(`  With Images: ${withImages.toLocaleString()}`);
  console.log(`  Broken Images: ${totalProblematic}`);
  console.log(`  Status: ${totalProblematic === 0 ? '✅ HEALTHY' : '❌ NEEDS ATTENTION'}`);
  console.log('='.repeat(80));
  console.log('');

  process.exit(0);
}

finalImageAudit().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
