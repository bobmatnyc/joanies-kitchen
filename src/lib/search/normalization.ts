/**
 * Normalization utilities for recipe ranking scores
 *
 * This module provides functions to normalize various metrics to a 0-1 scale
 * for use in weighted ranking algorithms.
 */

/**
 * Normalize a rating on a 0-5 scale to 0-1
 *
 * @param rating - Rating value (0-5)
 * @param maxRating - Maximum rating value (default: 5)
 * @returns Normalized value (0-1)
 *
 * @example
 * normalizeRating(4.5) // => 0.9
 * normalizeRating(3.0) // => 0.6
 */
export function normalizeRating(rating: number, maxRating: number = 5): number {
  if (rating <= 0) return 0;
  if (rating >= maxRating) return 1;
  return rating / maxRating;
}

/**
 * Normalize a count value using logarithmic scaling
 *
 * This prevents recipes with extremely high counts from dominating
 * the rankings while still rewarding popularity.
 *
 * Uses formula: log(count + 1) / log(max + 1)
 *
 * @param count - Count value (e.g., favorites, views)
 * @param max - Maximum expected count (optional, for bounded normalization)
 * @returns Normalized value (0-1)
 *
 * @example
 * normalizeCount(0) // => 0
 * normalizeCount(10) // => ~0.48
 * normalizeCount(100) // => ~0.69
 * normalizeCount(1000) // => ~0.82
 */
export function normalizeCount(count: number, max?: number): number {
  if (count <= 0) return 0;

  if (max !== undefined && max > 0) {
    // Bounded logarithmic normalization
    const normalizedCount = Math.log(count + 1) / Math.log(max + 1);
    return Math.min(normalizedCount, 1);
  }

  // Unbounded logarithmic normalization (asymptotic to 1)
  // Using log base 10 for reasonable scaling
  return Math.min(Math.log10(count + 1) / 3, 1); // Caps at ~1000
}

/**
 * Calculate recency score using exponential decay
 *
 * More recent items get higher scores. The halfLife parameter controls
 * how quickly the score decays over time.
 *
 * Uses formula: 2^(-daysSince / halfLife)
 *
 * @param date - Date of the item
 * @param halfLife - Number of days for score to halve (default: 30)
 * @returns Recency score (0-1)
 *
 * @example
 * calculateRecencyScore(new Date()) // => 1.0 (today)
 * calculateRecencyScore(new Date(Date.now() - 30*24*60*60*1000)) // => 0.5 (30 days ago)
 * calculateRecencyScore(new Date(Date.now() - 90*24*60*60*1000)) // => 0.125 (90 days ago)
 */
export function calculateRecencyScore(date: Date, halfLife: number = 30): number {
  const now = new Date();
  const daysSince = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSince < 0) return 1; // Future date treated as current

  // Exponential decay: 2^(-days / halfLife)
  const score = 2 ** (-daysSince / halfLife);
  return Math.max(0, Math.min(score, 1));
}

/**
 * Calculate recipe completeness score
 *
 * Evaluates how complete a recipe is based on presence of key fields.
 * A complete recipe has better visibility in search results.
 *
 * Scoring criteria:
 * - Has description: 20%
 * - Has ingredients: 20%
 * - Has instructions: 20%
 * - Has images: 15%
 * - Has nutrition info: 10%
 * - Has timing (prep/cook): 10%
 * - Has difficulty/cuisine: 5%
 *
 * @param recipe - Recipe object with standard fields
 * @returns Completeness score (0-1)
 *
 * @example
 * calculateCompletenessScore({
 *   description: "...",
 *   ingredients: "[...]",
 *   images: "[...]"
 * }) // => ~0.55
 */
export function calculateCompletenessScore(recipe: {
  description?: string | null;
  ingredients?: string | null;
  instructions?: string | null;
  images?: string | null;
  nutrition_info?: string | null;
  prep_time?: number | null;
  cook_time?: number | null;
  difficulty?: string | null;
  cuisine?: string | null;
}): number {
  let score = 0;

  // Description (20%)
  if (recipe.description && recipe.description.trim().length > 0) {
    score += 0.2;
  }

  // Ingredients (20%)
  if (recipe.ingredients && recipe.ingredients.trim().length > 2) {
    try {
      const ingredientsArray = JSON.parse(recipe.ingredients);
      if (Array.isArray(ingredientsArray) && ingredientsArray.length > 0) {
        score += 0.2;
      }
    } catch {
      // Invalid JSON - no points
    }
  }

  // Instructions (20%)
  if (recipe.instructions && recipe.instructions.trim().length > 2) {
    try {
      const instructionsArray = JSON.parse(recipe.instructions);
      if (Array.isArray(instructionsArray) && instructionsArray.length > 0) {
        score += 0.2;
      }
    } catch {
      // Invalid JSON - no points
    }
  }

  // Images (15%)
  if (recipe.images && recipe.images.trim().length > 2) {
    try {
      const imagesArray = JSON.parse(recipe.images);
      if (Array.isArray(imagesArray) && imagesArray.length > 0) {
        score += 0.15;
      }
    } catch {
      // Invalid JSON - no points
    }
  }

  // Nutrition info (10%)
  if (recipe.nutrition_info && recipe.nutrition_info.trim().length > 2) {
    score += 0.1;
  }

  // Timing (10%)
  if ((recipe.prep_time && recipe.prep_time > 0) || (recipe.cook_time && recipe.cook_time > 0)) {
    score += 0.1;
  }

  // Difficulty/Cuisine (5%)
  if (recipe.difficulty || recipe.cuisine) {
    score += 0.05;
  }

  return score;
}

/**
 * Calculate trending score based on recent activity
 *
 * Combines recency with engagement metrics to identify trending recipes.
 *
 * @param updatedAt - Last update timestamp
 * @param totalRatings - Number of recent ratings
 * @param avgRating - Average rating value
 * @returns Trending score (0-1)
 *
 * @example
 * calculateTrendingScore(
 *   new Date(Date.now() - 2*24*60*60*1000), // 2 days ago
 *   15, // 15 ratings
 *   4.5  // 4.5 stars
 * ) // => ~0.85
 */
export function calculateTrendingScore(
  updatedAt: Date,
  totalRatings: number = 0,
  avgRating: number = 0
): number {
  // Recency component (60% weight)
  const recencyScore = calculateRecencyScore(updatedAt, 7); // 7-day half-life for trending

  // Engagement component (30% weight)
  const engagementScore = normalizeCount(totalRatings);

  // Quality component (10% weight)
  const qualityScore = normalizeRating(avgRating);

  return recencyScore * 0.6 + engagementScore * 0.3 + qualityScore * 0.1;
}

/**
 * Normalize similarity score from cosine distance
 *
 * Cosine similarity is already in range [-1, 1], but we typically
 * use [0, 1] range and filter by minimum threshold.
 *
 * @param similarity - Cosine similarity (-1 to 1)
 * @returns Normalized similarity (0-1)
 */
export function normalizeSimilarity(similarity: number): number {
  // Cosine similarity is typically in [0, 1] for our use case
  // But handle full range for safety
  if (similarity < 0) return 0;
  if (similarity > 1) return 1;
  return similarity;
}

/**
 * Calculate quality score from multiple quality indicators
 *
 * Combines system rating, completeness, and AI confidence into
 * a unified quality metric.
 *
 * @param systemRating - AI-generated quality rating (0-5)
 * @param completeness - Recipe completeness score (0-1)
 * @param confidence - AI confidence score (0-1)
 * @returns Quality score (0-1)
 *
 * @example
 * calculateQualityScore(4.5, 0.9, 0.95) // => 0.91
 */
export function calculateQualityScore(
  systemRating: number = 0,
  completeness: number = 0,
  confidence: number = 1
): number {
  // Weight distribution:
  // - System rating: 50%
  // - Completeness: 30%
  // - Confidence: 20%

  const normalizedRating = normalizeRating(systemRating);

  return normalizedRating * 0.5 + completeness * 0.3 + confidence * 0.2;
}

/**
 * Calculate user engagement score
 *
 * Combines user ratings, favorites (future), and views (future)
 * into a unified engagement metric.
 *
 * @param avgUserRating - Average user rating (0-5)
 * @param totalRatings - Total number of ratings
 * @param favoriteCount - Number of favorites (optional, future)
 * @param viewCount - Number of views (optional, future)
 * @returns Engagement score (0-1)
 *
 * @example
 * calculateEngagementScore(4.5, 120, 45, 2500) // => 0.83
 */
export function calculateEngagementScore(
  avgUserRating: number = 0,
  totalRatings: number = 0,
  favoriteCount: number = 0,
  viewCount: number = 0
): number {
  // Weight distribution (adaptive based on available metrics):
  // - Average rating: 40%
  // - Rating count: 30%
  // - Favorites: 20%
  // - Views: 10%

  const ratingScore = normalizeRating(avgUserRating);
  const ratingCountScore = normalizeCount(totalRatings);
  const favoritesScore = normalizeCount(favoriteCount);
  const viewsScore = normalizeCount(viewCount);

  return ratingScore * 0.4 + ratingCountScore * 0.3 + favoritesScore * 0.2 + viewsScore * 0.1;
}
