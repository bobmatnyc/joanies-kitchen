#!/usr/bin/env tsx

/**
 * Zero Waste Chef URL Scraper
 *
 * Scrapes recipe URLs from Anne-Marie Bonneau's Zero Waste Chef recipe index page
 * using Firecrawl API. Extracts, filters, and deduplicates all recipe URLs.
 *
 * Usage:
 *   pnpm tsx scripts/scrape-zero-waste-chef-urls.ts
 *
 * Output:
 *   tmp/zero-waste-chef-urls.txt - One URL per line, ready for batch processing
 *
 * Environment Variables:
 *   FIRECRAWL_API_KEY - Required for web scraping
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local BEFORE any other imports
config({ path: resolve(process.cwd(), '.env.local') });

import Firecrawl from '@mendable/firecrawl-js';
import { writeFile, mkdir } from 'node:fs/promises';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
  TARGET_URL: 'https://zerowastechef.com/recipe-index/',
  OUTPUT_FILE: resolve(process.cwd(), 'tmp/zero-waste-chef-urls.txt'),
  TMP_DIR: resolve(process.cwd(), 'tmp'),
  REQUEST_TIMEOUT_MS: 120000, // 2 minutes - recipe index pages can be large
};

// ============================================================================
// LOGGING
// ============================================================================

const logs: string[] = [];

function log(message: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}`;
  logs.push(logLine);
  console.log(message);
}

// ============================================================================
// URL EXTRACTION AND FILTERING
// ============================================================================

/**
 * Extract URLs from markdown content
 */
function extractUrlsFromMarkdown(markdown: string): string[] {
  const urls: string[] = [];

  // Match markdown links: [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = linkRegex.exec(markdown)) !== null) {
    let url = match[2];

    // Remove any title text after the URL (markdown format: [text](url "title"))
    // Split by space and take only the first part (the actual URL)
    url = url.split(' ')[0].replace(/['"]/g, '');

    urls.push(url);
  }

  return urls;
}

/**
 * Extract URLs from HTML content (fallback)
 */
function extractUrlsFromHtml(html: string): string[] {
  const urls: string[] = [];

  // Match href attributes: href="url" or href='url'
  const hrefRegex = /href=["']([^"']+)["']/g;
  let match;

  while ((match = hrefRegex.exec(html)) !== null) {
    const url = match[1];
    urls.push(url);
  }

  return urls;
}

/**
 * Filter URLs to only include zerowastechef.com recipe URLs
 */
function filterRecipeUrls(urls: string[]): string[] {
  const recipeUrls = urls.filter(url => {
    // Must be from zerowastechef.com domain
    if (!url.includes('zerowastechef.com')) {
      return false;
    }

    // Skip the recipe index page itself
    if (url.includes('/recipe-index')) {
      return false;
    }

    // Skip category/tag pages
    if (url.includes('/category/') || url.includes('/tag/')) {
      return false;
    }

    // Skip author/about pages
    if (url.includes('/about') || url.includes('/author/')) {
      return false;
    }

    // Skip admin/login pages
    if (url.includes('/wp-admin') || url.includes('/wp-login')) {
      return false;
    }

    // Skip comment links
    if (url.includes('#comment') || url.includes('#respond')) {
      return false;
    }

    // Skip feed/RSS URLs
    if (url.includes('/feed')) {
      return false;
    }

    // Accept URLs that look like blog posts (likely recipes)
    // Typical pattern: zerowastechef.com/YYYY/MM/recipe-slug/
    const blogPostPattern = /zerowastechef\.com\/\d{4}\/\d{2}\//;
    if (blogPostPattern.test(url)) {
      return true;
    }

    // Also accept any zerowastechef.com URL with a meaningful slug
    // (at least 3 characters after the domain)
    const meaningfulSlugPattern = /zerowastechef\.com\/[a-z0-9-]{3,}/;
    if (meaningfulSlugPattern.test(url)) {
      return true;
    }

    return false;
  });

  return recipeUrls;
}

/**
 * Clean and normalize URLs
 */
function cleanUrls(urls: string[]): string[] {
  return urls.map(url => {
    // Remove trailing slashes
    url = url.replace(/\/$/, '');

    // Remove query parameters and fragments
    url = url.split('?')[0].split('#')[0];

    // Ensure https://
    if (url.startsWith('http://')) {
      url = url.replace('http://', 'https://');
    }

    // Remove www. prefix for consistency
    url = url.replace('://www.', '://');

    return url;
  });
}

/**
 * Deduplicate URLs (case-insensitive)
 */
function deduplicateUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const url of urls) {
    const normalized = url.toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(url);
    }
  }

  return unique;
}

// ============================================================================
// FIRECRAWL SCRAPING
// ============================================================================

async function scrapeRecipeIndex(): Promise<string[]> {
  log(`\n📄 Scraping recipe index: ${CONFIG.TARGET_URL}`);

  try {
    const firecrawl = new Firecrawl({ apiKey: CONFIG.FIRECRAWL_API_KEY });

    // Use v2 API scrape endpoint with format options
    const result = await firecrawl.scrape(CONFIG.TARGET_URL, {
      formats: ['markdown', 'html'],
      onlyMainContent: true,
      timeout: CONFIG.REQUEST_TIMEOUT_MS,
    }) as any;

    // Check if scraping was successful
    if (!result) {
      throw new Error('No result returned from Firecrawl');
    }

    // Check for errors in metadata
    if (result.metadata?.statusCode >= 400) {
      throw new Error(result.metadata.error || `HTTP ${result.metadata.statusCode}`);
    }

    log(`   ✓ Page scraped successfully`);
    log(`   Markdown length: ${result.markdown?.length || 0} chars`);
    log(`   HTML length: ${result.html?.length || 0} chars`);

    // Extract URLs from markdown first (cleaner)
    let urls: string[] = [];

    if (result.markdown) {
      urls = extractUrlsFromMarkdown(result.markdown);
      log(`   Found ${urls.length} URLs in markdown`);
    }

    // Fallback to HTML if markdown didn't yield enough URLs
    if (urls.length < 10 && result.html) {
      log(`   Extracting URLs from HTML as fallback...`);
      urls = extractUrlsFromHtml(result.html);
      log(`   Found ${urls.length} URLs in HTML`);
    }

    // Filter to recipe URLs only
    const recipeUrls = filterRecipeUrls(urls);
    log(`   Filtered to ${recipeUrls.length} recipe URLs`);

    // Clean and normalize URLs
    const cleanedUrls = cleanUrls(recipeUrls);
    log(`   Cleaned URLs`);

    // Deduplicate
    const uniqueUrls = deduplicateUrls(cleanedUrls);
    log(`   Deduplicated to ${uniqueUrls.length} unique URLs`);

    return uniqueUrls;

  } catch (error: any) {
    log(`   ✗ Scraping failed: ${error.message}`);
    if (error.response?.data) {
      log(`   API Error: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

// ============================================================================
// FILE OUTPUT
// ============================================================================

async function saveUrlsToFile(urls: string[]): Promise<void> {
  try {
    // Ensure tmp directory exists
    await mkdir(CONFIG.TMP_DIR, { recursive: true });

    // Write URLs to file (one per line)
    const content = urls.join('\n') + '\n';
    await writeFile(CONFIG.OUTPUT_FILE, content, 'utf-8');

    log(`\n✓ URLs saved to: ${CONFIG.OUTPUT_FILE}`);
    log(`   Total URLs: ${urls.length}`);

  } catch (error: any) {
    log(`\n✗ Failed to save URLs: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('='.repeat(70));
  console.log('ZERO WASTE CHEF URL SCRAPER');
  console.log('='.repeat(70));
  console.log(`Target: ${CONFIG.TARGET_URL}`);
  console.log(`Output: ${CONFIG.OUTPUT_FILE}`);
  console.log('='.repeat(70));

  // Validate API key
  if (!CONFIG.FIRECRAWL_API_KEY) {
    console.error('\n❌ FIRECRAWL_API_KEY not found in environment');
    console.error('   Add it to .env.local and try again');
    process.exit(1);
  }

  console.log('✓ API key validated\n');

  try {
    // Scrape recipe index page
    const urls = await scrapeRecipeIndex();

    if (urls.length === 0) {
      throw new Error('No recipe URLs found on the page');
    }

    // Save to file
    await saveUrlsToFile(urls);

    // Show sample URLs
    log('\n' + '='.repeat(70));
    log('SAMPLE URLS (first 10):');
    log('='.repeat(70));
    const sampleUrls = urls.slice(0, 10);
    sampleUrls.forEach((url, index) => {
      log(`${index + 1}. ${url}`);
    });

    if (urls.length > 10) {
      log(`... and ${urls.length - 10} more`);
    }

    // Final summary
    log('\n' + '='.repeat(70));
    log('SUCCESS');
    log('='.repeat(70));
    log(`✓ Found ${urls.length} recipe URLs`);
    log(`✓ Saved to ${CONFIG.OUTPUT_FILE}`);
    log('='.repeat(70));

  } catch (error: any) {
    console.error('\n❌ FATAL ERROR:', error.message);
    process.exit(1);
  }
}

// Run main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  });
