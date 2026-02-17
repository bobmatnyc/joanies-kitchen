/**
 * Ingredients API Integration Tests
 *
 * Tests for /api/v1/ingredients/* endpoints
 *
 * Coverage:
 * - GET /api/v1/ingredients (list ingredients)
 * - GET /api/v1/ingredients/:slug (get ingredient by slug)
 * - GET /api/v1/ingredients/:slug/recipes (get recipes using ingredient)
 * - GET /api/v1/ingredients/categories (get categories)
 * - GET /api/v1/ingredients/search (search ingredients)
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

describe('Ingredients API Endpoints', () => {
  let readContext: TestContext;
  let testIngredientSlug: string;

  beforeAll(async () => {
    await globalSetup();

    readContext = await createTestApiKey({
      scopes: ['read:ingredients', 'read:recipes'],
    });
  });

  afterAll(async () => {
    await readContext.cleanup();
    await globalTeardown();
  });

  // ============================================================================
  // GET /api/v1/ingredients - List Ingredients
  // ============================================================================

  describe('GET /api/v1/ingredients', () => {
    it('should return paginated list of ingredients', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/ingredients', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { page: '1', limit: '20' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('items');
      expect(Array.isArray(data.data.items)).toBe(true);
      expect(data.data).toHaveProperty('pagination');
      expect(data.data.pagination.page).toBe(1);
      expect(data.data.pagination.limit).toBe(20);

      if (data.data.items.length > 0) {
        testIngredientSlug = data.data.items[0].slug;
      }
    });

    it('should filter by category', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/ingredients', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { category: 'vegetables' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      if (data.data.items.length > 0) {
        data.data.items.forEach((ingredient: any) => {
          expect(ingredient.category).toBe('vegetables');
        });
      }
    });

    it('should sort ingredients', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/ingredients', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { sortBy: 'name', order: 'asc' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      if (data.data.items.length > 1) {
        const names = data.data.items.map((ing: any) => ing.name);
        const sortedNames = [...names].sort();
        expect(names).toEqual(sortedNames);
      }
    });

    it('should reject without authentication', async () => {
      const url = new URL('/api/v1/ingredients', 'http://localhost:3000');
      const response = await fetch(url.toString());

      assertStatus(response, 401);
    });

    it('should reject invalid page parameter', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/ingredients', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { page: '0' },
      });

      assertStatus(response, 400);
    });

    it('should enforce max limit', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/ingredients', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { limit: '200' },
      });

      assertStatus(response, 400);
    });

    it('should include ingredient metadata', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/ingredients', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { limit: '1' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      if (data.data.items.length > 0) {
        const ingredient = data.data.items[0];
        expect(ingredient).toHaveProperty('id');
        expect(ingredient).toHaveProperty('name');
        expect(ingredient).toHaveProperty('slug');
        expect(ingredient).toHaveProperty('category');
      }
    });
  });

  // ============================================================================
  // GET /api/v1/ingredients/search - Search Ingredients
  // ============================================================================

  describe('GET /api/v1/ingredients/search', () => {
    it('should search ingredients by query', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/ingredients/search', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { q: 'tomato', limit: '10' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.items)).toBe(true);

      if (data.data.items.length > 0) {
        data.data.items.forEach((ingredient: any) => {
          const name = ingredient.name.toLowerCase();
          const description = ingredient.description?.toLowerCase() || '';
          expect(name.includes('tomato') || description.includes('tomato')).toBe(true);
        });
      }
    });

    it('should require search query', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/ingredients/search', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { limit: '10' },
      });

      assertStatus(response, 400);
    });

    it('should limit search results', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/ingredients/search', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { q: 'a', limit: '5' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.data.items.length).toBeLessThanOrEqual(5);
    });

    it('should return empty results for no matches', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/ingredients/search', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { q: 'xyzabc123nonexistent' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.data.items).toEqual([]);
    });

    it('should handle special characters in search', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/ingredients/search', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { q: 'salt & pepper' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);
      expect(data.success).toBe(true);
    });
  });

  // ============================================================================
  // GET /api/v1/ingredients/categories - Get Categories
  // ============================================================================

  describe('GET /api/v1/ingredients/categories', () => {
    it('should list all ingredient categories', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/ingredients/categories', {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.categories)).toBe(true);
      expect(data.data.categories.length).toBeGreaterThan(0);
    });

    it('should include category counts', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/ingredients/categories', {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      if (data.data.categories.length > 0) {
        const category = data.data.categories[0];
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('count');
        expect(typeof category.count).toBe('number');
      }
    });

    it('should reject without authentication', async () => {
      const url = new URL('/api/v1/ingredients/categories', 'http://localhost:3000');
      const response = await fetch(url.toString());

      assertStatus(response, 401);
    });

    it('should return consistent category structure', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/ingredients/categories', {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      data.data.categories.forEach((category: any) => {
        expect(category).toHaveProperty('name');
        expect(typeof category.name).toBe('string');
      });
    });
  });

  // ============================================================================
  // GET /api/v1/ingredients/:slug - Get Ingredient by Slug
  // ============================================================================

  describe('GET /api/v1/ingredients/:slug', () => {
    it('should get ingredient by slug', async () => {
      // Use slug from first test
      if (!testIngredientSlug) {
        // Get one if not available
        const listResponse = await makeAuthenticatedRequest('/api/v1/ingredients', {
          method: 'GET',
          apiKey: readContext.testApiKey,
          query: { limit: '1' },
        });
        const listData = await assertJsonResponse(listResponse);
        testIngredientSlug = listData.data.items[0].slug;
      }

      const response = await makeAuthenticatedRequest(`/api/v1/ingredients/${testIngredientSlug}`, {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      expect(data.data.slug).toBe(testIngredientSlug);
      expect(data.data).toHaveProperty('name');
      expect(data.data).toHaveProperty('category');
    });

    it('should return 404 for non-existent ingredient', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/ingredients/non-existent-ingredient', {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 404);
    });

    it('should include detailed information', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/ingredients/${testIngredientSlug}`, {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.data).toHaveProperty('id');
      expect(data.data).toHaveProperty('name');
      expect(data.data).toHaveProperty('slug');
      expect(data.data).toHaveProperty('category');
    });

    it('should reject without authentication', async () => {
      const url = new URL(`/api/v1/ingredients/${testIngredientSlug}`, 'http://localhost:3000');
      const response = await fetch(url.toString());

      assertStatus(response, 401);
    });
  });

  // ============================================================================
  // GET /api/v1/ingredients/:slug/recipes - Get Recipes Using Ingredient
  // ============================================================================

  describe('GET /api/v1/ingredients/:slug/recipes', () => {
    it('should list recipes using ingredient', async () => {
      const response = await makeAuthenticatedRequest(
        `/api/v1/ingredients/${testIngredientSlug}/recipes`,
        {
          method: 'GET',
          apiKey: readContext.testApiKey,
          query: { page: '1', limit: '10' },
        }
      );

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('items');
      expect(Array.isArray(data.data.items)).toBe(true);
      expect(data.data).toHaveProperty('pagination');
    });

    it('should return 404 for non-existent ingredient', async () => {
      const response = await makeAuthenticatedRequest(
        '/api/v1/ingredients/non-existent/recipes',
        {
          method: 'GET',
          apiKey: readContext.testApiKey,
        }
      );

      assertStatus(response, 404);
    });

    it('should paginate recipe results', async () => {
      const response = await makeAuthenticatedRequest(
        `/api/v1/ingredients/${testIngredientSlug}/recipes`,
        {
          method: 'GET',
          apiKey: readContext.testApiKey,
          query: { page: '1', limit: '5' },
        }
      );

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.data.items.length).toBeLessThanOrEqual(5);
      expect(data.data.pagination.limit).toBe(5);
    });

    it('should include recipe details', async () => {
      const response = await makeAuthenticatedRequest(
        `/api/v1/ingredients/${testIngredientSlug}/recipes`,
        {
          method: 'GET',
          apiKey: readContext.testApiKey,
          query: { limit: '1' },
        }
      );

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      if (data.data.items.length > 0) {
        const recipe = data.data.items[0];
        expect(recipe).toHaveProperty('id');
        expect(recipe).toHaveProperty('title');
        expect(recipe).toHaveProperty('slug');
      }
    });

    it('should filter recipes by difficulty', async () => {
      const response = await makeAuthenticatedRequest(
        `/api/v1/ingredients/${testIngredientSlug}/recipes`,
        {
          method: 'GET',
          apiKey: readContext.testApiKey,
          query: { difficulty: 'easy' },
        }
      );

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      if (data.data.items.length > 0) {
        data.data.items.forEach((recipe: any) => {
          expect(recipe.difficulty).toBe('easy');
        });
      }
    });

    it('should sort recipes', async () => {
      const response = await makeAuthenticatedRequest(
        `/api/v1/ingredients/${testIngredientSlug}/recipes`,
        {
          method: 'GET',
          apiKey: readContext.testApiKey,
          query: { sortBy: 'title', order: 'asc' },
        }
      );

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
    });

    it('should reject without read:recipes scope', async () => {
      const noRecipeContext = await createTestApiKey({
        scopes: ['read:ingredients'],
      });

      const response = await makeAuthenticatedRequest(
        `/api/v1/ingredients/${testIngredientSlug}/recipes`,
        {
          method: 'GET',
          apiKey: noRecipeContext.testApiKey,
        }
      );

      assertStatus(response, 403);

      await noRecipeContext.cleanup();
    });
  });
});
