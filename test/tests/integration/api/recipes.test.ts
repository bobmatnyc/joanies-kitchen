/**
 * API Recipe Endpoints Integration Tests
 *
 * Tests for /api/v1/recipes/* endpoints
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

describe('API Recipe Endpoints', () => {
  let readContext: TestContext;
  let writeContext: TestContext;

  beforeAll(async () => {
    await globalSetup();

    // Create read-only key
    readContext = await createTestApiKey({
      scopes: ['read:recipes'],
    });

    // Create read-write key
    writeContext = await createTestApiKey({
      scopes: ['read:recipes', 'write:recipes'],
    });
  });

  afterAll(async () => {
    await readContext.cleanup();
    await writeContext.cleanup();
    await globalTeardown();
  });

  describe('GET /api/v1/recipes', () => {
    it('should list recipes with valid API key', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/recipes', {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data).toHaveProperty('recipes');
      expect(Array.isArray(data.recipes)).toBe(true);
      expect(data).toHaveProperty('pagination');
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('total');
    });

    it('should filter recipes by query parameter', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/recipes', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { q: 'soup' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.recipes.length).toBeGreaterThan(0);
      data.recipes.forEach((recipe: any) => {
        const titleMatch = recipe.title.toLowerCase().includes('soup');
        const descMatch = recipe.description?.toLowerCase().includes('soup');
        expect(titleMatch || descMatch).toBe(true);
      });
    });

    it('should filter recipes by tags', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/recipes', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { tags: 'vegetarian,quick' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      if (data.recipes.length > 0) {
        data.recipes.forEach((recipe: any) => {
          const hasTag = recipe.tags?.some((t: string) =>
            ['vegetarian', 'quick'].includes(t.toLowerCase())
          );
          expect(hasTag).toBe(true);
        });
      }
    });

    it('should paginate results', async () => {
      const page1 = await makeAuthenticatedRequest('/api/v1/recipes', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { page: '1', limit: '10' },
      });

      assertStatus(page1, 200);
      const data1 = await assertJsonResponse(page1);

      expect(data1.recipes.length).toBeLessThanOrEqual(10);
      expect(data1.pagination.page).toBe(1);
      expect(data1.pagination.limit).toBe(10);

      if (data1.pagination.total > 10) {
        const page2 = await makeAuthenticatedRequest('/api/v1/recipes', {
          method: 'GET',
          apiKey: readContext.testApiKey,
          query: { page: '2', limit: '10' },
        });

        const data2 = await assertJsonResponse(page2);
        expect(data2.pagination.page).toBe(2);

        // Recipes on page 2 should be different from page 1
        const page1Ids = data1.recipes.map((r: any) => r.id);
        const page2Ids = data2.recipes.map((r: any) => r.id);
        const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
        expect(overlap.length).toBe(0);
      }
    });

    it('should require authentication', async () => {
      const response = await fetch('http://localhost:3000/api/v1/recipes');
      assertStatus(response, 401);
    });

    it('should enforce rate limits', async () => {
      // Make 100 rapid requests
      const requests = Array.from({ length: 100 }, () =>
        makeAuthenticatedRequest('/api/v1/recipes', {
          method: 'GET',
          apiKey: readContext.testApiKey,
        })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.status === 429);

      // Should hit rate limit
      expect(rateLimited.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('GET /api/v1/recipes/:id', () => {
    it('should retrieve specific recipe by ID', async () => {
      // First get a list to find a valid ID
      const listResponse = await makeAuthenticatedRequest('/api/v1/recipes', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { limit: '1' },
      });

      const listData = await assertJsonResponse(listResponse);

      if (listData.recipes.length === 0) {
        // Skip test if no recipes available
        return;
      }

      const recipeId = listData.recipes[0].id;

      // Get specific recipe
      const response = await makeAuthenticatedRequest(`/api/v1/recipes/${recipeId}`, {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.id).toBe(recipeId);
      expect(data).toHaveProperty('title');
      expect(data).toHaveProperty('ingredients');
      expect(data).toHaveProperty('instructions');
      expect(Array.isArray(data.ingredients)).toBe(true);
      expect(Array.isArray(data.instructions)).toBe(true);
    });

    it('should return 404 for non-existent recipe', async () => {
      const response = await makeAuthenticatedRequest(
        '/api/v1/recipes/00000000-0000-0000-0000-000000000000',
        {
          method: 'GET',
          apiKey: readContext.testApiKey,
        }
      );

      assertStatus(response, 404);
    });

    it('should include chef information if available', async () => {
      // Get a recipe
      const listResponse = await makeAuthenticatedRequest('/api/v1/recipes', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { limit: '1' },
      });

      const listData = await assertJsonResponse(listResponse);

      if (listData.recipes.length === 0) {
        return;
      }

      const recipeId = listData.recipes[0].id;

      const response = await makeAuthenticatedRequest(`/api/v1/recipes/${recipeId}`, {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      const data = await assertJsonResponse(response);

      if (data.chefId) {
        expect(data).toHaveProperty('chef');
        expect(data.chef).toHaveProperty('name');
      }
    });
  });

  describe('GET /api/v1/recipes/:id/similar', () => {
    it('should return similar recipes', async () => {
      // Get a recipe first
      const listResponse = await makeAuthenticatedRequest('/api/v1/recipes', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { limit: '1' },
      });

      const listData = await assertJsonResponse(listResponse);

      if (listData.recipes.length === 0) {
        return;
      }

      const recipeId = listData.recipes[0].id;

      // Get similar recipes
      const response = await makeAuthenticatedRequest(`/api/v1/recipes/${recipeId}/similar`, {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data).toHaveProperty('similar');
      expect(Array.isArray(data.similar)).toBe(true);
      expect(data).toHaveProperty('algorithm');

      if (data.similar.length > 0) {
        data.similar.forEach((recipe: any) => {
          expect(recipe).toHaveProperty('id');
          expect(recipe).toHaveProperty('title');
          expect(recipe).toHaveProperty('similarityScore');
          expect(recipe.similarityScore).toBeGreaterThan(0);
          expect(recipe.similarityScore).toBeLessThanOrEqual(1);
          // Should not include the original recipe
          expect(recipe.id).not.toBe(recipeId);
        });
      }
    });

    it('should limit number of similar recipes', async () => {
      const listResponse = await makeAuthenticatedRequest('/api/v1/recipes', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { limit: '1' },
      });

      const listData = await assertJsonResponse(listResponse);

      if (listData.recipes.length === 0) {
        return;
      }

      const recipeId = listData.recipes[0].id;

      const response = await makeAuthenticatedRequest(`/api/v1/recipes/${recipeId}/similar`, {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { limit: '5' },
      });

      const data = await assertJsonResponse(response);
      expect(data.similar.length).toBeLessThanOrEqual(5);
    });
  });

  describe('POST /api/v1/recipes', () => {
    it('should create a new recipe with write permissions', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/recipes', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          title: 'Integration Test Recipe',
          description: 'Created via API integration test',
          ingredients: [
            { name: 'Test Ingredient 1', quantity: '1 cup' },
            { name: 'Test Ingredient 2', quantity: '2 tbsp' },
          ],
          instructions: [
            { step: 1, text: 'First step' },
            { step: 2, text: 'Second step' },
          ],
          prepTime: 10,
          cookTime: 20,
          servings: 4,
          tags: ['test'],
        },
      });

      assertStatus(response, 201);
      const data = await assertJsonResponse(response);

      expect(data).toHaveProperty('id');
      expect(data.title).toBe('Integration Test Recipe');
      expect(data.ingredients.length).toBe(2);
      expect(data.instructions.length).toBe(2);
    });

    it('should reject recipe creation without write scope', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/recipes', {
        method: 'POST',
        apiKey: readContext.testApiKey,
        body: {
          title: 'Unauthorized Recipe',
          ingredients: [],
          instructions: [],
        },
      });

      assertStatus(response, 403);
    });

    it('should validate required fields', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/recipes', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          // Missing title
          ingredients: [],
          instructions: [],
        },
      });

      assertStatus(response, 400);
      const data = await assertJsonResponse(response);
      expect(data.error).toContain('title');
    });
  });

  describe('PATCH /api/v1/recipes/:id', () => {
    it('should update recipe fields', async () => {
      // Create a recipe first
      const createResponse = await makeAuthenticatedRequest('/api/v1/recipes', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          title: 'Recipe to Update',
          ingredients: [],
          instructions: [],
        },
      });

      const createData = await assertJsonResponse(createResponse);
      const recipeId = createData.id;

      // Update it
      const updateResponse = await makeAuthenticatedRequest(`/api/v1/recipes/${recipeId}`, {
        method: 'PATCH',
        apiKey: writeContext.testApiKey,
        body: {
          title: 'Updated Recipe Title',
          description: 'Updated description',
        },
      });

      assertStatus(updateResponse, 200);
      const updateData = await assertJsonResponse(updateResponse);

      expect(updateData.title).toBe('Updated Recipe Title');
      expect(updateData.description).toBe('Updated description');
    });
  });

  describe('DELETE /api/v1/recipes/:id', () => {
    it('should delete recipe with write permissions', async () => {
      // Create a recipe first
      const createResponse = await makeAuthenticatedRequest('/api/v1/recipes', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          title: 'Recipe to Delete',
          ingredients: [],
          instructions: [],
        },
      });

      const createData = await assertJsonResponse(createResponse);
      const recipeId = createData.id;

      // Delete it
      const deleteResponse = await makeAuthenticatedRequest(`/api/v1/recipes/${recipeId}`, {
        method: 'DELETE',
        apiKey: writeContext.testApiKey,
      });

      assertStatus(deleteResponse, 204);

      // Verify it's gone
      const getResponse = await makeAuthenticatedRequest(`/api/v1/recipes/${recipeId}`, {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(getResponse, 404);
    });
  });

  describe('Response Format', () => {
    it('should return consistent recipe schema', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/recipes', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { limit: '1' },
      });

      const data = await assertJsonResponse(response);

      if (data.recipes.length === 0) {
        return;
      }

      const recipe = data.recipes[0];

      // Check required fields
      expect(recipe).toHaveProperty('id');
      expect(recipe).toHaveProperty('title');
      expect(recipe).toHaveProperty('slug');
      expect(recipe).toHaveProperty('createdAt');
      expect(recipe).toHaveProperty('updatedAt');

      // Check array fields
      if (recipe.ingredients) {
        expect(Array.isArray(recipe.ingredients)).toBe(true);
      }
      if (recipe.instructions) {
        expect(Array.isArray(recipe.instructions)).toBe(true);
      }
      if (recipe.tags) {
        expect(Array.isArray(recipe.tags)).toBe(true);
      }
    });
  });
});
