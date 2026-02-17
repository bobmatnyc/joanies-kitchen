#!/usr/bin/env tsx
/**
 * Test the Firecrawl fix
 * Verifies that scraping now works correctly
 */

import 'dotenv/config';
import { scrapeRecipePage } from '@/lib/firecrawl';

async function testFix() {
  console.log('='.repeat(80));
  console.log('FIRECRAWL FIX TEST');
  console.log('='.repeat(80));
  console.log('');

  const testUrls = [
    'https://altonbrown.com/recipes/meatloaf-reloaded/',
    'https://www.saveur.com/article/Recipes/Minestrone-1000090697/',
  ];

  for (const url of testUrls) {
    console.log(`Testing: ${url}`);
    console.log('-'.repeat(80));

    try {
      const result = await scrapeRecipePage(url);

      console.log('✅ SUCCESS!');
      console.log(`   - success field: ${result.success}`);
      console.log(`   - Has markdown: ${!!result.markdown}`);
      console.log(`   - Has html: ${!!result.html}`);
      console.log(`   - Markdown length: ${result.markdown?.length || 0}`);

      if (result.markdown) {
        console.log(`   - Preview: ${result.markdown.substring(0, 200).replace(/\n/g, ' ')}`);
      }
      console.log('');
    } catch (error: any) {
      console.error('❌ FAILED!');
      console.error(`   - Error: ${error.message}`);
      console.error('');
    }
  }

  console.log('='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));
}

testFix().catch(console.error);
