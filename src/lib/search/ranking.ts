/**
 * Advanced weighted ranking algorithm for recipe search results
 *
 * This module provides a comprehensive ranking system that combines multiple
 * signals to produce the most relevant search results for users.
 */

import type { Recipe } from '@/lib/db/schema';
import {
  calculateCompletenessScore,
  calculateEngagementScore,
  calculateQualityScore,
  calculateRecencyScore,
  calculateTrendingScore,
  normalizeSimilarity,
} from './normalization';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Ranking weights configuration
 */
export interface RankingWeights {
  /** Semantic similarity weight (default: 0.6 = 60%) */
  similarity: number;
  /** Recipe quality weight (default: 0.2 = 20%) */
  quality: number;
  /** User engagement weight (default: 0.15 = 15%) */
  engagement: number;
  /** Recency/trending weight (default: 0.05 = 5%) */
  recency: number;
}

/**
 * Default ranking weights (balanced mode)
 */
export const DEFAULT_WEIGHTS: RankingWeights = {
  similarity: 0.6,
  quality: 0.2,
  engagement: 0.15,
  recency: 0.05,
};

/**
 * Score components breakdown
 */
export interface ScoreComponents {
  /** Normalized similarity score (0-1) */
  similarity: number;
  /** Quality score combining system rating, completeness, confidence (0-1) */
  quality: number;
  /** Engagement score from user ratings, favorites, views (0-1) */
  engagement: number;
  /** Recency score with exponential decay (0-1) */
  recency: number;
}

/**
 * Recipe with calculated ranking score
 */
export interface RecipeScore {
  recipeId: string;
  /** Final weighted score (0-1) */
  finalScore: number;
  /** Individual component scores */
  components: ScoreComponents;
}

/**
 * Recipe extended with similarity score
 */
export interface RecipeWithSimilarity extends Recipe {
  similarity: number;
}

/**
 * Ranked recipe result
 */
export interface RankedRecipe extends RecipeWithSimilarity {
  /** Final ranking score (0-1) */
  rankingScore: number;
  /** Score breakdown for debugging/explanation */
  scoreComponents?: ScoreComponents;
}

/**
 * Ranking mode presets
 */
export type RankingMode =
  | 'balanced' // Default weights (60% similarity, 20% quality, 15% engagement, 5% recency)
  | 'semantic' // Prioritize similarity (80% similarity, 10% quality, 10% engagement)
  | 'quality' // Prioritize highly-rated (40% quality, 30% similarity, 20% engagement, 10% recency)
  | 'popular' // Prioritize engagement (50% engagement, 30% similarity, 15% quality, 5% recency)
  | 'trending' // Prioritize recent activity (40% recency, 30% similarity, 20% engagement, 10% quality)
  | 'discovery'; // Balanced for exploration (35% similarity, 35% quality, 20% recency, 10% engagement)

/**
 * Ranking mode weight presets
 */
export const RANKING_PRESETS: Record<RankingMode, RankingWeights> = {
  balanced: {
    similarity: 0.6,
    quality: 0.2,
    engagement: 0.15,
    recency: 0.05,
  },
  semantic: {
    similarity: 0.8,
    quality: 0.1,
    engagement: 0.1,
    recency: 0.0,
  },
  quality: {
    similarity: 0.3,
    quality: 0.4,
    engagement: 0.2,
    recency: 0.1,
  },
  popular: {
    similarity: 0.3,
    quality: 0.15,
    engagement: 0.5,
    recency: 0.05,
  },
  trending: {
    similarity: 0.3,
    quality: 0.1,
    engagement: 0.2,
    recency: 0.4,
  },
  discovery: {
    similarity: 0.35,
    quality: 0.35,
    engagement: 0.1,
    recency: 0.2,
  },
};

/**
 * User preferences for personalization (future)
 */
export interface UserPreferences {
  /** Favorite cuisines (e.g., ['Italian', 'Mexican']) */
  favoriteCuisines?: string[];
  /** Preferred difficulty levels */
  preferredDifficulty?: Array<'easy' | 'medium' | 'hard'>;
  /** Dietary restrictions (e.g., ['vegetarian', 'gluten-free']) */
  dietaryRestrictions?: string[];
  /** Ingredient preferences (liked/disliked) */
  ingredientPreferences?: {
    liked?: string[];
    disliked?: string[];
  };
}

/**
 * Ranking options
 */
export interface RankingOptions {
  /** Ranking mode (uses preset weights) */
  mode?: RankingMode;
  /** Custom weights (overrides mode preset) */
  weights?: Partial<RankingWeights>;
  /** User preferences for personalization */
  userPreferences?: UserPreferences;
  /** Key to use for similarity score (default: 'similarity') */
  similarityKey?: string;
  /** Include score breakdown for debugging */
  includeScoreBreakdown?: boolean;
  /** Recency half-life in days (default: 30) */
  recencyHalfLife?: number;
}

// ============================================================================
// CORE RANKING FUNCTIONS
// ============================================================================

/**
 * Calculate recipe ranking score
 *
 * Combines multiple signals (similarity, quality, engagement, recency)
 * using weighted average to produce a final ranking score.
 *
 * @param recipe - Recipe object with all fields
 * @param similarity - Similarity score from vector search (0-1)
 * @param weights - Custom weights (optional, defaults to balanced)
 * @param options - Additional options like recency half-life
 * @returns Recipe score with component breakdown
 *
 * @example
 * const score = calculateRecipeScore(recipe, 0.85, DEFAULT_WEIGHTS);
 * console.log(score.finalScore); // => 0.78
 * console.log(score.components.quality); // => 0.82
 */
export function calculateRecipeScore(
  recipe: Recipe,
  similarity: number,
  weights: RankingWeights = DEFAULT_WEIGHTS,
  options: Pick<RankingOptions, 'recencyHalfLife'> = {}
): RecipeScore {
  // 1. Normalize similarity
  const normalizedSimilarity = normalizeSimilarity(similarity);

  // 2. Calculate quality score
  const systemRating = recipe.system_rating ? parseFloat(recipe.system_rating.toString()) : 0;
  const completeness = calculateCompletenessScore(recipe);
  const confidence = recipe.confidence_score ? parseFloat(recipe.confidence_score.toString()) : 1;

  const qualityScore = calculateQualityScore(systemRating, completeness, confidence);

  // 3. Calculate engagement score
  const avgUserRating = recipe.avg_user_rating ? parseFloat(recipe.avg_user_rating.toString()) : 0;
  const totalRatings = recipe.total_user_ratings || 0;

  // Future: Add favoriteCount and viewCount when available
  const engagementScore = calculateEngagementScore(
    avgUserRating,
    totalRatings,
    0, // favoriteCount (future)
    0 // viewCount (future)
  );

  // 4. Calculate recency score
  const updatedAt = recipe.updated_at || recipe.created_at;
  const recencyHalfLife = options.recencyHalfLife || 30;
  const recencyScore = calculateRecencyScore(updatedAt, recencyHalfLife);

  // 5. Calculate weighted final score
  const finalScore =
    normalizedSimilarity * weights.similarity +
    qualityScore * weights.quality +
    engagementScore * weights.engagement +
    recencyScore * weights.recency;

  return {
    recipeId: recipe.id,
    finalScore,
    components: {
      similarity: normalizedSimilarity,
      quality: qualityScore,
      engagement: engagementScore,
      recency: recencyScore,
    },
  };
}

/**
 * Apply personalization boost to ranking score
 *
 * Increases score for recipes matching user preferences.
 * This is a multiplicative boost (0.9 - 1.1x) to avoid dominating the ranking.
 *
 * @param score - Base ranking score (0-1)
 * @param recipe - Recipe to evaluate
 * @param preferences - User preferences
 * @returns Boosted score (0-1)
 *
 * @example
 * const boosted = applyPersonalizationBoost(0.75, recipe, {
 *   favoriteCuisines: ['Italian'],
 *   preferredDifficulty: ['easy']
 * });
 * // If recipe is Italian and easy: score * 1.1 = 0.825
 */
export function applyPersonalizationBoost(
  score: number,
  recipe: Recipe,
  preferences?: UserPreferences
): number {
  if (!preferences) return score;

  let boost = 1.0; // Neutral boost

  // Cuisine preference boost (+5%)
  if (preferences.favoriteCuisines && preferences.favoriteCuisines.length > 0) {
    if (recipe.cuisine && preferences.favoriteCuisines.includes(recipe.cuisine)) {
      boost += 0.05;
    }
  }

  // Difficulty preference boost (+5%)
  if (preferences.preferredDifficulty && preferences.preferredDifficulty.length > 0) {
    if (recipe.difficulty && preferences.preferredDifficulty.includes(recipe.difficulty)) {
      boost += 0.05;
    }
  }

  // Dietary restrictions check (penalty -10% if doesn't match)
  if (preferences.dietaryRestrictions && preferences.dietaryRestrictions.length > 0) {
    try {
      const tags = recipe.tags ? JSON.parse(recipe.tags) : [];
      const hasAnyRestriction = preferences.dietaryRestrictions.some((restriction) =>
        tags.some((tag: string) => tag.toLowerCase().includes(restriction.toLowerCase()))
      );

      if (!hasAnyRestriction) {
        boost -= 0.1;
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  // Apply boost (clamped to 0.9 - 1.1 range)
  const clampedBoost = Math.max(0.9, Math.min(1.1, boost));
  return Math.min(score * clampedBoost, 1.0);
}

/**
 * Rank recipes using weighted algorithm
 *
 * Main ranking function that processes an array of recipes with similarity
 * scores and returns them sorted by final ranking score.
 *
 * @param recipes - Array of recipes with similarity scores
 * @param options - Ranking options including mode, weights, preferences
 * @returns Sorted array of ranked recipes
 *
 * @example
 * const ranked = rankRecipes(searchResults, {
 *   mode: 'quality',
 *   includeScoreBreakdown: true
 * });
 */
export function rankRecipes(
  recipes: RecipeWithSimilarity[],
  options: RankingOptions = {}
): RankedRecipe[] {
  // Determine weights
  let weights: RankingWeights;

  if (options.weights) {
    // Custom weights provided - merge with defaults
    weights = { ...DEFAULT_WEIGHTS, ...options.weights };
  } else if (options.mode) {
    // Use preset mode
    weights = RANKING_PRESETS[options.mode];
  } else {
    // Default to balanced mode
    weights = DEFAULT_WEIGHTS;
  }

  // Normalize weights to sum to 1.0
  const weightSum = weights.similarity + weights.quality + weights.engagement + weights.recency;
  const normalizedWeights: RankingWeights = {
    similarity: weights.similarity / weightSum,
    quality: weights.quality / weightSum,
    engagement: weights.engagement / weightSum,
    recency: weights.recency / weightSum,
  };

  // Calculate scores for all recipes
  const scoredRecipes = recipes.map((recipe) => {
    const similarityValue = options.similarityKey
      ? (recipe as any)[options.similarityKey] || 0
      : recipe.similarity;

    const score = calculateRecipeScore(recipe, similarityValue, normalizedWeights, {
      recencyHalfLife: options.recencyHalfLife,
    });

    // Apply personalization boost if preferences provided
    const finalScore = applyPersonalizationBoost(score.finalScore, recipe, options.userPreferences);

    const rankedRecipe: RankedRecipe = {
      ...recipe,
      rankingScore: finalScore,
    };

    // Include score breakdown if requested
    if (options.includeScoreBreakdown) {
      rankedRecipe.scoreComponents = score.components;
    }

    return rankedRecipe;
  });

  // Sort by ranking score (highest first)
  return scoredRecipes.sort((a, b) => b.rankingScore - a.rankingScore);
}

/**
 * Explain ranking score
 *
 * Generates human-readable explanation of why a recipe received its score.
 *
 * @param recipe - Ranked recipe with score components
 * @param weights - Weights used for ranking
 * @returns Explanation string
 *
 * @example
 * const explanation = explainRankingScore(rankedRecipe, weights);
 * // => "Score: 0.82 (Similarity: 0.85, Quality: 0.78, Engagement: 0.45, Recency: 0.92)"
 */
export function explainRankingScore(
  recipe: RankedRecipe,
  weights: RankingWeights = DEFAULT_WEIGHTS
): string {
  if (!recipe.scoreComponents) {
    return `Score: ${recipe.rankingScore.toFixed(2)} (components not available)`;
  }

  const components = recipe.scoreComponents;
  const parts: string[] = [
    `Score: ${recipe.rankingScore.toFixed(2)}`,
    `Similarity: ${components.similarity.toFixed(2)} (${(weights.similarity * 100).toFixed(0)}%)`,
    `Quality: ${components.quality.toFixed(2)} (${(weights.quality * 100).toFixed(0)}%)`,
    `Engagement: ${components.engagement.toFixed(2)} (${(weights.engagement * 100).toFixed(0)}%)`,
    `Recency: ${components.recency.toFixed(2)} (${(weights.recency * 100).toFixed(0)}%)`,
  ];

  return parts.join(' | ');
}

/**
 * Get trending recipes based on recent activity
 *
 * Identifies recipes with high recent engagement.
 *
 * @param recipes - Array of recipes to evaluate
 * @param limit - Maximum number of trending recipes (default: 10)
 * @returns Top trending recipes
 */
export function getTrendingRecipes(
  recipes: Recipe[],
  limit: number = 10
): Array<Recipe & { trendingScore: number }> {
  const recipesWithTrending = recipes.map((recipe) => {
    const updatedAt = recipe.updated_at || recipe.created_at;
    const totalRatings = recipe.total_user_ratings || 0;
    const avgRating = recipe.avg_user_rating ? parseFloat(recipe.avg_user_rating.toString()) : 0;

    const trendingScore = calculateTrendingScore(updatedAt, totalRatings, avgRating);

    return {
      ...recipe,
      trendingScore,
    };
  });

  return recipesWithTrending.sort((a, b) => b.trendingScore - a.trendingScore).slice(0, limit);
}

/**
 * Merge and rank results from multiple search strategies
 *
 * Useful for hybrid search combining semantic + keyword + ingredient searches.
 *
 * @param resultSets - Array of result sets with their weights
 * @param options - Ranking options
 * @returns Merged and ranked recipes
 *
 * @example
 * const merged = mergeAndRankResults([
 *   { results: semanticResults, weight: 0.5 },
 *   { results: keywordResults, weight: 0.3 },
 *   { results: ingredientResults, weight: 0.2 }
 * ]);
 */
export function mergeAndRankResults(
  resultSets: Array<{
    results: RecipeWithSimilarity[];
    weight: number;
  }>,
  options: RankingOptions = {}
): RankedRecipe[] {
  // Normalize result set weights
  const totalWeight = resultSets.reduce((sum, set) => sum + set.weight, 0);
  const normalizedSets = resultSets.map((set) => ({
    ...set,
    weight: set.weight / totalWeight,
  }));

  // Merge results, combining scores for recipes appearing in multiple sets
  const mergedMap = new Map<string, { recipe: Recipe; combinedSimilarity: number }>();

  normalizedSets.forEach(({ results, weight }) => {
    results.forEach((recipe) => {
      if (mergedMap.has(recipe.id)) {
        // Recipe appears in multiple sets - boost its similarity
        const existing = mergedMap.get(recipe.id)!;
        existing.combinedSimilarity += recipe.similarity * weight;
      } else {
        // First occurrence
        mergedMap.set(recipe.id, {
          recipe,
          combinedSimilarity: recipe.similarity * weight,
        });
      }
    });
  });

  // Convert to RecipeWithSimilarity array
  const mergedRecipes: RecipeWithSimilarity[] = Array.from(mergedMap.values()).map(
    ({ recipe, combinedSimilarity }) => ({
      ...recipe,
      similarity: combinedSimilarity,
    })
  );

  // Apply ranking algorithm
  return rankRecipes(mergedRecipes, options);
}
