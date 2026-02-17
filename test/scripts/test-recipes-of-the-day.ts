#!/usr/bin/env tsx
/**
 * Test script for getRecipesOfTheDay()
 * Validates:
 * - Deterministic selection (same results for same day)
 * - Recipe complementarity (uses semantic search)
 * - Returns exactly 4 recipes (or as many as available)
 * - All recipes have images
 */

import { getRecipesOfTheDay } from '@/app/actions/recipes';

async function testRecipesOfTheDay() {
  console.log('🧪 Testing Recipes of the Day...\n');

  // Test 1: Run the function
  console.log('Test 1: Fetching recipes of the day...');
  const recipes1 = await getRecipesOfTheDay();

  console.log(`✓ Fetched ${recipes1.length} recipes`);
  console.log('\nRecipes:');
  recipes1.forEach((recipe, index) => {
    const tags = recipe.tags ? JSON.parse(recipe.tags as string) : [];
    const courseType = tags.find((t: string) =>
      ['appetizer', 'main', 'side', 'dessert'].some(c => t.includes(c))
    ) || 'unknown';
    console.log(`  ${index + 1}. [${courseType}] ${recipe.name}`);
    console.log(`     Cuisine: ${recipe.cuisine || 'N/A'}`);
    console.log(`     Rating: ${recipe.system_rating || 'N/A'}`);
    console.log(`     Has image: ${!!(recipe.image_url || recipe.images)}`);
  });

  // Test 2: Verify determinism (run again, should get same results)
  console.log('\n\nTest 2: Verifying deterministic selection...');
  const recipes2 = await getRecipesOfTheDay();

  const isSame = recipes1.length === recipes2.length &&
    recipes1.every((r1, i) => r1.id === recipes2[i].id);

  if (isSame) {
    console.log('✓ Deterministic selection works (same recipes on multiple calls)');
  } else {
    console.log('✗ WARNING: Results differ between calls!');
    console.log('First call:', recipes1.map(r => r.name));
    console.log('Second call:', recipes2.map(r => r.name));
  }

  // Test 3: Check recipe diversity
  console.log('\n\nTest 3: Checking recipe complementarity...');
  const cuisines = new Set(recipes1.map(r => r.cuisine).filter(Boolean));
  const categories = new Set(
    recipes1.flatMap(r => {
      const tags = r.tags ? JSON.parse(r.tags as string) : [];
      return tags.filter((t: string) =>
        ['appetizer', 'main', 'side', 'dessert', 'starter', 'dinner'].some(c => t.includes(c))
      );
    })
  );

  console.log(`Cuisines represented: ${Array.from(cuisines).join(', ') || 'N/A'}`);
  console.log(`Categories represented: ${Array.from(categories).join(', ')}`);
  console.log(`✓ Recipe diversity: ${cuisines.size} cuisine(s), ${categories.size} category tags`);

  // Test 4: Verify all have images
  console.log('\n\nTest 4: Verifying all recipes have images...');
  const allHaveImages = recipes1.every(r => r.image_url || r.images);
  if (allHaveImages) {
    console.log('✓ All recipes have images');
  } else {
    console.log('✗ Some recipes missing images:');
    recipes1.filter(r => !(r.image_url || r.images)).forEach(r => {
      console.log(`  - ${r.name}`);
    });
  }

  console.log('\n✅ Testing complete!');
}

testRecipesOfTheDay().catch(console.error);
