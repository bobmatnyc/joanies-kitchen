#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local BEFORE any other imports
config({ path: resolve(process.cwd(), '.env.local') });

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Manual Chef Image Search - Targeted script for Shannon Martinez and Vivian Li
 *
 * Enhanced search strategy with:
 * - Multiple alternative search queries (without "portrait")
 * - Expanded domain filters (news outlets, professional sites)
 * - Relaxed scoring system (non-square OK, lower thresholds)
 * - Manual fallback URLs for specific chefs
 *
 * Usage:
 *   tsx scripts/manual-chef-image-search.ts              # Dry run (preview only)
 *   APPLY_CHANGES=true tsx scripts/manual-chef-image-search.ts  # Actually download and update
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

interface SearchResult {
  slug: string;
  name: string;
  searchQuery?: string;
  selectedImage?: {
    url: string;
    width?: number;
    height?: number;
    source: string;
    position: number;
    score: number;
    reasons: string[];
  };
  downloadedPath?: string;
  databaseUpdated: boolean;
  error?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  SERPAPI_API_KEY: process.env.SERPAPI_API_KEY,
  APPLY_CHANGES: process.env.APPLY_CHANGES === 'true',
  IMAGE_DIR: '/Users/masa/Projects/recipe-manager/public/images/chefs',
  API_RATE_LIMIT_MS: 1500, // 1.5 seconds between API calls
  MIN_IMAGE_WIDTH: 400, // RELAXED from 500px
  MIN_IMAGE_SIZE_BYTES: 5 * 1024, // RELAXED to 5KB minimum
  MAX_IMAGES_PER_QUERY: 200, // INCREASED from 10
  TIMEOUT_MS: 30000,
};

// Target chefs (Katrina Blair)
const TARGET_CHEFS = ['katrina-blair'];

// Stock photo domains to filter out (kept conservative)
const BANNED_DOMAINS = [
  'shutterstock.com',
  'gettyimages.com',
  'istockphoto.com',
  'depositphotos.com',
  'dreamstime.com',
  'alamy.com',
  '123rf.com',
  'stocksy.com',
];

// EXPANDED: More professional sources including news outlets
const PREFERRED_DOMAINS = [
  // Food media (original)
  'nytimes.com',
  'theguardian.com',
  'washingtonpost.com',
  'bonappetit.com',
  'foodandwine.com',
  'seriouseats.com',
  'eater.com',
  'saveur.com',
  'epicurious.com',
  // News outlets
  'bbc.com',
  'cnn.com',
  'forbes.com',
  'businessinsider.com',
  'huffpost.com',
  'theverge.com',
  'wired.com',
  // Professional photography
  'photography.com',
  'portrait.com',
  // Chef-specific domains
  'smithanddaughters.com',
  'smithanddaughter.com',
  'smith-and-daughters.com',
  'vegan.com',
  'veganfoodandliving.com',
  // Australia-specific (for Shannon Martinez)
  'theage.com.au',
  'smh.com.au',
  'abc.net.au',
  'sbs.com.au',
  'broadsheet.com.au',
  'timeout.com',
  'goodfood.com.au',
  'delicious.com.au',
];

// ============================================================================
// ENHANCED SEARCH STRATEGIES
// ============================================================================

function generateSearchQueries(chef: {
  name: string;
  slug: string;
}): string[] {
  const name = chef.name;

  // Chef-specific manual fallback queries
  const manualQueries: Record<string, string[]> = {
    'katrina-blair': [
      // Wild foods educator and author
      '"Katrina Blair" wild foods',
      '"Katrina Blair" author',
      '"Katrina Blair" foraging educator',
      '"Katrina Blair" herbalist',
      '"Katrina Blair" wild edibles',
      'Katrina Blair wild foods educator',
      'Katrina Blair foraging',
      'Katrina Blair author portrait',
    ],
    'shannon-martinez': [
      // Direct restaurant associations
      '"Shannon Martinez" Smith and Daughters',
      '"Shannon Martinez" vegan chef Melbourne',
      '"Shannon Martinez" restaurant owner',
      '"Shannon Martinez" cookbook author',
      'Shannon Martinez chef professional',
      'Shannon Martinez food writer',
      // Without quotes for broader results
      'Shannon Martinez Smith Daughters Melbourne',
      'Shannon Martinez vegan restaurant',
      'Shannon Martinez Australian chef',
    ],
    'vivian-li': [
      // Professional contexts
      '"Vivian Li" chef portrait',
      '"Vivian Li" chef professional photo',
      '"Vivian Li" restaurant chef',
      '"Vivian Li" cookbook author',
      'Vivian Li chef photograph',
      'Vivian Li food professional',
      // Without quotes
      'Vivian Li chef restaurant',
      'Vivian Li culinary professional',
    ],
  };

  if (manualQueries[chef.slug]) {
    return manualQueries[chef.slug];
  }

  // Generic fallback (shouldn't be reached for target chefs)
  return [
    `"${name}" chef`,
    `"${name}" restaurant owner`,
    `"${name}" cookbook author`,
    `"${name}" food writer`,
    `"${name}" professional photo`,
    `${name} chef restaurant`,
    `${name} culinary professional`,
  ];
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
    // RELAXED: Remove strict content-type restrictions
    // Accept more diverse image sources
  });

  const url = `https://serpapi.com/search.json?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Joanies-Kitchen-Chef-Image-Scraper/2.0',
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
// RELAXED IMAGE SCORING
// ============================================================================

function isDomainBanned(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return BANNED_DOMAINS.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}

function isDomainPreferred(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return PREFERRED_DOMAINS.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}

function scoreImage(image: SerpAPIImageResult): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // RELAXED: Accept smaller images, but still prefer larger ones
  if (image.original_width && image.original_width >= 1000) {
    score += 5;
    reasons.push('high resolution (1000px+)');
  } else if (image.original_width && image.original_width >= 700) {
    score += 3;
    reasons.push('good resolution (700px+)');
  } else if (image.original_width && image.original_width >= CONFIG.MIN_IMAGE_WIDTH) {
    score += 1;
    reasons.push('acceptable resolution (400px+)');
  }

  // RELAXED: Accept non-square aspect ratios
  if (image.original_width && image.original_height) {
    const aspectRatio = image.original_width / image.original_height;
    if (aspectRatio >= 0.8 && aspectRatio <= 1.2) {
      score += 3;
      reasons.push('square aspect ratio');
    } else if (aspectRatio >= 0.5 && aspectRatio <= 1.5) {
      score += 2;
      reasons.push('portrait/landscape aspect ratio (acceptable)');
    } else {
      score += 1;
      reasons.push('wide/tall aspect ratio (usable)');
    }
  }

  // Source domain scoring (still important)
  if (isDomainPreferred(image.original)) {
    score += 5;
    reasons.push('from preferred/professional source');
  }

  // RELAXED: Less emphasis on position
  if (image.position === 1) {
    score += 1;
    reasons.push('top search result');
  } else if (image.position <= 5) {
    score += 0.5;
    reasons.push('top 5 result');
  }

  // Title scoring (professional keywords)
  const title = image.title.toLowerCase();
  if (title.includes('portrait') || title.includes('headshot')) {
    score += 2;
    reasons.push('portrait/headshot in title');
  }
  if (title.includes('chef') || title.includes('cook')) {
    score += 1;
    reasons.push('chef/cook in title');
  }
  if (title.includes('professional') || title.includes('profile')) {
    score += 1;
    reasons.push('professional/profile in title');
  }

  return { score, reasons };
}

function selectBestImages(
  images: SerpAPIImageResult[],
  topN: number = 5
): Array<SerpAPIImageResult & { score: number; reasons: string[] }> {
  // Filter out banned domains and products
  const validImages = images.filter((img) => {
    if (img.is_product) return false;
    if (isDomainBanned(img.original)) return false;
    if (img.original_width && img.original_width < CONFIG.MIN_IMAGE_WIDTH) return false;
    return true;
  });

  if (validImages.length === 0) {
    return [];
  }

  // Score all images
  const scoredImages = validImages.map((img) => ({
    ...img,
    ...scoreImage(img),
  }));

  // Sort by score (highest first)
  scoredImages.sort((a, b) => b.score - a.score);

  return scoredImages.slice(0, topN);
}

// ============================================================================
// IMAGE DOWNLOAD
// ============================================================================

async function testImageUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second test

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    clearTimeout(timeoutId);

    return response.ok && response.headers.get('content-type')?.startsWith('image/');
  } catch {
    return false;
  }
}

async function downloadImage(url: string, outputPath: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'image/webp,image/apng,image/jpeg,image/png,image/*,*/*;q=0.8',
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
// MAIN PROCESSING LOGIC
// ============================================================================

async function processChef(chef: {
  id: string;
  slug: string;
  name: string;
  profile_image_url?: string | null;
}): Promise<SearchResult> {
  const result: SearchResult = {
    slug: chef.slug,
    name: chef.name,
    databaseUpdated: false,
  };

  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔍 Processing: ${chef.name} (${chef.slug})`);
  console.log(`${'='.repeat(70)}\n`);

  // Try different search queries
  const queries = generateSearchQueries(chef);
  const allCandidates: Array<{
    query: string;
    image: SerpAPIImageResult & { score: number; reasons: string[] };
  }> = [];

  for (const query of queries) {
    console.log(`🔎 Searching: "${query}"`);

    try {
      const images = await searchImages(query);
      console.log(`   📷 Found ${images.length} images`);

      if (images.length === 0) {
        console.log(`   ⚠️  No images found\n`);
        continue;
      }

      // Get top 5 candidates from this query
      const topImages = selectBestImages(images, 5);

      if (topImages.length === 0) {
        console.log(`   ⚠️  All images filtered out (banned domains or too small)\n`);
        continue;
      }

      console.log(`   📊 Top ${topImages.length} candidates:`);
      topImages.forEach((img, idx) => {
        const hostname = new URL(img.original).hostname;
        console.log(
          `      ${idx + 1}. Score: ${img.score.toFixed(1)} - ${hostname} (${img.original_width}x${img.original_height}px)`
        );
        console.log(`         Reasons: ${img.reasons.join(', ')}`);
        console.log(`         URL: ${img.original.substring(0, 80)}...`);
      });
      console.log();

      // Add to candidates
      topImages.forEach((img) => {
        allCandidates.push({ query, image: img });
      });

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, CONFIG.API_RATE_LIMIT_MS));
    } catch (error) {
      console.error(`   ❌ Search failed:`, error);
      console.log();
      continue;
    }
  }

  if (allCandidates.length === 0) {
    result.error = 'No suitable images found after trying all search queries';
    return result;
  }

  // Sort all candidates by score
  allCandidates.sort((a, b) => b.image.score - a.image.score);

  console.log(`\n📊 OVERALL TOP 10 CANDIDATES (across all queries):`);
  console.log(`${'─'.repeat(70)}`);
  allCandidates.slice(0, 10).forEach((candidate, idx) => {
    const hostname = new URL(candidate.image.original).hostname;
    console.log(
      `${idx + 1}. Score: ${candidate.image.score.toFixed(1)} - ${hostname}`
    );
    console.log(`   Query: "${candidate.query}"`);
    console.log(`   Size: ${candidate.image.original_width}x${candidate.image.original_height}px`);
    console.log(`   Reasons: ${candidate.image.reasons.join(', ')}`);
    console.log(`   URL: ${candidate.image.original}`);
    console.log();
  });

  // Select best candidate and test URL
  let selectedCandidate = null;
  for (const candidate of allCandidates.slice(0, 10)) {
    console.log(`🔗 Testing URL: ${candidate.image.original.substring(0, 80)}...`);
    const isValid = await testImageUrl(candidate.image.original);

    if (isValid) {
      selectedCandidate = candidate;
      console.log(`   ✅ URL is valid and accessible\n`);
      break;
    } else {
      console.log(`   ❌ URL failed validation (not accessible)\n`);
    }
  }

  if (!selectedCandidate) {
    result.error = 'Found candidates but none had valid URLs';
    return result;
  }

  const selectedImage = selectedCandidate.image;
  result.searchQuery = selectedCandidate.query;
  result.selectedImage = {
    url: selectedImage.original,
    width: selectedImage.original_width,
    height: selectedImage.original_height,
    source: selectedImage.source,
    position: selectedImage.position,
    score: selectedImage.score,
    reasons: selectedImage.reasons,
  };

  console.log(`🎯 SELECTED IMAGE:`);
  console.log(`   Query: "${result.searchQuery}"`);
  console.log(`   URL: ${selectedImage.original}`);
  console.log(`   Score: ${selectedImage.score.toFixed(1)}`);
  console.log(`   Size: ${selectedImage.original_width}x${selectedImage.original_height}px`);
  console.log(`   Reasons: ${selectedImage.reasons.join(', ')}\n`);

  // Download image (if APPLY_CHANGES is true)
  if (CONFIG.APPLY_CHANGES) {
    const filename = `${chef.slug}.jpg`;
    const outputPath = join(CONFIG.IMAGE_DIR, filename);

    console.log(`⬇️  Downloading image...`);

    const downloadSuccess = await downloadImage(selectedImage.original, outputPath);

    if (!downloadSuccess) {
      result.error = 'Failed to download image';
      return result;
    }

    result.downloadedPath = outputPath;

    // Update database
    try {
      const imageUrl = `/images/chefs/${filename}`;
      await db
        .update(chefs)
        .set({ profile_image_url: imageUrl })
        .where(eq(chefs.id, chef.id));

      result.databaseUpdated = true;
      console.log(`✅ Database updated: profile_image_url = "${imageUrl}"\n`);
    } catch (error) {
      result.error = `Database update failed: ${error}`;
      console.error(`❌ Database update failed:`, error);
    }
  } else {
    console.log(`ℹ️  DRY RUN: Would download from ${selectedImage.original}`);
    console.log(`ℹ️  DRY RUN: Would save to /images/chefs/${chef.slug}.jpg\n`);
  }

  return result;
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

function printReport(results: SearchResult[]) {
  console.log('\n');
  console.log('🖼️  Manual Chef Image Search Report');
  console.log('━'.repeat(70));
  console.log('');

  results.forEach((r) => {
    console.log(`\n${r.name} (${r.slug}):`);
    if (r.selectedImage) {
      console.log(`  ✅ Found image (Score: ${r.selectedImage.score.toFixed(1)})`);
      console.log(`     Query: "${r.searchQuery}"`);
      console.log(`     URL: ${r.selectedImage.url}`);
      console.log(`     Size: ${r.selectedImage.width}x${r.selectedImage.height}px`);
      console.log(`     Reasons: ${r.selectedImage.reasons.join(', ')}`);

      if (r.databaseUpdated) {
        console.log(`  ✅ Downloaded and database updated`);
        console.log(`     Path: ${r.downloadedPath}`);
      } else if (CONFIG.APPLY_CHANGES) {
        console.log(`  ❌ Download or database update failed`);
      } else {
        console.log(`  ℹ️  DRY RUN - Not downloaded`);
      }
    } else if (r.error) {
      console.log(`  ❌ ${r.error}`);
    }
  });

  console.log('\n');
  const successful = results.filter((r) => r.databaseUpdated).length;
  const foundImages = results.filter((r) => r.selectedImage).length;

  console.log('Summary:');
  console.log(`  Images Found: ${foundImages}/${results.length}`);
  if (CONFIG.APPLY_CHANGES) {
    console.log(`  Successfully Downloaded: ${successful}/${foundImages}`);
  } else {
    console.log(`  ⚠️  DRY RUN MODE - Set APPLY_CHANGES=true to download`);
  }
  console.log('');
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function main() {
  console.log('🖼️  Manual Chef Image Search - Enhanced Strategy');
  console.log('━'.repeat(70));
  console.log('');
  console.log('Target Chef: Katrina Blair');
  console.log('');

  // Validate environment
  if (!CONFIG.SERPAPI_API_KEY) {
    console.error('❌ SERPAPI_API_KEY environment variable is required');
    console.error('');
    console.error('Get your API key from: https://serpapi.com/');
    process.exit(1);
  }

  if (!CONFIG.APPLY_CHANGES) {
    console.log('ℹ️  Running in DRY RUN mode (preview only)');
    console.log('   Set APPLY_CHANGES=true to actually download images');
    console.log('');
  }

  console.log('Enhanced Search Strategy:');
  console.log('  ✓ Multiple alternative search queries (chef, restaurant owner, etc.)');
  console.log('  ✓ Expanded domain filters (news outlets, professional sites)');
  console.log('  ✓ Relaxed scoring (400px+, non-square OK)');
  console.log(`  ✓ Increased results limit (${CONFIG.MAX_IMAGES_PER_QUERY} per query)`);
  console.log('  ✓ URL validation before download');
  console.log('');

  // Fetch target chefs from database
  const targetChefs = await db
    .select()
    .from(chefs)
    .where(eq(chefs.is_verified, true));

  const chefsToProcess = targetChefs.filter((chef) => TARGET_CHEFS.includes(chef.slug));

  if (chefsToProcess.length === 0) {
    console.error('❌ No target chefs found in database');
    process.exit(1);
  }

  console.log(`📋 Found ${chefsToProcess.length} target chef(s):`);
  chefsToProcess.forEach((chef) => {
    console.log(`   - ${chef.name} (${chef.slug})`);
  });
  console.log('');

  // Process each chef
  const results: SearchResult[] = [];

  for (const chef of chefsToProcess) {
    const result = await processChef(chef);
    results.push(result);
  }

  // Print final report
  printReport(results);

  console.log('✅ Manual chef image search complete!');
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
