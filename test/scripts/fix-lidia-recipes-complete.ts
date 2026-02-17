#!/usr/bin/env tsx

/**
 * Fix Lidia Bastianich Recipe Images and Instructions
 *
 * This script:
 * 1. Identifies Lidia recipes with magazine cover images (excluding the 2 good ones)
 * 2. Generates proper food photography using OpenAI DALL-E 3
 * 3. Reformats instructions from blocks of text into proper numbered steps using GPT-4
 *
 * Usage:
 *   npx tsx scripts/fix-lidia-recipes-complete.ts
 *
 * Environment Variables Required:
 *   OPENAI_API_KEY - OpenAI API key for DALL-E 3 and GPT-4
 *   DATABASE_URL - Neon PostgreSQL connection string
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq, and, not, inArray } from 'drizzle-orm';
import OpenAI from 'openai';
import { db } from '@/lib/db';
import { chefs, chefRecipes } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';

// Configuration
const OUTPUT_DIR = 'public/recipes/lidia';
const GOOD_RECIPE_IDS = [
  '25fce1f4-03f7-4731-a592-b38a92a2c85d',
  '0b288d1f-31dc-47f9-a4f7-9f338a3cf48d',
];
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// OpenAI client
let openAIClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openAIClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your-openai-api-key-here') {
      throw new Error('OPENAI_API_KEY environment variable is not set or is placeholder');
    }

    openAIClient = new OpenAI({
      apiKey,
    });
  }
  return openAIClient;
}

/**
 * Generate a food photography image using DALL-E 3
 */
async function generateRecipeImage(
  recipeName: string,
  description: string,
  retryCount = 0
): Promise<string> {
  const client = getOpenAIClient();

  // Create a detailed prompt for food photography
  const prompt = `Professional food photography of ${recipeName}. ${description}.
High-quality, appetizing, restaurant-style plating on a rustic Italian table.
Natural lighting, shallow depth of field, garnished beautifully.
Photorealistic, magazine-quality food photography.`;

  console.log(`   Generating image with DALL-E 3...`);
  console.log(`   Prompt: ${prompt.substring(0, 100)}...`);

  try {
    const response = await client.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'b64_json',
    });

    const imageData = response.data[0];
    if (!imageData.b64_json) {
      throw new Error('No image data returned from DALL-E');
    }

    return imageData.b64_json;
  } catch (error: any) {
    if (retryCount < MAX_RETRIES) {
      console.warn(`   ⚠️  Image generation failed, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return generateRecipeImage(recipeName, description, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Reformat instructions from text block to numbered steps using GPT-4
 */
async function reformatInstructions(
  recipeName: string,
  currentInstructions: string,
  retryCount = 0
): Promise<string[]> {
  const client = getOpenAIClient();

  // Parse current instructions (might be JSON array or text)
  let instructionsText: string;
  try {
    const parsed = JSON.parse(currentInstructions);
    if (Array.isArray(parsed)) {
      instructionsText = parsed.join('\n\n');
    } else {
      instructionsText = currentInstructions;
    }
  } catch {
    instructionsText = currentInstructions;
  }

  const prompt = `You are a professional recipe editor. Reformat the following recipe instructions into clear, numbered steps.

Recipe: ${recipeName}

Current instructions (may be a block of text):
${instructionsText}

Requirements:
1. Split into logical, numbered steps
2. Each step should be concise but complete
3. Use active voice and imperative mood (e.g., "Heat the oil", not "The oil should be heated")
4. Include timing and temperature details where mentioned
5. Maintain all important details from the original
6. Return ONLY a JSON array of strings, one per step
7. Do not add new information or change the cooking method

Example format:
["Step 1 text here", "Step 2 text here", "Step 3 text here"]`;

  console.log(`   Reformatting instructions with GPT-4...`);

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'You are a professional recipe editor. Return only valid JSON arrays of instruction steps.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT-4');
    }

    // Parse the JSON response
    const steps = JSON.parse(content.trim());
    if (!Array.isArray(steps)) {
      throw new Error('Response is not a JSON array');
    }

    return steps;
  } catch (error: any) {
    if (retryCount < MAX_RETRIES) {
      console.warn(`   ⚠️  Instruction reformatting failed, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return reformatInstructions(recipeName, currentInstructions, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Save image to filesystem
 */
function saveImage(base64Data: string, recipeId: string, recipeName: string): string {
  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Generate filename from recipe name
  const sanitizedName = recipeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);

  const filename = `${sanitizedName}-${recipeId.substring(0, 8)}.png`;
  const filepath = join(OUTPUT_DIR, filename);

  // Decode base64 and save
  const imageBuffer = Buffer.from(base64Data, 'base64');
  writeFileSync(filepath, imageBuffer);

  console.log(`   ✅ Saved: ${filepath}`);

  // Return the public URL path
  return `/recipes/lidia/${filename}`;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔧 Fixing Lidia Bastianich Recipe Images and Instructions\n');
  console.log('================================================================================\n');

  // Find Lidia's chef record
  const [lidiaChef] = await db.select().from(chefs).where(eq(chefs.name, 'Lidia Bastianich')).limit(1);

  if (!lidiaChef) {
    throw new Error('Lidia Bastianich chef record not found');
  }

  console.log(`✅ Found chef: ${lidiaChef.name} (${lidiaChef.id})\n`);

  // Get all Lidia recipes EXCEPT the two good ones
  const lidiaRecipes = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      description: recipes.description,
      instructions: recipes.instructions,
      images: recipes.images,
    })
    .from(recipes)
    .innerJoin(chefRecipes, eq(recipes.id, chefRecipes.recipe_id))
    .where(
      and(
        eq(chefRecipes.chef_id, lidiaChef.id),
        not(inArray(recipes.id, GOOD_RECIPE_IDS))
      )
    );

  console.log(`📋 Found ${lidiaRecipes.length} recipes to fix (excluding 2 good ones)\n`);

  if (lidiaRecipes.length === 0) {
    console.log('✅ No recipes to fix!\n');
    return;
  }

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < lidiaRecipes.length; i++) {
    const recipe = lidiaRecipes[i];
    const progress = `[${i + 1}/${lidiaRecipes.length}]`;

    console.log(`${progress} Processing: ${recipe.name}`);
    console.log(`${progress}   ID: ${recipe.id}`);

    try {
      // Step 1: Generate new image
      console.log(`${progress}   Step 1: Generating image...`);
      const base64Image = await generateRecipeImage(
        recipe.name,
        recipe.description || ''
      );

      const imageUrl = saveImage(base64Image, recipe.id, recipe.name);
      console.log(`${progress}   ✅ Image generated: ${imageUrl}`);

      // Step 2: Reformat instructions
      console.log(`${progress}   Step 2: Reformatting instructions...`);
      const formattedInstructions = await reformatInstructions(
        recipe.name,
        recipe.instructions
      );

      console.log(`${progress}   ✅ Instructions reformatted: ${formattedInstructions.length} steps`);

      // Step 3: Update database
      console.log(`${progress}   Step 3: Updating database...`);
      await db
        .update(recipes)
        .set({
          images: JSON.stringify([imageUrl]),
          instructions: JSON.stringify(formattedInstructions),
          updated_at: new Date(),
        })
        .where(eq(recipes.id, recipe.id));

      console.log(`${progress} ✅ SUCCESS: ${recipe.name}\n`);
      successCount++;

      // Rate limiting: wait 1 second between recipes to avoid API limits
      if (i < lidiaRecipes.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error: any) {
      console.error(`${progress} ❌ FAILED: ${recipe.name}`);
      console.error(`${progress}    Error: ${error.message}\n`);
      failureCount++;
    }
  }

  console.log('================================================================================');
  console.log('🎉 PROCESSING COMPLETE\n');
  console.log(`✅ Success: ${successCount} recipes`);
  console.log(`❌ Failed: ${failureCount} recipes`);
  console.log('\n📝 Next Steps:');
  console.log('   1. Review the generated images in public/recipes/lidia/');
  console.log('   2. Check the reformatted instructions in the database');
  console.log('   3. Verify the recipes display correctly in the app\n');
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
