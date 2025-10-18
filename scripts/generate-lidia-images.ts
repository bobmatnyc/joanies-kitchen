#!/usr/bin/env tsx

/**
 * Generate AI Images for Lidia Bastianich's Recipes
 *
 * This script generates professional food photography images for all of Lidia Bastianich's
 * recipes that don't have images yet, using OpenRouter's Gemini 2.5 Flash Image Preview model.
 *
 * Features:
 * - Queries database to find Lidia's recipes without images
 * - Generates high-quality food photography using AI
 * - Saves images to public/recipes/lidia/
 * - Updates recipe records with image URLs
 * - Idempotent (skips recipes that already have images)
 * - Comprehensive error handling and progress logging
 *
 * Usage:
 *   npx tsx scripts/generate-lidia-images.ts
 *
 * Environment Variables Required:
 *   OPENROUTER_API_KEY - OpenRouter API key
 *   DATABASE_URL - Neon PostgreSQL connection string
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { and, eq, isNull, or } from 'drizzle-orm';
import OpenAI from 'openai';
import { db } from '@/lib/db';
import { chefs, chefRecipes } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';

// Configuration
const IMAGE_GENERATION_MODEL = 'google/gemini-2.5-flash-image-preview';
const OUTPUT_DIR = 'public/recipes/lidia';
const ASPECT_RATIO = '1:1'; // Square images work best for recipe cards
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// OpenRouter client
let openRouterClient: OpenAI | null = null;

function getOpenRouterClient(): OpenAI {
  if (!openRouterClient) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is not set');
    }

    openRouterClient = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002',
        'X-Title': 'Recipe Manager - Image Generation',
      },
    });
  }
  return openRouterClient;
}

/**
 * Generate a professional food photography prompt for a recipe
 */
function generateImagePrompt(
  recipeName: string,
  description: string | null,
  cuisine: string | null
): string {
  const cuisineText = cuisine ? `${cuisine} cuisine` : 'Italian cuisine';
  const descriptionText = description ? description.substring(0, 200) : 'delicious and authentic';

  return `Professional food photography of ${recipeName}, ${cuisineText}. ${descriptionText}.
The dish is beautifully plated on a rustic ceramic dish with natural lighting from the side,
showcasing the textures and colors of the ingredients. High-quality restaurant-style presentation,
warm and inviting atmosphere, shallow depth of field, appetizing composition.
Style: editorial food photography, authentic Italian home cooking aesthetic.`;
}

/**
 * Generate an image using OpenRouter API
 */
async function generateImage(
  prompt: string,
  recipeId: string,
  attempt: number = 1
): Promise<string | null> {
  const client = getOpenRouterClient();

  try {
    console.log(`   🎨 Generating image (attempt ${attempt}/${MAX_RETRIES})...`);

    const response = await client.chat.completions.create({
      model: IMAGE_GENERATION_MODEL,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      // @ts-expect-error - OpenRouter specific parameters
      modalities: ['image', 'text'],
      image_config: {
        aspect_ratio: ASPECT_RATIO,
      },
      stream: false,
    });

    // Extract image data from response
    const choice = response.choices?.[0];
    if (!choice?.message) {
      throw new Error('No response from image generation API');
    }

    // @ts-expect-error - OpenRouter returns images in a specific format
    const images = choice.message.images;
    if (!images || images.length === 0) {
      throw new Error('No images generated in response');
    }

    // Extract base64 image data
    const imageData = images[0];
    const base64Data = imageData.image_url?.url;

    if (!base64Data) {
      throw new Error('No image URL in response');
    }

    // Remove data URL prefix if present
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');

    return base64Image;
  } catch (error) {
    console.error(`   ❌ Error generating image (attempt ${attempt}):`, error);

    // Retry logic
    if (attempt < MAX_RETRIES) {
      console.log(`   ⏳ Retrying in ${RETRY_DELAY_MS / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return generateImage(prompt, recipeId, attempt + 1);
    }

    return null;
  }
}

/**
 * Save base64 image to file system
 */
function saveImageToFile(base64Data: string, recipeId: string, recipeName: string): string | null {
  try {
    // Ensure output directory exists
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`   📁 Created directory: ${OUTPUT_DIR}`);
    }

    // Generate filename from recipe name (sanitized)
    const sanitizedName = recipeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);

    const filename = `${sanitizedName}-${recipeId.substring(0, 8)}.png`;
    const filepath = join(OUTPUT_DIR, filename);

    // Convert base64 to buffer and write to file
    const buffer = Buffer.from(base64Data, 'base64');
    writeFileSync(filepath, buffer);

    console.log(`   💾 Saved image: ${filepath}`);

    // Return URL path (relative to public directory)
    return `/recipes/lidia/${filename}`;
  } catch (error) {
    console.error(`   ❌ Error saving image:`, error);
    return null;
  }
}

/**
 * Update recipe record with generated image URL
 */
async function updateRecipeImage(recipeId: string, imageUrl: string): Promise<boolean> {
  try {
    await db
      .update(recipes)
      .set({
        images: JSON.stringify([imageUrl]),
        updated_at: new Date(),
      })
      .where(eq(recipes.id, recipeId));

    console.log(`   ✅ Updated recipe with image URL`);
    return true;
  } catch (error) {
    console.error(`   ❌ Error updating recipe:`, error);
    return false;
  }
}

/**
 * Process a single recipe
 */
async function processRecipe(recipe: any): Promise<boolean> {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📖 Recipe: ${recipe.name}`);
  console.log(`   ID: ${recipe.id}`);
  console.log(`   Cuisine: ${recipe.cuisine || 'Not specified'}`);
  console.log(`   Description: ${recipe.description?.substring(0, 100)}...`);
  console.log('─'.repeat(70));

  // Generate image prompt
  const prompt = generateImagePrompt(recipe.name, recipe.description, recipe.cuisine);
  console.log(`   📝 Prompt: ${prompt.substring(0, 150)}...`);

  // Generate image
  const base64Image = await generateImage(prompt, recipe.id);
  if (!base64Image) {
    console.log(`   ⚠️  Failed to generate image after ${MAX_RETRIES} attempts`);
    return false;
  }

  // Save image to file
  const imageUrl = saveImageToFile(base64Image, recipe.id, recipe.name);
  if (!imageUrl) {
    console.log(`   ⚠️  Failed to save image to file`);
    return false;
  }

  // Update recipe record
  const updated = await updateRecipeImage(recipe.id, imageUrl);
  if (!updated) {
    console.log(`   ⚠️  Failed to update recipe record`);
    return false;
  }

  console.log(`   🎉 Successfully generated and saved image!`);
  return true;
}

/**
 * Main script execution
 */
async function main() {
  console.log(`\n${'═'.repeat(70)}`);
  console.log('🖼️  AI IMAGE GENERATION FOR LIDIA BASTIANICH RECIPES');
  console.log(`${'═'.repeat(70)}\n`);

  try {
    // Step 1: Find Lidia Bastianich's chef_id
    console.log('🔍 Step 1: Finding Lidia Bastianich in database...\n');

    const [lidia] = await db
      .select()
      .from(chefs)
      .where(eq(chefs.slug, 'lidia-bastianich'))
      .limit(1);

    if (!lidia) {
      console.error('❌ Error: Lidia Bastianich not found in chefs table');
      console.log('\n💡 Tip: Run the chef import script first:');
      console.log('   npx tsx scripts/import-chefs.ts\n');
      process.exit(1);
    }

    console.log(`✅ Found: ${lidia.name || lidia.display_name}`);
    console.log(`   Chef ID: ${lidia.id}`);
    console.log(`   Slug: ${lidia.slug}`);
    console.log(`   Recipe Count: ${lidia.recipe_count || 0}\n`);

    // Step 2: Query recipes without images (via chef_recipes join table)
    console.log('🔍 Step 2: Finding recipes without images...\n');

    const recipesResult = await db
      .select({
        recipe: recipes,
      })
      .from(chefRecipes)
      .innerJoin(recipes, eq(chefRecipes.recipe_id, recipes.id))
      .where(
        and(
          eq(chefRecipes.chef_id, lidia.id),
          or(isNull(recipes.images), eq(recipes.images, '[]'), eq(recipes.images, ''))
        )
      );

    // Extract recipes from join result
    const recipesWithoutImages = recipesResult.map((r) => r.recipe);

    console.log(`📊 Found ${recipesWithoutImages.length} recipes without images\n`);

    if (recipesWithoutImages.length === 0) {
      console.log("✅ All of Lidia's recipes already have images!");
      console.log('\n💡 Tip: To regenerate images, clear the images field in the database.\n');
      process.exit(0);
    }

    // Step 3: Generate images for each recipe
    console.log('🎨 Step 3: Generating images...\n');

    let successful = 0;
    let failed = 0;
    const skipped = 0;

    for (let i = 0; i < recipesWithoutImages.length; i++) {
      const recipe = recipesWithoutImages[i];
      console.log(`\n[${i + 1}/${recipesWithoutImages.length}]`);

      const success = await processRecipe(recipe);
      if (success) {
        successful++;
      } else {
        failed++;
      }

      // Rate limiting: small delay between requests
      if (i < recipesWithoutImages.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Step 4: Summary
    console.log(`\n${'═'.repeat(70)}`);
    console.log('📊 SUMMARY');
    console.log('═'.repeat(70));
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed:     ${failed}`);
    console.log(`⏭️  Skipped:    ${skipped}`);
    console.log(`📝 Total:      ${recipesWithoutImages.length}`);
    console.log(`${'═'.repeat(70)}\n`);

    if (successful > 0) {
      console.log('🎉 Image generation completed!\n');
      console.log('📁 Images saved to: public/recipes/lidia/');
      console.log('🗄️  Database updated with image URLs\n');
      console.log('💡 Next steps:');
      console.log('   1. Verify images at: http://localhost:3002/discover/chefs/lidia-bastianich');
      console.log('   2. Check image quality and regenerate if needed');
      console.log('   3. Consider flagging low-quality images for manual review\n');
    }

    if (failed > 0) {
      console.log('⚠️  Some images failed to generate. Check errors above.\n');
      console.log('💡 Common issues:');
      console.log('   - API rate limits (wait a few minutes and retry)');
      console.log('   - Invalid API key (check OPENROUTER_API_KEY)');
      console.log('   - Network connectivity issues');
      console.log('   - Model availability (check OpenRouter status)\n');
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Verify DATABASE_URL is set correctly');
    console.log('   2. Verify OPENROUTER_API_KEY is set correctly');
    console.log('   3. Check database connectivity');
    console.log('   4. Check OpenRouter API status: https://status.openrouter.ai\n');
    process.exit(1);
  }
}

// Run the script
main()
  .then(() => {
    console.log('✅ Script completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
