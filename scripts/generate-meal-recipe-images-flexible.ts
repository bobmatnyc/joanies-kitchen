#!/usr/bin/env tsx
/**
 * Generate AI images for all recipes in a specific meal
 *
 * Usage:
 *   pnpm tsx scripts/generate-meal-recipe-images-flexible.ts <meal-name>
 *
 * Or run without arguments to see available meals and choose interactively
 *
 * Process:
 * 1. Find the specified meal (or list available meals)
 * 2. Get all recipes in that meal
 * 3. For each recipe without images:
 *    - Generate DALL-E 3 image
 *    - Upload to Vercel Blob
 *    - Update recipe record
 *
 * Requirements:
 * - OPENAI_API_KEY environment variable
 * - BLOB_READ_WRITE_TOKEN environment variable
 */

import 'dotenv/config';
import { put } from '@vercel/blob';
import { eq, or, like } from 'drizzle-orm';
import OpenAI from 'openai';
import { db } from '@/lib/db';
import { recipes, meals, mealRecipes } from '@/lib/db/schema';
import * as readline from 'readline';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rate limiting configuration
const RATE_LIMIT_DELAY = 12000; // 12 seconds between requests (5 per minute for DALL-E 3)
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

// Background prompts based on recipe category/cuisine
const BACKGROUND_PROMPTS: Record<string, string> = {
  italian: 'rustic Italian trattoria with checkered tablecloth, warm candlelight, fresh basil',
  french: 'elegant French bistro, marble table, soft romantic lighting',
  asian: 'modern Asian restaurant, bamboo mat, minimalist plating',
  mexican: 'colorful Mexican cantina, terracotta dishes, vibrant setting',
  american: 'classic American diner, clean presentation, bright lighting',
  soup: 'cozy kitchen setting, rustic bowl on wooden table, steam rising, warm lighting',
  salad: 'bright garden-fresh setting, natural daylight, vibrant colors',
  dessert: 'elegant dessert display, pristine white background, soft lighting',
  bread: 'artisan bakery setting, flour-dusted surface, warm oven glow',
  default: 'professional food photography studio, clean modern setting, perfect lighting',
};

interface RecipeImageResult {
  recipeId: string;
  recipeName: string;
  success: boolean;
  imageUrl?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Generate a contextual prompt for food photography
 */
function generateImagePrompt(recipeName: string, cuisine: string | null, description: string | null): string {
  const cuisineKey = cuisine?.toLowerCase() || 'default';
  const background = BACKGROUND_PROMPTS[cuisineKey] || BACKGROUND_PROMPTS.default;

  // Determine if it's soup/salad/bread/dessert from name
  const nameLower = recipeName.toLowerCase();
  let categoryBackground = background;

  if (nameLower.includes('soup') || nameLower.includes('stew')) {
    categoryBackground = BACKGROUND_PROMPTS.soup;
  } else if (nameLower.includes('salad')) {
    categoryBackground = BACKGROUND_PROMPTS.salad;
  } else if (nameLower.includes('bread') || nameLower.includes('roll') || nameLower.includes('baguette')) {
    categoryBackground = BACKGROUND_PROMPTS.bread;
  } else if (nameLower.includes('cake') || nameLower.includes('pie') || nameLower.includes('cookie')) {
    categoryBackground = BACKGROUND_PROMPTS.dessert;
  }

  return `Professional food photography of ${recipeName}.
Setting: ${categoryBackground}
${description ? `Dish description: ${description.substring(0, 150)}` : ''}
Photographed from a flattering 45-degree angle with shallow depth of field,
styled by a professional food stylist,
warm, inviting atmosphere, vibrant natural colors,
appetizing, high-end editorial quality for a cookbook.
NO text, NO watermarks, NO logos.
Ultra-realistic, magazine-quality food photography.`;
}

/**
 * Generate AI image using DALL-E 3
 */
async function generateAIImage(recipeName: string, cuisine: string | null, description: string | null, retryCount = 0): Promise<string> {
  const prompt = generateImagePrompt(recipeName, cuisine, description);

  console.log(`   📝 Prompt: "${prompt.substring(0, 100)}..."`);

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      style: 'natural',
    });

    const imageUrl = response.data[0]?.url;

    if (!imageUrl) {
      throw new Error('No image URL returned from OpenAI');
    }

    console.log(`   ✅ AI image generated successfully`);
    return imageUrl;
  } catch (error: any) {
    if (retryCount < MAX_RETRIES && error?.status === 429) {
      console.log(`   ⏳ Rate limited, retrying in ${RETRY_DELAY/1000}s... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return generateAIImage(recipeName, cuisine, description, retryCount + 1);
    }
    console.error(`   ❌ AI generation failed:`, error?.message || error);
    throw error;
  }
}

/**
 * Download image and upload to Vercel Blob
 */
async function uploadToBlob(imageUrl: string, recipeName: string): Promise<string> {
  try {
    console.log(`   ⬇️  Downloading AI-generated image...`);

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`   ☁️  Uploading to Vercel Blob...`);

    const safeFileName = recipeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50);
    const filename = `recipes/ai/meal-${safeFileName}-${Date.now()}.png`;

    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: 'image/png',
    });

    console.log(`   ✅ Uploaded to: ${blob.url}`);
    return blob.url;
  } catch (error) {
    console.error(`   ❌ Upload failed:`, error);
    throw error;
  }
}

/**
 * Check if recipe needs image generation
 */
function needsImage(recipe: any): { needs: boolean; reason?: string } {
  if (!recipe.images || recipe.images === 'null' || recipe.images === '[]') {
    return { needs: true };
  }

  try {
    const imageArray = JSON.parse(recipe.images);
    if (!Array.isArray(imageArray) || imageArray.length === 0) {
      return { needs: true };
    }

    // Check if images are broken/invalid URLs
    const validImages = imageArray.filter((url: string) => url && url.startsWith('http'));
    if (validImages.length === 0) {
      return { needs: true, reason: 'has broken image URLs' };
    }

    return { needs: false };
  } catch (e) {
    return { needs: true, reason: 'has malformed images JSON' };
  }
}

/**
 * Process a single recipe - generate and upload image
 */
async function processRecipe(recipe: any): Promise<RecipeImageResult> {
  const result: RecipeImageResult = {
    recipeId: recipe.id,
    recipeName: recipe.name,
    success: false,
  };

  try {
    console.log(`\n🍽️  Processing: ${recipe.name}`);
    console.log(`   Cuisine: ${recipe.cuisine || 'N/A'}`);

    const imageCheck = needsImage(recipe);

    if (!imageCheck.needs) {
      console.log(`   ⏭️  Skipping - already has images`);
      result.skipped = true;
      result.skipReason = 'already has images';
      return result;
    }

    if (imageCheck.reason) {
      console.log(`   ⚠️  Reason: ${imageCheck.reason}`);
    }

    // Step 1: Generate AI image
    console.log(`   🎨 Generating AI image...`);
    const aiImageUrl = await generateAIImage(recipe.name, recipe.cuisine, recipe.description);

    // Step 2: Upload to Blob
    const blobUrl = await uploadToBlob(aiImageUrl, recipe.name);

    // Step 3: Update recipe
    console.log(`   💾 Updating recipe in database...`);

    let existingImages: string[] = [];
    if (recipe.images) {
      try {
        const parsed = JSON.parse(recipe.images);
        if (Array.isArray(parsed)) {
          existingImages = parsed.filter((url: string) => url && url.startsWith('http'));
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    const updatedImages = [blobUrl, ...existingImages];

    await db
      .update(recipes)
      .set({
        images: JSON.stringify(updatedImages),
        updated_at: new Date(),
      })
      .where(eq(recipes.id, recipe.id));

    console.log(`   ✅ Recipe updated successfully!`);

    result.success = true;
    result.imageUrl = blobUrl;

    // Rate limiting delay
    console.log(`   ⏳ Waiting ${RATE_LIMIT_DELAY/1000}s before next request...`);
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));

    return result;
  } catch (error: any) {
    console.error(`   ❌ Failed to process recipe:`, error?.message || error);
    result.error = error?.message || String(error);
    return result;
  }
}

/**
 * Ask user to choose a meal interactively
 */
async function chooseMealInteractively(availableMeals: any[]): Promise<any> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('\n📋 Available meals:');
    availableMeals.forEach((meal, i) => {
      console.log(`   ${i + 1}. ${meal.name} (ID: ${meal.id})`);
    });

    rl.question('\nEnter meal number (1-' + availableMeals.length + '): ', (answer) => {
      const index = parseInt(answer) - 1;
      rl.close();

      if (index >= 0 && index < availableMeals.length) {
        resolve(availableMeals[index]);
      } else {
        console.error('Invalid selection');
        process.exit(1);
      }
    });
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('\n🍲 Meal Recipe Image Generator');
  console.log('═'.repeat(80));

  // Verify environment variables
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY not found in environment');
    process.exit(1);
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('❌ Error: BLOB_READ_WRITE_TOKEN not found in environment');
    process.exit(1);
  }

  try {
    // Get meal name from command line arguments
    const mealNameArg = process.argv[2];

    let targetMeal;

    if (mealNameArg) {
      // Find meal by name
      console.log(`\n🔍 Looking for meal: "${mealNameArg}"...\n`);

      const matchingMeals = await db
        .select()
        .from(meals)
        .where(or(
          eq(meals.name, mealNameArg),
          like(meals.name, `%${mealNameArg}%`)
        ))
        .limit(10);

      if (matchingMeals.length === 0) {
        console.error(`❌ No meals found matching: "${mealNameArg}"`);
        console.log('\n💡 Run without arguments to see all available meals\n');
        process.exit(1);
      }

      if (matchingMeals.length === 1) {
        targetMeal = matchingMeals[0];
      } else {
        console.log(`Found ${matchingMeals.length} matching meals, using first one:`);
        matchingMeals.forEach((m, i) => {
          console.log(`   ${i + 1}. ${m.name} (ID: ${m.id})`);
        });
        targetMeal = matchingMeals[0];
        console.log(`\n   → Selected: ${targetMeal.name} (ID: ${targetMeal.id})`);
      }
    } else {
      // No argument - show all meals and let user choose
      const allMeals = await db.select().from(meals).limit(50);

      if (allMeals.length === 0) {
        console.error('❌ No meals found in database');
        process.exit(1);
      }

      targetMeal = await chooseMealInteractively(allMeals);
    }

    console.log(`\n✅ Selected meal: ${targetMeal.name} (ID: ${targetMeal.id})`);

    // Get all recipes in this meal
    console.log('\n📋 Getting recipes from meal...');

    const mealRecipesData = await db
      .select({
        recipe: recipes,
        mealRecipe: mealRecipes,
      })
      .from(mealRecipes)
      .innerJoin(recipes, eq(mealRecipes.recipe_id, recipes.id))
      .where(eq(mealRecipes.meal_id, targetMeal.id));

    if (mealRecipesData.length === 0) {
      console.log('⚠️  This meal has no recipes');
      console.log('Exiting - nothing to do.');
      process.exit(0);
    }

    const recipesToCheck = mealRecipesData.map(mr => mr.recipe);

    console.log(`✅ Found ${recipesToCheck.length} recipes in meal\n`);

    // Display all recipes
    console.log('📖 Recipes in meal:');
    recipesToCheck.forEach((r, i) => {
      const hasImages = !needsImage(r).needs;
      console.log(`   ${i + 1}. ${r.name} ${hasImages ? '✓' : '✗'}`);
    });

    // Filter recipes that need images
    const recipesNeedingImages = recipesToCheck.filter(r => needsImage(r).needs);

    console.log(`\n🎯 Recipes needing images: ${recipesNeedingImages.length} of ${recipesToCheck.length}`);

    if (recipesNeedingImages.length === 0) {
      console.log('\n✅ All recipes already have images! Nothing to do.');
      process.exit(0);
    }

    // Process each recipe
    console.log(`\n🚀 Generating images for ${recipesNeedingImages.length} recipes...`);
    console.log(`⏰ Estimated time: ~${(recipesNeedingImages.length * RATE_LIMIT_DELAY / 1000 / 60).toFixed(1)} minutes`);
    console.log(`💰 Estimated cost: $${(recipesNeedingImages.length * 0.04).toFixed(2)} (DALL-E 3 @ $0.04/image)\n`);

    const results: RecipeImageResult[] = [];

    for (let i = 0; i < recipesNeedingImages.length; i++) {
      const recipe = recipesNeedingImages[i];
      console.log(`\n[${i + 1}/${recipesNeedingImages.length}] Processing: ${recipe.name}`);

      const result = await processRecipe(recipe);
      results.push(result);
    }

    // Generate summary report
    console.log('\n\n' + '═'.repeat(80));
    console.log('📊 SUMMARY REPORT');
    console.log('═'.repeat(80));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success && !r.skipped);
    const skipped = results.filter(r => r.skipped);

    console.log(`\n✅ Successfully generated: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`⏭️  Skipped: ${skipped.length}`);
    console.log(`📊 Total processed: ${results.length}`);

    if (successful.length > 0) {
      console.log('\n✅ Successfully generated images:');
      successful.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.recipeName}`);
        console.log(`      Image: ${r.imageUrl}`);
      });
    }

    if (failed.length > 0) {
      console.log('\n❌ Failed to generate images:');
      failed.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.recipeName}`);
        console.log(`      Error: ${r.error}`);
      });
    }

    console.log(`\n💰 Total cost: $${(successful.length * 0.04).toFixed(2)}`);
    console.log(`\n🌐 View meal: http://localhost:3002/meals/${targetMeal.id}`);
    console.log('\n✅ Script completed!\n');

  } catch (error) {
    console.error('\n❌ Script failed:', error);
    throw error;
  }
}

// Run the script
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
