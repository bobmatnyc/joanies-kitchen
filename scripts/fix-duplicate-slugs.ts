#!/usr/bin/env tsx
/**
 * Fix Duplicate Ingredient Slugs
 *
 * Finds duplicate slugs and appends a numeric suffix to make them unique
 *
 * Usage:
 *   pnpm tsx scripts/fix-duplicate-slugs.ts
 */

import { db } from '@/lib/db';
import { ingredients } from '@/lib/db/ingredients-schema';
import { eq, sql } from 'drizzle-orm';

async function fixDuplicates() {
  console.log('🔍 Finding duplicate slugs...');

  // Find duplicate slugs
  const duplicates = await db.execute(sql`
    SELECT slug, COUNT(*) as count
    FROM ingredients
    WHERE slug IS NOT NULL
    GROUP BY slug
    HAVING COUNT(*) > 1
    ORDER BY count DESC, slug
  `);

  if (duplicates.rows.length === 0) {
    console.log('✅ No duplicates found!');
    return;
  }

  console.log(`❌ Found ${duplicates.rows.length} duplicate slugs`);

  for (const dup of duplicates.rows) {
    const slug = dup.slug as string;
    const count = dup.count as number;

    console.log(`\n📌 Processing "${slug}" (${count} instances):`);

    // Get all ingredients with this slug
    const items = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.slug, slug))
      .orderBy(ingredients.created_at);

    // Keep first one as-is, rename others with numeric suffix
    for (let i = 1; i < items.length; i++) {
      const newSlug = `${slug}-${i + 1}`;
      await db
        .update(ingredients)
        .set({ slug: newSlug, updated_at: new Date() })
        .where(eq(ingredients.id, items[i].id));

      console.log(`  ✅ ${items[i].display_name}: ${slug} → ${newSlug}`);
    }
  }

  console.log('\n✨ All duplicates resolved!');
}

// Run the script
fixDuplicates()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });
