# Semantic Recipe Search Implementation Guide

## Overview

This guide documents the complete semantic search implementation for the Recipe Manager application. The system uses pgvector embeddings with the all-MiniLM-L6-v2 model to enable natural language recipe search and similarity matching.

## Architecture

### Components

1. **Database Layer** (`/src/lib/db/embeddings.ts`)
   - CRUD operations for recipe embeddings
   - Vector similarity search using pgvector
   - HNSW index for fast nearest-neighbor queries

2. **AI Layer** (`/src/lib/ai/embeddings.ts`)
   - Embedding generation via Hugging Face API
   - 384-dimensional vectors (all-MiniLM-L6-v2)
   - Recipe text preprocessing and optimization

3. **Server Actions** (`/src/app/actions/semantic-search.ts`)
   - `semanticSearchRecipes()` - Pure vector search
   - `hybridSearchRecipes()` - Combined vector + text search
   - `findSimilarToRecipe()` - Recipe similarity matching
   - `getSearchSuggestions()` - Autocomplete support

4. **UI Components**
   - `SemanticSearchPanel` - Full-featured search interface
   - `SimilarRecipesWidget` - "More Like This" widget
   - `RecipeCard` - Enhanced with similarity scores

5. **API Routes** (`/src/app/api/search/semantic/route.ts`)
   - REST endpoints for client-side searches
   - Supports both GET and POST methods

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

**Use Cases:**
- "More Like This" feature on recipe pages
- Recipe recommendations
- Discovery of related recipes

### 5. Search Suggestions

Autocomplete functionality for search inputs:

```typescript
const result = await getSearchSuggestions("chick", 10);
// Returns: ["chicken soup", "chicken curry", "chicken"]
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

### API Routes

**POST Request:**
```bash
curl -X POST http://localhost:3001/api/search/semantic \
  -H "Content-Type: application/json" \
  -d '{
    "query": "spicy pasta",
    "mode": "hybrid",
    "options": {
      "limit": 10,
      "minSimilarity": 0.5,
      "cuisine": "Italian"
    }
  }'
```

**GET Request:**
```bash
curl "http://localhost:3001/api/search/semantic?q=pasta&mode=semantic&limit=10&minSimilarity=0.5"
```

## Testing

### Run Test Suite

```bash
npm run test:semantic-search
```

The test suite validates:
- Natural language queries
- Filtered searches
- Similar recipe finding
- Hybrid search
- Performance metrics

### Expected Results

**Performance:**
- Search time: < 1 second (excellent)
- 1-3 seconds (good)
- \> 3 seconds (needs optimization)

**Accuracy:**
- High similarity (>70%): Very relevant
- Medium similarity (50-70%): Relevant
- Low similarity (30-50%): Somewhat relevant
- <30%: Consider increasing threshold

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

### Performance Tuning

**Database:**
- HNSW index configured for fast nearest-neighbor search
- Index parameters optimized for 384-dimensional vectors
- Cosine distance metric for similarity

**Query Optimization:**
- Fetch 3x requested limit initially
- Apply filters after vector search
- Sort by similarity score
- Limit final results

## Troubleshooting

### No Results Found

**Causes:**
- Similarity threshold too high
- No recipes match filters
- No embeddings generated yet

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

**Causes:**
- Cold start (first query)
- Database connection latency
- Missing HNSW index

**Solutions:**
```sql
-- Verify HNSW index exists
SELECT * FROM pg_indexes WHERE tablename = 'recipe_embeddings';

-- Create index if missing
CREATE INDEX IF NOT EXISTS recipe_embeddings_embedding_idx
ON recipe_embeddings
USING hnsw (embedding vector_cosine_ops);
```

### Inaccurate Results

**Causes:**
- Query too vague
- Embeddings need regeneration
- Wrong search mode

**Solutions:**
```typescript
// Use more specific queries
"quick easy pasta with tomatoes"  // Better
"food"                            // Too vague

// Use hybrid mode for keyword-heavy queries
mode: 'hybrid'

// Regenerate embeddings
// Delete and re-create recipe embeddings
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

### getSearchSuggestions()

```typescript
function getSearchSuggestions(
  partial: string,
  limit?: number
): Promise<{ success: boolean; suggestions: string[] }>
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

### Filter Usage

**Combine filters effectively:**
```typescript
// Good: Specific but not over-constrained
{
  cuisine: "Italian",
  difficulty: "easy",
  minSimilarity: 0.4
}

// Bad: Over-constrained
{
  cuisine: "Italian",
  difficulty: "easy",
  dietaryRestrictions: ["vegan", "gluten-free", "nut-free"],
  minSimilarity: 0.8  // Too strict
}
```

### Performance

**Optimize searches:**
```typescript
// Use appropriate limits
limit: 20  // Good for UI
limit: 100 // Avoid unless necessary

// Cache results when possible
const [results, setResults] = useState([]);
useEffect(() => {
  // Cache search results
}, [query]);
```

## Future Enhancements

### Potential Improvements

1. **Multi-modal Search**
   - Image-based recipe search
   - Voice query support
   - Combined text + image queries

2. **Personalization**
   - User preference learning
   - Collaborative filtering
   - Search history influence

3. **Advanced Features**
   - Faceted search
   - Search analytics
   - Query expansion
   - Spelling correction

4. **Performance**
   - Result caching
   - Query deduplication
   - Incremental loading
   - Search-as-you-type

## Support

### Resources

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Hugging Face Models](https://huggingface.co/sentence-transformers)
- [Vector Search Guide](https://www.pinecone.io/learn/vector-search/)

### Common Issues

See [Troubleshooting](#troubleshooting) section above.

### Contact

For issues or questions, please refer to the project README or create an issue in the repository.

---

**Last Updated:** October 14, 2025
**Version:** 1.0.0
