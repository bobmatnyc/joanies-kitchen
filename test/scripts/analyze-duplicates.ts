/**
 * Analyze Ingredient Duplicates
 *
 * Quick analysis script to identify duplicate and normalization issues
 * in the ingredients table.
 */

import { db } from '@/lib/db';
import { ingredients } from '@/lib/db/ingredients-schema';
import { sql } from 'drizzle-orm';

async function analyzeDuplicates() {
  console.log('🔍 Analyzing Ingredient Duplicates...\n');

  // 1. Total ingredient count
  const totalCount = await db.select({ count: sql<number>`count(*)` }).from(ingredients);
  console.log(`📊 Total Ingredients: ${totalCount[0]?.count || 0}\n`);

  // 2. Find exact duplicates (same name, different IDs)
  console.log('🔴 Exact Duplicates (same name, different IDs):');
  const exactDuplicates = await db.execute(sql`
    SELECT name, display_name, COUNT(*) as count
    FROM ingredients
    GROUP BY name, display_name
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 20
  `);

  if (exactDuplicates.rows.length > 0) {
    exactDuplicates.rows.forEach((row: any) => {
      console.log(`  - "${row.name}" (${row.display_name}): ${row.count} duplicates`);
    });
  } else {
    console.log('  ✅ No exact duplicates found');
  }
  console.log('');

  // 3. Find ingredients with preparation suffixes
  console.log('🟡 Ingredients with Preparation Suffixes:');
  const preparationSuffixes = await db.execute(sql`
    SELECT name, display_name
    FROM ingredients
    WHERE
      name ILIKE '%leaves%' OR
      name ILIKE '%chopped%' OR
      name ILIKE '%diced%' OR
      name ILIKE '%sliced%' OR
      name ILIKE '%minced%' OR
      name ILIKE '%grated%' OR
      name ILIKE '%shredded%'
    ORDER BY name
    LIMIT 30
  `);

  if (preparationSuffixes.rows.length > 0) {
    preparationSuffixes.rows.forEach((row: any) => {
      console.log(`  - ${row.name} (${row.display_name})`);
    });
    console.log(`  ... and ${Math.max(0, preparationSuffixes.rows.length - 30)} more`);
  }
  console.log('');

  // 4. Find ingredients with quantity in name
  console.log('🟠 Ingredients with Quantity/Measurement in Name:');
  const quantityInName = await db.execute(sql`
    SELECT name, display_name
    FROM ingredients
    WHERE
      name ~ '\\([0-9]' OR
      name ~ '\\d+\\s*(oz|ounce|lb|pound|stick|can|package|pkg|bag)' OR
      name ILIKE '%(%-%)%'
    ORDER BY name
    LIMIT 30
  `);

  if (quantityInName.rows.length > 0) {
    quantityInName.rows.forEach((row: any) => {
      console.log(`  - ${row.name} (${row.display_name})`);
    });
  }
  console.log('');

  // 5. Find potential variant duplicates (fuzzy matching)
  console.log('🔵 Potential Variant Duplicates (similar names):');
  const variantDuplicates = await db.execute(sql`
    SELECT DISTINCT
      a.name as name1,
      b.name as name2,
      similarity(a.name, b.name) as sim
    FROM ingredients a
    JOIN ingredients b ON a.id < b.id
    WHERE similarity(a.name, b.name) > 0.8
      AND a.name != b.name
    ORDER BY sim DESC
    LIMIT 20
  `);

  if (variantDuplicates.rows.length > 0) {
    variantDuplicates.rows.forEach((row: any) => {
      console.log(`  - "${row.name1}" ↔ "${row.name2}" (similarity: ${(row.sim * 100).toFixed(1)}%)`);
    });
  }
  console.log('');

  // 6. Category distribution
  console.log('📦 Category Distribution:');
  const categories = await db.execute(sql`
    SELECT
      COALESCE(category, 'uncategorized') as category,
      COUNT(*) as count
    FROM ingredients
    GROUP BY category
    ORDER BY count DESC
  `);

  categories.rows.forEach((row: any) => {
    console.log(`  - ${row.category}: ${row.count}`);
  });
  console.log('');

  console.log('✅ Analysis complete!\n');
  process.exit(0);
}

analyzeDuplicates().catch((error) => {
  console.error('❌ Error analyzing duplicates:', error);
  process.exit(1);
});
