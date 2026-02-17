/**
 * Inventory API Integration Tests
 *
 * Tests for /api/v1/inventory/* endpoints
 *
 * Coverage:
 * - GET /api/v1/inventory (list user's inventory)
 * - GET /api/v1/inventory/:id (get inventory item)
 * - POST /api/v1/inventory (add to inventory)
 * - PATCH /api/v1/inventory/:id (update inventory item)
 * - DELETE /api/v1/inventory/:id (remove from inventory)
 * - POST /api/v1/inventory/:id/use (mark item as used)
 * - GET /api/v1/inventory/matches (get recipe matches)
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

describe('Inventory API Endpoints', () => {
  let readContext: TestContext;
  let writeContext: TestContext;
  let testInventoryId: number;

  beforeAll(async () => {
    await globalSetup();

    readContext = await createTestApiKey({
      scopes: ['read:inventory'],
    });

    writeContext = await createTestApiKey({
      scopes: ['read:inventory', 'write:inventory', 'delete:inventory', 'read:ingredients'],
    });
  });

  afterAll(async () => {
    await readContext.cleanup();
    await writeContext.cleanup();
    await globalTeardown();
  });

  // ============================================================================
  // POST /api/v1/inventory - Add to Inventory
  // ============================================================================

  describe('POST /api/v1/inventory', () => {
    it('should add item to inventory', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/inventory', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          ingredient_id: 1,
          quantity: 2,
          unit: 'cups',
          location: 'pantry',
          notes: 'Test inventory item',
        },
      });

      assertStatus(response, 201);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id');
      expect(data.data.ingredient_id).toBe(1);
      expect(data.data.quantity).toBe(2);
      expect(data.data.unit).toBe('cups');
      expect(data.data.location).toBe('pantry');

      testInventoryId = data.data.id;
    });

    it('should reject without write scope', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/inventory', {
        method: 'POST',
        apiKey: readContext.testApiKey,
        body: {
          ingredient_id: 1,
          quantity: 1,
        },
      });

      assertStatus(response, 403);
    });

    it('should validate required fields', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/inventory', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          // Missing ingredient_id
          quantity: 1,
        },
      });

      assertStatus(response, 400);
    });

    it('should validate quantity is positive', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/inventory', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          ingredient_id: 1,
          quantity: -1,
        },
      });

      assertStatus(response, 400);
    });

    it('should allow adding expiration date', async () => {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7);

      const response = await makeAuthenticatedRequest('/api/v1/inventory', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          ingredient_id: 2,
          quantity: 1,
          unit: 'kg',
          expires_at: expirationDate.toISOString(),
        },
      });

      assertStatus(response, 201);
      const data = await assertJsonResponse(response);
      expect(data.data.expires_at).toBeTruthy();
    });
  });

  // ============================================================================
  // GET /api/v1/inventory - List Inventory
  // ============================================================================

  describe('GET /api/v1/inventory', () => {
    it('should list user inventory with pagination', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/inventory', {
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

    it('should filter by location', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/inventory', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { location: 'pantry' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      if (data.data.items.length > 0) {
        data.data.items.forEach((item: any) => {
          expect(item.location).toBe('pantry');
        });
      }
    });

    it('should filter by expiration status', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/inventory', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { includeExpired: 'false' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);
      expect(data.success).toBe(true);
    });

    it('should search by ingredient name', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/inventory', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { search: 'flour' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);
      expect(data.success).toBe(true);
    });

    it('should reject without authentication', async () => {
      const url = new URL('/api/v1/inventory', 'http://localhost:3000');
      const response = await fetch(url.toString());

      assertStatus(response, 401);
    });
  });

  // ============================================================================
  // GET /api/v1/inventory/:id - Get Inventory Item
  // ============================================================================

  describe('GET /api/v1/inventory/:id', () => {
    it('should get inventory item by id', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/inventory/${testInventoryId}`, {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      expect(data.data.id).toBe(testInventoryId);
      expect(data.data).toHaveProperty('ingredient');
    });

    it('should return 404 for non-existent item', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/inventory/999999', {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 404);
    });

    it('should include ingredient details', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/inventory/${testInventoryId}`, {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.data.ingredient).toHaveProperty('name');
      expect(data.data.ingredient).toHaveProperty('category');
    });
  });

  // ============================================================================
  // PATCH /api/v1/inventory/:id - Update Inventory Item
  // ============================================================================

  describe('PATCH /api/v1/inventory/:id', () => {
    it('should update inventory item', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/inventory/${testInventoryId}`, {
        method: 'PATCH',
        apiKey: writeContext.testApiKey,
        body: {
          quantity: 5,
          notes: 'Updated notes',
        },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      expect(data.data.quantity).toBe(5);
      expect(data.data.notes).toBe('Updated notes');
    });

    it('should reject update without write scope', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/inventory/${testInventoryId}`, {
        method: 'PATCH',
        apiKey: readContext.testApiKey,
        body: {
          quantity: 10,
        },
      });

      assertStatus(response, 403);
    });

    it('should return 404 for non-existent item', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/inventory/999999', {
        method: 'PATCH',
        apiKey: writeContext.testApiKey,
        body: {
          quantity: 1,
        },
      });

      assertStatus(response, 404);
    });

    it('should allow partial updates', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/inventory/${testInventoryId}`, {
        method: 'PATCH',
        apiKey: writeContext.testApiKey,
        body: {
          location: 'refrigerator',
        },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);
      expect(data.data.location).toBe('refrigerator');
    });

    it('should validate quantity on update', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/inventory/${testInventoryId}`, {
        method: 'PATCH',
        apiKey: writeContext.testApiKey,
        body: {
          quantity: -5,
        },
      });

      assertStatus(response, 400);
    });
  });

  // ============================================================================
  // POST /api/v1/inventory/:id/use - Mark Item as Used
  // ============================================================================

  describe('POST /api/v1/inventory/:id/use', () => {
    it('should mark item as used and reduce quantity', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/inventory/${testInventoryId}/use`, {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          quantity: 1,
        },
      });

      // Should be 200 or 204
      expect([200, 204]).toContain(response.status);
    });

    it('should reject without write scope', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/inventory/${testInventoryId}/use`, {
        method: 'POST',
        apiKey: readContext.testApiKey,
        body: {
          quantity: 1,
        },
      });

      assertStatus(response, 403);
    });

    it('should validate quantity', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/inventory/${testInventoryId}/use`, {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          quantity: -1,
        },
      });

      assertStatus(response, 400);
    });

    it('should return 404 for non-existent item', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/inventory/999999/use', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          quantity: 1,
        },
      });

      assertStatus(response, 404);
    });

    it('should prevent using more than available', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/inventory/${testInventoryId}/use`, {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          quantity: 1000, // Exceeds available
        },
      });

      // Should be 400 (bad request) or 422 (unprocessable)
      expect([400, 422]).toContain(response.status);
    });
  });

  // ============================================================================
  // GET /api/v1/inventory/matches - Get Recipe Matches
  // ============================================================================

  describe('GET /api/v1/inventory/matches', () => {
    it('should find recipes matching inventory', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/inventory/matches', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { limit: '10' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('recipes');
      expect(Array.isArray(data.data.recipes)).toBe(true);
    });

    it('should filter by minimum match percentage', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/inventory/matches', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { minMatchPercentage: '50' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      if (data.data.recipes.length > 0) {
        data.data.recipes.forEach((recipe: any) => {
          expect(recipe.matchPercentage).toBeGreaterThanOrEqual(50);
        });
      }
    });

    it('should include match details', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/inventory/matches', {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      if (data.data.recipes.length > 0) {
        const recipe = data.data.recipes[0];
        expect(recipe).toHaveProperty('matchPercentage');
        expect(recipe).toHaveProperty('missingIngredients');
      }
    });

    it('should reject without authentication', async () => {
      const url = new URL('/api/v1/inventory/matches', 'http://localhost:3000');
      const response = await fetch(url.toString());

      assertStatus(response, 401);
    });
  });

  // ============================================================================
  // DELETE /api/v1/inventory/:id - Remove from Inventory
  // ============================================================================

  describe('DELETE /api/v1/inventory/:id', () => {
    it('should delete inventory item', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/inventory/${testInventoryId}`, {
        method: 'DELETE',
        apiKey: writeContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);
      expect(data.success).toBe(true);
    });

    it('should return 404 after deletion', async () => {
      const response = await makeAuthenticatedRequest(`/api/v1/inventory/${testInventoryId}`, {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 404);
    });

    it('should reject deletion without delete scope', async () => {
      // Create a new item to test
      const createResponse = await makeAuthenticatedRequest('/api/v1/inventory', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          ingredient_id: 3,
          quantity: 1,
        },
      });

      const createData = await assertJsonResponse(createResponse);
      const newItemId = createData.data.id;

      const response = await makeAuthenticatedRequest(`/api/v1/inventory/${newItemId}`, {
        method: 'DELETE',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 403);

      // Cleanup
      await makeAuthenticatedRequest(`/api/v1/inventory/${newItemId}`, {
        method: 'DELETE',
        apiKey: writeContext.testApiKey,
      });
    });
  });
});
