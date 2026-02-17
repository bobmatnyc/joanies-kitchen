/**
 * Identify Top 50 Recipes for Image Generation
 *
 * This script queries the database to identify the best 50 recipes
 * for professional image generation based on available quality metrics.
 *
 * PRIORITIZATION CRITERIA:
 * 1. Chef-attributed recipes (highest quality)
 * 2. System/curated recipes (verified quality)
 * 3. Recipes with good metadata (description, tags, cuisine)
 * 4. Recipes with few/no existing images
 * 5. Diverse cuisine representation
 *
 * USAGE:
 *   pnpm tsx scripts/post-launch/identify-top50-recipes.ts
 */

import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { chefs } from '@/lib/db/chef-schema';
import { desc, eq, isNotNull, sql } from 'drizzle-orm';

interface RecipeCandidate {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  cuisine: string | null;
  images: string | null;
  tags: string | null;
  is_system_recipe: boolean;
  chef_id: string | null;
  created_at: Date;
  image_count: number;
  has_description: boolean;
  has_cuisine: boolean;
  has_tags: boolean;
  quality_score: number;
}

function calculateQualityScore(recipe: any): number {
  let score = 0;

  // Chef attribution (highest weight)
  if (recipe.chef_id) score += 50;

  // System/curated recipe
  if (recipe.is_system_recipe) score += 30;

  // Has description
  if (recipe.description && recipe.description.length > 50) score += 10;

  // Has cuisine
  if (recipe.cuisine) score += 5;

  // Has tags
  if (recipe.tags && JSON.parse(recipe.tags).length > 0) score += 5;

  // Fewer images = higher priority (need images)
  const imageCount = recipe.images ? JSON.parse(recipe.images).length : 0;
  if (imageCount === 0) score += 20;
  else if (imageCount === 1) score += 10;
  else if (imageCount < 3) score += 5;

  return score;
}

async function identifyTop50() {
  console.log('🔍 Identifying top 50 recipes for image generation...\n');

  // Query public recipes
  const publicRecipes = await db
    .select()
    .from(recipes)
    .where(eq(recipes.is_public, true))
    .orderBy(desc(recipes.created_at));

  console.log(`📊 Total public recipes: ${publicRecipes.length}`);

  // Calculate quality scores
  const candidates: RecipeCandidate[] = publicRecipes
    .filter(recipe => {
      // Filter out recipes with corrupted data
      try {
        if (recipe.images) JSON.parse(recipe.images);
        if (recipe.tags) JSON.parse(recipe.tags);
        return true;
      } catch (e) {
        console.log(`⚠️  Skipping recipe ${recipe.id} (${recipe.name}) - corrupted JSON`);
        return false;
      }
    })
    .map(recipe => {
    const imageCount = recipe.images ? JSON.parse(recipe.images).length : 0;
    const hasDescription = !!recipe.description && recipe.description.length > 50;
    const hasCuisine = !!recipe.cuisine;
    const hasTags = !!recipe.tags && JSON.parse(recipe.tags).length > 0;
    const qualityScore = calculateQualityScore(recipe);

    return {
      id: recipe.id,
      name: recipe.name,
      slug: recipe.slug,
      description: recipe.description,
      cuisine: recipe.cuisine,
      images: recipe.images,
      tags: recipe.tags,
      is_system_recipe: recipe.is_system_recipe,
      chef_id: recipe.chef_id,
      created_at: recipe.created_at,
      image_count: imageCount,
      has_description: hasDescription,
      has_cuisine: hasCuisine,
      has_tags: hasTags,
      quality_score: qualityScore,
    };
  });

  // Sort by quality score
  candidates.sort((a, b) => b.quality_score - a.quality_score);

  // Get top 50
  const top50 = candidates.slice(0, 50);

  // Statistics
  const stats = {
    total: top50.length,
    with_chef: top50.filter(r => r.chef_id).length,
    system_recipes: top50.filter(r => r.is_system_recipe).length,
    with_description: top50.filter(r => r.has_description).length,
    with_cuisine: top50.filter(r => r.has_cuisine).length,
    with_tags: top50.filter(r => r.has_tags).length,
    no_images: top50.filter(r => r.image_count === 0).length,
    one_image: top50.filter(r => r.image_count === 1).length,
    two_images: top50.filter(r => r.image_count === 2).length,
  };

  // Cuisine distribution
  const cuisineCount: Record<string, number> = {};
  top50.forEach(r => {
    if (r.cuisine) {
      cuisineCount[r.cuisine] = (cuisineCount[r.cuisine] || 0) + 1;
    }
  });

  console.log('\n📈 TOP 50 STATISTICS:');
  console.log('━'.repeat(60));
  console.log(`Total recipes:           ${stats.total}`);
  console.log(`Chef-attributed:         ${stats.with_chef} (${((stats.with_chef / stats.total) * 100).toFixed(1)}%)`);
  console.log(`System/curated:          ${stats.system_recipes} (${((stats.system_recipes / stats.total) * 100).toFixed(1)}%)`);
  console.log(`With description:        ${stats.with_description} (${((stats.with_description / stats.total) * 100).toFixed(1)}%)`);
  console.log(`With cuisine:            ${stats.with_cuisine} (${((stats.with_cuisine / stats.total) * 100).toFixed(1)}%)`);
  console.log(`With tags:               ${stats.with_tags} (${((stats.with_tags / stats.total) * 100).toFixed(1)}%)`);
  console.log(`No images:               ${stats.no_images} (${((stats.no_images / stats.total) * 100).toFixed(1)}%)`);
  console.log(`One image:               ${stats.one_image} (${((stats.one_image / stats.total) * 100).toFixed(1)}%)`);
  console.log(`Two+ images:             ${stats.two_images} (${((stats.two_images / stats.total) * 100).toFixed(1)}%)`);

  console.log('\n🍽️  CUISINE DISTRIBUTION:');
  console.log('━'.repeat(60));
  Object.entries(cuisineCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cuisine, count]) => {
      console.log(`${cuisine.padEnd(30)} ${count} recipes`);
    });

  console.log('\n🎯 TOP 50 RECIPES (Ranked by Quality Score):');
  console.log('━'.repeat(80));

  top50.forEach((recipe, idx) => {
    const chef = recipe.chef_id ? ` [Chef: ${recipe.chef_id.substring(0, 8)}...]` : '';
    const system = recipe.is_system_recipe ? ' [SYSTEM]' : '';
    const images = `[${recipe.image_count} img]`;
    const cuisine = recipe.cuisine ? `(${recipe.cuisine})` : '(no cuisine)';
    const score = `[Score: ${recipe.quality_score}]`;

    console.log(`${String(idx + 1).padStart(2)}. ${score} ${images} ${recipe.name} ${cuisine}${chef}${system}`);
  });

  console.log('\n💰 COST ESTIMATE:');
  console.log('━'.repeat(60));
  console.log(`50 recipes × 2 variations × $0.04 = $4.00`);
  console.log(`Estimated time: 2-3 hours (network dependent)`);

  console.log('\n✅ Ready to run image generation:');
  console.log('   pnpm tsx scripts/post-launch/generate-top50-images.ts --dry-run');
  console.log('   pnpm tsx scripts/post-launch/generate-top50-images.ts');

  return top50;
}

// Execute
identifyTop50()
  .then(() => {
    console.log('\n✅ Top 50 identification complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
