# Recipe Search Ranking System

Advanced weighted ranking algorithm for recipe search results that combines multiple signals to produce highly relevant results.

## Overview

The ranking system combines four key components:

1. **Semantic Similarity (60%)** - How well the recipe matches the search query
2. **Quality Score (20%)** - Recipe completeness, system rating, and AI confidence
3. **User Engagement (15%)** - User ratings, favorites, and views
4. **Recency/Trending (5%)** - How recent and active the recipe is

## Quick Start

### Basic Usage

```typescript
import { rankRecipes } from '@/lib/search';

// After getting search results with similarity scores
const rankedRecipes = rankRecipes(searchResults, {
  mode: 'balanced', // Use default balanced weights
});
```

### With Custom Options

```typescript
const rankedRecipes = rankRecipes(searchResults, {
  mode: 'quality', // Prioritize highly-rated recipes
  includeScoreBreakdown: true, // Include detailed scoring
});

// Access score breakdown
rankedRecipes.forEach(recipe => {
  console.log(recipe.scoreComponents);
  // {
  //   similarity: 0.85,
  //   quality: 0.92,
  //   engagement: 0.67,
  //   recency: 0.88
  // }
});
```

## Ranking Modes

### Balanced (Default)
```typescript
{ similarity: 0.6, quality: 0.2, engagement: 0.15, recency: 0.05 }
```
Best for general-purpose search results.

### Semantic
```typescript
{ similarity: 0.8, quality: 0.1, engagement: 0.1, recency: 0.0 }
```
Prioritizes similarity - best for "find similar recipes" features.

### Quality
```typescript
{ similarity: 0.3, quality: 0.4, engagement: 0.2, recency: 0.1 }
```
Prioritizes highly-rated recipes - best for "best recipes" pages.

### Popular
```typescript
{ similarity: 0.3, quality: 0.15, engagement: 0.5, recency: 0.05 }
```
Prioritizes user engagement - best for trending/popular sections.

### Trending
```typescript
{ similarity: 0.3, quality: 0.1, engagement: 0.2, recency: 0.4 }
```
Prioritizes recent activity - best for "what's new" feeds.

### Discovery
```typescript
{ similarity: 0.35, quality: 0.35, engagement: 0.1, recency: 0.2 }
```
Balanced for exploration - surfaces diverse, quality recipes.

## Integration Examples

### Semantic Search Integration

```typescript
import { semanticSearchRecipes } from '@/app/actions/semantic-search';

const result = await semanticSearchRecipes("spicy pasta", {
  limit: 20,
  rankingMode: 'balanced', // Apply weighted ranking
  includeScoreBreakdown: true,
});

// Results are automatically ranked
console.log(result.recipes[0].rankingScore); // 0.87
```

### Ingredient Search Integration

```typescript
import { searchRecipesByIngredients } from '@/app/actions/ingredient-search';

const result = await searchRecipesByIngredients(
  ['tomatoes', 'basil', 'mozzarella'],
  {
    matchMode: 'all',
    rankingMode: 'quality', // Prioritize best recipes
  }
);

// Recipes ranked by match + quality
```

### Hybrid Search

```typescript
import { mergeAndRankResults } from '@/lib/search';

const merged = mergeAndRankResults([
  { results: semanticResults, weight: 0.6 },
  { results: ingredientResults, weight: 0.4 },
], {
  mode: 'balanced',
});
```

## Personalization (Future)

The system supports personalization boosts:

```typescript
const rankedRecipes = rankRecipes(searchResults, {
  mode: 'balanced',
  userPreferences: {
    favoriteCuisines: ['Italian', 'Mexican'],
    preferredDifficulty: ['easy'],
    dietaryRestrictions: ['vegetarian'],
  },
});

// Recipes matching preferences get +10% boost
// Recipes not matching dietary restrictions get -10% penalty
```

## Score Breakdown

### Quality Score Components

```typescript
{
  systemRating: 4.5,    // AI-generated quality (0-5) → 50% weight
  completeness: 0.92,   // Recipe completeness (0-1) → 30% weight
  confidence: 0.95,     // AI confidence (0-1) → 20% weight
}
// Final quality score: 0.91
```

### Completeness Scoring

- Description: 20%
- Ingredients: 20%
- Instructions: 20%
- Images: 15%
- Nutrition info: 10%
- Timing (prep/cook): 10%
- Difficulty/Cuisine: 5%

### Engagement Score Components

```typescript
{
  avgRating: 4.5,        // User rating (0-5) → 40% weight
  totalRatings: 120,     // Rating count (log scaled) → 30% weight
  favoriteCount: 45,     // Favorites (log scaled) → 20% weight
  viewCount: 2500,       // Views (log scaled) → 10% weight
}
```

### Recency Score

Uses exponential decay with configurable half-life:

```typescript
// Default: 30-day half-life
calculateRecencyScore(updatedAt, 30);

// Trending mode: 7-day half-life
calculateRecencyScore(updatedAt, 7);
```

## Normalization Functions

### Rating Normalization

```typescript
import { normalizeRating } from '@/lib/search';

normalizeRating(4.5); // 0.9 (4.5/5)
normalizeRating(3.0); // 0.6 (3.0/5)
```

### Count Normalization (Logarithmic)

```typescript
import { normalizeCount } from '@/lib/search';

normalizeCount(10);    // ~0.35
normalizeCount(100);   // ~0.67
normalizeCount(1000);  // ~0.82
```

Prevents high-count recipes from dominating rankings.

### Recency Scoring

```typescript
import { calculateRecencyScore } from '@/lib/search';

const now = new Date();
const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000);

calculateRecencyScore(now);           // 1.0
calculateRecencyScore(thirtyDaysAgo); // 0.5 (half-life)
```

## Advanced Features

### Score Explanation

```typescript
import { explainRankingScore } from '@/lib/search';

const explanation = explainRankingScore(rankedRecipe, weights);
console.log(explanation);
// "Score: 0.82 | Similarity: 0.85 (60%) | Quality: 0.78 (20%) | ..."
```

### Trending Recipes

```typescript
import { getTrendingRecipes } from '@/lib/search';

const trending = getTrendingRecipes(allRecipes, 10);
// Returns top 10 recipes with high recent activity
```

### Custom Weights

```typescript
const rankedRecipes = rankRecipes(searchResults, {
  weights: {
    similarity: 0.4,
    quality: 0.3,
    engagement: 0.2,
    recency: 0.1,
  },
});

// Weights are automatically normalized to sum to 1.0
```

## Performance Considerations

### Caching

Search results with rankings are cached:

```typescript
// First request: calculates ranking
const result1 = await semanticSearchRecipes("pasta");

// Second request: uses cached ranked results
const result2 = await semanticSearchRecipes("pasta");
```

### Batch Processing

Ranking is optimized for batch operations:

```typescript
// Efficient: Single ranking operation
const ranked = rankRecipes(recipes, options);

// Inefficient: Individual ranking
recipes.forEach(recipe => {
  calculateRecipeScore(recipe, similarity);
});
```

### Lazy Loading

Score breakdown is only calculated when requested:

```typescript
// Minimal overhead
rankRecipes(recipes, { includeScoreBreakdown: false });

// Includes detailed components
rankRecipes(recipes, { includeScoreBreakdown: true });
```

## Testing

Comprehensive test suite with 44 tests:

```bash
# Run ranking system tests
npm run test src/lib/search/__tests__

# Run with coverage
npm run test:coverage src/lib/search
```

### Test Coverage

- ✅ Normalization functions (8 tests)
- ✅ Quality scoring (3 tests)
- ✅ Engagement scoring (3 tests)
- ✅ Recency/trending (3 tests)
- ✅ Ranking algorithm (8 tests)
- ✅ Personalization (4 tests)
- ✅ Merging strategies (3 tests)
- ✅ Edge cases and validation (12 tests)

## Migration Guide

### From Simple Similarity Sorting

**Before:**
```typescript
const results = recipes
  .map(recipe => ({ ...recipe, similarity }))
  .sort((a, b) => b.similarity - a.similarity);
```

**After:**
```typescript
import { rankRecipes } from '@/lib/search';

const results = rankRecipes(
  recipes.map(r => ({ ...r, similarity }))
);
// Now includes quality, engagement, and recency
```

### From Manual Scoring

**Before:**
```typescript
const score =
  similarity * 0.6 +
  (systemRating / 5) * 0.3 +
  (userRating / 5) * 0.1;
```

**After:**
```typescript
import { calculateRecipeScore } from '@/lib/search';

const { finalScore, components } = calculateRecipeScore(
  recipe,
  similarity,
  weights
);
// Includes completeness, confidence, recency, etc.
```

## API Reference

### Core Functions

#### `rankRecipes(recipes, options)`

Rank recipes using weighted algorithm.

**Parameters:**
- `recipes: RecipeWithSimilarity[]` - Recipes with similarity scores
- `options?: RankingOptions` - Ranking configuration

**Returns:** `RankedRecipe[]` - Sorted recipes with scores

---

#### `calculateRecipeScore(recipe, similarity, weights, options)`

Calculate ranking score for a single recipe.

**Parameters:**
- `recipe: Recipe` - Recipe to score
- `similarity: number` - Similarity score (0-1)
- `weights?: RankingWeights` - Weight configuration
- `options?: { recencyHalfLife?: number }` - Additional options

**Returns:** `RecipeScore` - Score with component breakdown

---

#### `applyPersonalizationBoost(score, recipe, preferences)`

Apply personalization boost to score.

**Parameters:**
- `score: number` - Base score (0-1)
- `recipe: Recipe` - Recipe to evaluate
- `preferences?: UserPreferences` - User preferences

**Returns:** `number` - Boosted score (0-1)

---

### Normalization Functions

See [normalization.ts](./normalization.ts) for detailed API docs.

## Contributing

When adding new ranking signals:

1. Add normalization function in `normalization.ts`
2. Update `calculateRecipeScore` in `ranking.ts`
3. Add tests in `__tests__/`
4. Update this documentation
5. Consider weight distribution impact

## Future Enhancements

- [ ] View count tracking (database schema update needed)
- [ ] Favorite count tracking (database schema update needed)
- [ ] A/B testing framework for weight optimization
- [ ] Machine learning-based weight tuning
- [ ] Time-of-day ranking adjustments
- [ ] Seasonal/holiday boosting
- [ ] User interaction-based learning
