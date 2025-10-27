/**
 * API Meals & Shopping Lists Endpoints Integration Tests
 *
 * Tests for /api/v1/meals/* and /api/v1/shopping-lists/* endpoints
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

describe('API Meals Endpoints', () => {
  let readContext: TestContext;
  let writeContext: TestContext;

  beforeAll(async () => {
    await globalSetup();

    readContext = await createTestApiKey({
      scopes: ['read:meals'],
    });

    writeContext = await createTestApiKey({
      scopes: ['read:meals', 'write:meals', 'read:recipes'],
    });
  });

  afterAll(async () => {
    await readContext.cleanup();
    await writeContext.cleanup();
    await globalTeardown();
  });

  describe('POST /api/v1/meals', () => {
    it('should create a new meal plan', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/meals', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          name: 'Sunday Dinner',
          date: new Date().toISOString(),
          servings: 4,
          notes: 'Family dinner',
        },
      });

      assertStatus(response, 201);
      const data = await assertJsonResponse(response);

      expect(data).toHaveProperty('id');
      expect(data.name).toBe('Sunday Dinner');
      expect(data.servings).toBe(4);
      expect(data).toHaveProperty('slug');
      expect(data).toHaveProperty('recipes');
      expect(Array.isArray(data.recipes)).toBe(true);
    });

    it('should reject meal creation without write scope', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/meals', {
        method: 'POST',
        apiKey: readContext.testApiKey,
        body: {
          name: 'Unauthorized Meal',
          servings: 2,
        },
      });

      assertStatus(response, 403);
    });

    it('should validate required fields', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/meals', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          // Missing name
          servings: 4,
        },
      });

      assertStatus(response, 400);
      const data = await assertJsonResponse(response);
      expect(data.error).toBeTruthy();
    });
  });

  describe('GET /api/v1/meals', () => {
    it('should list all meals for authenticated user', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/meals', {
        method: 'GET',
        apiKey: readContext.testApiKey,
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data).toHaveProperty('meals');
      expect(Array.isArray(data.meals)).toBe(true);
      expect(data).toHaveProperty('pagination');
    });

    it('should filter meals by date range', async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await makeAuthenticatedRequest('/api/v1/meals', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: {
          startDate: today.toISOString(),
          endDate: tomorrow.toISOString(),
        },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      if (data.meals.length > 0) {
        data.meals.forEach((meal: any) => {
          const mealDate = new Date(meal.date);
          expect(mealDate >= today).toBe(true);
          expect(mealDate <= tomorrow).toBe(true);
        });
      }
    });

    it('should paginate meal results', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/meals', {
        method: 'GET',
        apiKey: readContext.testApiKey,
        query: { page: '1', limit: '10' },
      });

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.meals.length).toBeLessThanOrEqual(10);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(10);
    });
  });

  describe('GET /api/v1/meals/:id', () => {
    it('should retrieve specific meal by ID', async () => {
      // Create a meal first
      const createResponse = await makeAuthenticatedRequest('/api/v1/meals', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          name: 'Test Meal for Retrieval',
          servings: 2,
        },
      });

      const createData = await assertJsonResponse(createResponse);
      const mealId = createData.id;

      // Retrieve it
      const response = await makeAuthenticatedRequest(
        `/api/v1/meals/${mealId}`,
        {
          method: 'GET',
          apiKey: readContext.testApiKey,
        }
      );

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data.id).toBe(mealId);
      expect(data.name).toBe('Test Meal for Retrieval');
      expect(data).toHaveProperty('recipes');
      expect(data).toHaveProperty('totalIngredients');
      expect(data).toHaveProperty('totalTime');
    });

    it('should return 404 for non-existent meal', async () => {
      const response = await makeAuthenticatedRequest(
        '/api/v1/meals/00000000-0000-0000-0000-000000000000',
        {
          method: 'GET',
          apiKey: readContext.testApiKey,
        }
      );

      assertStatus(response, 404);
    });
  });

  describe('PATCH /api/v1/meals/:id', () => {
    it('should update meal details', async () => {
      // Create a meal
      const createResponse = await makeAuthenticatedRequest('/api/v1/meals', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          name: 'Meal to Update',
          servings: 2,
        },
      });

      const createData = await assertJsonResponse(createResponse);
      const mealId = createData.id;

      // Update it
      const updateResponse = await makeAuthenticatedRequest(
        `/api/v1/meals/${mealId}`,
        {
          method: 'PATCH',
          apiKey: writeContext.testApiKey,
          body: {
            name: 'Updated Meal Name',
            servings: 6,
            notes: 'Updated notes',
          },
        }
      );

      assertStatus(updateResponse, 200);
      const updateData = await assertJsonResponse(updateResponse);

      expect(updateData.name).toBe('Updated Meal Name');
      expect(updateData.servings).toBe(6);
      expect(updateData.notes).toBe('Updated notes');
    });
  });

  describe('DELETE /api/v1/meals/:id', () => {
    it('should delete meal', async () => {
      // Create a meal
      const createResponse = await makeAuthenticatedRequest('/api/v1/meals', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          name: 'Meal to Delete',
          servings: 2,
        },
      });

      const createData = await assertJsonResponse(createResponse);
      const mealId = createData.id;

      // Delete it
      const deleteResponse = await makeAuthenticatedRequest(
        `/api/v1/meals/${mealId}`,
        {
          method: 'DELETE',
          apiKey: writeContext.testApiKey,
        }
      );

      assertStatus(deleteResponse, 204);

      // Verify it's gone
      const getResponse = await makeAuthenticatedRequest(
        `/api/v1/meals/${mealId}`,
        {
          method: 'GET',
          apiKey: readContext.testApiKey,
        }
      );

      assertStatus(getResponse, 404);
    });
  });

  describe('POST /api/v1/meals/:id/recipes', () => {
    it('should add recipe to meal', async () => {
      // Create a meal
      const mealResponse = await makeAuthenticatedRequest('/api/v1/meals', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          name: 'Meal for Recipe Association',
          servings: 4,
        },
      });

      const mealData = await assertJsonResponse(mealResponse);
      const mealId = mealData.id;

      // Get a recipe to add
      const recipesResponse = await makeAuthenticatedRequest('/api/v1/recipes', {
        method: 'GET',
        apiKey: writeContext.testApiKey,
        query: { limit: '1' },
      });

      const recipesData = await assertJsonResponse(recipesResponse);

      if (recipesData.recipes.length === 0) {
        return; // Skip if no recipes available
      }

      const recipeId = recipesData.recipes[0].id;

      // Add recipe to meal
      const addResponse = await makeAuthenticatedRequest(
        `/api/v1/meals/${mealId}/recipes`,
        {
          method: 'POST',
          apiKey: writeContext.testApiKey,
          body: {
            recipeId,
            course: 'main',
          },
        }
      );

      assertStatus(addResponse, 201);
      const addData = await assertJsonResponse(addResponse);

      expect(addData.recipes).toContainEqual(
        expect.objectContaining({
          recipeId,
          course: 'main',
        })
      );
    });
  });

  describe('GET /api/v1/meals/:id/recipes', () => {
    it('should list recipes in meal', async () => {
      // Create a meal
      const mealResponse = await makeAuthenticatedRequest('/api/v1/meals', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          name: 'Meal with Recipes',
          servings: 4,
        },
      });

      const mealData = await assertJsonResponse(mealResponse);
      const mealId = mealData.id;

      // Get recipes in meal
      const response = await makeAuthenticatedRequest(
        `/api/v1/meals/${mealId}/recipes`,
        {
          method: 'GET',
          apiKey: readContext.testApiKey,
        }
      );

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data).toHaveProperty('recipes');
      expect(Array.isArray(data.recipes)).toBe(true);
    });
  });

  describe('DELETE /api/v1/meals/:id/recipes/:recipeId', () => {
    it('should remove recipe from meal', async () => {
      // This test would require creating a meal with recipes
      // Implementation depends on your actual endpoint structure
    });
  });

  describe('GET /api/v1/meals/:id/shopping-list', () => {
    it('should generate shopping list from meal', async () => {
      // Create a meal
      const mealResponse = await makeAuthenticatedRequest('/api/v1/meals', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          name: 'Meal for Shopping List',
          servings: 4,
        },
      });

      const mealData = await assertJsonResponse(mealResponse);
      const mealId = mealData.id;

      // Generate shopping list
      const response = await makeAuthenticatedRequest(
        `/api/v1/meals/${mealId}/shopping-list`,
        {
          method: 'GET',
          apiKey: readContext.testApiKey,
        }
      );

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data).toHaveProperty('ingredients');
      expect(Array.isArray(data.ingredients)).toBe(true);
      expect(data).toHaveProperty('mealId');
      expect(data.mealId).toBe(mealId);

      if (data.ingredients.length > 0) {
        data.ingredients.forEach((ingredient: any) => {
          expect(ingredient).toHaveProperty('name');
          expect(ingredient).toHaveProperty('quantity');
          expect(ingredient).toHaveProperty('category');
        });
      }
    });
  });
});

describe('API Shopping Lists Endpoints', () => {
  let writeContext: TestContext;

  beforeAll(async () => {
    await globalSetup();

    writeContext = await createTestApiKey({
      scopes: ['read:meals', 'write:meals'],
    });
  });

  afterAll(async () => {
    await writeContext.cleanup();
    await globalTeardown();
  });

  describe('POST /api/v1/shopping-lists', () => {
    it('should create shopping list', async () => {
      const response = await makeAuthenticatedRequest('/api/v1/shopping-lists', {
        method: 'POST',
        apiKey: writeContext.testApiKey,
        body: {
          name: 'Weekly Groceries',
          items: [
            { name: 'Milk', quantity: '1 gallon', category: 'dairy' },
            { name: 'Eggs', quantity: '12', category: 'dairy' },
          ],
        },
      });

      assertStatus(response, 201);
      const data = await assertJsonResponse(response);

      expect(data).toHaveProperty('id');
      expect(data.name).toBe('Weekly Groceries');
      expect(data.items.length).toBe(2);
    });
  });

  describe('GET /api/v1/shopping-lists', () => {
    it('should list all shopping lists', async () => {
      const response = await makeAuthenticatedRequest(
        '/api/v1/shopping-lists',
        {
          method: 'GET',
          apiKey: writeContext.testApiKey,
        }
      );

      assertStatus(response, 200);
      const data = await assertJsonResponse(response);

      expect(data).toHaveProperty('lists');
      expect(Array.isArray(data.lists)).toBe(true);
    });
  });

  describe('PATCH /api/v1/shopping-lists/:id/items/:itemId', () => {
    it('should mark item as checked', async () => {
      // Create a shopping list
      const createResponse = await makeAuthenticatedRequest(
        '/api/v1/shopping-lists',
        {
          method: 'POST',
          apiKey: writeContext.testApiKey,
          body: {
            name: 'Test List',
            items: [{ name: 'Item 1', quantity: '1' }],
          },
        }
      );

      const createData = await assertJsonResponse(createResponse);
      const listId = createData.id;
      const itemId = createData.items[0].id;

      // Mark as checked
      const updateResponse = await makeAuthenticatedRequest(
        `/api/v1/shopping-lists/${listId}/items/${itemId}`,
        {
          method: 'PATCH',
          apiKey: writeContext.testApiKey,
          body: {
            checked: true,
          },
        }
      );

      assertStatus(updateResponse, 200);
      const updateData = await assertJsonResponse(updateResponse);

      const updatedItem = updateData.items.find((i: any) => i.id === itemId);
      expect(updatedItem.checked).toBe(true);
    });
  });
});
