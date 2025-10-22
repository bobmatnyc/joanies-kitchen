/**
 * Generate Specific Images for Products and Tools
 *
 * This script generates AI images for:
 * 1. Product-specific ingredients (cake mix, soup mix, etc.) - 33 items
 * 2. Kitchen tools (skewers, thermometer, etc.) - 31 items
 *
 * Uses Replicate Flux Schnell model with specialized prompts
 * for product packaging and kitchen tools.
 *
 * Cost Estimate: ~$0.19 - $0.32 (64 images at $0.003-$0.005 each)
 * Time Estimate: 4-8 minutes
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const sql = neon(process.env.DATABASE_URL!);

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
  // High priority only (usage > 0) = 10 items
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
  // High priority only (usage > 0) = 7 items
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
  return `Product photography of ${productName} package, grocery store product, clean white background, professional lighting, front view of box or bag, product label visible, high resolution, commercial photography style, appetizing presentation`;
}

/**
 * Generate image prompt for kitchen tool
 */
function getToolPrompt(toolName: string, canonicalName: string): string {
  return `Professional product photography of ${canonicalName}, kitchen tool, clean white background or kitchen counter, natural lighting, detailed view showing functionality, high resolution, commercial product photo, isolated object, clear details`;
}

/**
 * Generate image using Replicate API
 */
async function generateImageWithReplicate(prompt: string): Promise<Buffer> {
  const apiToken = process.env.REPLICATE_API_TOKEN;

  if (!apiToken) {
    throw new Error('REPLICATE_API_TOKEN not found in environment variables');
  }

  console.log(`  🎨 Generating with prompt: "${prompt.substring(0, 60)}..."`);

  // Create prediction
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: '5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc56e41f62f35637',
      input: {
        prompt,
        num_outputs: 1,
        aspect_ratio: '1:1',
        output_format: 'jpg',
        output_quality: 90,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Replicate API error: ${response.status} - ${await response.text()}`);
  }

  const prediction = await response.json();

  // Poll for completion
  let status = prediction.status;
  let pollUrl = prediction.urls.get;

  while (status !== 'succeeded' && status !== 'failed') {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
    const checkResponse = await fetch(pollUrl, {
      headers: { 'Authorization': `Token ${apiToken}` },
    });
    const checkData = await checkResponse.json();
    status = checkData.status;

    if (status === 'failed') {
      throw new Error(`Image generation failed: ${checkData.error}`);
    }
  }

  // Download image
  const imageUrl = prediction.output[0];
  console.log(`  📥 Downloading from: ${imageUrl}`);

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.statusText}`);
  }

  const buffer = Buffer.from(await imageResponse.arrayBuffer());

  // Validate size
  if (buffer.length < 10000) {
    throw new Error(`Image too small: ${(buffer.length / 1024).toFixed(1)}KB`);
  }

  console.log(`  ✅ Downloaded: ${(buffer.length / 1024).toFixed(1)}KB`);
  return buffer;
}

/**
 * Save progress to file
 */
async function saveProgress(progress: GenerationProgress): Promise<void> {
  const progressPath = join(process.cwd(), 'tmp', 'specific-image-generation-progress.json');
  await writeFile(progressPath, JSON.stringify(progress, null, 2));
}

/**
 * Load existing progress
 */
async function loadProgress(): Promise<GenerationProgress | null> {
  try {
    const progressPath = join(process.cwd(), 'tmp', 'specific-image-generation-progress.json');
    const data = await import(progressPath);
    return data as GenerationProgress;
  } catch {
    return null;
  }
}

async function generateSpecificImages() {
  console.log('🎨 Generating Specific Images for Products and Tools\\n');
  console.log('This will generate AI images for:');
  console.log(`  📦 ${PRODUCT_INGREDIENTS.length} product-specific ingredients`);
  console.log(`  🔧 ${KITCHEN_TOOLS.length} kitchen tools`);
  console.log(`  💰 Estimated cost: $${(PRODUCT_INGREDIENTS.length + KITCHEN_TOOLS.length) * 0.003} - $${(PRODUCT_INGREDIENTS.length + KITCHEN_TOOLS.length) * 0.005}`);
  console.log(`  ⏱️  Estimated time: ${Math.ceil((PRODUCT_INGREDIENTS.length + KITCHEN_TOOLS.length) * 2 / 60)}-${Math.ceil((PRODUCT_INGREDIENTS.length + KITCHEN_TOOLS.length) * 4 / 60)} minutes\\n`);

  // Check for API token
  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('❌ Error: REPLICATE_API_TOKEN not found in environment variables');
    console.error('   Add to .env.local: REPLICATE_API_TOKEN=r8_your_token_here');
    console.error('   Get your token at: https://replicate.com/account/api-tokens\\n');
    process.exit(1);
  }

  // Dry run check
  const shouldApply = process.env.APPLY_CHANGES === 'true';
  if (!shouldApply) {
    console.log('⚠️  DRY RUN MODE - No images will be generated');
    console.log('To generate images, set APPLY_CHANGES=true\\n');
    console.log('Command: APPLY_CHANGES=true npx tsx scripts/generate-specific-images.ts\\n');
    return;
  }

  // Ensure tmp and images directories exist
  await mkdir(join(process.cwd(), 'tmp'), { recursive: true });
  await mkdir(join(process.cwd(), 'public', 'images', 'ingredients', 'products'), { recursive: true });
  await mkdir(join(process.cwd(), 'public', 'images', 'tools'), { recursive: true });

  console.log('🚀 Starting image generation...\\n');

  // Track progress
  const progress: GenerationProgress = {
    phase: 'products',
    total: PRODUCT_INGREDIENTS.length + KITCHEN_TOOLS.length,
    processed: 0,
    successful: 0,
    failed: 0,
    processedIds: [],
    failures: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Generate product images
  console.log('📦 Phase 1: Product-Specific Ingredients\\n');
  for (const product of PRODUCT_INGREDIENTS) {
    console.log(`[${progress.processed + 1}/${progress.total}] ${product.name} (${product.usage} recipes)`);

    try {
      const prompt = getProductPrompt(product.name);
      const imageBuffer = await generateImageWithReplicate(prompt);

      // Save to disk
      const filename = `${product.name.replace(/\\s+/g, '-').toLowerCase()}.jpg`;
      const filepath = join(process.cwd(), 'public', 'images', 'ingredients', 'products', filename);
      await writeFile(filepath, imageBuffer);

      // Update database
      const imageUrl = `/images/ingredients/products/${filename}`;
      await sql`
        UPDATE ingredients
        SET image_url = ${imageUrl}, updated_at = NOW()
        WHERE id = ${product.id}
      `;

      console.log(`  💾 Saved to: ${imageUrl}\\n`);

      progress.successful++;
      progress.processedIds.push(product.id);
    } catch (error: any) {
      console.error(`  ❌ Failed: ${error.message}\\n`);
      progress.failed++;
      progress.failures.push({ id: product.id, name: product.name, error: error.message });
    }

    progress.processed++;
    progress.updatedAt = new Date().toISOString();
    await saveProgress(progress);

    // Rate limiting: 2 seconds between requests
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Generate tool images
  console.log('\\n🔧 Phase 2: Kitchen Tools\\n');
  progress.phase = 'tools';

  for (const tool of KITCHEN_TOOLS) {
    console.log(`[${progress.processed + 1}/${progress.total}] ${tool.canonical} (${tool.usage} recipes)`);

    try {
      const prompt = getToolPrompt(tool.name, tool.canonical);
      const imageBuffer = await generateImageWithReplicate(prompt);

      // Save to disk
      const filename = `${tool.name.replace(/\\s+/g, '-').toLowerCase()}.jpg`;
      const filepath = join(process.cwd(), 'public', 'images', 'tools', filename);
      await writeFile(filepath, imageBuffer);

      // Update database (tools are still in ingredients table)
      const imageUrl = `/images/tools/${filename}`;
      await sql`
        UPDATE ingredients
        SET image_url = ${imageUrl}, updated_at = NOW()
        WHERE id = ${tool.id}
      `;

      console.log(`  💾 Saved to: ${imageUrl}\\n`);

      progress.successful++;
      progress.processedIds.push(tool.id);
    } catch (error: any) {
      console.error(`  ❌ Failed: ${error.message}\\n`);
      progress.failed++;
      progress.failures.push({ id: tool.id, name: tool.name, error: error.message });
    }

    progress.processed++;
    progress.updatedAt = new Date().toISOString();
    await saveProgress(progress);

    // Rate limiting: 2 seconds between requests
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Final report
  console.log('\\n✨ Generation Complete!\\n');
  console.log('📊 Summary:');
  console.log(`   Total: ${progress.total}`);
  console.log(`   Successful: ${progress.successful} (${((progress.successful / progress.total) * 100).toFixed(1)}%)`);
  console.log(`   Failed: ${progress.failed}`);

  if (progress.failures.length > 0) {
    console.log('\\n❌ Failures:');
    progress.failures.forEach((f, i) => {
      console.log(`   ${i + 1}. ${f.name}: ${f.error}`);
    });
  }

  console.log('\\n📝 Progress saved to: tmp/specific-image-generation-progress.json');
}

// Run script
generateSpecificImages()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\\n❌ Script failed:', error);
    process.exit(1);
  });
