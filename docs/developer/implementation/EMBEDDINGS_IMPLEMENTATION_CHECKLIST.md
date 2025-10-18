# Meal & Chef Embeddings Implementation Checklist

Quick reference for implementing and using meal and chef embeddings.

## ✅ What's Already Done

### Core Implementation
- [x] Database schema created (`src/lib/db/embeddings-schema.ts`)
- [x] Database helper functions (`src/lib/db/meal-chef-embeddings.ts`)
- [x] Embedding text builders added to `src/lib/ai/embeddings.ts`
- [x] Meal embeddings generation script (`scripts/generate-meal-embeddings.ts`)
- [x] Chef embeddings generation script (`scripts/generate-chef-embeddings.ts`)
- [x] Schema migration script (`scripts/apply-embeddings-schema.ts`)
- [x] NPM scripts added to `package.json`
- [x] Comprehensive documentation created
- [x] Quick start guide created

## 🔧 Setup Steps (Do These First)

### 1. Add HuggingFace API Key
```bash
# Get from: https://huggingface.co/settings/tokens
echo "HUGGINGFACE_API_KEY=hf_..." >> .env.local
```

### 2. Apply Database Schema
```bash
# Preview changes first
pnpm embeddings:schema:dry-run

# Apply schema
pnpm embeddings:schema
```

This creates:
- `meals_embeddings` table
- `chefs_embeddings` table
- HNSW vector indexes
- Foreign key constraints
- Timestamp indexes

### 3. Verify Schema
```bash
# Check tables exist
psql $DATABASE_URL -c "\dt *embeddings"

# Check indexes exist
psql $DATABASE_URL -c "\di meals_embeddings*"
psql $DATABASE_URL -c "\di chefs_embeddings*"
```

## 🚀 Generate Embeddings (Do These Second)

### Meal Embeddings
```bash
# 1. Test on 10 meals first
pnpm embeddings:meals:test

# 2. If successful, generate all
pnpm embeddings:meals

# 3. If interrupted, resume
pnpm embeddings:meals:resume
```

### Chef Embeddings
```bash
# 1. Test on 10 chefs first
pnpm embeddings:chefs:test

# 2. If successful, generate all
pnpm embeddings:chefs

# 3. If interrupted, resume
pnpm embeddings:chefs:resume
```

## 📋 Integration Steps (Do These Third)

### 1. Create Server Actions

#### Meal Search Action
**File**: `src/app/actions/meal-search.ts`

```typescript
'use server';

import { generateEmbedding } from '@/lib/ai/embeddings';
import { findSimilarMeals } from '@/lib/db/meal-chef-embeddings';

export async function searchMealsBySimilarity(
  query: string,
  limit: number = 10,
  minSimilarity: number = 0.3
) {
  try {
    // Generate embedding from search query
    const queryEmbedding = await generateEmbedding(query);

    // Find similar meals
    const results = await findSimilarMeals(
      queryEmbedding,
      limit,
      minSimilarity
    );

    return { success: true, results };
  } catch (error: any) {
    console.error('Meal search error:', error);
    return { success: false, error: error.message };
  }
}

export async function findSimilarMealsById(
  mealId: string,
  limit: number = 10,
  minSimilarity: number = 0.5
) {
  try {
    const { getMealEmbedding } = await import('@/lib/db/meal-chef-embeddings');

    // Get embedding for this meal
    const mealEmbedding = await getMealEmbedding(mealId);
    if (!mealEmbedding) {
      return { success: false, error: 'Meal embedding not found' };
    }

    // Find similar meals
    const results = await findSimilarMeals(
      mealEmbedding.embedding,
      limit + 1, // +1 to exclude self
      minSimilarity
    );

    // Filter out the query meal itself
    const filtered = results.filter((r: any) => r.meal_id !== mealId);

    return { success: true, results: filtered.slice(0, limit) };
  } catch (error: any) {
    console.error('Similar meals error:', error);
    return { success: false, error: error.message };
  }
}
```

#### Chef Search Action
**File**: `src/app/actions/chef-search.ts`

```typescript
'use server';

import { generateEmbedding } from '@/lib/ai/embeddings';
import { findSimilarChefs } from '@/lib/db/meal-chef-embeddings';

export async function searchChefsBySimilarity(
  query: string,
  limit: number = 10,
  minSimilarity: number = 0.3
) {
  try {
    // Generate embedding from search query
    const queryEmbedding = await generateEmbedding(query);

    // Find similar chefs
    const results = await findSimilarChefs(
      queryEmbedding,
      limit,
      minSimilarity
    );

    return { success: true, results };
  } catch (error: any) {
    console.error('Chef search error:', error);
    return { success: false, error: error.message };
  }
}

export async function findSimilarChefsById(
  chefId: string,
  limit: number = 10,
  minSimilarity: number = 0.5
) {
  try {
    const { getChefEmbedding } = await import('@/lib/db/meal-chef-embeddings');

    // Get embedding for this chef
    const chefEmbedding = await getChefEmbedding(chefId);
    if (!chefEmbedding) {
      return { success: false, error: 'Chef embedding not found' };
    }

    // Find similar chefs
    const results = await findSimilarChefs(
      chefEmbedding.embedding,
      limit + 1, // +1 to exclude self
      minSimilarity
    );

    // Filter out the query chef itself
    const filtered = results.filter((r: any) => r.chef_id !== chefId);

    return { success: true, results: filtered.slice(0, limit) };
  } catch (error: any) {
    console.error('Similar chefs error:', error);
    return { success: false, error: error.message };
  }
}
```

### 2. Create UI Components

#### Meal Search Component
**File**: `src/components/search/MealSemanticSearch.tsx`

```typescript
'use client';

import { useState } from 'react';
import { searchMealsBySimilarity } from '@/app/actions/meal-search';
import { MealCard } from '@/components/meals/MealCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function MealSemanticSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await searchMealsBySimilarity(query, 10, 0.3);
      if (response.success) {
        setResults(response.results);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search meals... (e.g., 'holiday dinner', 'quick weeknight')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((result) => (
          <MealCard key={result.meal_id} meal={result} />
        ))}
      </div>
    </div>
  );
}
```

#### Chef Search Component
**File**: `src/components/search/ChefSemanticSearch.tsx`

```typescript
'use client';

import { useState } from 'react';
import { searchChefsBySimilarity } from '@/app/actions/chef-search';
import { ChefCard } from '@/components/chef/ChefCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function ChefSemanticSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await searchChefsBySimilarity(query, 10, 0.3);
      if (response.success) {
        setResults(response.results);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search chefs... (e.g., 'italian cuisine', 'baking expert')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((result) => (
          <ChefCard key={result.chef_id} chef={result} />
        ))}
      </div>
    </div>
  );
}
```

### 3. Add to Pages

#### Meals Search Page
**File**: `src/app/meals/search/page.tsx`

```typescript
import { MealSemanticSearch } from '@/components/search/MealSemanticSearch';

export default function MealsSearchPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Search Meals</h1>
      <MealSemanticSearch />
    </div>
  );
}
```

#### Chefs Discovery Page
**File**: `src/app/discover/chefs/page.tsx` (or update existing)

```typescript
import { ChefSemanticSearch } from '@/components/search/ChefSemanticSearch';

export default function ChefsDiscoveryPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Discover Chefs</h1>
      <ChefSemanticSearch />
    </div>
  );
}
```

## ✨ Feature Ideas

### "Similar Meals" Widget
```typescript
// On meal detail page
import { findSimilarMealsById } from '@/app/actions/meal-search';

export async function SimilarMealsWidget({ mealId }: { mealId: string }) {
  const response = await findSimilarMealsById(mealId, 6, 0.5);

  if (!response.success || response.results.length === 0) {
    return null;
  }

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-bold mb-4">Similar Meals</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {response.results.map((meal) => (
          <MealCard key={meal.meal_id} meal={meal} />
        ))}
      </div>
    </section>
  );
}
```

### "Related Chefs" Widget
```typescript
// On chef profile page
import { findSimilarChefsById } from '@/app/actions/chef-search';

export async function RelatedChefsWidget({ chefId }: { chefId: string }) {
  const response = await findSimilarChefsById(chefId, 4, 0.5);

  if (!response.success || response.results.length === 0) {
    return null;
  }

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-bold mb-4">Similar Chefs</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {response.results.map((chef) => (
          <ChefCard key={chef.chef_id} chef={chef} />
        ))}
      </div>
    </section>
  );
}
```

## 🧪 Testing Checklist

- [ ] Schema applied successfully
- [ ] Can generate 10 meal embeddings (test)
- [ ] Can generate 10 chef embeddings (test)
- [ ] Embeddings exist in database
- [ ] HNSW indexes created
- [ ] Meal similarity search works
- [ ] Chef similarity search works
- [ ] Server actions created and working
- [ ] UI components render correctly
- [ ] Search returns relevant results

## 📊 Monitoring

### Check Embedding Coverage
```sql
-- Meal coverage
SELECT
  (SELECT COUNT(*) FROM meals_embeddings) as with_embeddings,
  (SELECT COUNT(*) FROM meals) as total_meals,
  ROUND(100.0 * (SELECT COUNT(*) FROM meals_embeddings) / (SELECT COUNT(*) FROM meals), 2) as coverage_pct;

-- Chef coverage
SELECT
  (SELECT COUNT(*) FROM chefs_embeddings) as with_embeddings,
  (SELECT COUNT(*) FROM chefs) as total_chefs,
  ROUND(100.0 * (SELECT COUNT(*) FROM chefs_embeddings) / (SELECT COUNT(*) FROM chefs), 2) as coverage_pct;
```

### Performance Metrics
```sql
-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE indexname LIKE '%embeddings%';
```

## 📚 Documentation

- **Comprehensive Guide**: `docs/guides/EMBEDDINGS_GENERATION_GUIDE.md`
- **Quick Start**: `scripts/README-MEAL-CHEF-EMBEDDINGS.md`
- **Implementation Summary**: `MEAL_CHEF_EMBEDDINGS_SUMMARY.md`
- **This Checklist**: `EMBEDDINGS_IMPLEMENTATION_CHECKLIST.md`

## 🆘 Troubleshooting

### Common Issues

1. **API Key Missing**
   ```
   ❌ HUGGINGFACE_API_KEY not configured
   ```
   **Fix**: Add to `.env.local`

2. **Model Loading**
   ```
   ⏳ Model loading... retrying
   ```
   **Fix**: Wait (automatic retry)

3. **Rate Limiting**
   ```
   ⏳ Retry 1/3...
   ```
   **Fix**: Increase delay: `--delay=3000`

4. **pgvector Missing**
   ```
   ❌ pgvector extension not installed
   ```
   **Fix**: `CREATE EXTENSION vector;`

## 🎯 Success Criteria

You're done when:
- ✅ All embeddings generated (100% coverage)
- ✅ Server actions work correctly
- ✅ UI components render properly
- ✅ Search returns relevant results
- ✅ Similarity thresholds tuned
- ✅ Performance is acceptable
- ✅ Error monitoring in place

## 🚢 Production Deployment

1. Verify all environment variables set
2. Apply schema to production database
3. Generate embeddings in batches
4. Monitor error logs
5. Verify index performance
6. Set up alerts for failures

## 💡 Tips

- Always test with small batches first (`--limit=10`)
- Use dry-run mode before execution
- Monitor checkpoint files during generation
- Adjust similarity thresholds per use case
- Regenerate embeddings when data changes significantly

---

**Next**: Start with setup steps, then generate embeddings, then build UI integration.
