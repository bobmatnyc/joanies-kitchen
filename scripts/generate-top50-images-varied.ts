/**
 * Generate varied, high-quality images for Top 50 recipes using OpenAI DALL-E 3
 * Each category gets contextually appropriate backgrounds and settings
 */

import { resolve } from 'node:path';
import { put } from '@vercel/blob';
import { config } from 'dotenv';
import { desc, eq, or, sql } from 'drizzle-orm';
import OpenAI from 'openai';
import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Background prompts for different food categories
const BACKGROUND_PROMPTS = {
  beef: 'rustic wooden table in a cozy steakhouse, warm candlelight, elegant plating',
  chicken: 'bright modern kitchen with marble countertops, natural daylight, fresh herbs nearby',
  lamb: 'elegant fine dining table with wine glasses, soft romantic lighting, upscale restaurant ambiance',
  pasta:
    'traditional Italian trattoria setting with checkered tablecloth, rustic wooden table, Tuscan atmosphere',
  seafood:
    'coastal restaurant with ocean view in background, natural light, nautical elements, fresh and light setting',
  pork: 'farmhouse kitchen setting with rustic charm, wooden cutting board, country-style ambiance',
  'other-proteins':
    'contemporary minimalist kitchen, clean white background, professional food photography lighting',
  vegetables: 'farm-to-table restaurant setting, bright natural light, garden-fresh aesthetic',
  salads: 'sunny outdoor patio dining, fresh garden background, bright and airy setting',
  grains: 'wholesome family dinner table, warm lighting, homestyle setting',
  potatoes: 'rustic country kitchen, cast iron cookware visible, warm homey atmosphere',
  bread: 'artisan bakery setting, flour-dusted surface, warm lighting from oven glow',
  cakes: 'elegant dessert display in French patisserie, soft lighting, pristine white background',
  cookies:
    'cozy home kitchen, cooling rack on marble counter, afternoon light streaming through window',
  pies: 'country kitchen setting, vintage pie dish, warm autumn lighting',
  puddings: 'upscale dessert presentation, fine china, sophisticated restaurant setting',
  frozen: 'modern ice cream parlor, colorful background, bright cheerful lighting',
  generic: 'professional food photography studio, clean modern setting, perfect lighting',
};

// Category detection based on tags
function determineCategory(tags: string | null): keyof typeof BACKGROUND_PROMPTS {
  if (!tags) return 'generic';

  try {
    const tagArray = JSON.parse(tags);
    const normalizedTags = tagArray.map((t: string) => t.toLowerCase());

    // Check for specific categories
    if (normalizedTags.some((t: string) => ['beef', 'steak', 'roast'].some((k) => t.includes(k))))
      return 'beef';
    if (normalizedTags.some((t: string) => ['chicken', 'poultry'].some((k) => t.includes(k))))
      return 'chicken';
    if (normalizedTags.some((t: string) => t.includes('lamb'))) return 'lamb';
    if (
      normalizedTags.some((t: string) =>
        ['pasta', 'noodles', 'spaghetti', 'lasagna'].some((k) => t.includes(k))
      )
    )
      return 'pasta';
    if (
      normalizedTags.some((t: string) =>
        ['seafood', 'fish', 'salmon', 'shrimp'].some((k) => t.includes(k))
      )
    )
      return 'seafood';
    if (normalizedTags.some((t: string) => ['pork', 'bacon', 'ham'].some((k) => t.includes(k))))
      return 'pork';
    if (
      normalizedTags.some((t: string) =>
        ['vegetables', 'vegetable', 'veggie'].some((k) => t.includes(k))
      )
    )
      return 'vegetables';
    if (normalizedTags.some((t: string) => t.includes('salad'))) return 'salads';
    if (normalizedTags.some((t: string) => ['rice', 'quinoa', 'grain'].some((k) => t.includes(k))))
      return 'grains';
    if (normalizedTags.some((t: string) => t.includes('potato'))) return 'potatoes';
    if (normalizedTags.some((t: string) => ['bread', 'roll', 'biscuit'].some((k) => t.includes(k))))
      return 'bread';
    if (normalizedTags.some((t: string) => ['cake', 'cupcake'].some((k) => t.includes(k))))
      return 'cakes';
    if (normalizedTags.some((t: string) => t.includes('cookie'))) return 'cookies';
    if (normalizedTags.some((t: string) => ['pie', 'tart'].some((k) => t.includes(k))))
      return 'pies';
    if (
      normalizedTags.some((t: string) =>
        ['pudding', 'custard', 'mousse'].some((k) => t.includes(k))
      )
    )
      return 'puddings';
    if (
      normalizedTags.some((t: string) =>
        ['ice cream', 'sorbet', 'frozen'].some((k) => t.includes(k))
      )
    )
      return 'frozen';

    return 'generic';
  } catch (_error) {
    return 'generic';
  }
}

// Generate image using DALL-E 3
async function generateImageForRecipe(recipe: {
  id: string;
  name: string;
  tags: string | null;
  description: string | null;
}) {
  const category = determineCategory(recipe.tags);
  const backgroundPrompt = BACKGROUND_PROMPTS[category];

  // Craft a detailed, high-quality prompt
  const prompt = `Professional food photography of ${recipe.name}.
Setting: ${backgroundPrompt}.
Style: appetizing, high-end editorial quality for a cookbook,
vibrant natural colors, shallow depth of field for artistic blur,
beautifully garnished and plated with attention to detail,
styled by a professional food stylist,
photographed from a flattering 45-degree angle.
NO text, NO watermarks, NO logos.
Ultra-realistic, magazine-quality food photography.`;

  console.log(`\nGenerating image for: ${recipe.name}`);
  console.log(`Category: ${category}`);
  console.log(`Prompt: ${prompt.substring(0, 100)}...`);

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard', // Use 'hd' for even better quality (2x cost)
      style: 'natural', // More realistic than 'vivid'
    });

    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      throw new Error('No image URL returned from OpenAI');
    }

    return imageUrl;
  } catch (error: any) {
    console.error(`Error generating image for ${recipe.name}:`, error.message);
    throw error;
  }
}

// Download image from URL and upload to Vercel Blob
async function uploadToVercelBlob(imageUrl: string, recipeName: string): Promise<string> {
  console.log(`Downloading and uploading to Vercel Blob...`);

  try {
    // Download image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate filename
    const filename = `top50-${recipeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}.png`;

    // Upload to Vercel Blob
    const uploadResult = await put(filename, buffer, {
      access: 'public',
      contentType: 'image/png',
    });

    console.log(`Uploaded to Vercel Blob: ${uploadResult.url}`);
    return uploadResult.url;
  } catch (error: any) {
    console.error('Error uploading to Vercel Blob:', error.message);
    throw error;
  }
}

// Update recipe with new image
async function updateRecipeImage(recipeId: string, imageUrl: string) {
  try {
    // Get current images
    const recipe = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);

    if (recipe.length === 0) {
      throw new Error(`Recipe ${recipeId} not found`);
    }

    const currentImages = recipe[0].images ? JSON.parse(recipe[0].images) : [];
    const newImages = [imageUrl, ...currentImages].slice(0, 6); // Max 6 images

    await db
      .update(recipes)
      .set({
        images: JSON.stringify(newImages),
        updated_at: new Date(),
      })
      .where(eq(recipes.id, recipeId));

    console.log(`Updated recipe ${recipeId} with new image`);
  } catch (error: any) {
    console.error(`Error updating recipe ${recipeId}:`, error.message);
    throw error;
  }
}

// Rate limiting helper
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main function
async function main() {
  console.log('=== Top 50 Image Generation with Varied Backgrounds ===\n');

  // Check for dry-run mode
  const isDryRun = process.argv.includes('--dry-run');
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No actual images will be generated\n');
  }

  // Get Top 50 recipes without images
  const topRecipes = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      tags: recipes.tags,
      description: recipes.description,
      images: recipes.images,
      system_rating: recipes.system_rating,
      avg_user_rating: recipes.avg_user_rating,
    })
    .from(recipes)
    .where(
      or(sql`${recipes.system_rating} IS NOT NULL`, sql`${recipes.avg_user_rating} IS NOT NULL`)
    )
    .orderBy(
      desc(
        sql`COALESCE(
          (COALESCE(${recipes.system_rating}, 0) + COALESCE(${recipes.avg_user_rating}, 0)) /
          NULLIF(
            (CASE WHEN ${recipes.system_rating} IS NOT NULL THEN 1 ELSE 0 END +
             CASE WHEN ${recipes.avg_user_rating} IS NOT NULL THEN 1 ELSE 0 END),
            0
          ),
          COALESCE(${recipes.system_rating}, ${recipes.avg_user_rating}, 0)
        )`
      )
    )
    .limit(50);

  console.log(`Found ${topRecipes.length} top-rated recipes`);

  // Filter to recipes without images
  const recipesNeedingImages = topRecipes.filter((recipe) => {
    if (!recipe.images) return true;
    try {
      const images = JSON.parse(recipe.images);
      return !Array.isArray(images) || images.length === 0;
    } catch {
      return true;
    }
  });

  console.log(`${recipesNeedingImages.length} recipes need images\n`);

  if (recipesNeedingImages.length === 0) {
    console.log('All Top 50 recipes already have images!');
    return;
  }

  // Estimate cost
  const costPerImage = 0.04; // DALL-E 3 standard quality: $0.04 per image
  const estimatedCost = recipesNeedingImages.length * costPerImage;
  console.log(`\nEstimated cost: $${estimatedCost.toFixed(2)} USD`);
  console.log('(DALL-E 3 standard quality: $0.04 per image)\n');

  // Process each recipe
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < recipesNeedingImages.length; i++) {
    const recipe = recipesNeedingImages[i];
    console.log(`\n[${i + 1}/${recipesNeedingImages.length}] Processing: ${recipe.name}`);

    try {
      if (isDryRun) {
        // Dry run - just show what would be generated
        const category = determineCategory(recipe.tags);
        console.log(`Would generate ${category} style image`);
        successCount++;
        console.log(`✅ [DRY RUN] Would generate and upload image`);
      } else {
        // Generate image with DALL-E 3
        const imageUrl = await generateImageForRecipe(recipe);

        // Upload to Vercel Blob
        const blobUrl = await uploadToVercelBlob(imageUrl, recipe.name);

        // Update recipe in database
        await updateRecipeImage(recipe.id, blobUrl);

        successCount++;
        console.log(`✅ Successfully generated and uploaded image`);

        // Rate limiting: DALL-E 3 allows ~5 requests per minute
        // Wait 12 seconds between requests to be safe
        if (i < recipesNeedingImages.length - 1) {
          console.log('Waiting 12 seconds before next request...');
          await delay(12000);
        }
      }
    } catch (error: any) {
      errorCount++;
      console.error(`❌ Failed to process recipe: ${error.message}`);
      console.log('Continuing with next recipe...');

      // Wait a bit before continuing after error
      if (!isDryRun) {
        await delay(5000);
      }
    }
  }

  // Summary
  console.log('\n=== Generation Complete ===');
  console.log(`✅ Success: ${successCount} images generated`);
  console.log(`❌ Errors: ${errorCount} recipes failed`);
  console.log(`💰 Actual cost: $${(successCount * costPerImage).toFixed(2)} USD`);
}

// Run script
main()
  .then(() => {
    console.log('\nScript finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript failed:', error);
    process.exit(1);
  });
