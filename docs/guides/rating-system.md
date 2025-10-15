# Recipe Rating System

A comprehensive dual-rating system that combines AI-powered quality evaluation with community user ratings.

## Overview

The Recipe Rating System provides two complementary rating mechanisms:

1. **AI-Powered System Ratings** - Automatic quality evaluation during recipe import
2. **Community User Ratings** - User-contributed ratings and reviews

## Features

### 1. AI-Powered System Ratings (0-5 Scale)

- **Automatic Quality Evaluation**: Every recipe is evaluated by AI during the crawl/import process
- **Multi-Factor Assessment**: Rates recipes based on:
  - Clarity of instructions
  - Ingredient quality and completeness
  - Cooking techniques
  - Overall recipe completeness
  - Practicality for home cooks
- **Transparent Reasoning**: Each rating includes a brief explanation
- **Model**: Uses Claude 3 Haiku via OpenRouter

### 2. Community User Ratings (0-5 Stars)

- **User Contributions**: Authenticated users can rate recipes
- **Star Rating System**: Simple 0-5 star interface
- **Optional Reviews**: Users can add review text with their rating
- **One Rating Per User**: Enforced by database unique constraint
- **Updatable Ratings**: Users can modify their previous ratings
- **Automatic Aggregation**: Average rating and total count calculated automatically

## Database Schema

### Updated `recipes` Table
```sql
ALTER TABLE recipes
ADD COLUMN system_rating DECIMAL(2,1),           -- AI quality score (0.0-5.0)
ADD COLUMN system_rating_reason TEXT,             -- AI reasoning
ADD COLUMN avg_user_rating DECIMAL(2,1),         -- Community average
ADD COLUMN total_user_ratings INTEGER DEFAULT 0; -- Rating count
```

### New `recipe_ratings` Table
```sql
CREATE TABLE recipe_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,  -- Clerk user ID
  rating INTEGER NOT NULL CHECK (rating >= 0 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(recipe_id, user_id)  -- One rating per user per recipe
);
```

## Usage

### AI Quality Evaluator

```typescript
import { evaluateRecipeQuality } from '@/lib/ai/recipe-quality-evaluator';

const evaluation = await evaluateRecipeQuality({
  name: 'Chocolate Chip Cookies',
  description: '...',
  ingredients: ['...'],
  instructions: ['...'],
  prepTime: '15 minutes',
  cookTime: '10 minutes',
  servings: 24,
});

console.log(evaluation.rating);    // 4.5
console.log(evaluation.reasoning); // "Clear instructions with good detail..."
```

### Rate a Recipe

```typescript
import { rateRecipe } from '@/app/actions/rate-recipe';

const result = await rateRecipe(
  'recipe-id-123',
  5,  // rating (0-5)
  'Amazing recipe! Made it 3 times already.'  // optional review
);

if (result.success) {
  console.log(`New average: ${result.avgUserRating}`);
  console.log(`Total ratings: ${result.totalRatings}`);
}
```

### UI Component

```tsx
import { RecipeRating } from '@/components/recipe/RecipeRating';

<RecipeRating
  recipeId={recipe.id}
  systemRating={recipe.systemRating}
  systemRatingReason={recipe.systemRatingReason}
  avgUserRating={recipe.avgUserRating}
  totalUserRatings={recipe.totalUserRatings}
  userRating={currentUserRating?.rating}
  userReview={currentUserRating?.review}
  isAuthenticated={!!user}
/>
```

## Testing

Run database tests:
```bash
npx tsx scripts/test-rating-db.ts
```

Run migration:
```bash
npx tsx scripts/run-rating-migration.ts
```

## Cost Considerations

### AI Evaluation Costs
- **Model**: Claude 3 Haiku (most cost-effective)
- **Estimated Cost**: ~$0.0002 per recipe evaluation
- **When Charged**: Only during recipe crawl/import (one-time)
- **Budget-Friendly**: ~$0.20 for 1,000 recipes

## Security

- All rating operations require Clerk authentication
- User ID stored with each rating for accountability
- Server-side validation of all rating submissions
- Rating constrained to 0-5 (database CHECK constraint)

## Performance

### Indexes
- `recipe_ratings_recipe_id_idx`: Fast lookup of all ratings for a recipe
- `recipe_ratings_user_id_idx`: Fast lookup of all ratings by a user

### Caching Strategy
- Average ratings stored in `recipes` table (no JOIN needed)
- Total count stored (no COUNT(*) needed)
- Recalculated only on rating change

---

**Last Updated:** October 2025
**Version:** 1.0.0
