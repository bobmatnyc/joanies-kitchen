#!/usr/bin/env tsx
/**
 * Populate Ingredient Slugs Script
 *
 * Generates URL-friendly slugs for all existing ingredients
 * This script should be run once after adding the slug column to the schema
 *
 * Usage:
 *   pnpm tsx scripts/populate-ingredient-slugs.ts
 */

import { db } from '@/lib/db';
import { ingredients } from '@/lib/db/ingredients-schema';
import { eq } from 'drizzle-orm';

/**
 * Convert ingredient name to URL-friendly slug
 * Examples:
 *   "Green Onion" -> "green-onion"
 *   "Tomatoes (Cherry)" -> "tomatoes-cherry"
 *   "Salt & Pepper" -> "salt-and-pepper"
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Replace ampersand with 'and'
    .replace(/&/g, 'and')
    // Remove parentheses and brackets
    .replace(/[()[\]]/g, '')
    // Replace spaces and special characters with hyphens
    .replace(/[^a-z0-9]+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Replace multiple hyphens with single hyphen
    .replace(/-+/g, '-');
}

async function populateSlugs() {
  console.log('🔄 Fetching all ingredients...');

  const allIngredients = await db.select().from(ingredients);

  console.log(`📊 Found ${allIngredients.length} ingredients`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const ingredient of allIngredients) {
    try {
      // Skip if slug already exists
      if (ingredient.slug) {
        skipped++;
        continue;
      }

      // Generate slug from display_name or name
      const slug = generateSlug(ingredient.display_name || ingredient.name);

      // Update ingredient with slug
      await db
        .update(ingredients)
        .set({ slug, updated_at: new Date() })
        .where(eq(ingredients.id, ingredient.id));

      updated++;
      console.log(`✅ ${ingredient.display_name}: ${slug}`);
    } catch (error: any) {
      errors++;
      console.error(`❌ Error updating ${ingredient.display_name}:`, error.message);
    }
  }

  console.log('\n📈 Summary:');
  console.log(`  ✅ Updated: ${updated}`);
  console.log(`  ⏭️  Skipped (already had slug): ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log(`  📊 Total: ${allIngredients.length}`);
}

// Run the script
populateSlugs()
  .then(() => {
    console.log('\n✨ Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
