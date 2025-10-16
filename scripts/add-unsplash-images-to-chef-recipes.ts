#!/usr/bin/env tsx
/**
 * Add Unsplash stock photos to chef recipes without images
 * Simple fallback solution until we can generate proper AI images
 */

import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { chefRecipes } from '@/lib/db/chef-schema';
import { eq, sql } from 'drizzle-orm';

// Unsplash food image IDs for different dish types
const FOOD_IMAGES: Record<string, string> = {
  // British
  'beef-wellington': 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976',
  'scallops': 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6',
  'pudding': 'https://images.unsplash.com/photo-1551024506-0bccd828d307',
  
  // American
  'roast-chicken': 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6',
  'chocolate-cake': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587',
  'turkey': 'https://images.unsplash.com/photo-1574672280600-4accfa5b6f98',
  'cookies': 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e',
  'mac-and-cheese': 'https://images.unsplash.com/photo-1543339494-b4cd4f7ba686',
  'chicken': 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6',
  
  // French
  'omelet': 'https://images.unsplash.com/photo-1612927601601-6638404737ce',
  'chicken-ballotine': 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6',
  'ratatouille': 'https://images.unsplash.com/photo-1512058564366-18510be2db19',
  
  // Middle Eastern
  'shakshuka': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38',
  'cauliflower': 'https://images.unsplash.com/photo-1568598035424-7070b67317d2',
  'rice': 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6',
  
  // Italian
  'spaghetti': 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9',
  'focaccia': 'https://images.unsplash.com/photo-1549931319-a545dcf3bc1b',
  
  // Indian
  'tikka-masala': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641',
  'dal': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d',
  'aloo-gobi': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7',
};

function getImageForRecipe(recipeName: string): string {
  const normalized = recipeName.toLowerCase();
  
  // Try to match by keywords
  for (const [keyword, url] of Object.entries(FOOD_IMAGES)) {
    if (normalized.includes(keyword)) {
      return `${url}?w=800&h=600&fit=crop`;
    }
  }
  
  // Default fallback - generic food photo
  return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop';
}

async function addUnsplashImages() {
  console.log('📸 Adding Unsplash stock photos to chef recipes...\n');

  // Get all recipes linked to chefs that don't have images
  const recipesWithoutImages = await db
    .select({
      recipe: recipes,
    })
    .from(recipes)
    .innerJoin(chefRecipes, eq(chefRecipes.recipe_id, recipes.id))
    .where(
      sql`(${recipes.images} IS NULL OR ${recipes.images}::text = '[]')`
    );

  console.log(`Found ${recipesWithoutImages.length} recipes needing images\n`);

  let successCount = 0;

  for (const { recipe } of recipesWithoutImages) {
    const imageUrl = getImageForRecipe(recipe.name);
    
    try {
      await db
        .update(recipes)
        .set({
          images: JSON.stringify([imageUrl]),
          updated_at: new Date(),
        })
        .where(eq(recipes.id, recipe.id));

      console.log(`✅ ${recipe.name.padEnd(40)} → ${imageUrl.substring(0, 50)}...`);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to update ${recipe.name}:`, error);
    }
  }

  console.log('\n═'.repeat(70));
  console.log(`Successfully added images to ${successCount}/${recipesWithoutImages.length} recipes`);
  console.log('═'.repeat(70));

  console.log('\n🎉 Image assignment complete!');
  console.log(`\n🌐 View chefs: http://localhost:3002/discover/chefs`);
}

addUnsplashImages()
  .then(() => {
    console.log('\n✅ Script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
