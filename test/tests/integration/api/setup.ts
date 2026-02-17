/**
 * API Integration Test Setup
 *
 * Provides utilities for testing API endpoints end-to-end
 */

import { eq } from 'drizzle-orm';
import { generateApiKey } from '@/lib/api-auth/key-generator';
import { apiKeys } from '@/lib/db/api-keys-schema';
import { db } from '@/lib/db';

export interface TestContext {
  testApiKey: string;
  testUserId: string;
  testKeyPrefix: string;
  cleanup: () => Promise<void>;
}

/**
 * Create a test API key for integration testing
 */
export async function createTestApiKey(
  options: { userId?: string; scopes?: string[]; expiresInDays?: number } = {}
): Promise<TestContext> {
  const userId = options.userId || `test-user-${Date.now()}`;
  const scopes = options.scopes || ['read:recipes', 'read:meals'];

  // Generate API key
  const keyData = await generateApiKey({
    userId,
    name: 'Integration Test Key',
    description: 'Temporary key for integration testing',
    scopes,
    expiresInDays: options.expiresInDays,
    environment: 'test',
  });

  const cleanup = async () => {
    // Delete test API key
    await db.delete(apiKeys).where(eq(apiKeys.userId, userId));
  };

  return {
    testApiKey: keyData.key,
    testUserId: userId,
    testKeyPrefix: keyData.keyPrefix,
    cleanup,
  };
}

/**
 * Make authenticated API request
 */
export async function makeAuthenticatedRequest(
  path: string,
  options: {
    method?: string;
    apiKey: string;
    body?: any;
    query?: Record<string, string>;
  }
): Promise<Response> {
  const { method = 'GET', apiKey, body, query } = options;

  const url = new URL(path, 'http://localhost:3000');
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const headers: HeadersInit = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    fetchOptions.body = JSON.stringify(body);
  }

  return fetch(url.toString(), fetchOptions);
}

/**
 * Assert response status
 */
export function assertStatus(response: Response, expected: number) {
  if (response.status !== expected) {
    throw new Error(`Expected status ${expected}, got ${response.status}: ${response.statusText}`);
  }
}

/**
 * Assert response has JSON body
 */
export async function assertJsonResponse<T = any>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    throw new Error(`Expected JSON response, got ${contentType}`);
  }
  return response.json();
}

/**
 * Clean up all test data
 */
export async function cleanupAllTestData() {
  // Delete all test API keys (user_id starts with "test-user-")
  await db.execute(`DELETE FROM api_keys WHERE user_id LIKE 'test-user-%'`);

  // Add more cleanup as needed for other test data
  console.log('✅ Test data cleaned up');
}

/**
 * Setup before all tests
 */
export async function globalSetup() {
  console.log('🔧 Setting up integration test environment...');
  await cleanupAllTestData();
  console.log('✅ Test environment ready');
}

/**
 * Teardown after all tests
 */
export async function globalTeardown() {
  console.log('🧹 Cleaning up test environment...');
  await cleanupAllTestData();
  console.log('✅ Teardown complete');
}
