#!/usr/bin/env tsx
/**
 * Generate AI images for chef recipes using OpenRouter
 * Uses Flux or other available image generation models
 */

import 'dotenv/config';
import { put } from '@vercel/blob';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefRecipes } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';

async function generateImageWithAI(recipeName: string, cuisine: string | null): Promise<string> {
  const openrouterApiKey = process.env.OPENROUTER_API_KEY;

  if (!openrouterApiKey) {
    throw new Error('OPENROUTER_API_KEY not found');
  }

  // Create detailed food photography prompt
  const cuisineType = cuisine || 'gourmet';
  const prompt = `Professional food photography of ${recipeName}, ${cuisineType} cuisine. Beautiful plating on rustic wooden table, natural lighting from window, restaurant quality presentation, appetizing, detailed, vibrant colors, top-down view, professional chef plating, garnished, 4K quality`;

  console.log(`      🎨 Generating with AI: "${prompt.substring(0, 60)}..."`);

  try {
    // Use Flux Pro 1.1 for image generation via OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002',
        'X-Title': 'Recipe Manager - AI Image Generation',
      },
      body: JSON.stringify({
        model: 'black-forest-labs/flux-pro-1.1',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Extract image URL from response
    const imageUrl = data.data?.[0]?.url;

    if (!imageUrl) {
      throw new Error('No image URL in response');
    }

    console.log(`      ✅ AI image generated successfully`);
    return imageUrl;
  } catch (error) {
    console.error(`      ❌ AI generation failed:`, error);
    throw error;
  }
}

async function downloadAndUploadToBlob(imageUrl: string, recipeName: string): Promise<string> {
  try {
    console.log(`      ⬇️  Downloading AI-generated image...`);

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`      ☁️  Uploading to Vercel Blob...`);

    // Create safe filename
    const safeFileName = recipeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const filename = `recipes/ai/${safeFileName}-${Date.now()}.png`;

    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: 'image/png',
    });

    console.log(`      ✅ Uploaded: ${blob.url.substring(0, 60)}...`);
    return blob.url;
  } catch (error) {
    console.error(`      ❌ Upload failed:`, error);
    throw error;
  }
}

async function generateAIRecipeImages() {
  console.log('🎨 Generating AI images for chef recipes...\n');
  console.log('Using: Flux Pro 1.1 via OpenRouter\n');

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('❌ Error: OPENROUTER_API_KEY not found');
    process.exit(1);
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('❌ Error: BLOB_READ_WRITE_TOKEN not found');
    process.exit(1);
  }

  // Get recipes that currently have Unsplash images (placeholders we want to replace)
  const recipesToRegenerate = await db
    .select({
      recipe: recipes,
    })
    .from(recipes)
    .innerJoin(chefRecipes, eq(chefRecipes.recipe_id, recipes.id))
    .where(sql`${recipes.images}::text LIKE '%unsplash%'`)
    .limit(25); // Limit for cost control

  console.log(`📊 Found ${recipesToRegenerate.length} recipes to generate AI images for\n`);

  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ recipe: string; error: string }> = [];

  for (let i = 0; i < recipesToRegenerate.length; i++) {
    const { recipe } = recipesToRegenerate[i];

    console.log(`\n[${i + 1}/${recipesToRegenerate.length}] ${recipe.name}`);
    console.log(
      `   Cuisine: ${recipe.cuisine || 'N/A'} | Difficulty: ${recipe.difficulty || 'N/A'}`
    );

    try {
      // Step 1: Generate AI image
      const aiImageUrl = await generateImageWithAI(recipe.name, recipe.cuisine);

      // Step 2: Download and upload to Blob
      const blobUrl = await downloadAndUploadToBlob(aiImageUrl, recipe.name);

      // Step 3: Update recipe
      await db
        .update(recipes)
        .set({
          images: JSON.stringify([blobUrl]),
          updated_at: new Date(),
        })
        .where(eq(recipes.id, recipe.id));

      console.log(`   ✅ Recipe updated with AI-generated image`);
      successCount++;

      // Rate limiting: 3 seconds between requests to avoid hitting limits
      if (i < recipesToRegenerate.length - 1) {
        console.log(`   ⏳ Waiting 3s before next generation...`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`   ❌ Failed: ${errorMsg}`);
      errorCount++;
      errors.push({ recipe: recipe.name, error: errorMsg });
    }
  }

  // Summary
  console.log('\n\n');
  console.log('═'.repeat(70));
  console.log('FINAL SUMMARY');
  console.log('═'.repeat(70));
  console.log(`Total recipes processed: ${recipesToRegenerate.length}`);
  console.log(`✅ Successfully generated: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('═'.repeat(70));

  if (errors.length > 0) {
    console.log('\n❌ Failed recipes:');
    errors.forEach(({ recipe, error }) => {
      console.log(`   - ${recipe}`);
      console.log(`     Error: ${error}`);
    });
  }

  console.log('\n🎉 AI image generation complete!');
  console.log(`\n🌐 View chefs: http://localhost:3002/discover/chefs`);

  if (successCount > 0) {
    console.log(
      `\n💰 Estimated cost: ~$${(successCount * 0.04).toFixed(2)} (Flux Pro 1.1: $0.04/image)`
    );
  }
}

// Run the script
generateAIRecipeImages()
  .then(() => {
    console.log('\n✅ Script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
