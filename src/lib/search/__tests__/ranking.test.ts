/**
 * Test suite for ranking algorithm
 */

import { describe, expect, it } from 'vitest';
import type { Recipe } from '@/lib/db/schema';
import type { RecipeWithSimilarity } from '../ranking';
import {
  applyPersonalizationBoost,
  calculateRecipeScore,
  DEFAULT_WEIGHTS,
  explainRankingScore,
  getTrendingRecipes,
  mergeAndRankResults,
  RANKING_PRESETS,
  rankRecipes,
} from '../ranking';

// Mock recipe factory
function createMockRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: `recipe-${Math.random()}`,
    user_id: 'user-123',
    chef_id: null,
    name: 'Test Recipe',
    description: 'A test recipe',
    ingredients: '["flour", "sugar"]',
    instructions: '["Mix", "Bake"]',
    prep_time: 15,
    cook_time: 30,
    servings: 4,
    difficulty: 'medium',
    cuisine: 'Italian',
    tags: '["vegetarian", "easy"]',
    image_url: null,
    images: '["image1.jpg"]',
    is_ai_generated: false,
    is_public: true,
    is_system_recipe: false,
    nutrition_info: '{"calories": 250}',
    model_used: null,
    source: null,
    created_at: new Date(),
    updated_at: new Date(),
    search_query: null,
    discovery_date: null,
    confidence_score: null,
    validation_model: null,
    embedding_model: null,
    discovery_week: null,
    discovery_year: null,
    published_date: null,
    system_rating: null,
    system_rating_reason: null,
    avg_user_rating: null,
    total_user_ratings: 0,
    slug: null,
    ...overrides,
  };
}

describe('Ranking Algorithm', () => {
  describe('calculateRecipeScore', () => {
    it('should calculate weighted score from components', () => {
      const recipe = createMockRecipe({
        system_rating: '4.5' as any,
        avg_user_rating: '4.0' as any,
        total_user_ratings: 50,
      });

      const score = calculateRecipeScore(recipe, 0.85, DEFAULT_WEIGHTS);

      expect(score.finalScore).toBeGreaterThan(0);
      expect(score.finalScore).toBeLessThanOrEqual(1);
      expect(score.components).toHaveProperty('similarity');
      expect(score.components).toHaveProperty('quality');
      expect(score.components).toHaveProperty('engagement');
      expect(score.components).toHaveProperty('recency');
    });

    it('should handle missing ratings', () => {
      const recipe = createMockRecipe({
        system_rating: null,
        avg_user_rating: null,
        total_user_ratings: 0,
      });

      const score = calculateRecipeScore(recipe, 0.75);

      expect(score.finalScore).toBeGreaterThan(0); // Similarity and recency still contribute
    });

    it('should respect weight distribution', () => {
      const recipe = createMockRecipe();

      const highSimilarityWeights = {
        similarity: 0.9,
        quality: 0.05,
        engagement: 0.03,
        recency: 0.02,
      };

      const score = calculateRecipeScore(recipe, 0.9, highSimilarityWeights);

      // Similarity should dominate
      expect(score.components.similarity).toBeCloseTo(0.9);
      expect(score.finalScore).toBeGreaterThan(0.8);
    });
  });

  describe('applyPersonalizationBoost', () => {
    it('should boost matching cuisine preferences', () => {
      const recipe = createMockRecipe({ cuisine: 'Italian' });
      const preferences = {
        favoriteCuisines: ['Italian', 'Mexican'],
      };

      const boosted = applyPersonalizationBoost(0.7, recipe, preferences);
      expect(boosted).toBeGreaterThan(0.7);
      expect(boosted).toBeLessThanOrEqual(0.77); // Max 10% boost
    });

    it('should boost matching difficulty', () => {
      const recipe = createMockRecipe({ difficulty: 'easy' });
      const preferences = {
        preferredDifficulty: ['easy'] as Array<'easy' | 'medium' | 'hard'>,
      };

      const boosted = applyPersonalizationBoost(0.7, recipe, preferences);
      expect(boosted).toBeGreaterThan(0.7);
    });

    it('should penalize missing dietary restrictions', () => {
      const recipe = createMockRecipe({ tags: '["meat", "dairy"]' });
      const preferences = {
        dietaryRestrictions: ['vegetarian', 'vegan'],
      };

      const boosted = applyPersonalizationBoost(0.7, recipe, preferences);
      expect(boosted).toBeLessThan(0.7);
    });

    it('should not modify score without preferences', () => {
      const recipe = createMockRecipe();
      const boosted = applyPersonalizationBoost(0.7, recipe);
      expect(boosted).toBe(0.7);
    });
  });

  describe('rankRecipes', () => {
    it('should sort recipes by ranking score', () => {
      const recipes: RecipeWithSimilarity[] = [
        {
          ...createMockRecipe({
            id: 'recipe-1',
            system_rating: '3.0' as any,
            avg_user_rating: '3.0' as any,
          }),
          similarity: 0.5,
        },
        {
          ...createMockRecipe({
            id: 'recipe-2',
            system_rating: '5.0' as any,
            avg_user_rating: '5.0' as any,
          }),
          similarity: 0.9,
        },
        {
          ...createMockRecipe({
            id: 'recipe-3',
            system_rating: '4.0' as any,
            avg_user_rating: '4.0' as any,
          }),
          similarity: 0.7,
        },
      ];

      const ranked = rankRecipes(recipes);

      expect(ranked[0].id).toBe('recipe-2'); // Highest similarity and ratings
      expect(ranked[1].id).toBe('recipe-3');
      expect(ranked[2].id).toBe('recipe-1');
    });

    it('should apply different ranking modes', () => {
      const recipe: RecipeWithSimilarity = {
        ...createMockRecipe({
          system_rating: '5.0' as any,
        }),
        similarity: 0.5,
      };

      const semanticMode = rankRecipes([recipe], { mode: 'semantic' });
      const qualityMode = rankRecipes([recipe], { mode: 'quality' });

      // Semantic mode prioritizes similarity (but it's low here)
      // Quality mode prioritizes system rating (which is high)
      expect(qualityMode[0].rankingScore).toBeGreaterThan(semanticMode[0].rankingScore);
    });

    it('should include score breakdown when requested', () => {
      const recipe: RecipeWithSimilarity = {
        ...createMockRecipe(),
        similarity: 0.8,
      };

      const ranked = rankRecipes([recipe], { includeScoreBreakdown: true });

      expect(ranked[0]).toHaveProperty('scoreComponents');
      expect(ranked[0].scoreComponents).toHaveProperty('similarity');
      expect(ranked[0].scoreComponents).toHaveProperty('quality');
    });

    it('should normalize custom weights', () => {
      const recipe: RecipeWithSimilarity = {
        ...createMockRecipe(),
        similarity: 0.8,
      };

      // Provide weights that don't sum to 1
      const ranked = rankRecipes([recipe], {
        weights: {
          similarity: 2,
          quality: 1,
          engagement: 1,
          recency: 0,
        },
      });

      expect(ranked[0].rankingScore).toBeGreaterThan(0);
      expect(ranked[0].rankingScore).toBeLessThanOrEqual(1);
    });
  });

  describe('explainRankingScore', () => {
    it('should generate human-readable explanation', () => {
      const recipe: RecipeWithSimilarity = {
        ...createMockRecipe(),
        similarity: 0.85,
      };

      const ranked = rankRecipes([recipe], { includeScoreBreakdown: true })[0];

      // Ensure scoreComponents exists
      expect(ranked.scoreComponents).toBeDefined();

      const explanation = explainRankingScore(ranked, DEFAULT_WEIGHTS);

      expect(explanation).toContain('Score:');
      expect(explanation).toContain('Similarity:');
      expect(explanation).toContain('Quality:');
      expect(explanation).toContain('Engagement:');
      expect(explanation).toContain('Recency:');
    });

    it('should handle missing components', () => {
      const recipe: RecipeWithSimilarity = {
        ...createMockRecipe(),
        similarity: 0.8,
      };

      const ranked = rankRecipes([recipe], { includeScoreBreakdown: false })[0];
      const explanation = explainRankingScore(ranked);

      expect(explanation).toContain('components not available');
    });
  });

  describe('getTrendingRecipes', () => {
    it('should identify trending recipes', () => {
      const recentRecipe = createMockRecipe({
        id: 'recent',
        updated_at: new Date(),
        total_user_ratings: 50,
        avg_user_rating: '4.5' as any,
      });

      const oldRecipe = createMockRecipe({
        id: 'old',
        updated_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        total_user_ratings: 10,
        avg_user_rating: '4.0' as any,
      });

      const trending = getTrendingRecipes([recentRecipe, oldRecipe], 2);

      expect(trending[0].id).toBe('recent');
      expect(trending[0].trendingScore).toBeGreaterThan(trending[1].trendingScore);
    });

    it('should limit results', () => {
      const recipes = Array.from({ length: 20 }, (_, i) => createMockRecipe({ id: `recipe-${i}` }));

      const trending = getTrendingRecipes(recipes, 5);
      expect(trending).toHaveLength(5);
    });
  });

  describe('mergeAndRankResults', () => {
    it('should merge results from multiple sources', () => {
      const recipe1: RecipeWithSimilarity = {
        ...createMockRecipe({ id: 'recipe-1' }),
        similarity: 0.8,
      };

      const recipe2: RecipeWithSimilarity = {
        ...createMockRecipe({ id: 'recipe-2' }),
        similarity: 0.7,
      };

      const recipe3: RecipeWithSimilarity = {
        ...createMockRecipe({ id: 'recipe-3' }),
        similarity: 0.6,
      };

      const merged = mergeAndRankResults([
        { results: [recipe1, recipe2], weight: 0.6 },
        { results: [recipe2, recipe3], weight: 0.4 },
      ]);

      expect(merged).toHaveLength(3);
      // recipe2 appears in both sets, should be ranked higher
      expect(merged[0].id).toBe('recipe-2');
    });

    it('should normalize result set weights', () => {
      const recipe: RecipeWithSimilarity = {
        ...createMockRecipe(),
        similarity: 0.8,
      };

      const merged = mergeAndRankResults([
        { results: [recipe], weight: 2 },
        { results: [], weight: 1 },
      ]);

      expect(merged).toHaveLength(1);
      expect(merged[0].similarity).toBeGreaterThan(0);
    });

    it('should handle empty result sets', () => {
      const merged = mergeAndRankResults([
        { results: [], weight: 0.5 },
        { results: [], weight: 0.5 },
      ]);

      expect(merged).toHaveLength(0);
    });
  });

  describe('RANKING_PRESETS', () => {
    it('should have valid presets', () => {
      const modes: Array<keyof typeof RANKING_PRESETS> = [
        'balanced',
        'semantic',
        'quality',
        'popular',
        'trending',
        'discovery',
      ];

      modes.forEach((mode) => {
        const weights = RANKING_PRESETS[mode];
        expect(weights).toBeDefined();
        expect(weights.similarity).toBeGreaterThanOrEqual(0);
        expect(weights.quality).toBeGreaterThanOrEqual(0);
        expect(weights.engagement).toBeGreaterThanOrEqual(0);
        expect(weights.recency).toBeGreaterThanOrEqual(0);

        // Sum should be close to 1 (allow for floating point)
        const sum = weights.similarity + weights.quality + weights.engagement + weights.recency;
        expect(sum).toBeCloseTo(1, 2);
      });
    });
  });
});
