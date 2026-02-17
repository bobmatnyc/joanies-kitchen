/**
 * Collections API Integration Tests
 *
 * Tests for /api/v1/collections/* endpoints
 *
 * Coverage:
 * - GET /api/v1/collections (list user's collections)
 * - GET /api/v1/collections/:id (get collection details)
 * - POST /api/v1/collections (create collection)
 * - PATCH /api/v1/collections/:id (update collection)
 * - DELETE /api/v1/collections/:id (delete collection)
 * - POST /api/v1/collections/:id/recipes (add recipe)
 * - DELETE /api/v1/collections/:id/recipes/:recipeId (remove recipe)
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

describe('Collections API Endpoints', () => {
  let readContext: TestContext;
  let writeContext: TestContext;
  let testCollectionId: number;

  beforeAll(async () => {
    await globalSetup();

    readContext = await createTestApiKey({
      scopes: ['read:collections'],
    });

    writeContext = await createTestApiKey({
      scopes: ['read:collections', 'write:collections', 'delete:collections', 'read:recipes'],
    });
  });

  afterAll(async () => {
    await readContext.cleanup();
    await writeContext.cleanup();
    await globalTeardown();
  });

  // ============================================================================
  // POST /api/v1/collections - Create Collection
  // ============================================================================

  describe('POST /api/v1/collections', () => {
    it('should create new collection', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/collections', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          name: 'Test Collection',
          description: 'A test collection for integration testing',
          is_public: false,
        },
      });

      assertStatus(response, 201);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id');
      expect(data.data.name).toBe('Test Collection');
      expect(data.data.description).toBe('A test collection for integration testing');
      expect(data.data.is_public).toBe(false);

      testCollectionId = data.data.id;
    });

    it('should reject creation without write scope', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/collections', {
        method: 'POST',
        apiKey: readContext.testApiKey,
        body: {
          name: 'Unauthorized Collection',
        },
      });

      assertStatus(response, 403);
    });

    it('should validate required fields', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/collections', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          // Missing name
          description: 'Invalid collection',
        },
      });

      assertStatus(response, 400);
    });

    it('should reject request without authentication', async () => {
      const url = new URL('/api/v1/collections', 'http://localhost:3000');
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test' }),
      });

      assertStatus(response, 401);
    });

    it('should allow creating collection with slug', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/collections', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          name: 'Slugged Collection',
          slug: 'slugged-collection',
          is_public: true,
        },
      });

      assertStatus(response, 201);
      const data = await assertJsonResponse(response);
      expect(data.data.slug).toBe('slugged-collection');
    });
  });

  // ============================================================================
  // GET /api/v1/collections - List Collections
  // ============================================================================

  describe('GET /api/v1/collections', () => {
    it('should list user collections with pagination', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/collections', {
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
    });

    it('should filter public collections', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/collections', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { is_public: 'true' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      if (data.data.items.length > 0) {
        data.data.items.forEach((collection: any) => {
          expect(collection.is_public).toBe(true);
        });
      }
    });

    it('should sort collections', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/collections', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { sortBy: 'name', order: 'asc' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);
      expect(data.success).toBe(true);
    });

    it('should reject without authentication', async () => {
      const url = new URL('/api/v1/collections', 'http://localhost:3000');
      const response = await fetch(url.toString());

      assertStatus(response, 401);
    });
  });

  // ============================================================================
  // GET /api/v1/collections/:id - Get Collection
  // ============================================================================

  describe('GET /api/v1/collections/:id', () => {
    it('should get collection by id', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/collections/${testCollectionId}`, {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      expect(data.data.id).toBe(testCollectionId);
      expect(data.data.name).toBe('Test Collection');
    });

    it('should return 404 for non-existent collection', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/collections/999999', {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 404);
    });

    it('should include recipes in collection', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/collections/${testCollectionId}`, {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.data).toHaveProperty('recipes');
      expect(Array.isArray(data.data.recipes)).toBe(true);
    });
  });

  // ============================================================================
  // PATCH /api/v1/collections/:id - Update Collection
  // ============================================================================

  describe('PATCH /api/v1/collections/:id', () => {
    it('should update collection', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/collections/${testCollectionId}`, {
        method: 'PATCH',
        apiKey: writeContext.testApiKey,
        body: {
          name: 'Updated Test Collection',
          description: 'Updated description',
          is_public: true,
        },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      expect(data.data.name).toBe('Updated Test Collection');
      expect(data.data.description).toBe('Updated description');
      expect(data.data.is_public).toBe(true);
    });

    it('should reject update without write scope', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/collections/${testCollectionId}`, {
        method: 'PATCH',
        apiKey: readContext.testApiKey,
        body: {
          name: 'Unauthorized Update',
        },
      });

      assertStatus(response, 403);
    });

    it('should return 404 for non-existent collection', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/collections/999999', {
        method: 'PATCH',
        apiKey: writeContext.testApiKey,
        body: {
          name: 'Update non-existent',
        },
      });

      assertStatus(response, 404);
    });

    it('should allow partial updates', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/collections/${testCollectionId}`, {
        method: 'PATCH',
        apiKey: writeContext.testApiKey,
        body: {
          description: 'Only description update',
        },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);
      expect(data.data.description).toBe('Only description update');
    });
  });

  // ============================================================================
  // POST /api/v1/collections/:id/recipes - Add Recipe to Collection
  // ============================================================================

  describe('POST /api/v1/collections/:id/recipes', () => {
    it('should add recipe to collection', async () => {
      // First, get a recipe ID (assuming there's at least one recipe)
      const recipesResponse = await makeAuthenticatedRequest('/api/v1/recipes', {
        method: 'GET',
        apiKey: writeContext.testApiKey,
        query: { limit: '1' },
      });

      assertStatus(recipesResponse, 200);
      const recipesData = await assertJsonResponse(recipesResponse);

      if (recipesData.data?.items?.length > 0) {
        const recipeId = recipesData.data.items[0].id;

        const response = await makeAuthenticatedRequest(
          `/api/v1/collections/${testCollectionId}/recipes`,
          {
            method: 'POST',
            apiKey: writeContext.testApiKey,
            body: {
              recipe_id: recipeId,
            },
          }
        );

        // Should be 201 (created) or 200 (already exists)
        expect([200, 201]).toContain(response.status);
      }
    });

    it('should reject without write scope', async () => {
      const response = await makeAuthenticatedRequest(
        `/api/v1/collections/${testCollectionId}/recipes`,
        {
          method: 'POST',
          apiKey: readContext.testApiKey,
          body: {
            recipe_id: 1,
          },
        }
      );

      assertStatus(response, 403);
    });

    it('should validate recipe_id', async () => {
      const response = await makeAuthenticatedRequest(
        `/api/v1/collections/${testCollectionId}/recipes`,
        {
          method: 'POST',
          apiKey: writeContext.testApiKey,
          body: {
            // Missing recipe_id
          },
        }
      );

      assertStatus(response, 400);
    });

    it('should return 404 for non-existent collection', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/collections/999999/recipes', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          recipe_id: 1,
        },
      });

      assertStatus(response, 404);
    });
  });

  // ============================================================================
  // DELETE /api/v1/collections/:id/recipes/:recipeId - Remove Recipe
  // ============================================================================

  describe('DELETE /api/v1/collections/:id/recipes/:recipeId', () => {
    it('should remove recipe from collection', async () => {
      // Get recipes in collection first
      const collectionResponse = await makeAuthenticatedRequest(
        `/api/v1/collections/${testCollectionId}`,
        {
          method: 'GET',
          apiKey: writeContext.testApiKey,
        }
      );

      const collectionData = await assertJsonResponse(collectionResponse);

      if (collectionData.data?.recipes?.length > 0) {
        const recipeId = collectionData.data.recipes[0].id;

        const response = await makeAuthenticatedRequest(
          `/api/v1/collections/${testCollectionId}/recipes/${recipeId}`,
          {
            method: 'DELETE',
            apiKey: writeContext.testApiKey,
          }
        );

        assertStatus(response, 200);
        const data = await assertJsonResponse(response);
        expect(data.success).toBe(true);
      }
    });

    it('should reject without write scope', async () => {
      const response = await makeAuthenticatedRequest(
        `/api/v1/collections/${testCollectionId}/recipes/1`,
        {
          method: 'DELETE',
          apiKey: readContext.testApiKey,
        }
      );

      assertStatus(response, 403);
    });

    it('should return 404 for non-existent collection', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/collections/999999/recipes/1', {
        method: 'DELETE',
        apiKey: writeContext.testApiKey,
      });

      assertStatus(response, 404);
    });
  });

  // ============================================================================
  // DELETE /api/v1/collections/:id - Delete Collection
  // ============================================================================

  describe('DELETE /api/v1/collections/:id', () => {
    it('should delete collection', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/collections/${testCollectionId}`, {
        method: 'DELETE',
        apiKey: writeContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);
      expect(data.success).toBe(true);
    });

    it('should return 404 after deletion', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/collections/${testCollectionId}`, {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 404);
    });

    it('should reject deletion without delete scope', async () => {
      // Create a new collection to test
      const createResponse = await makeAuthenticatedRequest('/api/v1/collections', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          name: 'Delete Test',
        },
      });

      const createData = await assertJsonResponse(createResponse);
      const newCollectionId = createData.data.id;

      const response = await makeAuthenticatedRequest(`/api/v1/collections/${newCollectionId}`, {
        method: 'DELETE',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 403);

      // Cleanup
      await makeAuthenticatedRequest(`/api/v1/collections/${newCollectionId}`, {
        method: 'DELETE',
        apiKey: writeContext.testApiKey,
      });
    });
  });
});
