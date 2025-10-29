#!/usr/bin/env tsx
/**
 * Improve Lidia Bastianich's Recipes
 *
 * This script performs two improvements on all Lidia's recipes:
 * 1. Generate AI images for recipes without images
 * 2. Format instructions into step-by-step format
 *
 * Skips recipes already improved:
 * - "Savoy Cabbage and Bell Pepper Slaw"
 * - "Zucchini in Scapece"
 *
 * Usage:
 *   npx tsx scripts/improve-lidia-recipes.ts
 */

import 'dotenv/config';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { db } from '@/lib/db';
import { chefRecipes, chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';

// Configuration
const IMAGE_GENERATION_MODEL = 'google/gemini-2.5-flash-image-preview';
const INSTRUCTION_FORMATTING_MODEL = 'meta-llama/llama-3.2-3b-instruct:free';
const OUTPUT_DIR = 'public/recipes/lidia';
const ASPECT_RATIO = '1:1';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const DELAY_BETWEEN_RECIPES_MS = 2000;

// Recipes to skip (already improved)
const SKIP_RECIPES = ['Savoy Cabbage and Bell Pepper Slaw', 'Zucchini in Scapece'];

// Stats tracking
const stats = {
  total: 0,
  processed: 0,
  imagesGenerated: 0,
  instructionsFormatted: 0,
  skipped: 0,
  errors: 0,
};

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
        'X-Title': 'Recipe Manager - Lidia Recipe Improvements',
      },
    });
  }
  return openRouterClient;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
 * Generate an image using OpenRouter API (Gemini 2.5 Flash Image Preview)
 */
async function generateImage(
  prompt: string,
  recipeId: string,
  attempt: number = 1
): Promise<string | null> {
  const client = getOpenRouterClient();

  try {
    console.log(`      🎨 Generating image (attempt ${attempt}/${MAX_RETRIES})...`);

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
    console.error(`      ❌ Error generating image (attempt ${attempt}):`, error);

    // Retry logic
    if (attempt < MAX_RETRIES) {
      console.log(`      ⏳ Retrying in ${RETRY_DELAY_MS / 1000} seconds...`);
      await sleep(RETRY_DELAY_MS);
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
      console.log(`      📁 Created directory: ${OUTPUT_DIR}`);
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

    console.log(`      💾 Saved image: ${filepath}`);

    // Return URL path (relative to public directory)
    return `/recipes/lidia/${filename}`;
  } catch (error) {
    console.error(`      ❌ Error saving image:`, error);
    return null;
  }
}

/**
 * Check if instructions are already well-formatted
 */
function isWellFormatted(instructions: string): boolean {
  // Check if already JSON array
  if (instructions.trim().startsWith('[') && instructions.trim().endsWith(']')) {
    try {
      const parsed = JSON.parse(instructions);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return true;
      }
    } catch {
      // Not valid JSON, continue checking
    }
  }

  // Check if has clear numbered steps (at least 3 steps with numbers)
  const numberedSteps = instructions.match(/^\d+\./gm);
  if (numberedSteps && numberedSteps.length >= 3) {
    return true;
  }

  return false;
}

/**
 * Use LLM to format instructions into clear steps
 */
async function formatInstructionsWithLLM(
  recipeName: string,
  instructions: string,
  retryCount = 0
): Promise<string[] | null> {
  const prompt = `You are formatting recipe instructions. Your task is to take the provided recipe instructions text and format it into clear, numbered steps.

CRITICAL RULES:
- Do NOT change any wording
- Do NOT add new content
- Do NOT remove content
- ONLY break the text into logical steps
- Each step should be one clear action or set of related actions
- Preserve all temperatures, times, measurements, and specific details exactly as written
- Return ONLY a JSON array of strings, one per step
- Do not include step numbers in the text (the array index serves as the step number)

Recipe: ${recipeName}

Input instructions:
${instructions}

Output format (JSON array only, no markdown, no explanation):
["Step 1 text here", "Step 2 text here", ...]`;

  const client = getOpenRouterClient();

  try {
    // Add delay between requests to avoid rate limiting
    if (retryCount > 0) {
      const delayMs = Math.min(1000 * 2 ** retryCount, 10000); // Exponential backoff
      console.log(`      ⏳ Waiting ${delayMs}ms before retry...`);
      await sleep(delayMs);
    }

    const completion = await client.chat.completions.create({
      model: INSTRUCTION_FORMATTING_MODEL,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1, // Low temperature for consistent formatting
      max_tokens: 4000,
    });

    const responseText = completion.choices[0]?.message?.content?.trim();
    if (!responseText) {
      throw new Error('Empty response from LLM');
    }

    // Extract JSON array from response (handle markdown code blocks)
    let jsonText = responseText;
    if (jsonText.includes('```')) {
      const match = jsonText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (match) {
        jsonText = match[1];
      }
    }

    // Parse JSON
    const steps = JSON.parse(jsonText);

    // Validate output
    if (!Array.isArray(steps)) {
      throw new Error('Response is not an array');
    }
    if (steps.length === 0) {
      throw new Error('Empty steps array');
    }
    if (!steps.every((step) => typeof step === 'string')) {
      throw new Error('Not all steps are strings');
    }

    return steps;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`      ❌ LLM Error: ${errorMsg}`);

    // Retry with backoff
    if ((errorMsg.includes('429') || errorMsg.includes('rate limit')) && retryCount < 3) {
      console.log(`      🔄 Retrying instruction formatting (attempt ${retryCount + 1})...`);
      return formatInstructionsWithLLM(recipeName, instructions, retryCount + 1);
    }

    return null;
  }
}

/**
 * Process a single recipe: generate image and format instructions
 */
async function processRecipe(recipe: any): Promise<{
  imageSuccess: boolean;
  instructionsSuccess: boolean;
}> {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📖 Recipe: ${recipe.name}`);
  console.log(`   ID: ${recipe.id}`);
  console.log(`   Cuisine: ${recipe.cuisine || 'Not specified'}`);
  console.log('─'.repeat(70));

  let imageSuccess = false;
  let instructionsSuccess = false;

  // Step 1: Generate AI Image (if needed)
  const needsImage = !recipe.images || recipe.images === '[]' || recipe.images === '';
  if (needsImage) {
    console.log('\n   🖼️  STEP 1: Generating AI Image');
    console.log(`   ${'─'.repeat(66)}`);

    try {
      const prompt = generateImagePrompt(recipe.name, recipe.description, recipe.cuisine);
      console.log(`      📝 Prompt: ${prompt.substring(0, 100)}...`);

      const base64Image = await generateImage(prompt, recipe.id);
      if (base64Image) {
        const imageUrl = saveImageToFile(base64Image, recipe.id, recipe.name);
        if (imageUrl) {
          await db
            .update(recipes)
            .set({
              images: JSON.stringify([imageUrl]),
              updated_at: new Date(),
            })
            .where(eq(recipes.id, recipe.id));

          console.log(`      ✅ Image generated and saved: ${imageUrl}`);
          imageSuccess = true;
          stats.imagesGenerated++;
        }
      }
    } catch (error) {
      console.error(`      ❌ Failed to generate image:`, error);
    }
  } else {
    console.log('\n   ✓ Image already exists, skipping');
    imageSuccess = true; // Count as success (nothing to do)
  }

  // Step 2: Format Instructions (if needed)
  const needsFormatting = !isWellFormatted(recipe.instructions) && !recipe.instructions_backup;
  if (needsFormatting) {
    console.log('\n   📝 STEP 2: Formatting Instructions');
    console.log(`   ${'─'.repeat(66)}`);

    try {
      console.log(`      🤖 Formatting with LLM...`);
      const formattedSteps = await formatInstructionsWithLLM(recipe.name, recipe.instructions);

      if (formattedSteps) {
        console.log(`      ✓ Formatted into ${formattedSteps.length} steps`);

        // Show preview of formatted instructions
        console.log('\n      Preview:');
        formattedSteps.slice(0, 3).forEach((step, i) => {
          const preview = step.length > 80 ? `${step.substring(0, 80)}...` : step;
          console.log(`      ${i + 1}. ${preview}`);
        });
        if (formattedSteps.length > 3) {
          console.log(`      ... and ${formattedSteps.length - 3} more steps`);
        }

        // Ensure instructions_backup column exists
        try {
          await db.execute(`
            ALTER TABLE recipes
            ADD COLUMN IF NOT EXISTS instructions_backup TEXT
          `);
        } catch (_e) {
          // Column might already exist, ignore error
        }

        // Update database
        await db
          .update(recipes)
          .set({
            instructions: JSON.stringify(formattedSteps),
            instructions_backup: recipe.instructions,
            updated_at: new Date(),
          })
          .where(eq(recipes.id, recipe.id));

        console.log(`      ✅ Instructions formatted and saved`);
        instructionsSuccess = true;
        stats.instructionsFormatted++;
      }
    } catch (error) {
      console.error(`      ❌ Failed to format instructions:`, error);
    }
  } else {
    const reason = recipe.instructions_backup
      ? 'already formatted (backup exists)'
      : 'already well-formatted';
    console.log(`\n   ✓ Instructions ${reason}, skipping`);
    instructionsSuccess = true; // Count as success (nothing to do)
  }

  console.log(`\n   ${'─'.repeat(66)}`);
  const summary = [];
  if (needsImage) summary.push(imageSuccess ? '✅ Image' : '❌ Image');
  if (needsFormatting) summary.push(instructionsSuccess ? '✅ Instructions' : '❌ Instructions');
  if (summary.length === 0) summary.push('✓ No changes needed');
  console.log(`   Summary: ${summary.join(' | ')}`);
  console.log('═'.repeat(70));

  return { imageSuccess, instructionsSuccess };
}

/**
 * Main script execution
 */
async function main() {
  console.log(`\n${'═'.repeat(70)}`);
  console.log('🚀 IMPROVE LIDIA BASTIANICH RECIPES');
  console.log('═'.repeat(70));
  console.log('Tasks:');
  console.log('  1. Generate AI images for recipes without images');
  console.log('  2. Format instructions into step-by-step format');
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

    // Step 2: Query all Lidia's recipes
    console.log('🔍 Step 2: Finding all Lidia Bastianich recipes...\n');

    const recipesResult = await db
      .select({
        recipe: recipes,
      })
      .from(chefRecipes)
      .innerJoin(recipes, eq(chefRecipes.recipe_id, recipes.id))
      .where(eq(chefRecipes.chef_id, lidia.id));

    // Extract recipes from join result
    const allRecipes = recipesResult.map((r) => r.recipe);

    console.log(`📊 Found ${allRecipes.length} total recipes\n`);

    // Filter out already-improved recipes
    const recipesToProcess = allRecipes.filter((recipe) => !SKIP_RECIPES.includes(recipe.name));

    const skippedCount = allRecipes.length - recipesToProcess.length;
    if (skippedCount > 0) {
      console.log(`⏭️  Skipping ${skippedCount} already-improved recipes:`);
      SKIP_RECIPES.forEach((name) => {
        if (allRecipes.some((r) => r.name === name)) {
          console.log(`   - ${name}`);
        }
      });
      console.log('');
    }

    console.log(`🎯 Processing ${recipesToProcess.length} recipes\n`);

    if (recipesToProcess.length === 0) {
      console.log('✅ All recipes are already improved!');
      process.exit(0);
    }

    stats.total = recipesToProcess.length;

    // Step 3: Process each recipe
    console.log('🎨 Step 3: Processing recipes...\n');

    for (let i = 0; i < recipesToProcess.length; i++) {
      const recipe = recipesToProcess[i];
      console.log(`\n[${i + 1}/${recipesToProcess.length}]`);

      const result = await processRecipe(recipe);

      if (result.imageSuccess && result.instructionsSuccess) {
        stats.processed++;
      } else {
        stats.errors++;
      }

      // Progress update every 5 recipes
      if ((i + 1) % 5 === 0) {
        console.log(`\n📊 Progress: ${i + 1}/${recipesToProcess.length} recipes processed`);
        console.log(
          `   Images: ${stats.imagesGenerated} | Instructions: ${stats.instructionsFormatted}`
        );
      }

      // Rate limiting: delay between recipes
      if (i < recipesToProcess.length - 1) {
        await sleep(DELAY_BETWEEN_RECIPES_MS);
      }
    }

    // Step 4: Final Summary
    console.log(`\n\n${'═'.repeat(70)}`);
    console.log('📊 FINAL SUMMARY');
    console.log('═'.repeat(70));
    console.log(`Total recipes:             ${stats.total}`);
    console.log(`Successfully processed:    ${stats.processed}`);
    console.log(`Images generated:          ${stats.imagesGenerated}`);
    console.log(`Instructions formatted:    ${stats.instructionsFormatted}`);
    console.log(`Errors:                    ${stats.errors}`);
    console.log('═'.repeat(70));

    if (stats.processed > 0) {
      console.log('\n🎉 Recipe improvements completed!\n');
      console.log('📁 Images saved to: public/recipes/lidia/');
      console.log('🗄️  Database updated with images and formatted instructions\n');
      console.log('💡 Next steps:');
      console.log('   1. Verify recipes at: http://localhost:3002/chef/lidia-bastianich');
      console.log('   2. Check image quality and instruction formatting');
      console.log('   3. Flag any low-quality images for manual review\n');
    }

    if (stats.errors > 0) {
      console.log('⚠️  Some recipes had errors. Check error messages above.\n');
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
