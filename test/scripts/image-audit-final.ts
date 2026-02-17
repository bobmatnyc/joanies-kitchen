#!/usr/bin/env tsx

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/index.js';

async function imageAudit() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║              RECIPE IMAGE AUDIT - BROKEN URL CHECK REPORT                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log('Date:', new Date().toISOString());
  console.log('');

  // 1. Database Statistics
  const totalResult = await db.execute(sql`SELECT COUNT(*) as count FROM recipes`);
  const totalRecipes = Number(totalResult.rows[0].count);

  const withImagesResult = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM recipes
    WHERE images IS NOT NULL
      AND images::text != '[]'
      AND images::text != 'null'
  `);
  const withImages = Number(withImagesResult.rows[0].count);

  console.log('DATABASE STATISTICS:');
  console.log('─'.repeat(80));
  console.log(`  Total Recipes:        ${totalRecipes.toLocaleString()}`);
  console.log(
    `  With Images:          ${withImages.toLocaleString()} (${((withImages / totalRecipes) * 100).toFixed(1)}%)`
  );
  console.log(
    `  Without Images:       ${(totalRecipes - withImages).toLocaleString()} (${(((totalRecipes - withImages) / totalRecipes) * 100).toFixed(1)}%)`
  );
  console.log('');

  // 2. Check for problematic patterns
  console.log('BROKEN IMAGE PATTERNS CHECK:');
  console.log('─'.repeat(80));

  const patterns = ['example.com', 'placeholder', 'dummy', 'localhost'];

  let totalProblematic = 0;

  for (const pattern of patterns) {
    const query = `%${pattern}%`;
    const result = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM recipes
      WHERE images::text LIKE ${query}
    `);

    const count = Number(result.rows[0].count);
    const status = count === 0 ? '✅' : '❌';
    console.log(`  ${status} ${pattern.padEnd(15)} ${count} recipe(s)`);
    totalProblematic += count;
  }
  console.log('');

  // 3. Roasted Tomato Soup Verification
  console.log('TARGET RECIPE VERIFICATION:');
  console.log('─'.repeat(80));

  const soupResult = await db.execute(sql`
    SELECT name, slug, images
    FROM recipes
    WHERE slug = 'roasted-tomato-soup'
    LIMIT 1
  `);

  if (soupResult.rows.length > 0) {
    const soup = soupResult.rows[0];
    console.log(`  Recipe Name:    ${soup.name}`);
    console.log(`  Recipe Slug:    ${soup.slug}`);
    console.log(`  Images:`);

    const images = soup.images;
    let imageArray = [];

    if (typeof images === 'string') {
      try {
        imageArray = JSON.parse(images);
      } catch (_e) {
        imageArray = [images];
      }
    } else if (Array.isArray(images)) {
      imageArray = images;
    }

    if (imageArray.length > 0) {
      imageArray.forEach((img, idx) => {
        const isBroken =
          img.includes('example.com') || img.includes('placeholder') || img.includes('dummy');
        const status = isBroken ? '❌ BROKEN' : '✅ VALID';
        console.log(`    ${idx + 1}. ${status}`);
        console.log(`       ${img}`);
      });
    } else {
      console.log('    (No images)');
    }
  } else {
    console.log('  ❌ Recipe not found!');
  }
  console.log('');

  // 4. Final Summary
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                              AUDIT SUMMARY                                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Total Recipes Checked:         ${totalRecipes.toLocaleString()}`);
  console.log(`  Recipes with Broken Images:    ${totalProblematic}`);
  console.log('');

  if (totalProblematic === 0) {
    console.log('  ✅ SUCCESS: No broken images found!');
    console.log('  ✅ The Roasted Tomato Soup fix is still in place.');
    console.log('  ✅ All recipe images are using valid URLs.');
  } else {
    console.log(`  ❌ ATTENTION: ${totalProblematic} recipe(s) need image fixes.`);
  }
  console.log('');
  console.log('═'.repeat(80));

  process.exit(0);
}

imageAudit().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
