/**
 * API Authentication Integration Tests
 *
 * Tests for /api/v1/auth/* endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestApiKey,
  makeAuthenticatedRequest,
  assertStatus,
  assertJsonResponse,
  globalSetup,
  globalTeardown,
  type TestContext,
} from './setup.js';

describe('API Authentication Endpoints', () => {
  let testContext: TestContext;

  beforeAll(async () => {
    await globalSetup();
    // Create admin test key with full scopes
    testContext = await createTestApiKey({
      scopes: ['admin:keys', 'read:keys', 'write:keys'],
    });
  });

  afterAll(async () => {
    await testContext.cleanup();
    await globalTeardown();
  });

  describe('POST /api/v1/auth/keys', () => {
    it('should create a new API key with valid admin credentials', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/auth/keys', {
        method: 'POST',
        apiKey: testContext.testApiKey,
        body: {
          name: 'Test Integration Key',
          description: 'Created via integration test',
          scopes: ['read:recipes'],
          expiresInDays: 30,
        },
      });

      assertStatus(response, 201);
      const data = await assertJsonResponse(response);

      expect(data).toHaveProperty('key');
      expect(data).toHaveProperty('keyPrefix');
      expect(data).toHaveProperty('id');
      expect(data.key).toMatch(/^jk_[a-zA-Z0-9]{32}$/);
      expect(data.scopes).toEqual(['read:recipes']);
    });

    it('should reject key creation without admin scope', async () => {
      // Create a read-only key
      const readOnlyContext = await createTestApiKey({
        scopes: ['read:recipes'],
      });

      const response = await makeAuthenticatedRequest('/api/v1/auth/keys', {
        method: 'POST',
        apiKey: readOnlyContext.testApiKey,
        body: {
          name: 'Unauthorized Key',
          scopes: ['read:recipes'],
        },
      });

      assertStatus(response, 403);
      const data = await assertJsonResponse(response);
      expect(data.error).toBe('Insufficient permissions');

      await readOnlyContext.cleanup();
    });

    it('should reject key creation with invalid scopes', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/auth/keys', {
        method: 'POST',
        apiKey: testContext.testApiKey,
        body: {
          name: 'Invalid Scopes Key',
          scopes: ['invalid:scope', 'read:recipes'],
        },
      });

      assertStatus(response, 400);
      const data = await assertJsonResponse(response);
      expect(data.error).toContain('Invalid scopes');
    });

    it('should reject key creation without authentication', async () => {
      const response = await fetch('http://localhost:3000/api/v1/auth/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Unauthenticated Key',
          scopes: ['read:recipes'],
        }),
      });

      assertStatus(response, 401);
    });
  });

  describe('GET /api/v1/auth/keys', () => {
    it('should list all API keys for authenticated user', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/auth/keys', {
        method: 'GET',
        apiKey: testContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(Array.isArray(data.keys)).toBe(true);
      expect(data.keys.length).toBeGreaterThan(0);
      expect(data.keys[0]).toHaveProperty('id');
      expect(data.keys[0]).toHaveProperty('name');
      expect(data.keys[0]).toHaveProperty('scopes');
      expect(data.keys[0]).not.toHaveProperty('key'); // Should not expose full key
    });

    it('should filter active keys only', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/auth/keys', {
        method: 'GET',
        apiKey: testContext.testApiKey,
        query: { active: 'true' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.keys.every((k: any) => k.isActive === true)).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await fetch('http://localhost:3000/api/v1/auth/keys');
      assertStatus(response, 401);
    });
  });

  describe('GET /api/v1/auth/keys/:id', () => {
    it('should retrieve specific API key details', async () => {
      // First create a key to retrieve
      const createResponse = await makeAuthenticatedRequest(
        '/api/v1/auth/keys',
        {
          method: 'POST',
          apiKey: testContext.testApiKey,
          body: {
            name: 'Key for Retrieval Test',
            scopes: ['read:recipes'],
          },
        }
      );

      const createData = await assertJsonResponse(createResponse);
      const keyId = createData.id;

      // Now retrieve it
      const response = await makeAuthenticatedRequest(
        `/api/v1/auth/keys/${keyId}`,
        {
          method: 'GET',
          apiKey: testContext.testApiKey,
        }
      );

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.id).toBe(keyId);
      expect(data.name).toBe('Key for Retrieval Test');
      expect(data.scopes).toEqual(['read:recipes']);
    });

    it('should return 404 for non-existent key', async () => {
      const response = await makeAuthenticatedRequest(
        '/api/v1/auth/keys/00000000-0000-0000-0000-000000000000',
        {
          method: 'GET',
          apiKey: testContext.testApiKey,
        }
      );

      assertStatus(response, 404);
    });
  });

  describe('PATCH /api/v1/auth/keys/:id', () => {
    it('should update API key name and description', async () => {
      // Create a key
      const createResponse = await makeAuthenticatedRequest(
        '/api/v1/auth/keys',
        {
          method: 'POST',
          apiKey: testContext.testApiKey,
          body: {
            name: 'Original Name',
            description: 'Original Description',
            scopes: ['read:recipes'],
          },
        }
      );

      const createData = await assertJsonResponse(createResponse);
      const keyId = createData.id;

      // Update it
      const updateResponse = await makeAuthenticatedRequest(
        `/api/v1/auth/keys/${keyId}`,
        {
          method: 'PATCH',
          apiKey: testContext.testApiKey,
          body: {
            name: 'Updated Name',
            description: 'Updated Description',
          },
        }
      );

      assertStatus(updateResponse, 200);
      const updateData = await assertJsonResponse(updateResponse);

      expect(updateData.name).toBe('Updated Name');
      expect(updateData.description).toBe('Updated Description');
    });

    it('should revoke API key', async () => {
      // Create a key
      const createResponse = await makeAuthenticatedRequest(
        '/api/v1/auth/keys',
        {
          method: 'POST',
          apiKey: testContext.testApiKey,
          body: {
            name: 'Key to Revoke',
            scopes: ['read:recipes'],
          },
        }
      );

      const createData = await assertJsonResponse(createResponse);
      const keyId = createData.id;

      // Revoke it
      const revokeResponse = await makeAuthenticatedRequest(
        `/api/v1/auth/keys/${keyId}`,
        {
          method: 'PATCH',
          apiKey: testContext.testApiKey,
          body: {
            isActive: false,
            revocationReason: 'Test revocation',
          },
        }
      );

      assertStatus(revokeResponse, 200);
      const revokeData = await assertJsonResponse(revokeResponse);

      expect(revokeData.isActive).toBe(false);
      expect(revokeData.revokedAt).toBeTruthy();
      expect(revokeData.revocationReason).toBe('Test revocation');
    });
  });

  describe('DELETE /api/v1/auth/keys/:id', () => {
    it('should delete API key permanently', async () => {
      // Create a key
      const createResponse = await makeAuthenticatedRequest(
        '/api/v1/auth/keys',
        {
          method: 'POST',
          apiKey: testContext.testApiKey,
          body: {
            name: 'Key to Delete',
            scopes: ['read:recipes'],
          },
        }
      );

      const createData = await assertJsonResponse(createResponse);
      const keyId = createData.id;

      // Delete it
      const deleteResponse = await makeAuthenticatedRequest(
        `/api/v1/auth/keys/${keyId}`,
        {
          method: 'DELETE',
          apiKey: testContext.testApiKey,
        }
      );

      assertStatus(deleteResponse, 204);

      // Verify it's gone
      const getResponse = await makeAuthenticatedRequest(
        `/api/v1/auth/keys/${keyId}`,
        {
          method: 'GET',
          apiKey: testContext.testApiKey,
        }
      );

      assertStatus(getResponse, 404);
    });
  });

  describe('GET /api/v1/auth/keys/:id/usage', () => {
    it('should retrieve usage statistics for API key', async () => {
      // Create a key
      const createResponse = await makeAuthenticatedRequest(
        '/api/v1/auth/keys',
        {
          method: 'POST',
          apiKey: testContext.testApiKey,
          body: {
            name: 'Key for Usage Test',
            scopes: ['read:recipes'],
          },
        }
      );

      const createData = await assertJsonResponse(createResponse);
      const keyId = createData.id;

      // Get usage stats
      const usageResponse = await makeAuthenticatedRequest(
        `/api/v1/auth/keys/${keyId}/usage`,
        {
          method: 'GET',
          apiKey: testContext.testApiKey,
        }
      );

      assertStatus(usageResponse, 200);
      const usageData = await assertJsonResponse(usageResponse);

      expect(usageData).toHaveProperty('totalRequests');
      expect(usageData).toHaveProperty('lastUsedAt');
      expect(usageData).toHaveProperty('usageByDay');
      expect(Array.isArray(usageData.usageByDay)).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on API key creation', async () => {
      // Make rapid requests (assuming 10 requests per minute limit)
      const requests = Array.from({ length: 15 }, () =>
        makeAuthenticatedRequest('/api/v1/auth/keys', {
          method: 'POST',
          apiKey: testContext.testApiKey,
          body: {
            name: `Rate Limit Test ${Date.now()}`,
            scopes: ['read:recipes'],
          },
        })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    }, 30000); // 30 second timeout for this test
  });

  describe('Security', () => {
    it('should reject expired API keys', async () => {
      // Create a key that expires immediately
      const expiredContext = await createTestApiKey({
        scopes: ['read:recipes'],
        expiresInDays: -1, // Already expired
      });

      const response = await makeAuthenticatedRequest('/api/v1/auth/keys', {
        method: 'GET',
        apiKey: expiredContext.testApiKey,
      });

      assertStatus(response, 401);
      const data = await assertJsonResponse(response);
      expect(data.error).toContain('expired');

      await expiredContext.cleanup();
    });

    it('should reject revoked API keys', async () => {
      // Create and immediately revoke a key
      const context = await createTestApiKey({
        scopes: ['admin:keys', 'read:recipes'],
      });

      // Get the key ID
      const listResponse = await makeAuthenticatedRequest('/api/v1/auth/keys', {
        method: 'GET',
        apiKey: context.testApiKey,
      });

      const listData = await assertJsonResponse(listResponse);
      const keyId = listData.keys[0].id;

      // Revoke it
      await makeAuthenticatedRequest(`/api/v1/auth/keys/${keyId}`, {
        method: 'PATCH',
        apiKey: testContext.testApiKey,
        body: {
          isActive: false,
        },
      });

      // Try to use revoked key
      const response = await makeAuthenticatedRequest('/api/v1/auth/keys', {
        method: 'GET',
        apiKey: context.testApiKey,
      });

      assertStatus(response, 401);
      const data = await assertJsonResponse(response);
      expect(data.error).toContain('revoked');

      await context.cleanup();
    });

    it('should not expose key hashes in responses', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/auth/keys', {
        method: 'GET',
        apiKey: testContext.testApiKey,
      });

      const data = await assertJsonResponse(response);
      const keys = data.keys;

      keys.forEach((key: any) => {
        expect(key).not.toHaveProperty('keyHash');
        expect(key).not.toHaveProperty('key');
      });
    });
  });
});
