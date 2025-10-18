# Embeddings Generation Guide

Complete guide for generating and managing vector embeddings for recipes, meals, and chefs in the Recipe Manager application.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Generating Embeddings](#generating-embeddings)
- [Vector Search](#vector-search)
- [Troubleshooting](#troubleshooting)

## Overview

The Recipe Manager uses vector embeddings to enable semantic search across recipes, meals, and chefs. Embeddings are 384-dimensional vectors generated using the **BAAI/bge-small-en-v1.5** model via HuggingFace's Inference API.

### Key Features

- **Semantic Search**: Find recipes, meals, and chefs by meaning, not just keywords
- **Similarity Discovery**: Discover related content automatically
- **Efficient Indexing**: HNSW (Hierarchical Navigable Small World) indexes for fast similarity search
- **Resume Support**: Checkpoint/resume capability for large-scale generation
- **Quality Validation**: Automatic validation of embedding quality

### Supported Entities

1. **Recipes**: ~200,000+ recipes from various sources
2. **Meals**: User-created meal plans with multiple recipes
3. **Chefs**: Famous chefs and recipe creators

## Architecture

### Embedding Generation Pipeline

```
Entity (Recipe/Meal/Chef)
    ↓
Build Embedding Text (name, description, tags, etc.)
    ↓
Generate Embedding (HuggingFace API)
    ↓
Validate Quality (dimension, NaN, zeros check)
    ↓
Save to Database (PostgreSQL with pgvector)
    ↓
HNSW Index (for fast similarity search)
```

### Technology Stack

- **Vector Database**: PostgreSQL with pgvector extension
- **Embedding Model**: BAAI/bge-small-en-v1.5 (384 dimensions)
- **API Provider**: HuggingFace Inference API (free tier)
- **Index Type**: HNSW (Hierarchical Navigable Small World)
- **Distance Metric**: Cosine similarity

## Database Schema

### Tables

#### `recipe_embeddings`
Already exists. Stores embeddings for recipes.

#### `meals_embeddings`
```sql
CREATE TABLE meals_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  embedding vector(384) NOT NULL,
  embedding_text TEXT NOT NULL,
  model_name VARCHAR(100) NOT NULL DEFAULT 'BAAI/bge-small-en-v1.5',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX meals_embeddings_meal_id_idx ON meals_embeddings(meal_id);
CREATE INDEX meals_embeddings_created_at_idx ON meals_embeddings(created_at DESC);

-- HNSW vector index for similarity search
CREATE INDEX meals_embeddings_embedding_idx
ON meals_embeddings
USING hnsw (embedding vector_cosine_ops);
```

#### `chefs_embeddings`
```sql
CREATE TABLE chefs_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chef_id UUID NOT NULL REFERENCES chefs(id) ON DELETE CASCADE,
  embedding vector(384) NOT NULL,
  embedding_text TEXT NOT NULL,
  model_name VARCHAR(100) NOT NULL DEFAULT 'BAAI/bge-small-en-v1.5',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX chefs_embeddings_chef_id_idx ON chefs_embeddings(chef_id);
CREATE INDEX chefs_embeddings_created_at_idx ON chefs_embeddings(created_at DESC);

-- HNSW vector index for similarity search
CREATE INDEX chefs_embeddings_embedding_idx
ON chefs_embeddings
USING hnsw (embedding vector_cosine_ops);
```

### Embedding Text Construction

#### Meals
```typescript
const embeddingText = `${meal.name}. ${meal.description}. Type: ${meal.meal_type}. Occasion: ${meal.occasion}. Tags: ${meal.tags.join(', ')}. Recipes: ${recipeNames.join(', ')}. Serves: ${meal.serves}`;
```

**Example:**
```
"Thanksgiving Dinner. Traditional family feast. Type: holiday. Occasion: Thanksgiving. Tags: Family Dinner, Holiday. Recipes: Roast Turkey, Mashed Potatoes, Green Bean Casserole, Pumpkin Pie. Serves: 8"
```

#### Chefs
```typescript
const embeddingText = `${chef.name}. ${chef.display_name}. ${chef.bio}. Specialties: ${chef.specialties.join(', ')}. Location: ${chef.location_city}, ${chef.location_state}, ${chef.location_country}`;
```

**Example:**
```
"J. Kenji López-Alt. Kenji López-Alt. Food scientist and author known for rigorous testing and clear explanations. Specialties: Science, Technique, Asian. Location: San Francisco, CA, USA"
```

## Generating Embeddings

### Prerequisites

1. **HuggingFace API Key**
   ```bash
   # Get from: https://huggingface.co/settings/tokens
   # Add to .env.local:
   HUGGINGFACE_API_KEY=hf_...
   ```

2. **Database Schema**
   ```bash
   # Apply embeddings schema (creates tables and indexes)
   pnpm embeddings:schema

   # Or dry run first:
   pnpm embeddings:schema:dry-run
   ```

3. **Verify pgvector Extension**
   ```bash
   psql $DATABASE_URL -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
   ```

### Recipe Embeddings

Recipes already have embeddings generated. To regenerate or update:

```bash
# Dry run (preview what will happen)
pnpm embeddings:generate:dry-run

# Generate embeddings
pnpm embeddings:generate

# Test on 10 recipes first
pnpm embeddings:generate:test

# Resume from last checkpoint (if interrupted)
pnpm embeddings:generate:resume
```

### Meal Embeddings

```bash
# Dry run (preview what will happen)
pnpm embeddings:meals:dry-run

# Generate embeddings for all meals
pnpm embeddings:meals

# Test on 10 meals first
pnpm embeddings:meals:test

# Resume from last checkpoint (if interrupted)
pnpm embeddings:meals:resume
```

**Advanced Options:**
```bash
# Custom batch size
npx tsx scripts/generate-meal-embeddings.ts --execute --batch-size=5

# Custom delay between batches (in ms)
npx tsx scripts/generate-meal-embeddings.ts --execute --delay=3000

# Limit to specific number
npx tsx scripts/generate-meal-embeddings.ts --execute --limit=100
```

### Chef Embeddings

```bash
# Dry run (preview what will happen)
pnpm embeddings:chefs:dry-run

# Generate embeddings for all chefs
pnpm embeddings:chefs

# Test on 10 chefs first
pnpm embeddings:chefs:test

# Resume from last checkpoint (if interrupted)
pnpm embeddings:chefs:resume
```

**Advanced Options:**
```bash
# Custom batch size
npx tsx scripts/generate-chef-embeddings.ts --execute --batch-size=5

# Custom delay between batches (in ms)
npx tsx scripts/generate-chef-embeddings.ts --execute --delay=3000

# Limit to specific number
npx tsx scripts/generate-chef-embeddings.ts --execute --limit=50
```

### Batch Processing Configuration

All embedding generation scripts support:

| Option | Default | Description |
|--------|---------|-------------|
| `--batch-size` | 10 | Number of items to process in parallel |
| `--delay` | 2000ms | Delay between batches (rate limiting) |
| `--limit` | unlimited | Maximum number to process |
| `--execute` | false | Actually generate (without = dry run) |
| `--resume` | false | Resume from last checkpoint |

### Checkpoint & Resume

All scripts automatically save checkpoints every 50 items:

```
tmp/
  meal-embedding-generation-checkpoint.json
  meal-embedding-errors.log
  meal-embedding-generation-report-<timestamp>.json
  chef-embedding-generation-checkpoint.json
  chef-embedding-errors.log
  chef-embedding-generation-report-<timestamp>.json
```

If interrupted, resume with:
```bash
pnpm embeddings:meals:resume
pnpm embeddings:chefs:resume
```

## Vector Search

### Database Helper Functions

#### Meals

```typescript
import {
  findSimilarMeals,
  saveMealEmbedding,
  getMealEmbedding,
} from '@/lib/db/meal-chef-embeddings';

// Generate and save embedding
const result = await generateMealEmbedding(meal, recipeNames);
await saveMealEmbedding(meal.id, result.embedding, result.embeddingText);

// Find similar meals
const queryEmbedding = await generateEmbedding("holiday dinner");
const similar = await findSimilarMeals(queryEmbedding, 10, 0.5);
// Returns meals sorted by similarity
```

#### Chefs

```typescript
import {
  findSimilarChefs,
  saveChefEmbedding,
  getChefEmbedding,
} from '@/lib/db/meal-chef-embeddings';

// Generate and save embedding
const result = await generateChefEmbedding(chef);
await saveChefEmbedding(chef.id, result.embedding, result.embeddingText);

// Find similar chefs
const queryEmbedding = await generateEmbedding("italian cuisine expert");
const similar = await findSimilarChefs(queryEmbedding, 10, 0.5);
// Returns chefs sorted by similarity
```

### Server Actions

Create server actions for semantic search:

```typescript
// src/app/actions/meal-search.ts
'use server';

import { generateEmbedding } from '@/lib/ai/embeddings';
import { findSimilarMeals } from '@/lib/db/meal-chef-embeddings';

export async function searchMealsBySimilarity(
  query: string,
  limit: number = 10
) {
  try {
    const queryEmbedding = await generateEmbedding(query);
    const results = await findSimilarMeals(queryEmbedding, limit, 0.3);
    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

```typescript
// src/app/actions/chef-search.ts
'use server';

import { generateEmbedding } from '@/lib/ai/embeddings';
import { findSimilarChefs } from '@/lib/db/meal-chef-embeddings';

export async function searchChefsBySimilarity(
  query: string,
  limit: number = 10
) {
  try {
    const queryEmbedding = await generateEmbedding(query);
    const results = await findSimilarChefs(queryEmbedding, limit, 0.3);
    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### Similarity Thresholds

Cosine similarity scores range from -1 to 1:

- **0.8 - 1.0**: Highly similar (nearly identical)
- **0.6 - 0.8**: Similar (strong match)
- **0.4 - 0.6**: Moderately similar (potential match)
- **0.3 - 0.4**: Weakly similar (may be relevant)
- **< 0.3**: Not similar (filter out)

Recommended thresholds:
- **Strict**: 0.6+ (high precision)
- **Balanced**: 0.4+ (good balance)
- **Exploratory**: 0.3+ (high recall)

## Troubleshooting

### Common Issues

#### 1. API Key Not Found
```
❌ HUGGINGFACE_API_KEY not configured
```

**Solution:**
```bash
# Get API key from: https://huggingface.co/settings/tokens
# Add to .env.local
echo "HUGGINGFACE_API_KEY=hf_..." >> .env.local
```

#### 2. Model Loading (503 Error)
```
⏳ Model loading or rate limited (HTTP 503), retrying in 5.0s
```

**Solution:** Wait for model to warm up (automatic retry). First request may take 20-30 seconds.

#### 3. pgvector Extension Missing
```
❌ pgvector extension not installed
```

**Solution:**
```sql
-- In your database
CREATE EXTENSION vector;
```

#### 4. Rate Limiting
```
⏳ Retry 1/3 in 2.0s... (HTTP 429)
```

**Solution:** Increase delay between batches:
```bash
npx tsx scripts/generate-meal-embeddings.ts --execute --delay=3000
```

#### 5. Checkpoint Recovery

If script was interrupted:
```bash
# Check checkpoint exists
ls tmp/*-checkpoint.json

# Resume from checkpoint
pnpm embeddings:meals:resume
pnpm embeddings:chefs:resume
```

#### 6. Invalid Embeddings

Scripts automatically validate embeddings:
- Dimension check (must be 384)
- NaN detection
- All-zeros detection
- Infinity detection

Failed embeddings are logged to `tmp/*-embedding-errors.log`.

### Performance Optimization

#### HNSW Index Parameters

For better search performance, tune HNSW index:

```sql
-- Higher ef_construction = better index quality (slower build)
CREATE INDEX meals_embeddings_embedding_idx
ON meals_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- For search-time tuning
SET hnsw.ef_search = 40;  -- Higher = more accurate (slower)
```

#### Batch Size Tuning

- **Small batch (1-5)**: Lower memory, slower overall
- **Medium batch (10-20)**: Balanced (recommended)
- **Large batch (50+)**: Faster but higher memory usage

```bash
# For limited memory
npx tsx scripts/generate-meal-embeddings.ts --execute --batch-size=5

# For better performance
npx tsx scripts/generate-meal-embeddings.ts --execute --batch-size=20
```

### Monitoring Progress

During generation, you'll see:

```
[Batch 1] Processing 10 meals...

[1/100] (1.0%) Thanksgiving Dinner
  ID: 550e8400-e29b-41d4-a716-446655440000
  ✅ Success (1 attempt)

📊 Progress Report:
  Processed: 10/100 (10.0%)
  Success: 10 | Failed: 0 | Retried: 0
  Elapsed: 45s | ETA: 6m 45s
  Rate: 13.3 meals/min
```

### Error Logs

Check error logs for failed items:

```bash
# View errors
cat tmp/meal-embedding-errors.log
cat tmp/chef-embedding-errors.log

# Count failures
wc -l tmp/meal-embedding-errors.log
```

## Best Practices

1. **Always dry run first**: Test with `--dry-run` before executing
2. **Start small**: Use `--limit=10` to test on small batches
3. **Monitor progress**: Watch for errors and rate limiting
4. **Use checkpoints**: Enable resume for large batches
5. **Verify indexes**: Check HNSW indexes exist after schema creation
6. **Tune thresholds**: Adjust similarity thresholds based on use case
7. **Regular regeneration**: Update embeddings when data changes significantly

## API Reference

### Embedding Generation

```typescript
// Generate meal embedding
import { generateMealEmbedding } from '@/lib/ai/embeddings';

const result = await generateMealEmbedding(
  meal,           // Meal object
  recipeNames,    // Array of recipe names
  { retries: 3 }  // Options (optional)
);

// Returns: { embedding: number[], embeddingText: string, modelName: string }
```

```typescript
// Generate chef embedding
import { generateChefEmbedding } from '@/lib/ai/embeddings';

const result = await generateChefEmbedding(
  chef,           // Chef object
  { retries: 3 }  // Options (optional)
);

// Returns: { embedding: number[], embeddingText: string, modelName: string }
```

### Database Operations

```typescript
// Save meal embedding
import { saveMealEmbedding } from '@/lib/db/meal-chef-embeddings';

await saveMealEmbedding(
  mealId,         // UUID
  embedding,      // number[] (384 dimensions)
  embeddingText,  // string
  modelName       // string (optional, defaults to BAAI/bge-small-en-v1.5)
);
```

```typescript
// Find similar meals
import { findSimilarMeals } from '@/lib/db/meal-chef-embeddings';

const results = await findSimilarMeals(
  queryEmbedding, // number[] (384 dimensions)
  limit,          // number (default: 10)
  minSimilarity   // number (default: 0.3)
);

// Returns: Array<MealEmbedding & { similarity: number; meal?: Meal }>
```

### Statistics

```typescript
// Count embeddings
import { countMealEmbeddings, countChefEmbeddings } from '@/lib/db/meal-chef-embeddings';

const mealCount = await countMealEmbeddings();
const chefCount = await countChefEmbeddings();
```

```typescript
// Get items needing embeddings
import { getMealsNeedingEmbedding, getChefsNeedingEmbedding } from '@/lib/db/meal-chef-embeddings';

const mealsWithoutEmbeddings = await getMealsNeedingEmbedding();
const chefsWithoutEmbeddings = await getChefsNeedingEmbedding();
```

## Next Steps

After generating embeddings:

1. **Implement semantic search UI**: Add search interfaces in your application
2. **Create discovery features**: "Similar meals", "Related chefs", etc.
3. **Build recommendations**: Suggest meals/chefs based on user preferences
4. **Monitor performance**: Track search quality and adjust thresholds
5. **Regular updates**: Regenerate embeddings when content changes

## Resources

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [BAAI/bge-small-en-v1.5 Model](https://huggingface.co/BAAI/bge-small-en-v1.5)
- [HuggingFace Inference API](https://huggingface.co/docs/api-inference/index)
- [HNSW Algorithm](https://arxiv.org/abs/1603.09320)
- [Cosine Similarity](https://en.wikipedia.org/wiki/Cosine_similarity)
