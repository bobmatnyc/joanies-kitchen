#!/usr/bin/env tsx
/**
 * Test Ollama Recipe Extraction
 *
 * Quick test to verify Ollama integration works before processing all URLs
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

import Firecrawl from '@mendable/firecrawl-js';
import { extractRecipeWithAI } from './lib/recipe-parser-script';

// Test URL
const TEST_URL = 'https://www.theguardian.com/lifeandstyle/2011/sep/16/rene-redzepi-masterclass-recipes';

async function testOllamaExtraction() {
  console.log('='.repeat(80));
  console.log('Testing Ollama Recipe Extraction');
  console.log('='.repeat(80));
  console.log(`\nTest URL: ${TEST_URL}\n`);

  const startTime = Date.now();

  try {
    // Initialize Firecrawl
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlKey) {
      throw new Error('FIRECRAWL_API_KEY is not set');
    }

    const firecrawl = new Firecrawl({ apiKey: firecrawlKey });

    console.log('1. Scraping page with Firecrawl...');
    const scrapeStart = Date.now();
    const scrapeResult = await firecrawl.scrape(TEST_URL, {
      formats: ['markdown', 'html'],
      onlyMainContent: true,
      timeout: 30000,
    }) as any;
    const scrapeTime = Date.now() - scrapeStart;
    console.log(`   ✓ Scraped in ${scrapeTime}ms`);

    if (!scrapeResult || !scrapeResult.markdown) {
      throw new Error('Failed to scrape URL');
    }

    console.log(`   - Markdown length: ${scrapeResult.markdown.length} chars`);
    console.log(`   - Metadata: ${JSON.stringify(scrapeResult.metadata || {}, null, 2)}`);

    // Extract recipe with Ollama
    console.log('\n2. Extracting recipe with Ollama...');
    const extractStart = Date.now();
    const recipe = await extractRecipeWithAI(
      scrapeResult.markdown,
      TEST_URL,
      scrapeResult.metadata
    );
    const extractTime = Date.now() - extractStart;

    if (!recipe) {
      throw new Error('Recipe extraction returned null');
    }

    console.log(`   ✓ Extracted in ${extractTime}ms`);
    console.log('\n3. Extraction Results:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(recipe, null, 2));
    console.log('='.repeat(80));

    const totalTime = Date.now() - startTime;
    console.log(`\n✓ Total time: ${totalTime}ms`);
    console.log(`  - Scraping: ${scrapeTime}ms (${Math.round((scrapeTime / totalTime) * 100)}%)`);
    console.log(`  - Extraction: ${extractTime}ms (${Math.round((extractTime / totalTime) * 100)}%)`);
    console.log(`\n✓ SUCCESS: Ollama extraction working correctly!`);

  } catch (error) {
    console.error(`\n✗ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run test
testOllamaExtraction();
