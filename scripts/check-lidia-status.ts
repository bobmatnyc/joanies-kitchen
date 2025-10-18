#!/usr/bin/env tsx
/**
 * Check Lidia Bastianich recipe image status
 */

import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';

async function main() {
  console.log('Checking Lidia Bastianich recipe status...\n');

  // Find Lidia
  const [lidia] = await db
    .select()
    .from(chefs)
    .where(eq(chefs.slug, 'lidia-bastianich'))
    .limit(1);

  if (!lidia) {
    console.log('❌ Lidia Bastianich not found in database');
    process.exit(1);
  }

  console.log('✅ Chef: Lidia Bastianich');
  console.log(`   ID: ${lidia.id}`);
  console.log(`   Name: ${lidia.name || lidia.display_name}\n`);

  // Count all recipes
  const allRecipes = await db
    .select()
    .from(recipes)
    .where(eq(recipes.chef_id, lidia.id));

  console.log(`📊 Total recipes: ${allRecipes.length}`);

  // Count recipes without images
  const noImages = await db
    .select()
    .from(recipes)
    .where(
      and(
        eq(recipes.chef_id, lidia.id),
        or(isNull(recipes.images), eq(recipes.images, '[]'), eq(recipes.images, ''))
      )
    );

  console.log(`🖼️  Recipes with images: ${allRecipes.length - noImages.length}`);
  console.log(`❌ Recipes without images: ${noImages.length}\n`);

  if (noImages.length > 0) {
    console.log('Sample recipes without images:');
    noImages.slice(0, 5).forEach((r) => {
      console.log(`   - ${r.name}`);
    });
    if (noImages.length > 5) {
      console.log(`   ... and ${noImages.length - 5} more\n`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
