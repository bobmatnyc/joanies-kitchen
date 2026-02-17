#!/usr/bin/env tsx
/**
 * Fix Broken Recipe Image - Pomegranate Peach Barbecue Sauce
 *
 * Generates image using local Stable Diffusion XL (Apple Silicon M4 Max)
 * and uploads to Vercel Blob Storage.
 *
 * Process:
 * 1. Fetch recipe details from database
 * 2. Generate image using Python SD XL script
 * 3. Upload to Vercel Blob Storage
 * 4. Update recipe with new image URL
 *
 * Usage:
 *   tsx scripts/fix-pomegranate-bbq-image.ts
 */

import 'dotenv/config';
import { exec } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { put } from '@vercel/blob';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

const execAsync = promisify(exec);

// Configuration
const RECIPE_SLUG = 'pomegranate-peach-barbecue-sauce';
const PYTHON_SCRIPT = join(process.cwd(), 'scripts/image-gen/meal_image_generator.py');
const TEMP_DIR = join(process.cwd(), 'tmp/recipe-fixes');
const TEMP_IMAGE = join(TEMP_DIR, `${RECIPE_SLUG}-${Date.now()}.png`);

// SD XL Generation Parameters
const SDXL_STEPS = 35; // Higher quality for sauce photography
const SDXL_GUIDANCE = 8.0; // Strong adherence to prompt
const SDXL_WIDTH = 1024;
const SDXL_HEIGHT = 1024;

interface RecipeDetails {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  ingredients: string | null;
  tags: string | null;
  images: string | null;
}

/**
 * Fetch recipe details from database
 */
async function fetchRecipe(): Promise<RecipeDetails> {
  console.log(`\n🔍 Fetching recipe: ${RECIPE_SLUG}`);

  const [recipe] = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      slug: recipes.slug,
      description: recipes.description,
      ingredients: recipes.ingredients,
      tags: recipes.tags,
      images: recipes.images,
    })
    .from(recipes)
    .where(eq(recipes.slug, RECIPE_SLUG))
    .limit(1);

  if (!recipe) {
    throw new Error(`Recipe not found: ${RECIPE_SLUG}`);
  }

  console.log(`✓ Found recipe: ${recipe.name}`);
  console.log(`  ID: ${recipe.id}`);
  console.log(`  Description: ${recipe.description?.substring(0, 80)}...`);

  return recipe;
}

/**
 * Generate image prompt from recipe details
 */
function generatePrompt(recipe: RecipeDetails): string {
  // Base description for pomegranate peach barbecue sauce
  const description = recipe.description || recipe.name;

  // High-quality food photography prompt for sauce
  const prompt = `Professional overhead food photography of ${description},
glossy ruby-red barbecue sauce in a small ceramic bowl on rustic wooden table,
rich deep color with hints of pomegranate seeds visible,
garnished with fresh herbs,
natural window lighting creating beautiful highlights on glossy sauce surface,
shallow depth of field,
appetizing, high-end editorial quality,
magazine-worthy food styling,
NO text, NO watermarks, NO logos, NO people`;

  // Clean up whitespace
  return prompt.replace(/\s+/g, ' ').trim();
}

/**
 * Check if Python script and dependencies exist
 */
async function validateEnvironment(): Promise<void> {
  console.log(`\n🔧 Validating environment...`);

  // Check Python script exists
  if (!existsSync(PYTHON_SCRIPT)) {
    throw new Error(`Python script not found: ${PYTHON_SCRIPT}`);
  }
  console.log(`✓ Python script found: ${PYTHON_SCRIPT}`);

  // Check Python dependencies
  try {
    await execAsync('python3 -c "import torch; import diffusers; import PIL"');
    console.log(`✓ Python dependencies available (torch, diffusers, PIL)`);
  } catch (error) {
    throw new Error(
      'Missing Python dependencies. Install with: pip3 install torch diffusers pillow transformers'
    );
  }

  // Check environment variables
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN not found in environment');
  }
  console.log(`✓ Vercel Blob token configured`);

  // Create temp directory
  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
    console.log(`✓ Created temp directory: ${TEMP_DIR}`);
  }
}

/**
 * Generate image using Stable Diffusion XL
 */
async function generateImage(prompt: string): Promise<string> {
  console.log(`\n🎨 Generating image with Stable Diffusion XL...`);
  console.log(`   Model: stabilityai/stable-diffusion-xl-base-1.0`);
  console.log(`   Device: MPS (Apple Silicon)`);
  console.log(`   Steps: ${SDXL_STEPS}`);
  console.log(`   Guidance: ${SDXL_GUIDANCE}`);
  console.log(`   Size: ${SDXL_WIDTH}x${SDXL_HEIGHT}`);
  console.log(`   Prompt: ${prompt.substring(0, 100)}...`);

  const command = `python3 "${PYTHON_SCRIPT}" \
    --prompt "${prompt.replace(/"/g, '\\"')}" \
    --output "${TEMP_IMAGE}" \
    --steps ${SDXL_STEPS} \
    --guidance ${SDXL_GUIDANCE} \
    --width ${SDXL_WIDTH} \
    --height ${SDXL_HEIGHT}`;

  try {
    const startTime = Date.now();
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for output
      timeout: 300000, // 5 minute timeout
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Log Python script output
    if (stdout) {
      console.log('\n--- Python Output ---');
      console.log(stdout);
    }
    if (stderr) {
      console.log('\n--- Python Warnings ---');
      console.log(stderr);
    }

    // Verify image was created
    if (!existsSync(TEMP_IMAGE)) {
      throw new Error('Image file was not created');
    }

    console.log(`\n✓ Image generated successfully in ${duration}s`);
    console.log(`  File: ${TEMP_IMAGE}`);

    return TEMP_IMAGE;
  } catch (error: any) {
    console.error(`\n✗ Image generation failed:`, error.message);
    if (error.stdout) console.error('stdout:', error.stdout);
    if (error.stderr) console.error('stderr:', error.stderr);
    throw error;
  }
}

/**
 * Upload image to Vercel Blob Storage
 */
async function uploadToBlob(imagePath: string, recipe: RecipeDetails): Promise<string> {
  console.log(`\n☁️  Uploading to Vercel Blob Storage...`);

  try {
    const imageBuffer = await readFile(imagePath);
    const filename = `recipes/sdxl/${recipe.slug || recipe.id}-${Date.now()}.png`;

    const blob = await put(filename, imageBuffer, {
      access: 'public',
      contentType: 'image/png',
    });

    console.log(`✓ Uploaded successfully`);
    console.log(`  URL: ${blob.url}`);
    console.log(`  Size: ${(imageBuffer.length / 1024).toFixed(1)} KB`);

    return blob.url;
  } catch (error: any) {
    console.error(`\n✗ Upload failed:`, error.message);
    throw error;
  }
}

/**
 * Update recipe with new image URL
 */
async function updateRecipe(recipe: RecipeDetails, newImageUrl: string): Promise<void> {
  console.log(`\n💾 Updating recipe in database...`);

  try {
    // Parse existing images
    let existingImages: string[] = [];
    if (recipe.images) {
      try {
        existingImages = JSON.parse(recipe.images);
      } catch (error) {
        console.warn('⚠️  Could not parse existing images, will replace');
      }
    }

    // Add new image at the beginning (hero image)
    const updatedImages = [newImageUrl, ...existingImages];

    // Update recipe
    await db
      .update(recipes)
      .set({
        images: JSON.stringify(updatedImages),
        image_url: newImageUrl, // Also update deprecated field for backwards compatibility
        updated_at: new Date(),
      })
      .where(eq(recipes.id, recipe.id));

    console.log(`✓ Recipe updated successfully`);
    console.log(`  Images: ${updatedImages.length} total`);
  } catch (error: any) {
    console.error(`\n✗ Database update failed:`, error.message);
    throw error;
  }
}

/**
 * Clean up temporary files
 */
function cleanup(imagePath: string): void {
  try {
    if (existsSync(imagePath)) {
      unlinkSync(imagePath);
      console.log(`\n🧹 Cleaned up temporary file: ${imagePath}`);
    }
  } catch (error: any) {
    console.warn(`⚠️  Failed to clean up temp file: ${error.message}`);
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🍑 Fix Recipe Image - Pomegranate Peach Barbecue Sauce');
  console.log('='.repeat(70));
  console.log(`Recipe: ${RECIPE_SLUG}`);
  console.log(`Model: Stable Diffusion XL (Local)`);
  console.log(`Device: MPS (Apple Silicon M4 Max)`);
  console.log('='.repeat(70));

  let tempImagePath: string | null = null;

  try {
    // Step 1: Validate environment
    await validateEnvironment();

    // Step 2: Fetch recipe
    const recipe = await fetchRecipe();

    // Step 3: Generate prompt
    const prompt = generatePrompt(recipe);

    // Step 4: Generate image
    tempImagePath = await generateImage(prompt);

    // Step 5: Upload to Blob
    const blobUrl = await uploadToBlob(tempImagePath, recipe);

    // Step 6: Update recipe
    await updateRecipe(recipe, blobUrl);

    // Success!
    console.log('\n' + '='.repeat(70));
    console.log('✅ SUCCESS!');
    console.log('='.repeat(70));
    console.log(`\n📸 New image URL: ${blobUrl}`);
    console.log(`\n🌐 View recipe:`);
    console.log(`   http://localhost:3002/recipes/${recipe.slug}`);
    console.log('\n' + '='.repeat(70) + '\n');

    return blobUrl;
  } catch (error: any) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ FAILED');
    console.error('='.repeat(70));
    console.error(`\nError: ${error.message}`);
    if (error.stack) {
      console.error(`\nStack trace:\n${error.stack}`);
    }
    console.error('\n' + '='.repeat(70) + '\n');
    throw error;
  } finally {
    // Clean up temp file
    if (tempImagePath) {
      cleanup(tempImagePath);
    }
  }
}

// Execute script
if (require.main === module) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      process.exit(1);
    });
}

export { main };
