/**
 * Test Recipe Ingestion API
 *
 * Usage:
 * npx tsx scripts/test-ingest-api.ts <url> [api_key]
 *
 * Examples:
 * npx tsx scripts/test-ingest-api.ts "https://www.sanaacooks.com/blog/tag/Dan+Barber"
 * npx tsx scripts/test-ingest-api.ts "https://example.com/recipe" jk_test_abc123...
 */

import { generateApiKey, hashApiKey } from '@/lib/api-auth/key-generator';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/api-keys-schema';
import { SCOPES } from '@/lib/api-auth/scopes';

const TEST_URL = process.argv[2] || 'https://www.sanaacooks.com/blog/tag/Dan+Barber';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002';

async function createTestApiKey(): Promise<string> {
  console.log('[Test] Creating test API key...');

  // Generate a test API key
  const generated = generateApiKey('development', 32);

  console.log('[Test] Generated API key:', generated.key);
  console.log('[Test] Key prefix:', generated.prefix);
  console.log('[Test] Environment:', generated.environment);

  // Save to database
  try {
    await db.insert(apiKeys).values({
      user_id: 'test-user',
      name: 'Test Recipe Ingestion Key',
      key_hash: generated.hash,
      key_prefix: generated.prefix,
      scopes: [SCOPES.WRITE_RECIPES, SCOPES.READ_RECIPES],
      is_active: true,
      environment: 'development',
      description: 'Temporary key for testing recipe ingestion API',
      created_by: 'test-script',
      total_requests: 0,
    });

    console.log('[Test] ✅ API key saved to database');
    return generated.key;
  } catch (error: any) {
    console.error('[Test] ❌ Failed to save API key:', error.message);
    throw error;
  }
}

async function testSingleIngestion(url: string, apiKey: string) {
  console.log('\n[Test] Testing single URL ingestion...');
  console.log('[Test] URL:', url);
  console.log('[Test] API Key:', apiKey.substring(0, 16) + '...');

  try {
    const response = await fetch(`${API_BASE_URL}/api/ingest-recipe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    console.log('[Test] Response status:', response.status);
    console.log('[Test] Response data:', JSON.stringify(data, null, 2));

    if (response.ok && data.success) {
      console.log('\n[Test] ✅ SUCCESS!');
      console.log('[Test] Recipe ID:', data.recipe.id);
      console.log('[Test] Recipe Name:', data.recipe.name);
      console.log('[Test] Recipe Slug:', data.recipe.slug);
      console.log('[Test] Recipe URL:', data.recipe.url);
      return data;
    } else {
      console.log('\n[Test] ❌ FAILED');
      console.log('[Test] Error:', data.error);
      return null;
    }
  } catch (error: any) {
    console.error('\n[Test] ❌ ERROR:', error.message);
    return null;
  }
}

async function testBatchIngestion(urls: string[], apiKey: string) {
  console.log('\n[Test] Testing batch URL ingestion...');
  console.log('[Test] URLs:', urls);

  try {
    const response = await fetch(`${API_BASE_URL}/api/ingest-recipe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ urls }),
    });

    const data = await response.json();

    console.log('[Test] Response status:', response.status);
    console.log('[Test] Response data:', JSON.stringify(data, null, 2));

    if (response.ok && data.success) {
      console.log('\n[Test] ✅ SUCCESS!');
      console.log('[Test] Stats:', data.stats);
      return data;
    } else {
      console.log('\n[Test] ❌ FAILED');
      console.log('[Test] Error:', data.error);
      return null;
    }
  } catch (error: any) {
    console.error('\n[Test] ❌ ERROR:', error.message);
    return null;
  }
}

async function cleanupTestApiKey(apiKey: string) {
  console.log('\n[Test] Cleaning up test API key...');

  try {
    const keyHash = hashApiKey(apiKey);

    await db.delete(apiKeys).where((keys, { eq }) => eq(keys.key_hash, keyHash));

    console.log('[Test] ✅ Test API key removed');
  } catch (error: any) {
    console.error('[Test] ❌ Failed to cleanup:', error.message);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Recipe Ingestion API Test');
  console.log('='.repeat(60));

  let apiKey: string;
  let shouldCleanup = false;

  // Check if API key was provided
  if (process.argv[3]) {
    apiKey = process.argv[3];
    console.log('[Test] Using provided API key');
  } else {
    console.log('[Test] No API key provided, creating test key...');
    apiKey = await createTestApiKey();
    shouldCleanup = true;
  }

  // Test single URL ingestion
  await testSingleIngestion(TEST_URL, apiKey);

  // Optional: Test batch ingestion
  // const testUrls = [
  //   'https://example.com/recipe1',
  //   'https://example.com/recipe2',
  // ];
  // await testBatchIngestion(testUrls, apiKey);

  // Cleanup test API key if we created it
  if (shouldCleanup) {
    await cleanupTestApiKey(apiKey);
  }

  console.log('\n[Test] Test complete!');
  console.log('='.repeat(60));
}

main()
  .then(() => {
    console.log('[Test] Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Test] Fatal error:', error);
    process.exit(1);
  });
