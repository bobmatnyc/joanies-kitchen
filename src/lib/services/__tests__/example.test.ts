/**
 * Example Service Tests
 *
 * This file demonstrates how to test services.
 * Services can be tested directly without HTTP mocking.
 *
 * To run tests:
 * - npm test src/lib/services/__tests__/
 * - npm test -- --watch (for watch mode)
 */

import { describe, expect, it } from 'vitest';
import { chefService, ingredientService } from '../index';

describe('Service Layer Examples', () => {
  describe('ChefService', () => {
    it('should export singleton instance', () => {
      expect(chefService).toBeDefined();
      expect(typeof chefService.findAll).toBe('function');
    });

    it('should have all required methods', () => {
      expect(chefService.findAll).toBeDefined();
      expect(chefService.findBySlug).toBeDefined();
      expect(chefService.findById).toBeDefined();
      expect(chefService.findRecipesByChef).toBeDefined();
      expect(chefService.create).toBeDefined();
      expect(chefService.update).toBeDefined();
      expect(chefService.delete).toBeDefined();
      expect(chefService.linkRecipeToChef).toBeDefined();
      expect(chefService.unlinkRecipeFromChef).toBeDefined();
      expect(chefService.search).toBeDefined();
    });
  });

  describe('IngredientService', () => {
    it('should export singleton instance', () => {
      expect(ingredientService).toBeDefined();
      expect(typeof ingredientService.findAll).toBe('function');
    });

    it('should have all required methods', () => {
      expect(ingredientService.findAll).toBeDefined();
      expect(ingredientService.findBySlug).toBeDefined();
      expect(ingredientService.findById).toBeDefined();
      expect(ingredientService.search).toBeDefined();
      expect(ingredientService.getCategories).toBeDefined();
      expect(ingredientService.getRecipesUsingIngredient).toBeDefined();
      expect(ingredientService.getRecipeCount).toBeDefined();
      expect(ingredientService.getCommonIngredients).toBeDefined();
      expect(ingredientService.getAllergens).toBeDefined();
    });
  });

  // Add more integration tests here when database connection is available
  // Example:
  // describe('ChefService Integration', () => {
  //   it('should find chef by slug', async () => {
  //     const chef = await chefService.findBySlug('kenji-lopez-alt');
  //     expect(chef).toBeDefined();
  //     expect(chef?.slug).toBe('kenji-lopez-alt');
  //   });
  //
  //   it('should return null for non-existent chef', async () => {
  //     const chef = await chefService.findBySlug('does-not-exist-xyz-123');
  //     expect(chef).toBeNull();
  //   });
  // });
});
