#!/usr/bin/env tsx

/**
 * Test Firecrawl API to understand response structure
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

import FirecrawlApp from '@mendable/firecrawl-js';

async function testFirecrawl() {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    console.error('❌ FIRECRAWL_API_KEY not found');
    process.exit(1);
  }

  console.log('✓ API key found');
  console.log('Testing Firecrawl API...\n');

  const firecrawl = new FirecrawlApp({ apiKey });

  // Test with a simple recipe URL
  const testUrl = 'https://www.allrecipes.com/recipe/23600/worlds-best-lasagna/';

  try {
    console.log(`Scraping: ${testUrl}`);
    const result = await firecrawl.scrape(testUrl, {
      formats: ['markdown', 'html'],
    });

    console.log('\n=== RESULT STRUCTURE ===');
    console.log('Type:', typeof result);
    console.log('Keys:', Object.keys(result));
    console.log('\nFull result:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('Error type:', typeof error);
    console.error('Error keys:', Object.keys(error));
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testFirecrawl()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
