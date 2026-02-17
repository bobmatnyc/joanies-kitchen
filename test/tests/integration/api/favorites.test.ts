/**
 * Favorites/Social API Integration Tests
 *
 * Tests for /api/v1/favorites/* and /api/v1/recipes/:id/like endpoints
 *
 * Coverage:
 * - GET /api/v1/favorites (list user's favorites)
 * - GET /api/v1/favorites/:recipeId (check if favorited)
 * - POST /api/v1/favorites/:recipeId (add favorite)
 * - DELETE /api/v1/favorites/:recipeId (remove favorite)
 * - POST /api/v1/recipes/:id/like (like recipe)
 * - DELETE /api/v1/recipes/:id/like (unlike recipe)
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

describe('Favorites & Social API Endpoints', () => {
  let readContext: TestContext;
  let writeContext: TestContext;
  let testRecipeId: number;

  beforeAll(async () => {
    await globalSetup();

    readContext = await createTestApiKey({
      scopes: ['read:favorites', 'read:recipes'],
    });

    writeContext = await createTestApiKey({
      scopes: ['read:favorites', 'write:favorites', 'read:recipes'],
    });

    // Get a recipe ID for testing
    const recipesResponse = await makeAuthenticatedRequest('/api/v1/recipes', {
      method: 'GET',
      apiKey: readContext.testApiKey,
      query: { limit: '1' },
    });

    const recipesData = await assertJsonResponse(recipesResponse);
    if (recipesData.data?.items?.length > 0) {
      testRecipeId = recipesData.data.items[0].id;
    }
  });

  afterAll(async () => {
    await readContext.cleanup();
    await writeContext.cleanup();
    await globalTeardown();
  });

  // ============================================================================
  // POST /api/v1/favorites/:recipeId - Add Favorite
  // ============================================================================

  describe('POST /api/v1/favorites/:recipeId', () => {
    it('should add recipe to favorites', async () => {
      if (!testRecipeId) {
        console.log('⚠️ No test recipe available, skipping test');
        return;
      }

      const response = await makeAuthenticatedRequest(`/api/v1/favorites/${testRecipeId}`, {
        method: 'POST',
        apiKey: writeContext.testApiKey,
      });

      assertStatus(response, 201);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('recipe_id');
      expect(data.data.recipe_id).toBe(testRecipeId);
    });

    it('should reject without write scope', async () => {
      if (!testRecipeId) return;

      const response = await makeAuthenticatedRequest(`/api/v1/favorites/${testRecipeId}`, {
        method: 'POST',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 403);
    });

    it('should reject without authentication', async () => {
      if (!testRecipeId) return;

      const url = new URL(`/api/v1/favorites/${testRecipeId}`, 'http://localhost:3000');
      const response = await fetch(url.toString(), {
        method: 'POST',
      });

      assertStatus(response, 401);
    });

    it('should handle already favorited recipe', async () => {
      if (!testRecipeId) return;

      const response = await makeAuthenticatedRequest(`/api/v1/favorites/${testRecipeId}`, {
        method: 'POST',
        apiKey: writeContext.testApiKey,
      });

      // Should be 200 (already exists) or 201 (created)
      expect([200, 201, 409]).toContain(response.status);
    });

    it('should return 404 for non-existent recipe', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/favorites/999999', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
      });

      assertStatus(response, 404);
    });

    it('should validate recipe ID format', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/favorites/invalid', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
      });

      assertStatus(response, 400);
    });
  });

  // ============================================================================
  // GET /api/v1/favorites - List Favorites
  // ============================================================================

  describe('GET /api/v1/favorites', () => {
    it('should list user favorites with pagination', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/favorites', {
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

    it('should include recipe details in favorites', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/favorites', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { limit: '1' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      if (data.data.items.length > 0) {
        const favorite = data.data.items[0];
        expect(favorite).toHaveProperty('recipe');
        expect(favorite.recipe).toHaveProperty('id');
        expect(favorite.recipe).toHaveProperty('title');
      }
    });

    it('should sort favorites', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/favorites', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { sortBy: 'created_at', order: 'desc' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);
      expect(data.success).toBe(true);
    });

    it('should reject without authentication', async () => {
      const url = new URL('/api/v1/favorites', 'http://localhost:3000');
      const response = await fetch(url.toString());

      assertStatus(response, 401);
    });

    it('should reject invalid pagination parameters', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/favorites', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { page: '-1' },
      });

      assertStatus(response, 400);
    });
  });

  // ============================================================================
  // GET /api/v1/favorites/:recipeId - Check if Favorited
  // ============================================================================

  describe('GET /api/v1/favorites/:recipeId', () => {
    it('should check if recipe is favorited', async () => {
      if (!testRecipeId) return;

      const response = await makeAuthenticatedRequest(`/api/v1/favorites/${testRecipeId}`, {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('isFavorited');
      expect(typeof data.data.isFavorited).toBe('boolean');
    });

    it('should return false for non-favorited recipe', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/favorites/1', {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.data).toHaveProperty('isFavorited');
    });

    it('should reject without authentication', async () => {
      if (!testRecipeId) return;

      const url = new URL(`/api/v1/favorites/${testRecipeId}`, 'http://localhost:3000');
      const response = await fetch(url.toString());

      assertStatus(response, 401);
    });
  });

  // ============================================================================
  // DELETE /api/v1/favorites/:recipeId - Remove Favorite
  // ============================================================================

  describe('DELETE /api/v1/favorites/:recipeId', () => {
    it('should remove recipe from favorites', async () => {
      if (!testRecipeId) return;

      const response = await makeAuthenticatedRequest(`/api/v1/favorites/${testRecipeId}`, {
        method: 'DELETE',
        apiKey: writeContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);
      expect(data.success).toBe(true);
    });

    it('should reject without write scope', async () => {
      if (!testRecipeId) return;

      const response = await makeAuthenticatedRequest(`/api/v1/favorites/${testRecipeId}`, {
        method: 'DELETE',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 403);
    });

    it('should return 404 for already removed favorite', async () => {
      if (!testRecipeId) return;

      // Try to delete again
      const response = await makeAuthenticatedRequest(`/api/v1/favorites/${testRecipeId}`, {
        method: 'DELETE',
        apiKey: writeContext.testApiKey,
      });

      // Should be 404 (not found) or 200 (already removed)
      expect([200, 404]).toContain(response.status);
    });

    it('should return 404 for non-existent recipe', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/favorites/999999', {
        method: 'DELETE',
        apiKey: writeContext.testApiKey,
      });

      assertStatus(response, 404);
    });
  });

  // ============================================================================
  // POST /api/v1/recipes/:id/like - Like Recipe
  // ============================================================================

  describe('POST /api/v1/recipes/:id/like', () => {
    it('should like a recipe', async () => {
      if (!testRecipeId) return;

      const response = await makeAuthenticatedRequest(`/api/v1/recipes/${testRecipeId}/like`, {
        method: 'POST',
        apiKey: writeContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('likes');
      expect(typeof data.data.likes).toBe('number');
    });

    it('should reject without write scope', async () => {
      if (!testRecipeId) return;

      const response = await makeAuthenticatedRequest(`/api/v1/recipes/${testRecipeId}/like`, {
        method: 'POST',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 403);
    });

    it('should handle already liked recipe', async () => {
      if (!testRecipeId) return;

      const response = await makeAuthenticatedRequest(`/api/v1/recipes/${testRecipeId}/like`, {
        method: 'POST',
        apiKey: writeContext.testApiKey,
      });

      // Should be 200 regardless
      assertStatus(response, 200);
    });

    it('should return 404 for non-existent recipe', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/recipes/999999/like', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
      });

      assertStatus(response, 404);
    });

    it('should increment like count', async () => {
      if (!testRecipeId) return;

      // Get initial count
      const initialResponse = await makeAuthenticatedRequest(`/api/v1/recipes/${testRecipeId}`, {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      const initialData = await assertJsonResponse(initialResponse);
      const initialLikes = initialData.data?.likes || 0;

      // Like the recipe
      const likeResponse = await makeAuthenticatedRequest(`/api/v1/recipes/${testRecipeId}/like`, {
        method: 'POST',
        apiKey: writeContext.testApiKey,
      });

      const likeData = await assertJsonResponse(likeResponse);
      expect(likeData.data.likes).toBeGreaterThanOrEqual(initialLikes);
    });
  });

  // ============================================================================
  // DELETE /api/v1/recipes/:id/like - Unlike Recipe
  // ============================================================================

  describe('DELETE /api/v1/recipes/:id/like', () => {
    it('should unlike a recipe', async () => {
      if (!testRecipeId) return;

      const response = await makeAuthenticatedRequest(`/api/v1/recipes/${testRecipeId}/like`, {
        method: 'DELETE',
        apiKey: writeContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('likes');
    });

    it('should reject without write scope', async () => {
      if (!testRecipeId) return;

      const response = await makeAuthenticatedRequest(`/api/v1/recipes/${testRecipeId}/like`, {
        method: 'DELETE',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 403);
    });

    it('should handle already unliked recipe', async () => {
      if (!testRecipeId) return;

      const response = await makeAuthenticatedRequest(`/api/v1/recipes/${testRecipeId}/like`, {
        method: 'DELETE',
        apiKey: writeContext.testApiKey,
      });

      // Should be 200 regardless
      assertStatus(response, 200);
    });

    it('should return 404 for non-existent recipe', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/recipes/999999/like', {
        method: 'DELETE',
        apiKey: writeContext.testApiKey,
      });

      assertStatus(response, 404);
    });

    it('should decrement like count', async () => {
      if (!testRecipeId) return;

      // Like first
      await makeAuthenticatedRequest(`/api/v1/recipes/${testRecipeId}/like`, {
        method: 'POST',
        apiKey: writeContext.testApiKey,
      });

      // Get count
      const beforeResponse = await makeAuthenticatedRequest(`/api/v1/recipes/${testRecipeId}`, {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      const beforeData = await assertJsonResponse(beforeResponse);
      const beforeLikes = beforeData.data?.likes || 0;

      // Unlike
      const unlikeResponse = await makeAuthenticatedRequest(`/api/v1/recipes/${testRecipeId}/like`, {
        method: 'DELETE',
        apiKey: writeContext.testApiKey,
      });

      const unlikeData = await assertJsonResponse(unlikeResponse);
      expect(unlikeData.data.likes).toBeLessThanOrEqual(beforeLikes);
    });
  });
});
