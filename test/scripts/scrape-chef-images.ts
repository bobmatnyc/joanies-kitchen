#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local BEFORE any other imports
config({ path: resolve(process.cwd(), '.env.local') });

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Chef Image Scraping Script with SerpAPI Google Image Search
 *
 * Uses SerpAPI to find professional chef images and downloads them.
 * Implements smart search strategies, image quality filtering, and progress tracking.
 *
 * Usage:
 *   tsx scripts/scrape-chef-images.ts              # Dry run (preview only)
 *   APPLY_CHANGES=true tsx scripts/scrape-chef-images.ts  # Actually download and update
 *   tsx scripts/scrape-chef-images.ts --force      # Re-download existing images
 *
 * Environment Variables:
 *   SERPAPI_API_KEY - Required SerpAPI key
 *   APPLY_CHANGES   - Set to 'true' to actually download images
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface SerpAPIImageResult {
  position: number;
  thumbnail: string;
  source: string;
  title: string;
  link: string; // Direct image URL
  original: string; // Full-size image URL
  original_width?: number;
  original_height?: number;
  is_product?: boolean;
}

interface SerpAPIResponse {
  search_metadata?: {
    status: string;
    created_at: string;
    processed_at: string;
    total_time_taken: number;
  };
  search_parameters?: {
    engine: string;
    q: string;
    num: number;
  };
  images_results?: SerpAPIImageResult[];
  error?: string;
}

interface ProgressState {
  lastProcessedSlug?: string;
  processedSlugs: string[];
  failedSlugs: string[];
  skippedSlugs: string[];
  timestamp: string;
}

interface ScrapingResult {
  slug: string;
  name: string;
  displayName?: string;
  searchQuery?: string;
  selectedImage?: {
    url: string;
    width?: number;
    height?: number;
    source: string;
    position: number;
  };
  downloadedPath?: string;
  databaseUpdated: boolean;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  SERPAPI_API_KEY: process.env.SERPAPI_API_KEY,
  APPLY_CHANGES: process.env.APPLY_CHANGES === 'true',
  FORCE_REDOWNLOAD: process.argv.includes('--force'),
  PROGRESS_FILE: '/Users/masa/Projects/recipe-manager/tmp/chef-image-scraping-progress.json',
  IMAGE_DIR: '/Users/masa/Projects/recipe-manager/public/images/chefs',
  API_RATE_LIMIT_MS: 1000, // 1 second between API calls
  MIN_IMAGE_WIDTH: 500,
  MIN_IMAGE_SIZE_BYTES: 10 * 1024, // 10KB minimum
  MAX_IMAGES_PER_QUERY: 10,
  TIMEOUT_MS: 30000, // 30 seconds per download
};

// Stock photo domains to filter out
const BANNED_DOMAINS = [
  'shutterstock.com',
  'gettyimages.com',
  'istockphoto.com',
  'depositphotos.com',
  'dreamstime.com',
  'alamy.com',
  '123rf.com',
  'stocksy.com',
  'unsplash.com', // Generic stock photos
  'pexels.com',
  'pixabay.com',
];

// Prefer these professional sources
const PREFERRED_DOMAINS = [
  'nytimes.com',
  'theguardian.com',
  'washingtonpost.com',
  'bonappetit.com',
  'foodandwine.com',
  'seriouseats.com',
  'eater.com',
  'saveur.com',
  'epicurious.com',
  // Chef's own domains (will be added dynamically from chef.website)
];

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

async function loadProgress(): Promise<ProgressState> {
  try {
    if (existsSync(CONFIG.PROGRESS_FILE)) {
      const data = await readFile(CONFIG.PROGRESS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('⚠️  Could not load progress file, starting fresh');
  }

  return {
    processedSlugs: [],
    failedSlugs: [],
    skippedSlugs: [],
    timestamp: new Date().toISOString(),
  };
}

async function saveProgress(state: ProgressState): Promise<void> {
  try {
    await mkdir('/Users/masa/Projects/recipe-manager/tmp', { recursive: true });
    await writeFile(CONFIG.PROGRESS_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    console.error('❌ Failed to save progress:', error);
  }
}

// ============================================================================
// SERPAPI INTEGRATION
// ============================================================================

async function searchImages(query: string): Promise<SerpAPIImageResult[]> {
  if (!CONFIG.SERPAPI_API_KEY) {
    throw new Error('SERPAPI_API_KEY environment variable is required');
  }

  const params = new URLSearchParams({
    engine: 'google_images',
    q: query,
    api_key: CONFIG.SERPAPI_API_KEY,
    num: CONFIG.MAX_IMAGES_PER_QUERY.toString(),
    safe: 'active',
    image_type: 'photo',
  });

  const url = `https://serpapi.com/search.json?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Joanies-Kitchen-Chef-Image-Scraper/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`SerpAPI request failed: ${response.status} ${response.statusText}`);
    }

    const data: SerpAPIResponse = await response.json();

    if (data.error) {
      throw new Error(`SerpAPI error: ${data.error}`);
    }

    return data.images_results || [];
  } catch (error) {
    console.error(`❌ SerpAPI request failed for query "${query}":`, error);
    throw error;
  }
}

// ============================================================================
// IMAGE SELECTION & FILTERING
// ============================================================================

function isDomainBanned(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return BANNED_DOMAINS.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}

function isDomainPreferred(url: string, chefWebsite?: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    // Check if it's from the chef's own website
    if (chefWebsite) {
      const chefHostname = new URL(chefWebsite).hostname.toLowerCase();
      if (hostname.includes(chefHostname)) {
        return true;
      }
    }

    return PREFERRED_DOMAINS.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}

function scoreImage(
  image: SerpAPIImageResult,
  chefWebsite?: string
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Size scoring (prefer larger images)
  if (image.original_width && image.original_width >= 1000) {
    score += 3;
    reasons.push('high resolution (1000px+)');
  } else if (image.original_width && image.original_width >= CONFIG.MIN_IMAGE_WIDTH) {
    score += 1;
    reasons.push('good resolution (500px+)');
  }

  // Aspect ratio scoring (prefer square or portrait)
  if (image.original_width && image.original_height) {
    const aspectRatio = image.original_width / image.original_height;
    if (aspectRatio >= 0.8 && aspectRatio <= 1.2) {
      score += 3;
      reasons.push('square aspect ratio');
    } else if (aspectRatio >= 0.6 && aspectRatio <= 0.9) {
      score += 2;
      reasons.push('portrait aspect ratio');
    }
  }

  // Source domain scoring
  if (isDomainPreferred(image.original, chefWebsite)) {
    score += 5;
    reasons.push('from preferred/official source');
  }

  // Position scoring (earlier results are usually better)
  if (image.position === 1) {
    score += 2;
    reasons.push('top search result');
  } else if (image.position <= 3) {
    score += 1;
    reasons.push('top 3 result');
  }

  // Title scoring (check for professional keywords)
  const title = image.title.toLowerCase();
  if (title.includes('portrait') || title.includes('headshot') || title.includes('chef')) {
    score += 1;
    reasons.push('professional keywords in title');
  }

  return { score, reasons };
}

function selectBestImage(
  images: SerpAPIImageResult[],
  chefWebsite?: string
): SerpAPIImageResult | null {
  // Filter out banned domains and products
  const validImages = images.filter((img) => {
    if (img.is_product) return false;
    if (isDomainBanned(img.original)) return false;
    if (img.original_width && img.original_width < CONFIG.MIN_IMAGE_WIDTH) return false;
    return true;
  });

  if (validImages.length === 0) {
    return null;
  }

  // Score all images
  const scoredImages = validImages.map((img) => ({
    image: img,
    ...scoreImage(img, chefWebsite),
  }));

  // Sort by score (highest first)
  scoredImages.sort((a, b) => b.score - a.score);

  console.log(`   📊 Top 3 images by score:`);
  scoredImages.slice(0, 3).forEach((scored, idx) => {
    console.log(
      `      ${idx + 1}. Score: ${scored.score} (${scored.reasons.join(', ')})`
    );
  });

  return scoredImages[0].image;
}

// ============================================================================
// IMAGE DOWNLOAD
// ============================================================================

async function downloadImage(url: string, outputPath: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`   ❌ HTTP ${response.status}: ${response.statusText}`);
      return false;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      console.error(`   ❌ Invalid content type: ${contentType}`);
      return false;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < CONFIG.MIN_IMAGE_SIZE_BYTES) {
      console.error(
        `   ❌ Image too small: ${buffer.length} bytes (min: ${CONFIG.MIN_IMAGE_SIZE_BYTES})`
      );
      return false;
    }

    // Ensure directory exists
    await mkdir(CONFIG.IMAGE_DIR, { recursive: true });

    // Write file
    await writeFile(outputPath, buffer);

    console.log(`   ✅ Downloaded: ${buffer.length} bytes → ${outputPath}`);
    return true;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error(`   ❌ Download timeout (${CONFIG.TIMEOUT_MS}ms)`);
      } else {
        console.error(`   ❌ Download failed:`, error.message);
      }
    }
    return false;
  }
}

// ============================================================================
// SEARCH STRATEGIES
// ============================================================================

function generateSearchQueries(chef: {
  name: string;
  display_name?: string | null;
}): string[] {
  const searchName = chef.display_name || chef.name;

  return [
    `"${searchName}" chef portrait`,
    `"${searchName}" chef professional photo`,
    `"${searchName}" chef headshot`,
    `"${searchName}" chef photograph`,
    `${searchName} chef`, // Fallback without quotes
  ];
}

// ============================================================================
// MAIN PROCESSING LOGIC
// ============================================================================

async function processChef(
  chef: {
    id: string;
    slug: string;
    name: string;
    display_name?: string | null;
    website?: string | null;
    profile_image_url?: string | null;
  },
  progress: ProgressState
): Promise<ScrapingResult> {
  const result: ScrapingResult = {
    slug: chef.slug,
    name: chef.name,
    displayName: chef.display_name || undefined,
    databaseUpdated: false,
  };

  // Check if chef already has image and we're not forcing re-download
  if (chef.profile_image_url && !CONFIG.FORCE_REDOWNLOAD) {
    result.skipped = true;
    result.skipReason = 'already has profile image';
    return result;
  }

  // Check if already processed in this session
  if (progress.processedSlugs.includes(chef.slug)) {
    result.skipped = true;
    result.skipReason = 'already processed in this session';
    return result;
  }

  console.log(`\n🔍 Processing: ${chef.name} (${chef.slug})`);

  // Try different search queries
  const queries = generateSearchQueries(chef);
  let selectedImage: SerpAPIImageResult | null = null;
  let successfulQuery = '';

  for (const query of queries) {
    console.log(`   🔎 Searching: "${query}"`);

    try {
      const images = await searchImages(query);
      console.log(`   📷 Found ${images.length} images`);

      if (images.length === 0) {
        continue;
      }

      // Try to select best image
      const best = selectBestImage(images, chef.website || undefined);
      if (best) {
        selectedImage = best;
        successfulQuery = query;
        console.log(
          `   ✅ Selected image #${best.position} from ${new URL(best.original).hostname}`
        );
        break;
      } else {
        console.log(`   ⚠️  No suitable images found (all filtered out)`);
      }
    } catch (error) {
      console.error(`   ❌ Search failed:`, error);
      continue;
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, CONFIG.API_RATE_LIMIT_MS));
  }

  if (!selectedImage) {
    result.error = 'No suitable images found after trying all search queries';
    return result;
  }

  result.searchQuery = successfulQuery;
  result.selectedImage = {
    url: selectedImage.original,
    width: selectedImage.original_width,
    height: selectedImage.original_height,
    source: selectedImage.source,
    position: selectedImage.position,
  };

  // Download image (if APPLY_CHANGES is true)
  if (CONFIG.APPLY_CHANGES) {
    const filename = `${chef.slug}.jpg`;
    const outputPath = join(CONFIG.IMAGE_DIR, filename);

    console.log(`   ⬇️  Downloading image...`);

    const downloadSuccess = await downloadImage(selectedImage.original, outputPath);

    if (!downloadSuccess) {
      result.error = 'Failed to download image';
      return result;
    }

    result.downloadedPath = outputPath;

    // Update database
    try {
      const imageUrl = `/images/chefs/${filename}`;
      await db.update(chefs).set({ profile_image_url: imageUrl }).where(eq(chefs.id, chef.id));

      result.databaseUpdated = true;
      console.log(`   ✅ Database updated: profile_image_url = "${imageUrl}"`);
    } catch (error) {
      result.error = `Database update failed: ${error}`;
      console.error(`   ❌ Database update failed:`, error);
    }
  } else {
    console.log(`   ℹ️  DRY RUN: Would download from ${selectedImage.original}`);
    console.log(`   ℹ️  DRY RUN: Would save to /images/chefs/${chef.slug}.jpg`);
  }

  return result;
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

function printReport(results: ScrapingResult[]) {
  const totalChefs = results.length;
  const skipped = results.filter((r) => r.skipped).length;
  const processed = results.filter((r) => !r.skipped).length;
  const successful = results.filter((r) => r.databaseUpdated).length;
  const failed = results.filter((r) => !r.skipped && !r.databaseUpdated).length;
  const foundImages = results.filter((r) => r.selectedImage).length;

  console.log('\n');
  console.log('🖼️  Chef Image Scraping Report');
  console.log('━'.repeat(60));
  console.log('');
  console.log(`Chefs to Process: ${totalChefs}`);
  console.log(
    `Chefs with Existing Images: ${skipped} (${skipped > 0 ? 'skipped' : 'none'})`
  );
  console.log(`Chefs Needing Images: ${processed}`);
  console.log('');

  if (results.some((r) => r.selectedImage)) {
    console.log('Search Results:');
    results.forEach((r) => {
      if (r.skipped) {
        console.log(`  ⏭️  ${r.name}: ${r.skipReason}`);
      } else if (r.selectedImage) {
        console.log(`  ✅ ${r.name}: Found ${r.selectedImage.position} images, selected #1`);
        console.log(`     URL: ${r.selectedImage.url}`);
        if (r.selectedImage.width && r.selectedImage.height) {
          console.log(`     Size: ${r.selectedImage.width}x${r.selectedImage.height}px`);
        }
      } else if (r.error) {
        console.log(`  ❌ ${r.name}: ${r.error}`);
      }
    });
    console.log('');
  }

  if (CONFIG.APPLY_CHANGES) {
    console.log('Downloads:');
    console.log(`  ✅ ${successful} images downloaded successfully`);
    if (failed > 0) {
      console.log(`  ❌ ${failed} failed downloads`);
    }
    console.log('');

    console.log('Database Updates:');
    console.log(`  ✅ ${successful} chefs updated with image URLs`);
    console.log('');
  } else {
    console.log('⚠️  DRY RUN MODE - No images downloaded or database updated');
    console.log('   Set APPLY_CHANGES=true to actually download images');
    console.log('');
  }

  console.log('Summary:');
  console.log(`  Success: ${successful}/${processed} (${Math.round((successful / processed) * 100)}%)`);
  console.log(`  Failed: ${failed}/${processed}`);
  console.log(`  Images Found: ${foundImages}/${processed}`);
  console.log('');
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function main() {
  console.log('🖼️  Chef Image Scraping with SerpAPI');
  console.log('━'.repeat(60));
  console.log('');

  // Validate environment
  if (!CONFIG.SERPAPI_API_KEY) {
    console.error('❌ SERPAPI_API_KEY environment variable is required');
    console.error('');
    console.error('Get your API key from: https://serpapi.com/');
    console.error('Then set it: export SERPAPI_API_KEY="your-key-here"');
    process.exit(1);
  }

  if (!CONFIG.APPLY_CHANGES) {
    console.log('ℹ️  Running in DRY RUN mode (preview only)');
    console.log('   Set APPLY_CHANGES=true to actually download images');
    console.log('');
  }

  if (CONFIG.FORCE_REDOWNLOAD) {
    console.log('ℹ️  FORCE mode enabled - will re-download existing images');
    console.log('');
  }

  // Load progress
  const progress = await loadProgress();

  // Fetch sustainable chefs from database
  const sustainableChefs = await db
    .select()
    .from(chefs)
    .where(eq(chefs.is_verified, true))
    .orderBy(chefs.name);

  console.log(`📋 Found ${sustainableChefs.length} verified chefs`);
  console.log('');

  // Process each chef
  const results: ScrapingResult[] = [];

  for (const chef of sustainableChefs) {
    const result = await processChef(chef, progress);
    results.push(result);

    // Update progress
    if (result.skipped) {
      if (!progress.skippedSlugs.includes(chef.slug)) {
        progress.skippedSlugs.push(chef.slug);
      }
    } else if (result.databaseUpdated) {
      if (!progress.processedSlugs.includes(chef.slug)) {
        progress.processedSlugs.push(chef.slug);
      }
    } else if (result.error) {
      if (!progress.failedSlugs.includes(chef.slug)) {
        progress.failedSlugs.push(chef.slug);
      }
    }

    progress.lastProcessedSlug = chef.slug;
    progress.timestamp = new Date().toISOString();
    await saveProgress(progress);

    // Rate limiting between chefs
    if (sustainableChefs.indexOf(chef) < sustainableChefs.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, CONFIG.API_RATE_LIMIT_MS));
    }
  }

  // Print final report
  printReport(results);

  console.log('✅ Chef image scraping complete!');
  console.log('');

  process.exit(0);
}

// ============================================================================
// EXECUTION
// ============================================================================

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
