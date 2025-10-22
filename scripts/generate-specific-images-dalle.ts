/**
 * Generate Specific Images for Products and Tools using DALL-E 3
 *
 * This script generates AI images for:
 * 1. Product-specific ingredients (cake mix, soup mix, etc.) - 10 items
 * 2. Kitchen tools (skewers, thermometer, etc.) - 7 items
 *
 * Uses OpenAI DALL-E 3 model with specialized prompts
 * for product packaging and kitchen tools.
 *
 * Cost Estimate: ~$0.68 - $1.70 (17 images at $0.04-$0.10 each)
 * Time Estimate: 2-5 minutes
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import OpenAI from 'openai';

const sql = neon(process.env.DATABASE_URL!);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Product-specific ingredient IDs (from analysis)
const PRODUCT_INGREDIENTS = [
  { id: '6000e6bb-1f16-4a17-a6dd-aaf98517e743', name: 'cake mix', category: 'other', usage: 8 },
  { id: 'a56cebec-48e2-4bfd-8c85-6d61b02170ba', name: 'bean soup mix', category: 'proteins', usage: 6 },
  { id: '9479eb2a-1c19-4bb1-9e9d-5a307ebc789b', name: 'onion soup mix', category: 'condiments', usage: 6 },
  { id: '148e32d5-0031-462e-863a-2c7ee4281688', name: 'pancake mix', category: 'grains', usage: 3 },
  { id: '02444985-7830-44aa-b267-44dcb1eb336f', name: 'chili seasoning mix', category: 'condiments', usage: 2 },
  { id: 'ffeb31d1-89bd-47e0-9931-5d283b93ae05', name: 'corn muffin mix', category: 'other', usage: 2 },
  { id: '4241860a-44f6-420f-b34a-24339ab48828', name: 'taco seasoning mix', category: 'condiments', usage: 2 },
  { id: '30e640fa-1402-4535-b7a5-baa3b685ceea', name: 'cornbread mix', category: 'other', usage: 1 },
  { id: 'f10c19d9-a490-433c-bfd0-a3d0e46c66f3', name: 'biscuit mix', category: 'other', usage: 1 },
  { id: '14518d7a-b685-440b-83d7-a749a0bea774', name: 'vegetable soup mix', category: 'other', usage: 1 },
];

// Kitchen tool IDs (from analysis - high usage only)
const KITCHEN_TOOLS = [
  { id: 'bf4491e6-e3ad-4bd1-9b7b-39ef4f2d7473', name: 'skewers', canonical: 'Skewer', usage: 9 },
  { id: 'ac46cc71-0d63-4076-96bc-d53261c68e2a', name: 'bamboo skewers', canonical: 'Skewer', usage: 6 },
  { id: '21644114-5795-491c-992e-6bf46ac13f7b', name: 'thermometer', canonical: 'Thermometer', usage: 6 },
  { id: 'd60e504a-1412-424e-af29-98c9e2e1578f', name: 'cookie cutter', canonical: 'Star Cookie Cutter', usage: 3 },
  { id: '1519b8c7-7d9d-4661-90ed-fb851e1dad78', name: 'cardboard round', canonical: 'Cardboard Round', usage: 2 },
  { id: '1310abfe-1cad-4618-871d-3d9c1400a9a0', name: 'spatula', canonical: 'Spatula', usage: 1 },
  { id: '7d16e6c8-bc34-4e7e-86a1-8b228f52cd95', name: 'oven-roasting bag', canonical: 'Oven-roasting Bag', usage: 1 },
];

interface GenerationProgress {
  phase: 'products' | 'tools';
  total: number;
  processed: number;
  successful: number;
  failed: number;
  processedIds: string[];
  failures: Array<{ id: string; name: string; error: string }>;
  startedAt: string;
  updatedAt: string;
}

/**
 * Generate image prompt for product packaging
 */
function getProductPrompt(productName: string): string {
  return `Professional product photography of a ${productName} package on a clean white kitchen counter. The product box or bag should be clearly visible with realistic brand-style labeling. Studio lighting, high resolution, appetizing and authentic grocery store product presentation. Front-facing view showing the full package.`;
}

/**
 * Generate image prompt for kitchen tool
 */
function getToolPrompt(toolName: string, canonicalName: string): string {
  return `Professional product photography of ${canonicalName} placed on a clean white kitchen counter. The ${toolName} should be clearly visible with realistic details showing its functionality. Natural kitchen lighting, high resolution, authentic kitchen tool presentation. Single object in focus.`;
}

/**
 * Generate image using OpenAI DALL-E 3
 */
async function generateImageWithDallE(prompt: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found in environment variables');
  }

  console.log(`  🎨 Generating with DALL-E 3: "${prompt.substring(0, 60)}..."`);

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url',
    });

    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      throw new Error('No image URL returned from DALL-E');
    }

    console.log(`  📥 Downloading image...`);

    // Download the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error: any) {
    console.error('  ❌ DALL-E generation failed:', error.message);
    throw error;
  }
}

/**
 * Upload image to Vercel Blob Storage
 */
async function uploadToVercelBlob(imageBuffer: Buffer, filename: string): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN not found in environment variables');
  }

  console.log(`  ☁️  Uploading to Vercel Blob: ${filename}`);

  const response = await fetch(`https://blob.vercel-storage.com/${filename}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'image/png',
      'x-content-type': 'image/png',
    },
    body: imageBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Blob upload failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.url;
}

/**
 * Save progress to filesystem
 */
async function saveProgress(progress: GenerationProgress): Promise<void> {
  const progressDir = join(process.cwd(), 'tmp');
  await mkdir(progressDir, { recursive: true });

  const filename = `specific-images-progress-${progress.phase}.json`;
  const filepath = join(progressDir, filename);

  await writeFile(filepath, JSON.stringify(progress, null, 2));
  console.log(`\n💾 Progress saved: ${filename}`);
}

/**
 * Process a single product ingredient
 */
async function processProduct(
  product: { id: string; name: string; category: string; usage: number },
  progress: GenerationProgress,
  dryRun: boolean
): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🥫 PRODUCT: ${product.name} (${product.category}, usage: ${product.usage})`);
  console.log(`   ID: ${product.id}`);

  try {
    // Generate prompt
    const prompt = getProductPrompt(product.name);
    console.log(`  📝 Prompt: "${prompt.substring(0, 80)}..."`);

    if (dryRun) {
      console.log('  🔍 DRY RUN - Skipping actual generation');
      progress.processed++;
      progress.successful++;
      return;
    }

    // Generate image with DALL-E
    const imageBuffer = await generateImageWithDallE(prompt);
    console.log(`  ✅ Image generated (${(imageBuffer.length / 1024).toFixed(1)} KB)`);

    // Upload to Vercel Blob
    const filename = `ingredients/products/${product.id}.png`;
    const blobUrl = await uploadToVercelBlob(imageBuffer, filename);
    console.log(`  ✅ Uploaded: ${blobUrl}`);

    // Update database
    await sql`
      UPDATE ingredients
      SET image_url = ${blobUrl}
      WHERE id = ${product.id}
    `;
    console.log(`  ✅ Database updated`);

    // Update progress
    progress.processed++;
    progress.successful++;
    progress.processedIds.push(product.id);
    progress.updatedAt = new Date().toISOString();

    // Save progress after each successful generation
    await saveProgress(progress);

    // Rate limiting - wait 3 seconds between requests
    console.log('  ⏳ Waiting 3 seconds...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
  } catch (error: any) {
    console.error(`  ❌ Failed to process ${product.name}:`, error.message);
    progress.processed++;
    progress.failed++;
    progress.failures.push({
      id: product.id,
      name: product.name,
      error: error.message,
    });
    progress.updatedAt = new Date().toISOString();
    await saveProgress(progress);
  }
}

/**
 * Process a single kitchen tool
 */
async function processTool(
  tool: { id: string; name: string; canonical: string; usage: number },
  progress: GenerationProgress,
  dryRun: boolean
): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔧 TOOL: ${tool.name} → ${tool.canonical} (usage: ${tool.usage})`);
  console.log(`   ID: ${tool.id}`);

  try {
    // Generate prompt
    const prompt = getToolPrompt(tool.name, tool.canonical);
    console.log(`  📝 Prompt: "${prompt.substring(0, 80)}..."`);

    if (dryRun) {
      console.log('  🔍 DRY RUN - Skipping actual generation');
      progress.processed++;
      progress.successful++;
      return;
    }

    // Generate image with DALL-E
    const imageBuffer = await generateImageWithDallE(prompt);
    console.log(`  ✅ Image generated (${(imageBuffer.length / 1024).toFixed(1)} KB)`);

    // Upload to Vercel Blob
    const filename = `ingredients/tools/${tool.id}.png`;
    const blobUrl = await uploadToVercelBlob(imageBuffer, filename);
    console.log(`  ✅ Uploaded: ${blobUrl}`);

    // Update database
    await sql`
      UPDATE ingredients
      SET image_url = ${blobUrl}
      WHERE id = ${tool.id}
    `;
    console.log(`  ✅ Database updated`);

    // Update progress
    progress.processed++;
    progress.successful++;
    progress.processedIds.push(tool.id);
    progress.updatedAt = new Date().toISOString();

    // Save progress after each successful generation
    await saveProgress(progress);

    // Rate limiting - wait 3 seconds between requests
    console.log('  ⏳ Waiting 3 seconds...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
  } catch (error: any) {
    console.error(`  ❌ Failed to process ${tool.name}:`, error.message);
    progress.processed++;
    progress.failed++;
    progress.failures.push({
      id: tool.id,
      name: tool.name,
      error: error.message,
    });
    progress.updatedAt = new Date().toISOString();
    await saveProgress(progress);
  }
}

/**
 * Main execution
 */
async function main() {
  const dryRun = process.env.APPLY_CHANGES !== 'true';

  console.log('\n' + '='.repeat(70));
  console.log('🎨 PRODUCT AND TOOL IMAGE GENERATION (DALL-E 3)');
  console.log('='.repeat(70));
  console.log(`\n📊 Scope:`);
  console.log(`   - Products: ${PRODUCT_INGREDIENTS.length} items`);
  console.log(`   - Tools: ${KITCHEN_TOOLS.length} items`);
  console.log(`   - Total: ${PRODUCT_INGREDIENTS.length + KITCHEN_TOOLS.length} images`);
  console.log(`\n💰 Estimated Cost: $${(PRODUCT_INGREDIENTS.length + KITCHEN_TOOLS.length) * 0.04} - $${(PRODUCT_INGREDIENTS.length + KITCHEN_TOOLS.length) * 0.10}`);
  console.log(`⏱️  Estimated Time: ${Math.ceil((PRODUCT_INGREDIENTS.length + KITCHEN_TOOLS.length) * 3 / 60)} minutes\n`);

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No images will be generated or uploaded');
    console.log('   Set APPLY_CHANGES=true to execute\n');
  } else {
    console.log('🚀 LIVE MODE - Images will be generated and uploaded\n');
  }

  // Phase 1: Products
  console.log('\n' + '='.repeat(70));
  console.log('📦 PHASE 1: PRODUCT-SPECIFIC INGREDIENTS');
  console.log('='.repeat(70));

  const productProgress: GenerationProgress = {
    phase: 'products',
    total: PRODUCT_INGREDIENTS.length,
    processed: 0,
    successful: 0,
    failed: 0,
    processedIds: [],
    failures: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  for (const product of PRODUCT_INGREDIENTS) {
    await processProduct(product, productProgress, dryRun);
  }

  // Phase 2: Tools
  console.log('\n' + '='.repeat(70));
  console.log('🔧 PHASE 2: KITCHEN TOOLS');
  console.log('='.repeat(70));

  const toolProgress: GenerationProgress = {
    phase: 'tools',
    total: KITCHEN_TOOLS.length,
    processed: 0,
    successful: 0,
    failed: 0,
    processedIds: [],
    failures: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  for (const tool of KITCHEN_TOOLS) {
    await processTool(tool, toolProgress, dryRun);
  }

  // Final summary
  console.log('\n' + '='.repeat(70));
  console.log('✨ GENERATION COMPLETE');
  console.log('='.repeat(70));
  console.log(`\n📊 Products:`);
  console.log(`   ✅ Successful: ${productProgress.successful}`);
  console.log(`   ❌ Failed: ${productProgress.failed}`);
  console.log(`\n🔧 Tools:`);
  console.log(`   ✅ Successful: ${toolProgress.successful}`);
  console.log(`   ❌ Failed: ${toolProgress.failed}`);
  console.log(`\n📈 Total:`);
  console.log(`   ✅ Successful: ${productProgress.successful + toolProgress.successful}`);
  console.log(`   ❌ Failed: ${productProgress.failed + toolProgress.failed}`);

  if (productProgress.failures.length > 0 || toolProgress.failures.length > 0) {
    console.log(`\n❌ Failures:`);
    [...productProgress.failures, ...toolProgress.failures].forEach((f) => {
      console.log(`   - ${f.name}: ${f.error}`);
    });
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

main().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
