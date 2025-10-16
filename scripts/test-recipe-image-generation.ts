/**
 * Test script for recipe image generation using OpenRouter's Gemini 2.5 Flash Image
 *
 * Cost: ~$0.039 per 1024x1024 image
 * Model: google/gemini-2.5-flash-image-preview
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';
import { eq, isNull, sql } from 'drizzle-orm';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'google/gemini-2.5-flash-image-preview';

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY not found in environment');
  process.exit(1);
}

interface Recipe {
  id: string;
  name: string;
  description: string | null;
  cuisine: string | null;
  ingredients: any;
}

/**
 * Generate recipe image using OpenRouter's Gemini 2.5 Flash Image
 */
async function generateRecipeImage(
  recipeName: string,
  description: string,
  cuisine?: string
): Promise<any> {
  const prompt = `Generate a professional food photography image of "${recipeName}".

${description ? `Description: ${description}` : ''}
${cuisine ? `Cuisine: ${cuisine}` : ''}

STYLE REQUIREMENTS:
- Professional food photography
- Natural, warm lighting (golden hour aesthetic)
- Appetizing presentation on rustic ceramic plate
- Shallow depth of field (blurred background)
- Garnished beautifully with fresh herbs
- High-end restaurant quality plating
- Cozy, inviting atmosphere
- Colors: warm tomato reds, olive greens, cream/beige tones (Joanie's Kitchen palette)

COMPOSITION:
- Hero shot: 3/4 angle view
- Show texture and freshness
- Include complementary props (wooden utensils, linen napkin, herbs)
- Background: soft-focus rustic kitchen or table setting`;

  console.log(`\n🎨 Generating image for: ${recipeName}`);
  console.log(`📝 Prompt length: ${prompt.length} characters`);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3003',
      'X-Title': 'Joanie\'s Kitchen - Recipe Manager',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      modalities: ['image', 'text'], // CRITICAL: Required for image generation
      max_tokens: 4096,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Debug: Log response structure
  console.log('📦 Response structure:', JSON.stringify(data, null, 2).slice(0, 500) + '...');

  // Check if image was generated
  const message = data.choices?.[0]?.message;
  const imageData = message?.images?.[0];

  if (!imageData) {
    console.error('❌ No image in response. Full structure:', JSON.stringify(data, null, 2));
    throw new Error('No image generated in response');
  }

  console.log(`✅ Image data type: ${typeof imageData}`);
  console.log(`✅ Image data preview: ${JSON.stringify(imageData).slice(0, 100)}...`);

  return imageData;
}

/**
 * Save image data to file
 */
async function saveImage(imageData: any, recipeId: string, recipeName: string): Promise<string> {
  // Create output directory
  const outputDir = path.join(process.cwd(), 'tmp', 'ai-recipe-images');
  await fs.mkdir(outputDir, { recursive: true });

  let imageBuffer: Buffer;
  let extension = 'png';

  // Handle different response formats
  if (typeof imageData === 'string') {
    // Case 1: base64 data URL (e.g., "data:image/png;base64,...")
    if (imageData.startsWith('data:')) {
      const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Invalid base64 data URL format');
      }
      extension = matches[1];
      imageBuffer = Buffer.from(matches[2], 'base64');
    }
    // Case 2: raw base64 string
    else {
      imageBuffer = Buffer.from(imageData, 'base64');
    }
  }
  // Case 3: Object with data property
  else if (typeof imageData === 'object' && imageData.data) {
    imageBuffer = Buffer.from(imageData.data, 'base64');
    extension = imageData.format || 'png';
  }
  // Case 4: Buffer or other format
  else {
    console.error('Unknown image data format:', typeof imageData, imageData);
    throw new Error(`Unsupported image data format: ${typeof imageData}`);
  }

  // Sanitize recipe name for filename
  const sanitizedName = recipeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50); // Limit filename length

  const filename = `${sanitizedName}-${recipeId.slice(0, 8)}.${extension}`;
  const filepath = path.join(outputDir, filename);

  await fs.writeFile(filepath, imageBuffer);

  console.log(`💾 Saved to: ${filepath}`);
  console.log(`📊 Size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);

  return filepath;
}

/**
 * Main test function
 */
async function main() {
  console.log('\n============================================================');
  console.log('🎨 JOANIE\'S KITCHEN - RECIPE IMAGE GENERATION TEST');
  console.log('============================================================\n');
  console.log(`Model: ${MODEL}`);
  console.log(`Cost per image: ~$0.039 (1024x1024)`);
  console.log(`Test count: 3 recipes\n`);

  try {
    // Get 3 sample recipes without images
    console.log('📋 Fetching sample recipes...\n');

    const sampleRecipes = await db
      .select({
        id: recipes.id,
        name: recipes.name,
        description: recipes.description,
        cuisine: recipes.cuisine,
        ingredients: recipes.ingredients,
      })
      .from(recipes)
      .where(
        sql`(${recipes.images} IS NULL OR ${recipes.images}::jsonb = '[]'::jsonb)`
      )
      .orderBy(sql`RANDOM()`)
      .limit(3);

    if (sampleRecipes.length === 0) {
      console.log('⚠️  No recipes without images found. Using any 3 recipes...\n');
      const anyRecipes = await db
        .select({
          id: recipes.id,
          name: recipes.name,
          description: recipes.description,
          cuisine: recipes.cuisine,
          ingredients: recipes.ingredients,
        })
        .from(recipes)
        .orderBy(sql`RANDOM()`)
        .limit(3);

      sampleRecipes.push(...anyRecipes);
    }

    console.log(`Found ${sampleRecipes.length} recipes to process:\n`);
    sampleRecipes.forEach((recipe, idx) => {
      console.log(`  ${idx + 1}. ${recipe.name} [${recipe.cuisine || 'N/A'}]`);
    });

    // Generate images
    const results: Array<{
      recipe: Recipe;
      filepath: string;
      cost: number;
    }> = [];

    for (const [index, recipe] of sampleRecipes.entries()) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`[${index + 1}/${sampleRecipes.length}] Processing: ${recipe.name}`);
      console.log('='.repeat(60));

      try {
        const imageData = await generateRecipeImage(
          recipe.name,
          recipe.description || '',
          recipe.cuisine || undefined
        );

        const filepath = await saveImage(imageData, recipe.id, recipe.name);

        results.push({
          recipe,
          filepath,
          cost: 0.039, // Estimated cost per image
        });

        console.log(`✅ Successfully generated image for: ${recipe.name}`);

        // Rate limiting: wait 2 seconds between requests
        if (index < sampleRecipes.length - 1) {
          console.log('\n⏳ Waiting 2 seconds before next request...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.error(`❌ Failed to generate image for ${recipe.name}:`, error);
        console.error(error instanceof Error ? error.message : String(error));
      }
    }

    // Summary
    console.log('\n============================================================');
    console.log('📊 GENERATION SUMMARY');
    console.log('============================================================\n');
    console.log(`✅ Successful: ${results.length}/${sampleRecipes.length}`);
    console.log(`💰 Total cost: $${(results.length * 0.039).toFixed(3)}\n`);

    if (results.length > 0) {
      console.log('Generated images:\n');
      results.forEach((result, idx) => {
        console.log(`  ${idx + 1}. ${result.recipe.name}`);
        console.log(`     File: ${path.basename(result.filepath)}`);
        console.log(`     Cost: $${result.cost.toFixed(3)}\n`);
      });

      console.log('\n💡 Next steps:');
      console.log('  1. Review generated images in tmp/ai-recipe-images/');
      console.log('  2. Assess quality and style match to Joanie\'s Kitchen brand');
      console.log('  3. If satisfied, can batch generate for remaining recipes');
      console.log(`  4. Estimated cost for all 3,276 recipes: $${(3276 * 0.039).toFixed(2)}\n`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

// Run the script
main()
  .then(() => {
    console.log('\n✅ Test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
