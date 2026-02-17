/**
 * Generate images for top 50 rated recipes without images
 * Using OpenRouter's Gemini 2.5 Flash Image
 *
 * Cost: ~$0.039 per 1024x1024 image × 50 = ~$1.95
 */

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

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
  system_rating: string | null;
}

async function generateRecipeImage(
  recipeName: string,
  description: string,
  cuisine?: string
): Promise<string> {
  const prompt = `Generate a professional food photography image of "${recipeName}".

${description ? `Description: ${description}` : ''}
${cuisine ? `Cuisine: ${cuisine}` : ''}

STYLE: Professional food photography, natural warm lighting (golden hour), appetizing presentation on rustic ceramic plate, shallow depth of field, garnished with fresh herbs, high-end restaurant quality, cozy inviting atmosphere, warm tomato reds/olive greens/cream tones (Joanie's Kitchen palette).

COMPOSITION: 3/4 angle view, show texture and freshness, complementary props (wooden utensils, linen napkin, herbs), soft-focus rustic background.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3003',
      'X-Title': "Joanie's Kitchen - Recipe Manager",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image', 'text'],
      max_tokens: 4096,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  const imageData = data.choices?.[0]?.message?.images?.[0];

  if (!imageData) {
    throw new Error('No image generated');
  }

  // Handle OpenRouter's response format
  if (typeof imageData === 'object' && imageData.image_url?.url) {
    return imageData.image_url.url; // Extract base64 data URL
  } else if (typeof imageData === 'string') {
    return imageData;
  }

  throw new Error(`Unexpected image format: ${typeof imageData}`);
}

async function saveImage(
  base64DataUrl: string,
  recipeId: string,
  recipeName: string
): Promise<string> {
  const outputDir = path.join(process.cwd(), 'public', 'ai-recipe-images');
  await fs.mkdir(outputDir, { recursive: true });

  // Parse base64 data URL
  const matches = base64DataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 data URL');
  }

  const [, extension, base64Content] = matches;
  const imageBuffer = Buffer.from(base64Content, 'base64');

  const sanitizedName = recipeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  const filename = `${sanitizedName}-${recipeId.slice(0, 8)}.${extension}`;
  const filepath = path.join(outputDir, filename);

  await fs.writeFile(filepath, imageBuffer);

  console.log(`💾 Saved: ${filename} (${(imageBuffer.length / 1024).toFixed(1)} KB)`);

  return `/ai-recipe-images/${filename}`; // Public URL path
}

async function main() {
  console.log('\n============================================================');
  console.log('🎨 GENERATING IMAGES FOR TOP 50 RECIPES');
  console.log('============================================================\n');
  console.log(`Model: ${MODEL}`);
  console.log(`Cost: ~$0.039 × 50 = ~$1.95\n`);

  try {
    // Get top 50 rated recipes without images
    const topRecipes = await db
      .select()
      .from(recipes)
      .where(
        sql`(images IS NULL OR images::jsonb = '[]'::jsonb)
            AND system_rating IS NOT NULL`
      )
      .orderBy(sql`system_rating DESC NULLS LAST`)
      .limit(50);

    console.log(`Found ${topRecipes.length} top-rated recipes without images\n`);

    const results: Array<{
      recipe: Recipe;
      imageUrl: string;
      filepath: string;
    }> = [];

    for (const [index, recipe] of topRecipes.entries()) {
      const rating = recipe.system_rating ? parseFloat(recipe.system_rating) : 0;
      console.log(`\n[${index + 1}/50] ${recipe.name} (★ ${rating.toFixed(1)})`);

      try {
        const base64DataUrl = await generateRecipeImage(
          recipe.name,
          recipe.description || '',
          recipe.cuisine || undefined
        );

        const imageUrl = await saveImage(base64DataUrl, recipe.id, recipe.name);

        // Update database with image URL (must stringify to JSON)
        await db
          .update(recipes)
          .set({ images: JSON.stringify([imageUrl]) })
          .where(sql`id = ${recipe.id}`);

        results.push({
          recipe,
          imageUrl,
          filepath: imageUrl,
        });

        console.log(`✅ Saved to database`);

        // Rate limit: 2 seconds between requests
        if (index < topRecipes.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Summary
    console.log('\n============================================================');
    console.log('📊 GENERATION SUMMARY');
    console.log('============================================================\n');
    console.log(`✅ Successful: ${results.length}/50`);
    console.log(`💰 Total cost: $${(results.length * 0.039).toFixed(2)}`);
    console.log(`📁 Images saved to: public/ai-recipe-images/\n`);

    if (results.length > 0) {
      console.log('Top 10 generated:\n');
      results.slice(0, 10).forEach((result, idx) => {
        const rating = result.recipe.system_rating ? parseFloat(result.recipe.system_rating) : 0;
        console.log(`  ${idx + 1}. ${result.recipe.name} (★ ${rating.toFixed(1)})`);
        console.log(`     ${result.imageUrl}\n`);
      });
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

main()
  .then(() => {
    console.log('\n✅ Image generation complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
