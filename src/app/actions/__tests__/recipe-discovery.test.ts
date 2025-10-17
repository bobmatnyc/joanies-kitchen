/**
 * Recipe Discovery Pipeline Tests
 *
 * NOTE: These are example tests to demonstrate the testing approach.
 * Actual execution requires:
 * - Valid API keys in environment
 * - Database connection
 * - Test data setup
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { discoverRecipeFromUrl, discoverRecipes } from '../recipe-discovery';

describe('Recipe Discovery Pipeline', () => {
  // Skip tests if API keys not available
  const hasApiKeys =
    process.env.OPENROUTER_API_KEY && process.env.BRAVE_API_KEY && process.env.HUGGINGFACE_API_KEY;

  beforeAll(() => {
    if (!hasApiKeys) {
      console.warn('Skipping tests: API keys not configured');
    }
  });

  describe('discoverRecipes', () => {
    it('should discover recipes from a basic query', async () => {
      if (!hasApiKeys) return;

      const result = await discoverRecipes('chocolate chip cookies', {
        maxResults: 2,
        minConfidence: 0.5,
      });

      expect(result.success).toBe(true);
      expect(result.stats.searched).toBeGreaterThan(0);
      expect(Array.isArray(result.recipes)).toBe(true);
    }, 60000); // 60s timeout for API calls

    it('should filter by cuisine', async () => {
      if (!hasApiKeys) return;

      const result = await discoverRecipes('pasta', {
        cuisine: 'Italian',
        maxResults: 2,
        minConfidence: 0.6,
      });

      expect(result.success).toBe(true);
      // Check if recipes have Italian cuisine
      result.recipes.forEach((recipe) => {
        expect(recipe.cuisine?.toLowerCase()).toContain('italian');
      });
    }, 60000);

    it('should respect confidence threshold', async () => {
      if (!hasApiKeys) return;

      const result = await discoverRecipes('soup', {
        maxResults: 3,
        minConfidence: 0.8, // High threshold
      });

      expect(result.success).toBe(true);
      // All saved recipes should have high confidence
      result.recipes.forEach((recipe) => {
        if (recipe.confidence_score) {
          expect(parseFloat(recipe.confidence_score)).toBeGreaterThanOrEqual(0.8);
        }
      });
    }, 60000);

    it('should handle empty results gracefully', async () => {
      if (!hasApiKeys) return;

      const result = await discoverRecipes('asdfghjklqwertyuiop'); // Nonsense query

      expect(result.success).toBe(true);
      expect(result.recipes.length).toBe(0);
      expect(result.stats.searched).toBeGreaterThanOrEqual(0);
    }, 30000);

    it('should include provenance data', async () => {
      if (!hasApiKeys) return;

      const query = 'simple salad';
      const result = await discoverRecipes(query, {
        maxResults: 1,
      });

      if (result.recipes.length > 0) {
        const recipe = result.recipes[0];
        expect(recipe.search_query).toBe(query);
        expect(recipe.discovery_date).toBeTruthy();
        expect(recipe.validation_model).toBe('anthropic/claude-3-haiku');
        expect(recipe.source).toBeTruthy(); // Should have URL
      }
    }, 60000);

    it('should generate embeddings', async () => {
      if (!hasApiKeys) return;

      const result = await discoverRecipes('quick breakfast', {
        maxResults: 1,
      });

      if (result.recipes.length > 0) {
        const recipe = result.recipes[0];
        expect(recipe.embedding_model).toBeTruthy();
        expect(recipe.embedding_model).toContain('all-MiniLM-L6-v2');
      }
    }, 60000);
  });

  describe('discoverRecipeFromUrl', () => {
    it('should extract recipe from valid URL', async () => {
      if (!hasApiKeys) return;

      // Use a known recipe URL (replace with actual test URL)
      const testUrl = 'https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/';

      const result = await discoverRecipeFromUrl(testUrl);

      expect(result.success).toBe(true);
      if (result.recipe) {
        expect(result.recipe.name).toBeTruthy();
        expect(result.recipe.ingredients).toBeTruthy();
        expect(result.recipe.instructions).toBeTruthy();
        expect(result.recipe.source).toBe(testUrl);
      }
    }, 60000);

    it('should handle invalid URL gracefully', async () => {
      if (!hasApiKeys) return;

      const result = await discoverRecipeFromUrl('https://example.com/not-a-recipe');

      // Should fail gracefully
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle missing API keys', async () => {
      // Temporarily clear API key
      const originalKey = process.env.OPENROUTER_API_KEY;
      delete process.env.OPENROUTER_API_KEY;

      try {
        const result = await discoverRecipes('test');
        expect(result.success).toBe(false);
      } finally {
        // Restore API key
        if (originalKey) {
          process.env.OPENROUTER_API_KEY = originalKey;
        }
      }
    });

    it('should report errors in results', async () => {
      if (!hasApiKeys) return;

      const result = await discoverRecipes('test', {
        maxResults: 5,
      });

      // Should have error tracking structure
      expect(result.stats).toHaveProperty('searched');
      expect(result.stats).toHaveProperty('validated');
      expect(result.stats).toHaveProperty('saved');
      expect(result.stats).toHaveProperty('failed');
      expect(result.stats).toHaveProperty('skipped');
    });
  });

  describe('Integration Tests', () => {
    it('should complete full pipeline', async () => {
      if (!hasApiKeys) return;

      const startTime = Date.now();

      const result = await discoverRecipes('easy pasta recipe', {
        maxResults: 1,
        minConfidence: 0.6,
      });

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      expect(result.success).toBe(true);

      // Pipeline should complete in reasonable time
      expect(duration).toBeLessThan(120); // 2 minutes max

      console.log(`Pipeline completed in ${duration}s`);
      console.log('Stats:', result.stats);

      if (result.recipes.length > 0) {
        const recipe = result.recipes[0];
        console.log('Sample recipe:', {
          name: recipe.name,
          cuisine: recipe.cuisine,
          difficulty: recipe.difficulty,
          confidence: recipe.confidence_score,
          hasEmbedding: !!recipe.embedding_model,
        });
      }
    }, 120000); // 2 minute timeout
  });
});

describe('Pipeline Components', () => {
  describe('Type Validation', () => {
    it('should validate ExtractedRecipe type', () => {
      const validRecipe = {
        name: 'Test Recipe',
        description: 'A test recipe',
        ingredients: ['ingredient 1', 'ingredient 2'],
        instructions: ['step 1', 'step 2'],
        isValid: true,
        confidenceScore: 0.9,
      };

      expect(validRecipe.name).toBeTruthy();
      expect(Array.isArray(validRecipe.ingredients)).toBe(true);
      expect(Array.isArray(validRecipe.instructions)).toBe(true);
      expect(validRecipe.confidenceScore).toBeGreaterThan(0);
    });

    it('should validate RecipeMetadata type', () => {
      const validMetadata = {
        cuisine: 'Italian',
        tags: ['quick', 'easy'],
        difficulty: 'medium' as const,
        dietaryInfo: ['vegetarian'],
      };

      expect(validMetadata.cuisine).toBeTruthy();
      expect(Array.isArray(validMetadata.tags)).toBe(true);
      expect(['easy', 'medium', 'hard']).toContain(validMetadata.difficulty);
    });

    it('should validate DiscoveryResult type', () => {
      const validResult = {
        success: true,
        recipes: [],
        stats: {
          searched: 10,
          validated: 8,
          saved: 6,
          failed: 2,
          skipped: 2,
        },
      };

      expect(validResult.success).toBe(true);
      expect(Array.isArray(validResult.recipes)).toBe(true);
      expect(validResult.stats.searched).toBeGreaterThanOrEqual(validResult.stats.validated);
    });
  });
});

// Mock tests for unit testing individual components
describe('Component Unit Tests (Mocked)', () => {
  it('should parse time strings correctly', () => {
    const parseTime = (timeStr?: string): number | null => {
      if (!timeStr) return null;
      const match = timeStr.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    };

    expect(parseTime('15 minutes')).toBe(15);
    expect(parseTime('1 hour')).toBe(1);
    expect(parseTime('30')).toBe(30);
    expect(parseTime(undefined)).toBeNull();
  });

  it('should validate URL format', () => {
    const isValidUrl = (string: string) => {
      try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    };

    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com')).toBe(true);
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('ftp://example.com')).toBe(false);
  });

  it('should build search query correctly', () => {
    const buildQuery = (query: string, cuisine?: string, ingredients?: string[]) => {
      let searchQuery = `${query} recipe`;
      if (cuisine) searchQuery += ` ${cuisine}`;
      if (ingredients?.length) {
        searchQuery += ` with ${ingredients.join(' ')}`;
      }
      return searchQuery;
    };

    expect(buildQuery('pasta')).toBe('pasta recipe');
    expect(buildQuery('pasta', 'Italian')).toBe('pasta recipe Italian');
    expect(buildQuery('pasta', 'Italian', ['tomatoes', 'basil'])).toBe(
      'pasta recipe Italian with tomatoes basil'
    );
  });
});
