/**
 * Chefs API Integration Tests
 *
 * Tests for /api/v1/chefs/* endpoints
 *
 * Coverage:
 * - GET /api/v1/chefs (list)
 * - GET /api/v1/chefs/:slug (get by slug)
 * - GET /api/v1/chefs/:slug/recipes (chef's recipes)
 * - POST /api/v1/chefs (create - admin)
 * - PATCH /api/v1/chefs/:slug (update - admin)
 * - DELETE /api/v1/chefs/:slug (delete - admin)
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assertJsonResponse,
  assertStatus,
  createTestApiKey,
  globalSetup,
  globalTeardown,
  makeAuthenticatedRequest,
  type TestContext,
} from './setup';

describe('Chefs API Endpoints', () => {
  let readContext: TestContext;
  let writeContext: TestContext;
  let adminContext: TestContext;
  let testChefSlug: string;

  beforeAll(async () => {
    await globalSetup();

    readContext = await createTestApiKey({
      scopes: ['read:chefs'],
    });

    writeContext = await createTestApiKey({
      scopes: ['read:chefs', 'write:chefs'],
    });

    adminContext = await createTestApiKey({
      scopes: ['read:chefs', 'write:chefs', 'delete:chefs'],
    });
  });

  afterAll(async () => {
    await readContext.cleanup();
    await writeContext.cleanup();
    await adminContext.cleanup();
    await globalTeardown();
  });

  // ============================================================================
  // GET /api/v1/chefs - List Chefs
  // ============================================================================

  describe('GET /api/v1/chefs', () => {
    it('should return paginated list of chefs', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/chefs', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { page: '1', limit: '10' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('items');
      expect(Array.isArray(data.data.items)).toBe(true);
      expect(data.data).toHaveProperty('pagination');
      expect(data.data.pagination.page).toBe(1);
      expect(data.data.pagination.limit).toBe(10);
    });

    it('should search chefs by name', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/chefs', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { search: 'chef' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.items)).toBe(true);
    });

    it('should sort chefs by different fields', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/chefs', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { sortBy: 'name', order: 'asc' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      if (data.data.items.length > 1) {
        const names = data.data.items.map((chef: any) => chef.name);
        const sortedNames = [...names].sort();
        expect(names).toEqual(sortedNames);
      }
    });

    it('should reject request without authentication', async () => {
      const url = new URL('/api/v1/chefs', 'http://localhost:3000');
      const response = await fetch(url.toString());

      assertStatus(response, 401);
    });

    it('should reject request with invalid page parameter', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/chefs', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { page: '-1' },
      });

      assertStatus(response, 400);
    });

    it('should enforce max limit parameter', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/chefs', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { limit: '200' },
      });

      assertStatus(response, 400);
    });
  });

  // ============================================================================
  // POST /api/v1/chefs - Create Chef
  // ============================================================================

  describe('POST /api/v1/chefs', () => {
    it('should create new chef with admin scope', async () => {
      testChefSlug = `test-chef-${Date.now()}`;
      const response = await makeAuthenticatedRequest('/api/v1/chefs', {
        method: 'POST',
        apiKey: adminContext.testApiKey,
        body: {
          slug: testChefSlug,
          name: 'Test Chef Integration',
          display_name: 'Chef Test',
          bio: 'A test chef for API integration testing',
          specialties: ['testing', 'automation'],
          is_active: true,
        },
      });

      assertStatus(response, 201);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      expect(data.data.slug).toBe(testChefSlug);
      expect(data.data.name).toBe('Test Chef Integration');
      expect(data.data.specialties).toEqual(['testing', 'automation']);
    });

    it('should reject creation without write:chefs scope', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/chefs', {
        method: 'POST',
        apiKey: readContext.testApiKey,
        body: {
          slug: 'unauthorized-chef',
          name: 'Unauthorized Chef',
        },
      });

      assertStatus(response, 403);
    });

    it('should validate required fields', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/chefs', {
        method: 'POST',
        apiKey: adminContext.testApiKey,
        body: {
          // Missing slug and name
          bio: 'Invalid chef',
        },
      });

      assertStatus(response, 400);
      const data = await assertJsonResponse(response);
      expect(data.success).toBe(false);
      expect(data.error).toBeTruthy();
    });

    it('should validate slug format', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/chefs', {
        method: 'POST',
        apiKey: adminContext.testApiKey,
        body: {
          slug: 'Invalid Slug With Spaces',
          name: 'Test Chef',
        },
      });

      assertStatus(response, 400);
    });

    it('should reject duplicate slug', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/chefs', {
        method: 'POST',
        apiKey: adminContext.testApiKey,
        body: {
          slug: testChefSlug, // Already exists from first test
          name: 'Duplicate Chef',
        },
      });

      assertStatus(response, 400);
      const data = await assertJsonResponse(response);
      expect(data.error).toContain('already exists');
    });
  });

  // ============================================================================
  // GET /api/v1/chefs/:slug - Get Chef by Slug
  // ============================================================================

  describe('GET /api/v1/chefs/:slug', () => {
    it('should get chef by slug', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/chefs/${testChefSlug}`, {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      expect(data.data.slug).toBe(testChefSlug);
      expect(data.data.name).toBe('Test Chef Integration');
    });

    it('should return 404 for non-existent chef', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/chefs/non-existent-chef', {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 404);
    });

    it('should reject without authentication', async () => {
      const url = new URL(`/api/v1/chefs/${testChefSlug}`, 'http://localhost:3000');
      const response = await fetch(url.toString());

      assertStatus(response, 401);
    });
  });

  // ============================================================================
  // GET /api/v1/chefs/:slug/recipes - Get Chef's Recipes
  // ============================================================================

  describe('GET /api/v1/chefs/:slug/recipes', () => {
    it('should list recipes by chef', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/chefs/${testChefSlug}/recipes`, {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { page: '1', limit: '10' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('items');
      expect(Array.isArray(data.data.items)).toBe(true);
      expect(data.data).toHaveProperty('pagination');
    });

    it('should return 404 for non-existent chef', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/chefs/non-existent/recipes', {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 404);
    });
  });

  // ============================================================================
  // PATCH /api/v1/chefs/:slug - Update Chef
  // ============================================================================

  describe('PATCH /api/v1/chefs/:slug', () => {
    it('should update chef with write scope', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/chefs/${testChefSlug}`, {
        method: 'PATCH',
        apiKey: writeContext.testApiKey,
        body: {
          bio: 'Updated bio for testing',
          specialties: ['testing', 'automation', 'integration'],
        },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      expect(data.data.bio).toBe('Updated bio for testing');
      expect(data.data.specialties).toContain('integration');
    });

    it('should reject update without write scope', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/chefs/${testChefSlug}`, {
        method: 'PATCH',
        apiKey: readContext.testApiKey,
        body: {
          bio: 'Unauthorized update',
        },
      });

      assertStatus(response, 403);
    });

    it('should return 404 for non-existent chef', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/chefs/non-existent', {
        method: 'PATCH',
        apiKey: writeContext.testApiKey,
        body: {
          bio: 'Update non-existent',
        },
      });

      assertStatus(response, 404);
    });

    it('should validate slug format on update', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/chefs/${testChefSlug}`, {
        method: 'PATCH',
        apiKey: writeContext.testApiKey,
        body: {
          slug: 'Invalid Slug',
        },
      });

      assertStatus(response, 400);
    });
  });

  // ============================================================================
  // DELETE /api/v1/chefs/:slug - Delete Chef
  // ============================================================================

  describe('DELETE /api/v1/chefs/:slug', () => {
    it('should reject deletion without delete scope', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/chefs/${testChefSlug}`, {
        method: 'DELETE',
        apiKey: writeContext.testApiKey,
      });

      assertStatus(response, 403);
    });

    it('should delete chef with delete scope', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/chefs/${testChefSlug}`, {
        method: 'DELETE',
        apiKey: adminContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);
      expect(data.success).toBe(true);
    });

    it('should return 404 after deletion', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/chefs/${testChefSlug}`, {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 404);
    });

    it('should return 404 for already deleted chef', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/chefs/${testChefSlug}`, {
        method: 'DELETE',
        apiKey: adminContext.testApiKey,
      });

      assertStatus(response, 404);
    });
  });
});
