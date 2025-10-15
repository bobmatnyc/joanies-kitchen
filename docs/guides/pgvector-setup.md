# pgvector Setup for Recipe Manager

## Overview

This document describes the pgvector implementation for semantic recipe search in the Recipe Manager application.

**Status**: ✅ Fully implemented and verified
**pgvector Version**: 0.8.0
**Database**: Neon PostgreSQL
**Embedding Model**: all-MiniLM-L6-v2 (384 dimensions)
**Distance Metric**: Cosine similarity
**Index Type**: HNSW (Hierarchical Navigable Small World)

---

## Implementation Summary

### 1. Database Schema Changes

#### New Table: `recipe_embeddings`

Stores vector embeddings for semantic recipe search:

```sql
CREATE TABLE recipe_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  embedding vector(384) NOT NULL,
  embedding_text TEXT NOT NULL,
  model_name VARCHAR(100) NOT NULL DEFAULT 'all-MiniLM-L6-v2',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(recipe_id)
);
```

**Key Features**:
- One-to-one relationship with recipes (UNIQUE constraint on recipe_id)
- CASCADE deletion when recipe is deleted
- Automatic timestamp tracking via trigger
- Vector type supports 384-dimensional embeddings

#### Enhanced `recipes` Table

Added provenance tracking columns:

| Column | Type | Description |
|--------|------|-------------|
| `search_query` | TEXT | Search query that discovered the recipe |
| `discovery_date` | TIMESTAMP WITH TIME ZONE | When the recipe was discovered |
| `confidence_score` | DECIMAL(3,2) | Validation confidence (0.00-1.00) |
| `validation_model` | TEXT | AI model used for validation |
| `embedding_model` | TEXT | Embedding model name for vector search |

### 2. Vector Indexes

#### HNSW Index for Vector Search
```sql
CREATE INDEX recipe_embeddings_embedding_idx
ON recipe_embeddings
USING hnsw (embedding vector_cosine_ops);
```

**Performance Characteristics**:
- O(log n) search complexity
- Optimized for cosine similarity searches
- Suitable for large-scale deployments

#### Supporting Index
```sql
CREATE INDEX recipe_embeddings_recipe_id_idx
ON recipe_embeddings(recipe_id);
```

**Purpose**: Fast joins between recipes and embeddings tables

### 3. Database Triggers

#### Automatic Timestamp Updates
```sql
CREATE TRIGGER recipe_embeddings_updated_at_trigger
BEFORE UPDATE ON recipe_embeddings
FOR EACH ROW
EXECUTE FUNCTION update_recipe_embeddings_updated_at();
```

Automatically updates `updated_at` timestamp on any row modification.

---

## File Structure

### Migration Files
- `/src/lib/db/migrations/0005_enable_pgvector.sql` - Main SQL migration file
- `/scripts/run-migration-split.ts` - Migration execution script
- `/scripts/verify-pgvector-neon.ts` - Verification test suite

### Schema Files
- `/src/lib/db/schema.ts` - Updated Drizzle ORM schema with pgvector types

### Utility Scripts
- `/scripts/run-migration-neon.ts` - Alternative migration runner
- `/scripts/run-migration.js` - Node.js migration runner (requires pg package)
- `/scripts/verify-pgvector.js` - Node.js verification (requires pg package)

---

## Drizzle ORM Integration

### Type Definitions

```typescript
// Custom vector type for pgvector
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(384)';
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: string): number[] {
    if (typeof value === 'string') {
      const cleaned = value.replace(/[\[\]]/g, '');
      return cleaned.split(',').map(Number);
    }
    return value as any;
  },
});

// Recipe Embeddings table
export const recipeEmbeddings = pgTable('recipe_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  embedding: vector('embedding').notNull(),
  embeddingText: text('embedding_text').notNull(),
  modelName: varchar('model_name', { length: 100 })
    .notNull()
    .default('all-MiniLM-L6-v2'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Type exports
export type RecipeEmbedding = typeof recipeEmbeddings.$inferSelect;
export type NewRecipeEmbedding = typeof recipeEmbeddings.$inferInsert;
```

---

## Verification Results

### Test Suite Output

```
✅ All tests passed successfully!

Test Results:
  ✓ pgvector version 0.8.0 is installed
  ✓ recipe_embeddings table exists with 7 columns
  ✓ Found 4 indexes (including HNSW)
  ✓ Vector operations successful
    - Cosine similarity: 0.107283
    - L2 distance: 18.524285
    - Inner product: -20.425453
  ✓ All 5 provenance tracking columns added
  ✓ Foreign key constraints configured
  ✓ Triggers configured for automatic timestamps
  ✓ Query execution time: 21ms
```

---

## Usage Examples

### 1. Inserting an Embedding

```typescript
import { db } from '@/lib/db';
import { recipeEmbeddings } from '@/lib/db/schema';

// Generate embedding from recipe text
const embeddingVector = await generateEmbedding(recipeText);

// Insert into database
await db.insert(recipeEmbeddings).values({
  recipeId: recipe.id,
  embedding: embeddingVector,
  embeddingText: recipeText,
  modelName: 'all-MiniLM-L6-v2',
});
```

### 2. Semantic Search

```typescript
import { sql } from 'drizzle-orm';

// Find similar recipes using cosine similarity
const queryEmbedding = await generateEmbedding(searchQuery);

const similarRecipes = await db.execute(sql`
  SELECT
    r.*,
    1 - (e.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
  FROM recipe_embeddings e
  JOIN recipes r ON r.id = e.recipe_id
  WHERE r.user_id = ${userId}
  ORDER BY e.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
  LIMIT 10
`);
```

### 3. Finding Similar Recipes

```typescript
// Find recipes similar to a specific recipe
const recipe = await db.query.recipes.findFirst({
  where: eq(recipes.id, recipeId),
  with: {
    embedding: true,
  },
});

if (recipe?.embedding) {
  const similar = await db.execute(sql`
    SELECT
      r.*,
      1 - (e.embedding <=> ${JSON.stringify(recipe.embedding.embedding)}::vector) as similarity
    FROM recipe_embeddings e
    JOIN recipes r ON r.id = e.recipe_id
    WHERE r.id != ${recipeId}
      AND r.user_id = ${userId}
    ORDER BY e.embedding <=> ${JSON.stringify(recipe.embedding.embedding)}::vector
    LIMIT 5
  `);
}
```

---

## Vector Distance Operators

pgvector provides three distance operators:

| Operator | Name | Use Case |
|----------|------|----------|
| `<=>` | Cosine distance | **Recommended**: Semantic similarity |
| `<->` | L2 distance | Euclidean distance |
| `<#>` | Inner product | Dot product similarity |

**Default**: Cosine distance (`<=>`) for semantic recipe search

---

## Performance Considerations

### Index Build Time
- HNSW index builds asynchronously
- First query may be slower while index is building
- Production optimization: Pre-build indexes during off-peak hours

### Query Performance
- **With HNSW index**: O(log n) complexity
- **Without index**: O(n) full table scan
- **Current performance**: ~21ms for test queries

### Scalability
- Supports millions of vectors
- Separate table design enables independent scaling
- Consider partitioning for > 10M recipes

---

## Next Steps

### 1. Implement Embedding Generation

Create an API endpoint to generate embeddings:

```typescript
// /src/app/api/embeddings/generate/route.ts
import { generateEmbedding } from '@/lib/ai/embeddings';

export async function POST(request: Request) {
  const { recipeId } = await request.json();

  // Fetch recipe
  const recipe = await db.query.recipes.findFirst({
    where: eq(recipes.id, recipeId),
  });

  // Generate embedding text
  const embeddingText = `${recipe.name} ${recipe.description} ${recipe.ingredients} ${recipe.tags}`;

  // Generate embedding vector
  const embedding = await generateEmbedding(embeddingText);

  // Store in database
  await db.insert(recipeEmbeddings).values({
    recipeId: recipe.id,
    embedding,
    embeddingText,
  });

  return Response.json({ success: true });
}
```

### 2. Implement Semantic Search API

Create semantic search endpoint:

```typescript
// /src/app/api/recipes/search/semantic/route.ts
export async function POST(request: Request) {
  const { query, limit = 10 } = await request.json();

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Search using vector similarity
  const results = await db.execute(sql`
    SELECT
      r.*,
      1 - (e.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
    FROM recipe_embeddings e
    JOIN recipes r ON r.id = e.recipe_id
    ORDER BY e.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
    LIMIT ${limit}
  `);

  return Response.json(results);
}
```

### 3. Batch Generate Embeddings

Create script to generate embeddings for existing recipes:

```bash
tsx scripts/generate-embeddings.ts
```

### 4. Add Similar Recipes Feature

Implement "Similar Recipes" recommendation:

```typescript
// /src/app/api/recipes/[id]/similar/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Implementation as shown in usage examples
}
```

---

## Configuration Summary

| Parameter | Value | Notes |
|-----------|-------|-------|
| Vector Dimensions | 384 | all-MiniLM-L6-v2 model |
| Distance Metric | Cosine | Best for semantic similarity |
| Index Type | HNSW | O(log n) search complexity |
| pgvector Version | 0.8.0 | Pre-installed on Neon |
| Default Model | all-MiniLM-L6-v2 | Hugging Face model |

---

## Troubleshooting

### Extension Not Found

```sql
-- Check if pgvector is installed
SELECT * FROM pg_extension WHERE extname = 'vector';

-- If missing, enable it
CREATE EXTENSION vector;
```

### Index Not Being Used

```sql
-- Check if indexes exist
SELECT * FROM pg_indexes WHERE tablename = 'recipe_embeddings';

-- Rebuild index if needed
REINDEX INDEX recipe_embeddings_embedding_idx;
```

### Vector Dimension Mismatch

Error: `vector dimension mismatch`

**Solution**: Ensure all embeddings are exactly 384 dimensions:
```typescript
if (embedding.length !== 384) {
  throw new Error(`Expected 384 dimensions, got ${embedding.length}`);
}
```

---

## References

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Neon PostgreSQL Extensions](https://neon.tech/docs/extensions/pgvector)
- [HNSW Algorithm](https://arxiv.org/abs/1603.09320)
- [all-MiniLM-L6-v2 Model](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)

---

## Maintenance

### Regular Tasks

1. **Monitor Index Health**
   ```sql
   SELECT
     schemaname,
     tablename,
     indexname,
     pg_size_pretty(pg_relation_size(indexrelid)) as size
   FROM pg_stat_user_indexes
   WHERE tablename = 'recipe_embeddings';
   ```

2. **Vacuum Regularly**
   ```sql
   VACUUM ANALYZE recipe_embeddings;
   ```

3. **Track Embedding Coverage**
   ```sql
   SELECT
     COUNT(DISTINCT r.id) as total_recipes,
     COUNT(DISTINCT e.recipe_id) as recipes_with_embeddings,
     ROUND(100.0 * COUNT(DISTINCT e.recipe_id) / COUNT(DISTINCT r.id), 2) as coverage_pct
   FROM recipes r
   LEFT JOIN recipe_embeddings e ON e.recipe_id = r.id;
   ```

---

**Last Updated**: 2025-10-14
**Migration Version**: 0005_enable_pgvector
**Status**: Production Ready ✅
