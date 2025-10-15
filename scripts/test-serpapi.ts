/**
 * Test script for SerpAPI integration
 * Tests the search functionality independently
 */

import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(__dirname, '../.env.local') });

// Simple fetch-based test (no TypeScript path aliases)
async function testSerpAPI() {
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    console.error('❌ SERPAPI_KEY not found in environment');
    return;
  }

  console.log('✓ SERPAPI_KEY found');
  console.log('\n🔍 Testing SerpAPI search...');

  try {
    const query = 'pasta carbonara recipe';
    const url = new URL('https://serpapi.com/search');
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', query);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('num', '3');

    console.log(`   Query: "${query}"`);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`SerpAPI error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`SerpAPI error: ${data.error}`);
    }

    const results = data.organic_results || [];

    console.log(`\n✓ SerpAPI search successful!`);
    console.log(`   Found ${results.length} results\n`);

    results.slice(0, 3).forEach((result: any, i: number) => {
      console.log(`   ${i + 1}. ${result.title}`);
      console.log(`      ${result.link}`);
      console.log(`      ${result.snippet?.substring(0, 100)}...`);
      console.log();
    });

    console.log('✅ SerpAPI integration test PASSED\n');

  } catch (error: any) {
    console.error('\n❌ SerpAPI test FAILED:', error.message);
  }
}

testSerpAPI();
