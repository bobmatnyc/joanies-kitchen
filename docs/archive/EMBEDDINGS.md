# Recipe Embeddings with Hugging Face

This document explains how to use the embedding generation utilities for semantic recipe search in the Recipe Manager.

## Overview

The Recipe Manager uses **Hugging Face's Inference API** with the `sentence-transformers/all-MiniLM-L6-v2` model to generate 384-dimensional vector embeddings for recipes. These embeddings enable semantic similarity search, allowing users to find recipes based on meaning rather than just keyword matching.

## Setup

### 1. Get Hugging Face API Key

1. Go to [Hugging Face Settings](https://huggingface.co/settings/tokens)
2. Create a new API token (free tier available)
3. Copy the token

### 2. Configure Environment

Add to your `.env.local` file:

```bash
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
```

### 3. Verify Database Setup

Ensure pgvector extension is enabled and the `recipe_embeddings` table exists:

```bash
npm run db:push
```

## Architecture

### Components

1. **Embedding Generation (`src/lib/ai/embeddings.ts`)**
   - Single and batch embedding generation
   - Recipe-specific text representation
   - Similarity calculations
   - Error handling with retries

2. **Database Operations (`src/lib/db/embeddings.ts`)**
   - CRUD operations for embeddings
   - Vector similarity search
   - Batch processing support

3. **Database Schema (`src/lib/db/schema.ts`)**
   - `recipe_embeddings` table with pgvector support
   - 384-dimensional vector storage
   - Recipe relationship with cascade delete

### Model Details

- **Model**: `sentence-transformers/all-MiniLM-L6-v2`
- **Dimensions**: 384
- **Purpose**: Semantic similarity search
- **Performance**: ~120MB model, optimized for speed
- **Free Tier**: Available on Hugging Face

## Usage Examples

### Generate Embedding for Text

```typescript
import { generateEmbedding } from '@/lib/ai/embeddings';

const embedding = await generateEmbedding('Delicious pasta recipe');
console.log(embedding.length); // 384
```

### Generate Embedding for Recipe

```typescript
import { generateRecipeEmbedding } from '@/lib/ai/embeddings';

const result = await generateRecipeEmbedding(recipe);
// Returns: { embedding: number[], embeddingText: string, modelName: string }
```

### Save Embedding to Database

```typescript
import { saveRecipeEmbedding } from '@/lib/db/embeddings';

await saveRecipeEmbedding(
  recipe.id,
  result.embedding,
  result.embeddingText,
  result.modelName
);
```

### Find Similar Recipes

```typescript
import { findSimilarRecipes } from '@/lib/db/embeddings';

const queryEmbedding = await generateEmbedding('pasta carbonara');
const similar = await findSimilarRecipes(queryEmbedding, 10, 0.5);

similar.forEach(result => {
  console.log(`${result.recipe_name}: ${result.similarity}`);
});
```

### Batch Processing

```typescript
import { generateEmbeddingsBatch } from '@/lib/ai/embeddings';

const texts = recipes.map(r => buildRecipeEmbeddingText(r));
const embeddings = await generateEmbeddingsBatch(texts, {
  batchSize: 10,
  delayMs: 1000,
  onProgress: (done, total) => console.log(`${done}/${total}`)
});
```

## API Reference

### Embedding Generation

#### `generateEmbedding(text: string, options?: EmbeddingGenerationOptions): Promise<number[]>`

Generates a 384-dimensional embedding vector for the given text.

**Parameters:**
- `text` - Text to generate embedding for
- `options` - Optional configuration
  - `retries` - Number of retry attempts (default: 3)
  - `timeout` - Request timeout in ms (default: 30000)
  - `waitForModel` - Wait for model to load if cold (default: true)

**Returns:** 384-dimensional number array

**Throws:** `EmbeddingError` on failure

#### `generateRecipeEmbedding(recipe: Recipe, options?: EmbeddingGenerationOptions): Promise<RecipeEmbeddingResult>`

Generates an embedding specifically optimized for a recipe.

**Returns:**
```typescript
{
  embedding: number[];
  embeddingText: string;
  modelName: string;
}
```

#### `buildRecipeEmbeddingText(recipe: Recipe): string`

Builds the text representation used for embedding generation. Combines:
- Recipe name
- Description
- Cuisine
- Tags
- Ingredients
- Difficulty level

#### `cosineSimilarity(a: number[], b: number[]): number`

Calculates cosine similarity between two vectors.

**Returns:** Number between -1 and 1 (1 = identical)

### Database Operations

#### `saveRecipeEmbedding(recipeId, embedding, embeddingText, modelName?): Promise<RecipeEmbedding>`

Saves or updates a recipe embedding in the database.

#### `getRecipeEmbedding(recipeId: string): Promise<RecipeEmbedding | null>`

Retrieves an embedding for a recipe.

#### `deleteRecipeEmbedding(recipeId: string): Promise<boolean>`

Deletes a recipe embedding.

#### `findSimilarRecipes(queryEmbedding: number[], limit?: number, minSimilarity?: number): Promise<Array<RecipeEmbedding & { similarity: number }>>`

Finds similar recipes using vector similarity search.

**Parameters:**
- `queryEmbedding` - Query vector to find similar recipes for
- `limit` - Maximum results (default: 10)
- `minSimilarity` - Minimum similarity threshold (default: 0.3)

#### `getRecipesNeedingEmbedding(modelName?: string): Promise<Recipe[]>`

Gets recipes that don't have embeddings or need regeneration.

#### `batchSaveRecipeEmbeddings(embeddings: Array<...>): Promise<RecipeEmbedding[]>`

Efficiently saves multiple embeddings in parallel.

## Error Handling

### Error Types

The system uses custom error classes with specific error codes:

```typescript
class EmbeddingError extends Error {
  code: 'API_ERROR' | 'VALIDATION_ERROR' | 'RATE_LIMIT' | 'TIMEOUT' | 'CONFIG_ERROR';
  details?: any;
}

class EmbeddingDatabaseError extends Error {
  operation: 'save' | 'get' | 'delete' | 'update' | 'search';
  details?: any;
}
```

### Common Errors

1. **Missing API Key**
   ```
   EmbeddingError: HUGGINGFACE_API_KEY not configured
   Code: CONFIG_ERROR
   ```

2. **Rate Limiting**
   ```
   EmbeddingError: Rate limit or model loading
   Code: RATE_LIMIT
   ```
   - Automatically retries with exponential backoff
   - Model cold start can take ~20 seconds

3. **Invalid Dimensions**
   ```
   EmbeddingError: Invalid embedding dimension
   Code: VALIDATION_ERROR
   ```

4. **Recipe Not Found**
   ```
   EmbeddingDatabaseError: Recipe not found
   Operation: save
   ```

### Retry Logic

The system automatically retries failed requests:
- **Default retries**: 3 attempts
- **Backoff**: Exponential (1s, 2s, 4s)
- **Model loading**: Waits for model to wake up
- **Rate limiting**: Respects API limits

## Testing

### Run Test Suite

```bash
# Run all tests (requires API key)
npm run test:embeddings

# Verbose output
npm run test:embeddings:verbose

# Skip API tests (only local tests)
npm run test:embeddings:skip-api
```

### Test Coverage

The test suite includes:

1. **Single Embedding Generation**
   - Text to vector conversion
   - Dimension validation
   - Error handling

2. **Batch Processing**
   - Multiple text embeddings
   - Progress tracking
   - Error recovery

3. **Recipe Embeddings**
   - Text representation building
   - Recipe-specific generation

4. **Similarity Calculations**
   - Cosine similarity
   - Similar embedding search

5. **Database Operations**
   - Save/retrieve embeddings
   - Vector similarity search
   - Batch operations

6. **End-to-End Workflow**
   - Full recipe embedding pipeline
   - Database integration

### Manual Testing

```typescript
// Test single embedding
const embedding = await generateEmbedding('test recipe');
console.log('Dimensions:', embedding.length); // Should be 384

// Test similarity
const sim = cosineSimilarity(embedding, embedding);
console.log('Self-similarity:', sim); // Should be ~1.0
```

## Performance

### Generation Speed

- **Single embedding**: ~500ms (after model warmup)
- **Cold start**: ~20 seconds (first request)
- **Batch processing**: ~1 second per 10 recipes (with delay)

### Best Practices

1. **Batch Processing**
   - Use `generateEmbeddingsBatch()` for multiple recipes
   - Configure appropriate batch size (10-20 recommended)
   - Add delays to avoid rate limiting

2. **Caching**
   - Store embeddings in database
   - Only regenerate when recipe content changes
   - Use `getRecipesNeedingEmbedding()` to find gaps

3. **Error Handling**
   - Always wrap in try-catch
   - Handle rate limiting gracefully
   - Log errors for debugging

4. **Database Queries**
   - Use indexes on recipe_id
   - Set appropriate similarity thresholds
   - Limit result set size

## Similarity Thresholds

Recommended similarity thresholds for recipe search:

- **0.8 - 1.0**: Very similar (near duplicates)
- **0.6 - 0.8**: Similar (related recipes)
- **0.4 - 0.6**: Somewhat similar (same category)
- **0.2 - 0.4**: Loosely related
- **< 0.2**: Not similar

## Integration Example

### Complete Recipe Search Flow

```typescript
import { generateEmbedding } from '@/lib/ai/embeddings';
import { findSimilarRecipes } from '@/lib/db/embeddings';

export async function searchRecipesBySemantic(query: string) {
  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // Find similar recipes
    const similar = await findSimilarRecipes(
      queryEmbedding,
      10,  // top 10 results
      0.3  // minimum 30% similarity
    );

    // Return results with scores
    return similar.map(result => ({
      id: result.recipeId,
      name: result.recipe_name,
      similarity: result.similarity,
      matchScore: Math.round(result.similarity * 100)
    }));

  } catch (error) {
    console.error('Semantic search failed:', error);
    throw error;
  }
}
```

## Troubleshooting

### Model Loading Timeout

If you get timeout errors:
- Increase timeout in options: `{ timeout: 60000 }`
- First request may take 20+ seconds
- Subsequent requests are fast

### Invalid Dimensions

Ensure you're using the correct model:
- Model: `sentence-transformers/all-MiniLM-L6-v2`
- Dimensions: 384 (not 512 or 768)

### Rate Limiting

If you hit rate limits:
- Increase delay in batch processing
- Reduce batch size
- Consider upgrading Hugging Face plan

### Database Connection

Ensure DATABASE_URL is configured:
```bash
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
```

## Future Enhancements

Potential improvements:
- [ ] Background job for embedding generation
- [ ] Incremental updates on recipe changes
- [ ] Multi-language support
- [ ] Hybrid search (embeddings + keywords)
- [ ] A/B testing different models
- [ ] Embedding analytics dashboard

## Resources

- [Hugging Face Inference API](https://huggingface.co/docs/api-inference/)
- [all-MiniLM-L6-v2 Model](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Cosine Similarity](https://en.wikipedia.org/wiki/Cosine_similarity)

## Support

For issues or questions:
1. Check this documentation
2. Run test suite: `npm run test:embeddings:verbose`
3. Review error logs
4. Check Hugging Face API status
