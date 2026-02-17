#!/usr/bin/env tsx
/**
 * Data Analysis Script - Chefs Without Recipes and Ingredient Image URLs
 *
 * Analyzes:
 * 1. Chefs without any associated recipes
 * 2. Ingredient image URL status (local paths vs Blob URLs)
 */

import { eq, sql, isNull, count } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import { ingredients } from '@/lib/db/ingredients-schema';

async function analyzeChefRecipeCoverage() {
  console.log('\n=== TASK 1: CHEFS WITHOUT RECIPES ===\n');

  try {
    // Get total count of chefs
    const totalChefsResult = await db
      .select({ count: count() })
      .from(chefs);
    const totalChefs = totalChefsResult[0]?.count || 0;

    console.log(`Total chefs in database: ${totalChefs}`);

    // Find chefs with recipe counts
    const chefsWithRecipeCounts = await db
      .select({
        id: chefs.id,
        name: chefs.name,
        display_name: chefs.display_name,
        recipe_count: sql<number>`CAST(COUNT(${recipes.id}) AS INTEGER)`,
      })
      .from(chefs)
      .leftJoin(recipes, eq(recipes.chef_id, chefs.id))
      .groupBy(chefs.id, chefs.name, chefs.display_name)
      .orderBy(sql`COUNT(${recipes.id}) DESC`);

    // Separate chefs with and without recipes
    const chefsWithRecipes = chefsWithRecipeCounts.filter(chef => chef.recipe_count > 0);
    const chefsWithoutRecipes = chefsWithRecipeCounts.filter(chef => chef.recipe_count === 0);

    console.log(`Chefs with recipes: ${chefsWithRecipes.length}`);
    console.log(`Chefs without recipes: ${chefsWithoutRecipes.length}`);

    // Check specifically for Alton Brown
    const altonBrown = chefsWithRecipeCounts.find(chef =>
      chef.name.toLowerCase().includes('alton') && chef.name.toLowerCase().includes('brown')
    );

    if (altonBrown) {
      console.log(`\n✓ Alton Brown found: "${altonBrown.display_name}" (${altonBrown.recipe_count} recipes)`);
    } else {
      console.log('\n✗ Alton Brown NOT found in database');
    }

    // Display chefs without recipes
    console.log('\n--- Chefs Without Any Recipes ---');
    if (chefsWithoutRecipes.length === 0) {
      console.log('✓ All chefs have at least one recipe!');
    } else {
      console.log(`\nFound ${chefsWithoutRecipes.length} chefs without recipes:\n`);
      chefsWithoutRecipes.forEach((chef, idx) => {
        console.log(`${idx + 1}. ${chef.display_name} (${chef.name})`);
        console.log(`   ID: ${chef.id}`);
      });
    }

    // Show top chefs by recipe count
    console.log('\n--- Top 10 Chefs by Recipe Count ---');
    chefsWithRecipes.slice(0, 10).forEach((chef, idx) => {
      console.log(`${idx + 1}. ${chef.display_name}: ${chef.recipe_count} recipes`);
    });

    return {
      totalChefs,
      chefsWithRecipes: chefsWithRecipes.length,
      chefsWithoutRecipes: chefsWithoutRecipes.length,
      chefsWithoutRecipesList: chefsWithoutRecipes,
      altonBrown,
    };
  } catch (error) {
    console.error('Error analyzing chef recipe coverage:', error);
    throw error;
  }
}

async function analyzeIngredientImageUrls() {
  console.log('\n\n=== TASK 2: INGREDIENT IMAGE URL STATUS ===\n');

  try {
    // Get total ingredient count
    const totalIngredientsResult = await db
      .select({ count: count() })
      .from(ingredients);
    const totalIngredients = totalIngredientsResult[0]?.count || 0;

    console.log(`Total ingredients in database: ${totalIngredients}`);

    // Get ingredients with and without image URLs
    const ingredientsWithImages = await db
      .select({
        id: ingredients.id,
        name: ingredients.name,
        display_name: ingredients.display_name,
        image_url: ingredients.image_url,
      })
      .from(ingredients)
      .where(sql`${ingredients.image_url} IS NOT NULL AND ${ingredients.image_url} != ''`)
      .limit(1000); // Sample limit

    const ingredientsWithoutImages = await db
      .select({ count: count() })
      .from(ingredients)
      .where(sql`${ingredients.image_url} IS NULL OR ${ingredients.image_url} = ''`);

    const withImagesCount = ingredientsWithImages.length;
    const withoutImagesCount = ingredientsWithoutImages[0]?.count || 0;

    console.log(`Ingredients with image URLs: ${withImagesCount}`);
    console.log(`Ingredients without image URLs: ${withoutImagesCount}`);

    // Analyze URL formats
    let localPathCount = 0;
    let blobUrlCount = 0;
    let relativePathCount = 0;
    let otherUrlCount = 0;

    const urlPatterns: Record<string, number> = {};

    ingredientsWithImages.forEach(ingredient => {
      const url = ingredient.image_url || '';

      // Track patterns more accurately
      let pattern = 'Unknown';

      if (url.includes('public/images/ingredients/')) {
        pattern = 'Local Absolute Path (public/images/ingredients/)';
        localPathCount++;
      } else if (url.startsWith('/images/ingredients/')) {
        pattern = 'Relative Path (/images/ingredients/)';
        relativePathCount++;
      } else if (url.includes('.blob.vercel-storage.com')) {
        pattern = 'Vercel Blob Storage';
        blobUrlCount++;
      } else if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
          const urlObj = new URL(url);
          pattern = `External URL (${urlObj.hostname})`;
          otherUrlCount++;
        } catch {
          pattern = 'Invalid URL';
        }
      } else if (url.startsWith('/') && !url.startsWith('/images/ingredients/')) {
        pattern = `Other Relative Path (${url.split('/')[1] || 'root'})`;
      }

      urlPatterns[pattern] = (urlPatterns[pattern] || 0) + 1;
    });

    console.log('\n--- Image URL Format Analysis ---');
    console.log(`Local absolute paths (public/images/ingredients/): ${localPathCount}`);
    console.log(`Relative paths (/images/ingredients/): ${relativePathCount}`);
    console.log(`Vercel Blob URLs: ${blobUrlCount}`);
    console.log(`Other external URLs: ${otherUrlCount}`);

    console.log('\n--- URL Pattern Breakdown ---');
    Object.entries(urlPatterns)
      .sort(([, a], [, b]) => b - a)
      .forEach(([pattern, count]) => {
        console.log(`${pattern}: ${count}`);
      });

    // Sample 10 ingredients with different URL types
    console.log('\n--- Sample Ingredient Records (10 examples) ---');

    const samples = ingredientsWithImages.slice(0, 10);
    samples.forEach((ingredient, idx) => {
      console.log(`\n${idx + 1}. ${ingredient.display_name} (${ingredient.name})`);
      console.log(`   ID: ${ingredient.id}`);
      console.log(`   Image URL: ${ingredient.image_url}`);

      const url = ingredient.image_url || '';
      let urlType = 'Unknown';
      if (url.includes('public/images/ingredients/')) {
        urlType = '⚠️  Local Path (needs migration)';
      } else if (url.includes('.blob.vercel-storage.com')) {
        urlType = '✓ Vercel Blob Storage';
      } else if (url.startsWith('http')) {
        urlType = 'External URL';
      }
      console.log(`   Type: ${urlType}`);
    });

    return {
      totalIngredients,
      withImagesCount,
      withoutImagesCount,
      localPathCount,
      relativePathCount,
      blobUrlCount,
      otherUrlCount,
      urlPatterns,
    };
  } catch (error) {
    console.error('Error analyzing ingredient image URLs:', error);
    throw error;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   JOANIE\'S KITCHEN - DATA ANALYSIS REPORT                      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  try {
    // Task 1: Chef Recipe Coverage
    const chefAnalysis = await analyzeChefRecipeCoverage();

    // Task 2: Ingredient Image URLs
    const ingredientAnalysis = await analyzeIngredientImageUrls();

    // Summary and Recommendations
    console.log('\n\n=== SUMMARY AND RECOMMENDATIONS ===\n');

    console.log('TASK 1: Chefs Without Recipes');
    console.log('─────────────────────────────────');
    if (chefAnalysis.chefsWithoutRecipes === 0) {
      console.log('✓ Status: GOOD - All chefs have recipes');
    } else {
      console.log(`⚠️  Status: ${chefAnalysis.chefsWithoutRecipes} chefs have no recipes`);
      console.log('\nRecommendations:');
      console.log('1. Review if these chefs should have recipes imported');
      console.log('2. Consider removing unused chef records to reduce database size');
      console.log('3. Check if recipes failed to import during migration');
    }

    if (chefAnalysis.altonBrown) {
      console.log(`\n✓ Alton Brown: ${chefAnalysis.altonBrown.recipe_count} recipes found`);
    } else {
      console.log('\n⚠️  Alton Brown: Not found - may need to import recipes');
    }

    console.log('\n\nTASK 2: Ingredient Image URLs');
    console.log('─────────────────────────────────');

    const needsMigration = ingredientAnalysis.localPathCount + ingredientAnalysis.relativePathCount;

    if (needsMigration > 0) {
      console.log(`⚠️  Status: ${needsMigration} ingredients need URL migration`);
      console.log(`   - Local absolute paths: ${ingredientAnalysis.localPathCount}`);
      console.log(`   - Relative paths: ${ingredientAnalysis.relativePathCount}`);
      console.log('\nRecommendations:');
      console.log('1. Run migration to convert local/relative paths to Vercel Blob URLs');
      console.log('2. Expected format: https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/ingredients/{filename}');
      console.log('3. Migration script: scripts/migrate-ingredient-images.ts (or similar)');
    } else if (ingredientAnalysis.blobUrlCount > 0) {
      console.log('✓ Status: GOOD - All images with local paths have been migrated');
      console.log(`   - Blob URLs: ${ingredientAnalysis.blobUrlCount}`);
      console.log(`   - External URLs: ${ingredientAnalysis.otherUrlCount}`);
    } else {
      console.log('⚠️  Status: No Blob URLs found - check migration status');
    }

    console.log(`\nImage Coverage: ${ingredientAnalysis.withImagesCount}/${ingredientAnalysis.totalIngredients} (${((ingredientAnalysis.withImagesCount / ingredientAnalysis.totalIngredients) * 100).toFixed(1)}%)`);

    if (ingredientAnalysis.withoutImagesCount > 0) {
      console.log(`\n⚠️  ${ingredientAnalysis.withoutImagesCount} ingredients have no images`);
      console.log('Consider adding images for better user experience');
    }

    console.log('\n\n✓ Analysis Complete!');
    process.exit(0);
  } catch (error) {
    console.error('\n\n✗ Analysis Failed:', error);
    process.exit(1);
  }
}

main();
