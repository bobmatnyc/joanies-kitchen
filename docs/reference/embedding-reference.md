# Embedding System Quick Reference

## 🚀 Quick Start (5 Minutes)

### 1. Get API Key
```bash
# Visit: https://huggingface.co/settings/tokens
# Create new token (Read access is sufficient)
```

### 2. Configure Environment
```bash
# Add to .env.local
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Test Setup
```bash
npm run test:embeddings
```

### 4. Generate Your First Embedding
```typescript
import { generateEmbedding } from '@/lib/ai/embeddings';

const embedding = await generateEmbedding('pasta with tomato sauce');
console.log(embedding.length); // 384
```

## 📖 Common Operations

### Generate Embedding for Recipe
```typescript
import { generateRecipeEmbedding } from '@/lib/ai/embeddings';
import { saveRecipeEmbedding } from '@/lib/db/embeddings';

// Generate
const result = await generateRecipeEmbedding(recipe);

// Save to database
await saveRecipeEmbedding(
  recipe.id,
  result.embedding,
  result.embeddingText
);
```

### Search Similar Recipes
```typescript
import { generateEmbedding } from '@/lib/ai/embeddings';
import { findSimilarRecipes } from '@/lib/db/embeddings';

// Search for "italian pasta"
const query = await generateEmbedding('italian pasta');
const results = await findSimilarRecipes(query, 10, 0.5);

results.forEach(r => {
  console.log(`${r.recipe_name}: ${(r.similarity * 100).toFixed(0)}% match`);
});
```

### Batch Process Recipes
```typescript
import { generateRecipeEmbedding } from '@/lib/ai/embeddings';
import { batchSaveRecipeEmbeddings } from '@/lib/db/embeddings';

// Generate all
const embeddings = await Promise.all(
  recipes.map(async r => {
    const result = await generateRecipeEmbedding(r);
    return {
      recipeId: r.id,
      embedding: result.embedding,
      embeddingText: result.embeddingText,
    };
  })
);

// Save all
await batchSaveRecipeEmbeddings(embeddings);
```

### Find Recipes Needing Embeddings
```typescript
import { getRecipesNeedingEmbedding } from '@/lib/db/embeddings';

const missing = await getRecipesNeedingEmbedding();
console.log(`${missing.length} recipes need embeddings`);
```

### Compare Two Recipes
```typescript
import { cosineSimilarity } from '@/lib/ai/embeddings';
import { getRecipeEmbedding } from '@/lib/db/embeddings';

const emb1 = await getRecipeEmbedding(recipeId1);
const emb2 = await getRecipeEmbedding(recipeId2);

const similarity = cosineSimilarity(emb1.embedding, emb2.embedding);
console.log(`Similarity: ${(similarity * 100).toFixed(1)}%`);
```

## 🔧 Configuration

### Default Settings
```typescript
{
  retries: 3,              // Number of retry attempts
  timeout: 30000,          // 30 seconds (for cold start)
  waitForModel: true,      // Wait for model to load
  batchSize: 10,           // Recipes per batch
  delayMs: 1000,           // Delay between batches (rate limiting)
  minSimilarity: 0.3       // 30% minimum similarity
}
```

### Custom Options
```typescript
const embedding = await generateEmbedding(text, {
  retries: 5,
  timeout: 60000,
});

const batch = await generateEmbeddingsBatch(texts, {
  batchSize: 5,
  delayMs: 2000,
  onProgress: (done, total) => console.log(`${done}/${total}`)
});
```

## 📊 Similarity Thresholds

| Range | Meaning | Use Case |
|-------|---------|----------|
| 0.8 - 1.0 | Very Similar | Duplicate detection |
| 0.6 - 0.8 | Similar | Related recipes |
| 0.4 - 0.6 | Somewhat Similar | Same category |
| 0.2 - 0.4 | Loosely Related | Broad search |
| < 0.2 | Not Similar | Different topics |

## ⚡ Performance

| Operation | Time | Notes |
|-----------|------|-------|
| First Request | ~20s | Model cold start |
| Subsequent | ~500ms | Model warm |
| Batch (10) | ~10s | With 1s delays |
| Database Query | <100ms | Similarity search |

## 🧪 Testing Commands

```bash
# Run all tests
npm run test:embeddings

# Verbose output
npm run test:embeddings:verbose

# Skip API tests (local only)
npm run test:embeddings:skip-api
```

## ❌ Error Handling

### Common Errors

**Missing API Key**
```typescript
Error: HUGGINGFACE_API_KEY not configured
Code: CONFIG_ERROR
Fix: Add API key to .env.local
```

**Rate Limiting**
```typescript
Error: Rate limit or model loading
Code: RATE_LIMIT
Fix: Increase delays, reduce batch size
```

**Wrong Dimensions**
```typescript
Error: Invalid embedding dimension: expected 384, got XXX
Code: VALIDATION_ERROR
Fix: Verify model is all-MiniLM-L6-v2
```

**Recipe Not Found**
```typescript
Error: Recipe not found
Operation: save
Fix: Verify recipe exists in database
```

### Try-Catch Example
```typescript
try {
  const result = await generateRecipeEmbedding(recipe);
  await saveRecipeEmbedding(recipe.id, result.embedding, result.embeddingText);
} catch (error) {
  if (error instanceof EmbeddingError) {
    console.error(`Embedding failed: ${error.code}`, error.details);
  } else if (error instanceof EmbeddingDatabaseError) {
    console.error(`Database failed: ${error.operation}`, error.details);
  } else {
    console.error('Unknown error:', error);
  }
}
```

## 🎯 Best Practices

### DO ✅
- Store embeddings in database (don't regenerate)
- Use batch processing for multiple recipes
- Add delays between batches (rate limiting)
- Validate embedding dimensions (must be 384)
- Handle errors gracefully with try-catch
- Set appropriate similarity thresholds

### DON'T ❌
- Don't expose API key to client-side code
- Don't regenerate embeddings unnecessarily
- Don't skip rate limiting delays
- Don't ignore error codes
- Don't use similarity < 0.3 for recommendations
- Don't process all recipes at once (use batches)

## 📦 Import Cheat Sheet

```typescript
// Embedding Generation
import {
  generateEmbedding,           // Single text → vector
  generateRecipeEmbedding,     // Recipe → { embedding, text, model }
  generateEmbeddingsBatch,     // Multiple texts → vectors
  buildRecipeEmbeddingText,    // Recipe → text representation
  cosineSimilarity,            // Compare two vectors
  findSimilar,                 // Find top K similar
  EmbeddingError,              // Error class
} from '@/lib/ai/embeddings';

// Database Operations
import {
  saveRecipeEmbedding,         // Save to DB
  getRecipeEmbedding,          // Get from DB
  deleteRecipeEmbedding,       // Delete from DB
  updateRecipeEmbedding,       // Update in DB
  findSimilarRecipes,          // Vector search
  getRecipesNeedingEmbedding,  // Find missing
  countRecipeEmbeddings,       // Count total
  batchSaveRecipeEmbeddings,   // Save multiple
  EmbeddingDatabaseError,      // Error class
} from '@/lib/db/embeddings';
```

## 📚 Full Documentation

- **Complete Guide**: `docs/EMBEDDINGS.md`
- **Examples**: `src/lib/ai/embeddings-example.ts`
- **Tests**: `scripts/test-embeddings.ts`
- **Summary**: `EMBEDDING_IMPLEMENTATION_SUMMARY.md`

## 🆘 Troubleshooting

### Problem: Timeout errors
**Solution**: Increase timeout, first request takes ~20s

### Problem: Rate limit errors
**Solution**: Increase delays between requests, reduce batch size

### Problem: Wrong dimensions
**Solution**: Verify using all-MiniLM-L6-v2 model (384 dimensions)

### Problem: API key not working
**Solution**: Verify key is correct, has read permissions

### Problem: Database connection errors
**Solution**: Check DATABASE_URL is configured correctly

### Problem: Recipe not found
**Solution**: Verify recipe exists before saving embedding

## 🎓 Learning Resources

- [Hugging Face Docs](https://huggingface.co/docs/api-inference/)
- [Model Card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
- [pgvector Guide](https://github.com/pgvector/pgvector)
- [Cosine Similarity](https://en.wikipedia.org/wiki/Cosine_similarity)

---

**Need Help?** Run tests first: `npm run test:embeddings:verbose`
