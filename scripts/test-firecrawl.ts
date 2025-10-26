#!/usr/bin/env tsx
import { scrapeRecipePage } from '../src/lib/firecrawl.js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testFirecrawl() {
  const testUrl = 'https://altonbrown.com/recipes/meatloaf-reloaded/';

  console.log(`\n🧪 Testing Firecrawl with: ${testUrl}\n`);

  try {
    const startTime = Date.now();
    const result = await scrapeRecipePage(testUrl);
    const endTime = Date.now();

    console.log(`✅ Success! (took ${endTime - startTime}ms)`);
    console.log(`📝 Markdown length: ${result.markdown?.length || 0} chars`);
    console.log(`📄 HTML length: ${result.html?.length || 0} chars`);
    console.log(`📊 Metadata:`, result.metadata);

    if (result.markdown) {
      console.log(`\n📖 First 500 chars of markdown:`);
      console.log(result.markdown.substring(0, 500));
    }
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    console.error(`Stack:`, error.stack);
  }
}

testFirecrawl().catch(console.error);
