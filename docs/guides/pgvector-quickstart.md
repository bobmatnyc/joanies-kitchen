# pgvector Quick Start Guide

## Setup Complete ✅

pgvector has been successfully installed and configured for the Recipe Manager application.

---

## What Was Implemented

### 1. Database Extensions
- ✅ pgvector v0.8.0 extension enabled
- ✅ Vector similarity search support added

### 2. Database Schema
- ✅ `recipe_embeddings` table created (stores 384-dimension vectors)
- ✅ HNSW index for fast semantic search
- ✅ Enhanced `recipes` table with provenance tracking fields
- ✅ Automatic timestamp triggers

### 3. Drizzle ORM Integration
- ✅ Custom vector type for pgvector columns
- ✅ Type-safe schema definitions
- ✅ Zod validation schemas

### 4. Migration & Verification Scripts
- ✅ Migration scripts for database setup
- ✅ Comprehensive verification test suite
- ✅ All tests passing

---

## Quick Commands

### Run Migration (if needed again)
```bash
npx tsx scripts/run-migration-split.ts
```

### Verify Installation
```bash
npx tsx scripts/verify-pgvector-neon.ts
```

### Check Database Status
```bash
npx drizzle-kit studio
```

---

## File Locations

### Database Schema
- `/src/lib/db/schema.ts` - Updated with pgvector types
- `/src/lib/db/migrations/0005_enable_pgvector.sql` - SQL migration

### Scripts
- `/scripts/run-migration-split.ts` - **Recommended** migration runner
- `/scripts/verify-pgvector-neon.ts` - **Recommended** verification
- `/scripts/run-migration-neon.ts` - Alternative migration runner
- `/scripts/run-migration.js` - Node.js version (requires pg package)
- `/scripts/verify-pgvector.js` - Node.js verification (requires pg package)

### Documentation
- `/PGVECTOR_SETUP.md` - Complete implementation guide
- `/PGVECTOR_QUICKSTART.md` - This file

---

## Database Schema Overview

### `recipe_embeddings` Table
```
id              UUID PRIMARY KEY
recipe_id       TEXT NOT NULL (FK → recipes.id)
embedding       vector(384) NOT NULL
embedding_text  TEXT NOT NULL
model_name      VARCHAR(100) DEFAULT 'all-MiniLM-L6-v2'
created_at      TIMESTAMP WITH TIME ZONE
updated_at      TIMESTAMP WITH TIME ZONE
```

**Indexes**:
- HNSW index on `embedding` (vector_cosine_ops)
- B-tree index on `recipe_id`
- Unique constraint on `recipe_id`

### New `recipes` Columns
```
search_query      TEXT
discovery_date    TIMESTAMP WITH TIME ZONE
confidence_score  DECIMAL(3,2)
validation_model  TEXT
embedding_model   TEXT
```

---

## TypeScript Usage

### Import Types
```typescript
import { recipeEmbeddings, type RecipeEmbedding, type NewRecipeEmbedding } from '@/lib/db/schema';
import { db } from '@/lib/db';
```

### Insert Embedding
```typescript
const embedding: number[] = [...]; // 384-dimension vector

await db.insert(recipeEmbeddings).values({
  recipeId: 'recipe-uuid',
  embedding: embedding,
  embeddingText: 'Recipe text used for embedding',
  modelName: 'all-MiniLM-L6-v2',
});
```

### Semantic Search
```typescript
import { sql } from 'drizzle-orm';

const queryVector = [...]; // 384-dimension vector

const results = await db.execute(sql`
  SELECT
    r.*,
    1 - (e.embedding <=> ${JSON.stringify(queryVector)}::vector) as similarity
  FROM recipe_embeddings e
  JOIN recipes r ON r.id = e.recipe_id
  ORDER BY e.embedding <=> ${JSON.stringify(queryVector)}::vector
  LIMIT 10
`);
```

---

## Next Development Steps

### 1. Create Embedding Generation Service

File: `/src/lib/ai/embeddings.ts`

```typescript
export async function generateEmbedding(text: string): Promise<number[]> {
  // TODO: Implement using Hugging Face API or local model
  // Model: all-MiniLM-L6-v2
  // Output: 384-dimension vector
}
```

### 2. Create API Endpoints

#### Generate Embedding
`POST /api/embeddings/generate`
- Input: `{ recipeId: string }`
- Generates and stores embedding for recipe

#### Semantic Search
`POST /api/recipes/search/semantic`
- Input: `{ query: string, limit?: number }`
- Returns recipes ranked by semantic similarity

#### Similar Recipes
`GET /api/recipes/[id]/similar`
- Returns recipes similar to given recipe

### 3. Batch Generate Embeddings

Create: `/scripts/generate-embeddings.ts`
- Processes all existing recipes
- Generates embeddings in batches
- Handles errors gracefully

### 4. Frontend Integration

- Add semantic search UI component
- Display "Similar Recipes" section
- Show similarity scores

---

## Configuration

### Vector Settings
- **Dimensions**: 384 (fixed by all-MiniLM-L6-v2 model)
- **Distance Metric**: Cosine similarity (`<=>` operator)
- **Index Type**: HNSW (Hierarchical Navigable Small World)

### Model Information
- **Name**: all-MiniLM-L6-v2
- **Source**: Hugging Face sentence-transformers
- **Output**: 384-dimensional embeddings
- **Use Case**: General-purpose semantic similarity

---

## Verification Results

All tests passed ✅:

```
✓ pgvector version 0.8.0 is installed
✓ recipe_embeddings table exists with 7 columns
✓ Found 4 indexes (including HNSW)
✓ Vector operations successful
✓ All 5 provenance tracking columns added
✓ Foreign key constraints configured
✓ Triggers configured
✓ Query execution time: 21ms
```

---

## Troubleshooting

### Check Extension Status
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### Check Table Exists
```sql
SELECT * FROM information_schema.tables WHERE table_name = 'recipe_embeddings';
```

### Check Indexes
```sql
SELECT * FROM pg_indexes WHERE tablename = 'recipe_embeddings';
```

### Test Vector Operations
```typescript
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

const testVector = Array(384).fill(0.1);
const result = await sql`
  SELECT ${JSON.stringify(testVector)}::vector as test_vector
`;
```

---

## Resources

- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [Neon pgvector Docs](https://neon.tech/docs/extensions/pgvector)
- [all-MiniLM-L6-v2 Model](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
- [PGVECTOR_SETUP.md](./PGVECTOR_SETUP.md) - Full documentation

---

## Production Checklist

Before deploying to production:

- [ ] Test embedding generation with sample recipes
- [ ] Implement error handling for embedding API
- [ ] Add rate limiting to prevent API abuse
- [ ] Set up monitoring for vector search performance
- [ ] Create backup strategy for embeddings table
- [ ] Test semantic search with real user queries
- [ ] Implement caching for frequently searched queries
- [ ] Add analytics to track search quality

---

**Status**: Ready for development ✅
**Last Updated**: 2025-10-14
**Migration**: 0005_enable_pgvector
