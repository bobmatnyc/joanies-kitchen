#!/usr/bin/env tsx
/**
 * Fix Ingredient Slugs - Handle Duplicates
 *
 * This script:
 * 1. Identifies duplicate slug conflicts
 * 2. Generates unique slugs by appending incrementing numbers
 * 3. Populates all missing slugs
 */

import { db } from '@/lib/db';
import { ingredients } from '@/lib/db/ingredients-schema';
import { eq, sql } from 'drizzle-orm';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[()[\]]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

async function fixSlugs() {
  console.log('🔍 Fetching ingredients without slugs...\n');

  const ingredientsToUpdate = await db
    .select()
    .from(ingredients)
    .where(sql`${ingredients.slug} IS NULL`);

  console.log(`📊 Found ${ingredientsToUpdate.length} ingredients without slugs\n`);

  // Track existing slugs to avoid conflicts
  const existingSlugsResult = await db
    .select({ slug: ingredients.slug })
    .from(ingredients)
    .where(sql`${ingredients.slug} IS NOT NULL`);

  const usedSlugs = new Set(
    existingSlugsResult.map((r) => r.slug).filter((s): s is string => s !== null)
  );

  console.log(`📋 Found ${usedSlugs.size} existing slugs\n`);

  let updated = 0;
  let errors = 0;

  for (const ingredient of ingredientsToUpdate) {
    try {
      // Generate base slug
      let baseSlug = generateSlug(ingredient.display_name || ingredient.name);
      let slug = baseSlug;
      let counter = 1;

      // If slug exists, append number until we find a unique one
      while (usedSlugs.has(slug)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      // Update ingredient
      await db
        .update(ingredients)
        .set({ slug, updated_at: new Date() })
        .where(eq(ingredients.id, ingredient.id));

      // Mark slug as used
      usedSlugs.add(slug);

      updated++;
      if (counter > 1) {
        console.log(`✅ ${ingredient.display_name}: ${slug} (was duplicate, added -${counter - 1})`);
      } else {
        console.log(`✅ ${ingredient.display_name}: ${slug}`);
      }
    } catch (error: any) {
      errors++;
      console.error(`❌ Error updating ${ingredient.display_name}:`, error.message);
    }
  }

  console.log('\n📈 Summary:');
  console.log(`  ✅ Updated: ${updated}`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log(`  📊 Total processed: ${ingredientsToUpdate.length}`);
}

fixSlugs()
  .then(() => {
    console.log('\n✨ Fix complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fix failed:', error);
    process.exit(1);
  });
