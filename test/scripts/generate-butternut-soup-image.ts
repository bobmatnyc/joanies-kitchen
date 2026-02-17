#!/usr/bin/env tsx
/**
 * Generate professional AI image for Roasted Butternut Squash Soup
 * Uses DALL-E 3 via OpenAI SDK
 *
 * Recipe: Roasted Butternut Squash Soup
 * ID: ee4e2fb4-b7ae-44df-861c-39c1777c9984
 * Slug: roasted-butternut-squash-soup
 */

import 'dotenv/config';
import { put } from '@vercel/blob';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

const RECIPE_ID = 'ee4e2fb4-b7ae-44df-861c-39c1777c9984';
const RECIPE_SLUG = 'roasted-butternut-squash-soup';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateImageWithAI(): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not found');
  }

  // Professional food photography prompt for butternut squash soup
  const prompt = `Professional food photography of roasted butternut squash soup in a white ceramic bowl,
vibrant orange color with natural depth and richness,
garnished with elegant cream swirl in spiral pattern,
topped with toasted pumpkin seeds and fresh sage leaves,
warm natural lighting from the side creating soft shadows,
rustic wooden table background with subtle texture,
styled with a linen napkin and vintage spoon beside the bowl,
shallow depth of field focusing on the soup,
appetizing steam rising gently,
warm autumn color palette with orange, cream, and green accents,
professional food styling in modern rustic aesthetic,
high-end editorial quality for a cookbook or food magazine,
inviting and comforting presentation.
NO text, NO watermarks, NO logos.
Ultra-realistic, magazine-quality food photography.`;

  console.log(`🎨 Generating AI image for Roasted Butternut Squash Soup...`);
  console.log(`📝 Prompt: "${prompt.substring(0, 100)}..."`);

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

    const filename = `recipes/ai/butternut-squash-soup-${Date.now()}.png`;

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

async function generateButternutSoupImage() {
  console.log('\n🥣 Roasted Butternut Squash Soup - Image Generation');
  console.log('═'.repeat(70));
  console.log(`Recipe ID: ${RECIPE_ID}`);
  console.log(`Recipe Slug: ${RECIPE_SLUG}`);
  console.log(`Model: DALL-E 3 via OpenAI`);
  console.log(`Image Size: 1024x1024`);
  console.log(`Quality: Standard`);
  console.log(`Cost: ~$0.04 per image\n`);

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY not found');
    process.exit(1);
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('❌ Error: BLOB_READ_WRITE_TOKEN not found');
    process.exit(1);
  }

  try {
    // Get current recipe
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, RECIPE_ID)).limit(1);

    if (!recipe) {
      throw new Error('Recipe not found');
    }

    console.log(`📖 Current recipe:`);
    console.log(`   Name: ${recipe.name}`);
    console.log(`   Cuisine: ${recipe.cuisine || 'N/A'}`);
    console.log(`   Slug: ${recipe.slug}`);
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
      } catch (_e) {
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
    console.log(`📸 Total images: ${updatedImages.length}`);
    console.log(`\n🌐 View recipe at:`);
    console.log(`   http://localhost:3002/recipes/${RECIPE_SLUG}`);
    console.log(`\n💰 Estimated cost: $0.04\n`);
  } catch (error) {
    console.error('\n❌ Failed to generate image:', error);
    throw error;
  }
}

// Run the script
generateButternutSoupImage()
  .then(() => {
    console.log('✅ Script completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
