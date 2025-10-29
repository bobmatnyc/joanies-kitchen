#!/usr/bin/env tsx

import { sql } from 'drizzle-orm';
import { db } from '../src/lib/db/index.js';

async function comprehensiveImageAudit() {
  console.log('COMPREHENSIVE IMAGE AUDIT');
  console.log('='.repeat(80));
  console.log('');

  // 1. Count total recipes
  const totalResult = await db.execute(sql`SELECT COUNT(*) as count FROM recipes`);
  const totalRecipes = Number(totalResult.rows[0].count);
  console.log(`Total Recipes: ${totalRecipes.toLocaleString()}`);

  // 2. Count recipes with images
  const withImagesResult = await db.execute(sql`
    SELECT COUNT(*) as count 
    FROM recipes 
    WHERE images IS NOT NULL 
      AND images != '[]'::jsonb
      AND jsonb_array_length(images) > 0
  `);
  const withImages = Number(withImagesResult.rows[0].count);
  console.log(`Recipes with Images: ${withImages.toLocaleString()}`);
  console.log(`Recipes without Images: ${(totalRecipes - withImages).toLocaleString()}`);
  console.log('');

  // 3. Check for problematic patterns
  const patterns = [
    { name: 'example.com', query: '%example.com%' },
    { name: 'placeholder', query: '%placeholder%' },
    { name: 'dummy', query: '%dummy%' },
    { name: 'localhost', query: '%localhost%' },
    { name: 'test.jpg', query: '%test.jpg%' },
    { name: 'null', query: '%null%' },
  ];

  console.log('PROBLEMATIC IMAGE PATTERNS:');
  console.log('-'.repeat(80));

  let totalProblematic = 0;
  for (const { name, query } of patterns) {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM recipes
      WHERE images::text LIKE ${query}
    `);
    const count = Number(result.rows[0].count);
    if (count > 0) {
      console.log(`  ${name}: ${count} recipe(s)`);
      totalProblematic += count;
    }
  }

  if (totalProblematic === 0) {
    console.log('  ✅ No problematic patterns found!');
  }
  console.log('');

  // 4. Check image hosting sources
  console.log('IMAGE HOSTING SOURCES:');
  console.log('-'.repeat(80));

  const sources = [
    { name: 'Vercel Blob', pattern: '%vercel-storage.com%' },
    { name: 'Cloudinary', pattern: '%cloudinary.com%' },
    { name: 'Unsplash', pattern: '%unsplash.com%' },
    { name: 'OpenAI/DALL-E', pattern: '%oaidalleapiprodscus.blob.core.windows.net%' },
    { name: 'Recipe Sources', pattern: '%seriouseats.com%' },
  ];

  for (const { name, pattern } of sources) {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM recipes
      WHERE images::text LIKE ${pattern}
    `);
    const count = Number(result.rows[0].count);
    if (count > 0) {
      console.log(`  ${name}: ${count} recipe(s)`);
    }
  }
  console.log('');

  // 5. Recent recipes with images
  console.log('RECENTLY UPDATED RECIPES WITH IMAGES (Last 5):');
  console.log('-'.repeat(80));

  const recentResult = await db.execute(sql`
    SELECT name, slug, images, updated_at
    FROM recipes
    WHERE images IS NOT NULL
      AND jsonb_array_length(images) > 0
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 5
  `);

  for (const row of recentResult.rows) {
    console.log(`  - ${row.name}`);
    console.log(`    Slug: ${row.slug || 'N/A'}`);
    const images = row.images as string[];
    if (images && images.length > 0) {
      const firstImage = images[0];
      const displayUrl = firstImage.length > 60 ? `${firstImage.substring(0, 57)}...` : firstImage;
      console.log(`    Image: ${displayUrl}`);
    }
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('AUDIT COMPLETE');
  console.log('');

  process.exit(0);
}

comprehensiveImageAudit().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
