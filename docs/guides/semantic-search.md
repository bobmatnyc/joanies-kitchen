# Semantic Recipe Search

Natural language search powered by pgvector embeddings.

## Overview

The semantic search system uses pgvector embeddings with the all-MiniLM-L6-v2 model to enable natural language recipe search and similarity matching.

## Features

### 1. Semantic Search

Natural language queries return semantically similar recipes:

```typescript
const result = await semanticSearchRecipes("comfort food for cold weather", {
  limit: 20,
  minSimilarity: 0.5,
  includePrivate: true
});
```

**Query Examples:**
- "spicy comfort food"
- "quick healthy breakfast"
- "warming winter soup"
- "light summer salad"
- "decadent chocolate dessert"

### 2. Filtered Search

Combine semantic search with structured filters:

```typescript
const result = await semanticSearchRecipes("pasta dish", {
  cuisine: "Italian",
  difficulty: "easy",
  dietaryRestrictions: ["vegetarian", "gluten-free"],
  minSimilarity: 0.4,
  limit: 10
});
```

**Available Filters:**
- `cuisine` - Recipe cuisine type
- `difficulty` - easy, medium, or hard
- `dietaryRestrictions` - Array of dietary tags
- `minSimilarity` - Similarity threshold (0.0-1.0)
- `includePrivate` - Include user's private recipes

### 3. Hybrid Search

Combines vector similarity with text matching for best results:

```typescript
const result = await hybridSearchRecipes("spaghetti carbonara", {
  limit: 20
});
```

**Ranking Algorithm:**
- Semantic results: 70% weight
- Text matches: 30% weight
- Recipes in both: Boosted rank

### 4. Similar Recipes

Find recipes similar to a given recipe:

```typescript
const result = await findSimilarToRecipe(recipeId, 10);
```

## Usage

### Server-Side (Server Actions)

```typescript
import { semanticSearchRecipes } from '@/app/actions/semantic-search';

export default async function SearchPage() {
  const results = await semanticSearchRecipes("healthy dinner");

  return (
    <div>
      {results.recipes.map(recipe => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          showSimilarity
          similarity={recipe.similarity}
        />
      ))}
    </div>
  );
}
```

### Client-Side (React Component)

```tsx
'use client';

import { SemanticSearchPanel } from '@/components/recipe/SemanticSearchPanel';

export default function SearchPage() {
  return (
    <SemanticSearchPanel
      initialQuery=""
      onResultsChange={(count) => console.log(`Found ${count} recipes`)}
    />
  );
}
```

### Similar Recipes Widget

```tsx
import { SimilarRecipesWidget } from '@/components/recipe/SimilarRecipesWidget';

export default function RecipeDetailPage({ recipeId }: { recipeId: string }) {
  return (
    <div>
      {/* Recipe details... */}

      <SimilarRecipesWidget
        recipeId={recipeId}
        limit={6}
        autoLoad={true}
      />
    </div>
  );
}
```

## Testing

Run test suite:
```bash
npm run test:semantic-search
```

## Configuration

### Similarity Thresholds

```typescript
// Strict matching (high precision, fewer results)
minSimilarity: 0.7

// Balanced (recommended)
minSimilarity: 0.5

// Permissive (high recall, more results)
minSimilarity: 0.3
```

### Search Modes

```typescript
// Pure semantic search
mode: 'semantic'

// Hybrid (semantic + text) - Recommended
mode: 'hybrid'
```

## Performance

**Expected Results:**
- Search time: < 1 second (excellent)
- 1-3 seconds (good)
- > 3 seconds (needs optimization)

**Accuracy:**
- High similarity (>70%): Very relevant
- Medium similarity (50-70%): Relevant
- Low similarity (30-50%): Somewhat relevant

## Troubleshooting

### No Results Found

**Solutions:**
```typescript
// Lower similarity threshold
minSimilarity: 0.3

// Remove filters
cuisine: undefined
difficulty: undefined

// Generate embeddings
npm run db:seed:system
```

### Slow Search Performance

```sql
-- Verify HNSW index exists
SELECT * FROM pg_indexes WHERE tablename = 'recipe_embeddings';

-- Create index if missing
CREATE INDEX IF NOT EXISTS recipe_embeddings_embedding_idx
ON recipe_embeddings
USING hnsw (embedding vector_cosine_ops);
```

## API Reference

### semanticSearchRecipes()

```typescript
function semanticSearchRecipes(
  query: string,
  options?: {
    limit?: number;
    minSimilarity?: number;
    cuisine?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    dietaryRestrictions?: string[];
    includePrivate?: boolean;
  }
): Promise<SemanticSearchResult>
```

### hybridSearchRecipes()

```typescript
function hybridSearchRecipes(
  query: string,
  options?: SearchOptions
): Promise<SemanticSearchResult & { mergedCount?: number }>
```

### findSimilarToRecipe()

```typescript
function findSimilarToRecipe(
  recipeId: string,
  limit?: number
): Promise<SemanticSearchResult>
```

## Best Practices

### Query Writing

**Good Queries:**
- Descriptive: "creamy tomato pasta with basil"
- Intent-based: "comfort food for cold weather"
- Style-focused: "light healthy summer lunch"

**Poor Queries:**
- Too short: "food", "meal"
- Too specific: "recipe #1234"
- Misspelled: "spaghetty"

---

**Last Updated:** October 2025
**Version:** 1.0.0
