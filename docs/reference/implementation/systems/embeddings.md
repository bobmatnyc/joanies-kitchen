# Embeddings Implementation

Vector embeddings for semantic recipe search using pgvector and Hugging Face.

## Overview

The embeddings system generates 384-dimensional vectors for recipes using the all-MiniLM-L6-v2 model, enabling semantic search and similarity matching.

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
   - Semantic search operations
   - Hybrid search (vector + text)
   - Similar recipe finding

## Database Setup

### Enable pgvector Extension

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Create Embeddings Table

```sql
CREATE TABLE recipe_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id TEXT NOT NULL UNIQUE REFERENCES recipes(id) ON DELETE CASCADE,
  embedding vector(384) NOT NULL,
  model TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create HNSW index for fast similarity search
CREATE INDEX recipe_embeddings_embedding_idx
ON recipe_embeddings
USING hnsw (embedding vector_cosine_ops);
```

## Usage

### Generate Embeddings

```typescript
import { generateEmbedding } from '@/lib/ai/embeddings';

const embedding = await generateEmbedding('creamy tomato pasta recipe');
```

### Store Embeddings

```typescript
import { storeRecipeEmbedding } from '@/lib/db/embeddings';

await storeRecipeEmbedding(recipeId, embedding, 'all-MiniLM-L6-v2');
```

### Search by Similarity

```typescript
import { searchSimilarRecipes } from '@/lib/db/embeddings';

const similar = await searchSimilarRecipes(embedding, 10, 0.5);
```

## Configuration

### Environment Variables

```env
HUGGINGFACE_API_KEY=your_api_key_here
```

### Similarity Thresholds

- **0.7+**: Very similar (strict)
- **0.5-0.7**: Similar (recommended)
- **0.3-0.5**: Somewhat similar (permissive)
- **<0.3**: Low similarity

## Performance

### HNSW Index Parameters

- **Vector dimension**: 384
- **Distance metric**: Cosine similarity
- **Index type**: HNSW (Hierarchical Navigable Small World)

### Query Performance

- **Expected**: <1 second for most queries
- **Cold start**: 1-3 seconds
- **Needs optimization**: >3 seconds

## Troubleshooting

### Embeddings Not Generated

```bash
# Check Hugging Face API key
echo $HUGGINGFACE_API_KEY

# Test embedding generation
npx tsx scripts/test-embeddings.ts
```

### Slow Queries

```sql
-- Verify HNSW index exists
SELECT * FROM pg_indexes WHERE tablename = 'recipe_embeddings';

-- Rebuild index if needed
REINDEX INDEX recipe_embeddings_embedding_idx;
```

## Testing

Run embedding tests:
```bash
npx tsx scripts/test-embeddings.ts
npx tsx scripts/test-semantic-search.ts
```

## Cost Considerations

### Hugging Face API

- **Model**: sentence-transformers/all-MiniLM-L6-v2
- **Cost**: Free tier available (rate limited)
- **Alternative**: Self-hosted embedding service

### Storage

- **Vector size**: 384 dimensions × 4 bytes = 1.5KB per recipe
- **1,000 recipes**: ~1.5MB
- **10,000 recipes**: ~15MB

---

**Last Updated:** October 2025
**Version:** 1.0.0
