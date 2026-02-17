#!/usr/bin/env tsx
/**
 * Check Ingredient Slugs
 * Quick diagnostic to see if ingredients have slugs populated
 */

import { db } from '@/lib/db';
import { ingredients } from '@/lib/db/ingredients-schema';
import { sql } from 'drizzle-orm';

async function checkSlugs() {
  console.log('🔍 Checking ingredient slugs...\n');

  // Count total ingredients
  const [totalCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ingredients);

  // Count ingredients with slugs
  const [withSlugs] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ingredients)
    .where(sql`${ingredients.slug} IS NOT NULL`);

  // Count ingredients without slugs
  const [withoutSlugs] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ingredients)
    .where(sql`${ingredients.slug} IS NULL`);

  console.log('📊 Slug Status:');
  console.log(`  Total ingredients: ${totalCount.count}`);
  console.log(`  With slugs: ${withSlugs.count}`);
  console.log(`  Without slugs: ${withoutSlugs.count}`);

  // Show sample ingredients without slugs
  if (withoutSlugs.count > 0) {
    console.log('\n📋 Sample ingredients without slugs:');
    const samples = await db
      .select({
        id: ingredients.id,
        name: ingredients.name,
        display_name: ingredients.display_name,
        slug: ingredients.slug,
      })
      .from(ingredients)
      .where(sql`${ingredients.slug} IS NULL`)
      .limit(10);

    samples.forEach((ing) => {
      console.log(`  - ${ing.display_name} (${ing.name}): slug=${ing.slug}`);
    });
  }

  // Show sample ingredients with slugs
  if (withSlugs.count > 0) {
    console.log('\n✅ Sample ingredients with slugs:');
    const samples = await db
      .select({
        id: ingredients.id,
        name: ingredients.name,
        display_name: ingredients.display_name,
        slug: ingredients.slug,
      })
      .from(ingredients)
      .where(sql`${ingredients.slug} IS NOT NULL`)
      .limit(10);

    samples.forEach((ing) => {
      console.log(`  - ${ing.display_name}: /ingredients/${ing.slug}`);
    });
  }
}

checkSlugs()
  .then(() => {
    console.log('\n✨ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Check failed:', error);
    process.exit(1);
  });
