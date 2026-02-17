/**
 * Test script for Tavily API integration
 * Tests the search functionality independently without importing server-only modules
 *
 * Usage:
 *   npx tsx test/scripts/test-tavily-discovery.ts
 *   npx tsx test/scripts/test-tavily-discovery.ts --query "pasta carbonara"
 */

import { resolve } from 'node:path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: resolve(__dirname, '../../.env.local') });

// Recipe sites for filtering
const RECIPE_SITES = [
  'allrecipes.com',
  'foodnetwork.com',
  'seriouseats.com',
  'bonappetit.com',
  'epicurious.com',
  'tasty.co',
  'simplyrecipes.com',
  'food.com',
  'delish.com',
  'myrecipes.com',
  'thekitchn.com',
  'cookieandkate.com',
  'minimalistbaker.com',
  'budgetbytes.com',
  'smittenkitchen.com',
];

// Excluded domains (social media, video platforms)
const EXCLUDED_DOMAINS = [
  'youtube.com',
  'facebook.com',
  'instagram.com',
  'pinterest.com',
  'twitter.com',
  'tiktok.com',
  'reddit.com',
];

// Parse command line arguments
const args = process.argv.slice(2);
const queryIndex = args.indexOf('--query');
const testQuery = queryIndex !== -1 && args[queryIndex + 1]
  ? args[queryIndex + 1]
  : 'pasta carbonara';

console.log('='.repeat(80));
console.log('Tavily Recipe URL Discovery - Test Script');
console.log('='.repeat(80));
console.log();

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

/**
 * Filter results for recipe URLs
 */
function filterRecipeUrls(results: any[]): any[] {
  return results.filter((result) => {
    const domain = extractDomain(result.url).toLowerCase();

    // Exclude blocked domains
    const isExcluded = EXCLUDED_DOMAINS.some((excluded) => domain.includes(excluded));
    if (isExcluded) {
      return false;
    }

    // Check if from known recipe site
    const isRecipeSite = RECIPE_SITES.some((site) => domain.includes(site));

    // Or check if URL/title contains recipe-related keywords
    const hasRecipeKeywords =
      result.url.toLowerCase().includes('recipe') ||
      result.title.toLowerCase().includes('recipe');

    return isRecipeSite || hasRecipeKeywords;
  });
}

/**
 * Main test function
 */
async function testTavilyAPI() {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    console.error('❌ TAVILY_API_KEY not found in environment');
    console.error('   Please add TAVILY_API_KEY to your .env.local file');
    return;
  }

  console.log('✓ TAVILY_API_KEY found');
  console.log(`✓ Supported recipe sites: ${RECIPE_SITES.length} domains`);
  console.log(`✓ Excluded domains: ${EXCLUDED_DOMAINS.length} domains`);
  console.log();
  console.log('🔍 Testing Tavily search...');

  try {
    // Build search query
    const searchQuery = testQuery.toLowerCase().includes('recipe')
      ? testQuery
      : `${testQuery} recipe`;

    console.log(`   Query: "${searchQuery}"`);
    console.log();

    // Build request payload
    const requestBody = {
      api_key: apiKey,
      query: searchQuery,
      search_depth: 'basic',
      max_results: 10,
      include_domains: RECIPE_SITES,
      exclude_domains: EXCLUDED_DOMAINS,
      include_answer: false,
      include_raw_content: false,
    };

    console.log('   Request config:');
    console.log(`     - Search depth: ${requestBody.search_depth}`);
    console.log(`     - Max results: ${requestBody.max_results}`);
    console.log(`     - Include domains: ${requestBody.include_domains.length} recipe sites`);
    console.log(`     - Exclude domains: ${requestBody.exclude_domains.length} sites`);
    console.log();

    // Make API request
    const startTime = Date.now();
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tavily API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Tavily API error: ${data.error}`);
    }

    const results = data.results || [];

    console.log(`✓ Tavily search successful!`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Raw results: ${results.length}`);
    console.log();

    // Filter for recipe URLs
    const filtered = filterRecipeUrls(results);
    console.log('✓ Recipe URL filtering complete');
    console.log(`   Filtered results: ${filtered.length}`);
    console.log(`   Filtered out: ${results.length - filtered.length}`);
    console.log();

    // Display top results
    if (filtered.length > 0) {
      console.log('Top Recipe Results:');
      console.log('-'.repeat(80));

      filtered.slice(0, 5).forEach((result: any, index: number) => {
        console.log(`${index + 1}. ${result.title}`);
        console.log(`   URL: ${result.url}`);
        console.log(`   Source: ${extractDomain(result.url)}`);
        console.log(`   Score: ${result.score?.toFixed(3) || 'N/A'}`);
        console.log(`   Content: ${result.content?.slice(0, 80) || 'N/A'}...`);
        console.log();
      });

      if (filtered.length > 5) {
        console.log(`... and ${filtered.length - 5} more results`);
        console.log();
      }
    } else {
      console.log('⚠ No recipe URLs found after filtering');
      console.log();
    }

    // URL validation
    console.log('URL Validation:');
    console.log('-'.repeat(80));

    let validUrls = 0;
    let invalidUrls = 0;

    filtered.forEach((result: any) => {
      try {
        new URL(result.url);
        validUrls++;
      } catch {
        invalidUrls++;
        console.log(`⚠ Invalid URL: ${result.url}`);
      }
    });

    console.log(`Valid URLs: ${validUrls}`);
    console.log(`Invalid URLs: ${invalidUrls}`);
    console.log();

    // Summary
    console.log('='.repeat(80));
    console.log('Test Summary');
    console.log('-'.repeat(80));
    console.log('✅ Tavily integration test PASSED');
    console.log(`✓ Query: "${testQuery}"`);
    console.log(`✓ Raw results: ${results.length}`);
    console.log(`✓ Filtered recipe URLs: ${filtered.length}`);
    console.log(`✓ Valid URLs: ${validUrls}`);
    console.log(`✓ Response time: ${duration}ms`);
    console.log('='.repeat(80));
  } catch (error: any) {
    console.error();
    console.error('='.repeat(80));
    console.error('❌ Tavily test FAILED');
    console.error('-'.repeat(80));
    console.error('Error:', error.message);
    console.error();
    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }
    console.error('='.repeat(80));
    process.exit(1);
  }
}

// Run test
testTavilyAPI();
