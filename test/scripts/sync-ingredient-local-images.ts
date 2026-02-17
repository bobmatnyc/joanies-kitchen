#!/usr/bin/env tsx

/**
 * Sync Ingredient Images to Local Files
 * Maps ingredients using Unsplash URLs to local PNG files where available
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { eq, like } from 'drizzle-orm';
import { db } from '@/lib/db/index.js';
import { ingredients } from '@/lib/db/ingredients-schema.js';

async function syncIngredientImages() {
  console.log('\n🔄 Syncing Ingredient Images to Local Files\n');
  console.log('='.repeat(70));

  // Get all local ingredient image files
  const imagesDir = join(process.cwd(), 'public', 'images', 'ingredients');
  const imageFiles = readdirSync(imagesDir).filter((f) => f.endsWith('.png'));

  console.log(`\nFound ${imageFiles.length} local PNG files\n`);

  // Get all ingredients using Unsplash URLs
  const unsplashIngredients = await db
    .select()
    .from(ingredients)
    .where(like(ingredients.image_url, 'https://images.unsplash.com%'));

  console.log(`Found ${unsplashIngredients.length} ingredients using Unsplash URLs\n`);
  console.log('Attempting to map to local files...\n');

  let matched = 0;
  let updated = 0;
  let notFound = 0;

  for (const ingredient of unsplashIngredients) {
    // Try multiple filename variations to match existing files
    const baseName = ingredient.name.toLowerCase();

    // Variation 1: Hyphens (e.g., "almond-milk.png")
    const hyphenFilename = `${baseName.replace(/\s+/g, '-')}.png`;
    // Variation 2: Underscores (e.g., "almond_milk.png") - MOST COMMON
    const underscoreFilename = `${baseName.replace(/\s+/g, '_')}.png`;
    // Variation 3: No spaces (e.g., "almondmilk.png")
    const noSpaceFilename = `${baseName.replace(/\s+/g, '')}.png`;

    let matchedFilename: string | null = null;

    // Try each variation in order of likelihood
    if (imageFiles.includes(underscoreFilename)) {
      matchedFilename = underscoreFilename;
    } else if (imageFiles.includes(hyphenFilename)) {
      matchedFilename = hyphenFilename;
    } else if (imageFiles.includes(noSpaceFilename)) {
      matchedFilename = noSpaceFilename;
    }

    if (matchedFilename) {
      matched++;
      const localPath = `/images/ingredients/${matchedFilename}`;

      // Update database
      await db
        .update(ingredients)
        .set({ image_url: localPath })
        .where(eq(ingredients.id, ingredient.id));

      updated++;
      console.log(`✅ ${ingredient.display_name.padEnd(40)} → ${matchedFilename}`);
    } else {
      notFound++;
      if (notFound <= 20) {
        console.log(`❌ ${ingredient.display_name.padEnd(40)} → ${underscoreFilename} (NOT FOUND)`);
      }
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`\n📊 Sync Results:`);
  console.log(`   Total Unsplash ingredients: ${unsplashIngredients.length}`);
  console.log(`   Matched to local files: ${matched}`);
  console.log(`   Updated in database: ${updated}`);
  console.log(`   Not found locally: ${notFound}`);
  console.log(`   Success rate: ${((matched / unsplashIngredients.length) * 100).toFixed(1)}%\n`);

  if (notFound > 0) {
    console.log(`⚠️  ${notFound} ingredients still need local images generated`);
    console.log('   These will continue using Unsplash URLs until images are generated\n');
  }

  process.exit(0);
}

syncIngredientImages().catch((error) => {
  console.error('Error syncing ingredient images:', error);
  process.exit(1);
});
