#!/usr/bin/env tsx
/**
 * Generate AI image for Baked Ziti recipe
 * Uses DALL-E 3 via OpenAI SDK
 */

import 'dotenv/config';
import { put } from '@vercel/blob';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

const RECIPE_ID = '38142f14-3cda-4771-a826-f575f73a8f1b';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateImageWithAI(): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not found');
  }

  // Detailed prompt for Baked Ziti - Italian-American classic
  const prompt = `Professional food photography of Baked Ziti, Italian-American cuisine.
Setting: rustic wooden table in a cozy Italian trattoria with checkered tablecloth, warm candlelight.
Golden brown melted mozzarella cheese on top creating appetizing cheese pull,
layered pasta tubes (ziti) with rich tomato marinara sauce,
creamy ricotta cheese visible between layers, bubbling hot from the oven in a rustic ceramic baking dish,
garnished with fresh basil leaves, steam rising,
photographed from a flattering 45-degree angle with shallow depth of field,
styled by a professional food stylist, vibrant natural colors,
appetizing, high-end editorial quality for a cookbook.
NO text, NO watermarks, NO logos.
Ultra-realistic, magazine-quality food photography.`;

  console.log(`🎨 Generating AI image for Baked Ziti...`);
  console.log(`📝 Prompt: "${prompt.substring(0, 80)}..."`);

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

    console.log(`✅ AI image generated successfully`);
    return imageUrl;
  } catch (error) {
    console.error(`❌ AI generation failed:`, error);
    throw error;
  }
}

async function downloadAndUploadToBlob(imageUrl: string): Promise<string> {
  try {
    console.log(`⬇️  Downloading AI-generated image...`);

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`☁️  Uploading to Vercel Blob...`);

    const filename = `recipes/ai/baked-ziti-${Date.now()}.png`;

    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: 'image/png',
    });

    console.log(`✅ Uploaded to: ${blob.url}`);
    return blob.url;
  } catch (error) {
    console.error(`❌ Upload failed:`, error);
    throw error;
  }
}

async function generateBakedZitiImage() {
  console.log('\n🍝 Baked Ziti Image Generation');
  console.log('═'.repeat(70));
  console.log(`Recipe ID: ${RECIPE_ID}`);
  console.log(`Model: DALL-E 3 via OpenRouter`);
  console.log(`Cost: ~$0.04 per image\n`);

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('❌ Error: OPENROUTER_API_KEY not found');
    process.exit(1);
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('❌ Error: BLOB_READ_WRITE_TOKEN not found');
    process.exit(1);
  }

  try {
    // Get current recipe
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(eq(recipes.id, RECIPE_ID))
      .limit(1);

    if (!recipe) {
      throw new Error('Recipe not found');
    }

    console.log(`📖 Current recipe:`);
    console.log(`   Name: ${recipe.name}`);
    console.log(`   Cuisine: ${recipe.cuisine || 'N/A'}`);
    console.log(`   Current images: ${recipe.images || 'None'}\n`);

    // Step 1: Generate AI image
    const aiImageUrl = await generateImageWithAI();

    // Step 2: Download and upload to Blob
    const blobUrl = await downloadAndUploadToBlob(aiImageUrl);

    // Step 3: Parse existing images
    let existingImages: string[] = [];
    if (recipe.images) {
      try {
        existingImages = JSON.parse(recipe.images);
      } catch (e) {
        console.warn('⚠️  Could not parse existing images, will replace');
      }
    }

    // Step 4: Add new image at the beginning
    const updatedImages = [blobUrl, ...existingImages];

    // Step 5: Update recipe
    await db
      .update(recipes)
      .set({
        images: JSON.stringify(updatedImages),
        updated_at: new Date(),
      })
      .where(eq(recipes.id, RECIPE_ID));

    console.log(`\n✅ Recipe updated successfully!`);
    console.log(`\n📸 New image: ${blobUrl}`);
    console.log(`\n🌐 View recipe: http://localhost:3002/recipes/baked-ziti`);
    console.log(`\n💰 Estimated cost: $0.04\n`);
  } catch (error) {
    console.error('\n❌ Failed to generate image:', error);
    throw error;
  }
}

// Run the script
generateBakedZitiImage()
  .then(() => {
    console.log('✅ Script completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
