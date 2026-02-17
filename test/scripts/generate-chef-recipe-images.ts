#!/usr/bin/env tsx
/**
 * Generate AI images for chef recipes without images
 * Uses OpenRouter API to generate food images
 */

import 'dotenv/config';
import { put } from '@vercel/blob';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefRecipes } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';

interface Recipe {
  id: string;
  name: string;
  cuisine: string | null;
  difficulty: string | null;
  images: string | null;
}

async function generateRecipeImage(recipeName: string, cuisine: string | null): Promise<string> {
  const openrouterApiKey = process.env.OPENROUTER_API_KEY;

  if (!openrouterApiKey) {
    throw new Error('OPENROUTER_API_KEY not found in environment');
  }

  // Create a detailed prompt for the image
  const cuisineType = cuisine || 'gourmet';
  const prompt = `A professional, appetizing photograph of ${recipeName}, ${cuisineType} cuisine. The dish should be beautifully plated on a rustic wooden table with natural lighting. Food photography style, high quality, detailed, vibrant colors, restaurant quality presentation. Top-down view. 4K resolution.`;

  console.log(`      Generating image with prompt: "${prompt.substring(0, 80)}..."`);

  try {
    // Use OpenRouter's image generation (via supported models)
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002',
        'X-Title': 'Recipe Manager - Image Generation',
      },
      body: JSON.stringify({
        model: 'openai/dall-e-3',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        // DALL-E 3 specific parameters
        size: '1024x1024',
        quality: 'standard',
        style: 'natural',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Extract image URL from response
    const imageUrl = data.choices?.[0]?.message?.content;

    if (!imageUrl) {
      throw new Error('No image URL in response');
    }

    console.log(`      ✅ Image generated successfully`);
    return imageUrl;
  } catch (error) {
    console.error(`      ❌ Error generating image:`, error);
    throw error;
  }
}

async function uploadImageToBlob(imageUrl: string, recipeName: string): Promise<string> {
  try {
    console.log(`      Downloading image from DALL-E...`);

    // Download the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`      Uploading to Vercel Blob...`);

    // Create a safe filename
    const safeFileName = recipeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const timestamp = Date.now();
    const filename = `recipes/${safeFileName}-${timestamp}.png`;

    // Upload to Vercel Blob
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: 'image/png',
    });

    console.log(`      ✅ Uploaded to Blob: ${blob.url}`);
    return blob.url;
  } catch (error) {
    console.error(`      ❌ Error uploading to Blob:`, error);
    throw error;
  }
}

async function generateChefRecipeImages() {
  console.log('🎨 Generating AI images for chef recipes...\n');

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('❌ Error: OPENROUTER_API_KEY not found in environment');
    process.exit(1);
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('❌ Error: BLOB_READ_WRITE_TOKEN not found in environment');
    process.exit(1);
  }

  // Get all recipes linked to chefs that don't have images
  const recipesWithoutImages = await db
    .select({
      recipe: recipes,
    })
    .from(recipes)
    .innerJoin(chefRecipes, eq(chefRecipes.recipe_id, recipes.id))
    .where(sql`(${recipes.images} IS NULL OR ${recipes.images}::text = '[]')`)
    .limit(30); // Limit for cost control

  console.log(`Found ${recipesWithoutImages.length} recipes needing images\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < recipesWithoutImages.length; i++) {
    const { recipe } = recipesWithoutImages[i];

    console.log(`\n[${i + 1}/${recipesWithoutImages.length}] ${recipe.name}`);
    console.log(
      `   Cuisine: ${recipe.cuisine || 'N/A'} | Difficulty: ${recipe.difficulty || 'N/A'}`
    );

    try {
      // Step 1: Generate image with DALL-E
      const generatedImageUrl = await generateRecipeImage(recipe.name, recipe.cuisine);

      // Step 2: Upload to Vercel Blob
      const blobUrl = await uploadImageToBlob(generatedImageUrl, recipe.name);

      // Step 3: Update recipe with new image
      await db
        .update(recipes)
        .set({
          images: JSON.stringify([blobUrl]),
          updated_at: new Date(),
        })
        .where(eq(recipes.id, recipe.id));

      console.log(`   ✅ Recipe updated with image`);
      successCount++;

      // Rate limiting: wait 2 seconds between requests
      if (i < recipesWithoutImages.length - 1) {
        console.log(`   ⏳ Waiting 2s before next request...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`   ❌ Failed to generate image for ${recipe.name}:`, error);
      errorCount++;
    }
  }

  console.log('\n\n');
  console.log('═'.repeat(70));
  console.log('SUMMARY');
  console.log('═'.repeat(70));
  console.log(`Total recipes processed: ${recipesWithoutImages.length}`);
  console.log(`Successfully generated: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log('═'.repeat(70));

  console.log('\n🎉 Image generation complete!');
  console.log(`\n🌐 View chefs: http://localhost:3002/discover/chefs`);
}

// Run the script
generateChefRecipeImages()
  .then(() => {
    console.log('\n✅ Script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
