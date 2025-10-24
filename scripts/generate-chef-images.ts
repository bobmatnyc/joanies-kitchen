#!/usr/bin/env tsx

/**
 * Generate Profile Images for Sustainable Chefs using DALL-E 3
 *
 * This script:
 * 1. Queries the chefs table to find chefs without profile images
 * 2. Generates professional portrait images using DALL-E 3
 * 3. Saves images to /public/images/chefs/{chef-slug}.png
 * 4. Updates database with image paths
 *
 * Uses OpenAI DALL-E 3 model via OpenRouter API for consistent portrait generation.
 *
 * Cost Estimate: ~$0.80 - $2.00 per chef image ($0.04-$0.10 each)
 * Time Estimate: ~3-4 seconds per image + API processing time
 *
 * Run with:
 *   pnpm tsx scripts/generate-chef-images.ts              # Dry run (preview only)
 *   APPLY_CHANGES=true pnpm tsx scripts/generate-chef-images.ts  # Live mode
 */

import 'dotenv/config';
import { eq, or, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefs, type Chef } from '@/lib/db/chef-schema';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import OpenAI from 'openai';

// Initialize OpenAI client (DALL-E is available directly via OpenAI API)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GenerationProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  processedSlugs: string[];
  failures: Array<{ slug: string; name: string; error: string }>;
  startedAt: string;
  updatedAt: string;
}

interface ChefWithMissingImage {
  id: string;
  slug: string;
  name: string;
  displayName: string | null;
  bio: string | null;
  specialties: string[];
  profileImageUrl: string | null;
}

/**
 * Generate image prompt for chef portrait
 */
function getChefPortraitPrompt(chef: ChefWithMissingImage): string {
  // Extract key descriptors from bio
  const bioDescriptor = extractBioDescriptor(chef.bio, chef.specialties);

  // Use display name if available, otherwise use name
  const chefName = chef.displayName || chef.name;

  return `Professional portrait photo of ${chefName}, ${bioDescriptor}. High-quality headshot with warm natural lighting, professional photography, clean neutral background. Photorealistic, detailed facial features, approachable and friendly expression, chef or culinary professional appearance. Studio portrait style, sharp focus, professional headshot composition.`;
}

/**
 * Extract relevant bio descriptor for image prompt
 */
function extractBioDescriptor(bio: string | null, specialties: string[]): string {
  if (!bio && specialties.length === 0) {
    return 'professional chef and culinary expert';
  }

  // Common patterns to extract from bio
  const patterns = [
    /(?:author of|creator of|founder of|chef\/owner of)\s+[^.]+/i,
    /(?:specialist|expert|pioneer)\s+(?:in|of)\s+[^.]+/i,
    /(?:known for|focuses on|specializes in)\s+[^.]+/i,
  ];

  if (bio) {
    for (const pattern of patterns) {
      const match = bio.match(pattern);
      if (match) {
        // Clean up the match and limit length
        let descriptor = match[0].replace(/\s+/g, ' ').trim();
        if (descriptor.length > 100) {
          descriptor = descriptor.substring(0, 97) + '...';
        }
        return descriptor;
      }
    }

    // Fallback: use first sentence of bio (simplified)
    const firstSentence = bio.split(/[.!?]/)[0];
    if (firstSentence && firstSentence.length > 10 && firstSentence.length < 150) {
      return firstSentence.trim();
    }
  }

  // Fallback: use specialties
  if (specialties.length > 0) {
    const primarySpecialties = specialties.slice(0, 3).join(', ');
    return `${primarySpecialties} specialist`;
  }

  return 'professional chef and culinary expert';
}

/**
 * Generate image using OpenAI DALL-E 3
 */
async function generateChefImage(chef: ChefWithMissingImage): Promise<Buffer> {
  const prompt = getChefPortraitPrompt(chef);

  console.log(`  🎨 Generating portrait with DALL-E 3`);
  console.log(`     Prompt: "${prompt.substring(0, 100)}..."`);

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024', // Square format for avatars
      quality: 'standard', // Standard quality is sufficient for portraits
      style: 'natural', // Natural/photorealistic style
      response_format: 'url',
    });

    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      throw new Error('No image URL returned from DALL-E');
    }

    console.log(`  📥 Downloading image from DALL-E...`);

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
 * Save image to local filesystem
 */
async function saveChefImage(imageBuffer: Buffer, slug: string): Promise<string> {
  const publicDir = join(process.cwd(), 'public', 'images', 'chefs');
  await mkdir(publicDir, { recursive: true });

  const filename = `${slug}.png`;
  const filepath = join(publicDir, filename);
  const publicPath = `/images/chefs/${filename}`;

  await writeFile(filepath, imageBuffer);

  console.log(`  💾 Saved to: ${publicPath}`);
  console.log(`     File size: ${(imageBuffer.length / 1024).toFixed(1)} KB`);

  return publicPath;
}

/**
 * Update chef's profile_image_url in database
 */
async function updateChefImageUrl(chefId: string, imageUrl: string): Promise<void> {
  await db
    .update(chefs)
    .set({
      profile_image_url: imageUrl,
      updated_at: new Date(),
    })
    .where(eq(chefs.id, chefId));

  console.log(`  ✅ Database updated with image URL`);
}

/**
 * Save progress to filesystem
 */
async function saveProgress(progress: GenerationProgress): Promise<void> {
  const progressDir = join(process.cwd(), 'tmp');
  await mkdir(progressDir, { recursive: true });

  const filename = 'chef-images-progress.json';
  const filepath = join(progressDir, filename);

  await writeFile(filepath, JSON.stringify(progress, null, 2));
  console.log(`\n💾 Progress saved: ${filename}`);
}

/**
 * Process a single chef
 */
async function processChef(
  chef: ChefWithMissingImage,
  progress: GenerationProgress,
  dryRun: boolean
): Promise<void> {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`👨‍🍳 CHEF: ${chef.name}`);
  console.log(`   Slug: ${chef.slug}`);
  console.log(`   Display Name: ${chef.displayName || 'N/A'}`);
  console.log(`   Specialties: ${chef.specialties.join(', ') || 'None'}`);
  console.log(`   Current Image: ${chef.profileImageUrl || 'MISSING'}`);

  // Skip if chef already has image (safety check)
  if (chef.profileImageUrl && chef.profileImageUrl.trim() !== '') {
    console.log(`  ⏭️  SKIPPED - Chef already has profile image`);
    progress.skipped++;
    progress.processed++;
    return;
  }

  try {
    if (dryRun) {
      console.log('  🔍 DRY RUN - Would generate portrait image');
      const prompt = getChefPortraitPrompt(chef);
      console.log(`     Generated prompt: "${prompt}"`);
      progress.processed++;
      progress.successful++;
      return;
    }

    // Generate image with DALL-E
    const imageBuffer = await generateChefImage(chef);
    console.log(`  ✅ Image generated successfully`);

    // Save to local filesystem
    const publicPath = await saveChefImage(imageBuffer, chef.slug);

    // Update database
    await updateChefImageUrl(chef.id, publicPath);

    // Update progress
    progress.processed++;
    progress.successful++;
    progress.processedSlugs.push(chef.slug);
    progress.updatedAt = new Date().toISOString();

    // Save progress after each successful generation
    await saveProgress(progress);

    // Rate limiting - wait 3 seconds between requests to avoid API limits
    console.log('  ⏳ Waiting 3 seconds before next request...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
  } catch (error: any) {
    console.error(`  ❌ Failed to process ${chef.name}:`, error.message);
    progress.processed++;
    progress.failed++;
    progress.failures.push({
      slug: chef.slug,
      name: chef.name,
      error: error.message,
    });
    progress.updatedAt = new Date().toISOString();
    await saveProgress(progress);
  }
}

/**
 * Fetch all chefs without profile images
 */
async function getChefsWithMissingImages(): Promise<ChefWithMissingImage[]> {
  const results = await db
    .select({
      id: chefs.id,
      slug: chefs.slug,
      name: chefs.name,
      displayName: chefs.display_name,
      bio: chefs.bio,
      specialties: chefs.specialties,
      profileImageUrl: chefs.profile_image_url,
    })
    .from(chefs)
    .where(or(isNull(chefs.profile_image_url), eq(chefs.profile_image_url, '')));

  return results.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    displayName: r.displayName,
    bio: r.bio,
    specialties: r.specialties,
    profileImageUrl: r.profileImageUrl,
  }));
}

/**
 * Fetch all chefs (for summary)
 */
async function getAllChefs(): Promise<{ total: number; withImages: number }> {
  const allChefs = await db.select({ profileImageUrl: chefs.profile_image_url }).from(chefs);

  const withImages = allChefs.filter(
    (c) => c.profileImageUrl && c.profileImageUrl.trim() !== ''
  ).length;

  return {
    total: allChefs.length,
    withImages,
  };
}

/**
 * Main execution
 */
async function main() {
  const dryRun = process.env.APPLY_CHANGES !== 'true';

  console.log('\n' + '='.repeat(70));
  console.log('👨‍🍳 CHEF PROFILE IMAGE GENERATION (DALL-E 3)');
  console.log('='.repeat(70));

  // Check for API key
  if (!process.env.OPENAI_API_KEY && !dryRun) {
    console.error('\n❌ ERROR: OPENAI_API_KEY not found in environment variables');
    console.error('   Please set OPENAI_API_KEY in .env.local\n');
    process.exit(1);
  }

  // Get current stats
  console.log(`\n📊 Analyzing chefs database...`);
  const stats = await getAllChefs();
  const chefsNeedingImages = await getChefsWithMissingImages();

  console.log(`\n📈 Database Status:`);
  console.log(`   Total chefs: ${stats.total}`);
  console.log(`   Chefs with images: ${stats.withImages}`);
  console.log(`   Chefs needing images: ${chefsNeedingImages.length}`);

  if (chefsNeedingImages.length === 0) {
    console.log('\n✅ All chefs have profile images! Nothing to do.\n');
    process.exit(0);
  }

  console.log(`\n💰 Estimated Cost: $${(chefsNeedingImages.length * 0.04).toFixed(2)} - $${(chefsNeedingImages.length * 0.1).toFixed(2)}`);
  console.log(`⏱️  Estimated Time: ${Math.ceil((chefsNeedingImages.length * 6) / 60)} minutes\n`);

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No images will be generated or saved');
    console.log('   Set APPLY_CHANGES=true to execute\n');
  } else {
    console.log('🚀 LIVE MODE - Images will be generated and saved\n');
    console.log('⚠️  This will make API calls to OpenAI DALL-E 3');
    console.log('   Press Ctrl+C now to cancel...\n');
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  // Initialize progress tracking
  const progress: GenerationProgress = {
    total: chefsNeedingImages.length,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    processedSlugs: [],
    failures: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  console.log('='.repeat(70));
  console.log('🎨 STARTING CHEF IMAGE GENERATION');
  console.log('='.repeat(70));

  // Process each chef
  for (const chef of chefsNeedingImages) {
    await processChef(chef, progress, dryRun);
  }

  // Final summary
  console.log('\n' + '='.repeat(70));
  console.log('✨ GENERATION COMPLETE');
  console.log('='.repeat(70));
  console.log(`\n📊 Results:`);
  console.log(`   Total chefs checked: ${progress.total}`);
  console.log(`   ✅ Successfully generated: ${progress.successful}`);
  console.log(`   ⏭️  Skipped (already had images): ${progress.skipped}`);
  console.log(`   ❌ Failed: ${progress.failed}`);

  if (progress.failures.length > 0) {
    console.log(`\n❌ Failures:`);
    progress.failures.forEach((f) => {
      console.log(`   - ${f.name} (${f.slug}): ${f.error}`);
    });
  }

  if (progress.successful > 0) {
    console.log(`\n🎉 Successfully generated images for:`);
    progress.processedSlugs.forEach((slug) => {
      console.log(`   - /images/chefs/${slug}.png`);
    });
  }

  console.log('\n' + '='.repeat(70) + '\n');

  // Exit with error code if there were failures
  if (progress.failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
