# Pagination & Performance Guide

Complete guide to implementing and using pagination in Recipe Manager for handling 400K+ recipes.

## Overview

The pagination system is designed to handle massive datasets efficiently through:
- **Database indexes** for optimized queries
- **Server-side pagination** with limit/offset
- **Infinite scroll** with intersection observer
- **Client-side filtering** with URL state management
- **Lazy image loading** for performance

---

## Architecture

### Database Layer

#### Performance Indexes

Eight specialized indexes optimize common query patterns:

```sql
-- Rating-based sorting (default)
idx_recipes_rating ON (system_rating DESC, avg_user_rating DESC)

-- Recent recipes
idx_recipes_created ON (created_at DESC)

-- User access control
idx_recipes_user_public ON (user_id, is_public)

-- System/curated recipes
idx_recipes_system ON (is_system_recipe)

-- Cuisine filtering
idx_recipes_cuisine ON (cuisine)

-- Difficulty filtering
idx_recipes_difficulty ON (difficulty)

-- Public recipes composite
idx_recipes_public_system ON (is_public, is_system_recipe)

-- Weekly discovery
idx_recipes_discovery_week ON (discovery_year, discovery_week)
```

#### Query Optimization

Queries use:
- **WHERE clause filtering** before sorting
- **Composite indexes** for multi-column filters
- **Limit/offset pagination** for consistent results
- **Count queries** for pagination metadata
- **NULLS LAST** for rating sort stability

### Server Action Layer

`getRecipesPaginated()` in `src/app/actions/recipes.ts`:

```typescript
interface PaginationParams {
  page?: number;        // Default: 1
  limit?: number;       // Default: 24, Max: 100
  filters?: {
    cuisine?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    minRating?: number;
    tags?: string[];
    userId?: string;
    isSystemRecipe?: boolean;
    isPublic?: boolean;
    searchQuery?: string;
  };
  sort?: 'rating' | 'recent' | 'name'; // Default: rating
}
```

**Returns:**
```typescript
{
  recipes: Recipe[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}
```

### API Route Layer

`/api/recipes/paginated` supports both POST and GET:

**POST** (recommended for complex filters):
```bash
curl -X POST /api/recipes/paginated \
  -H "Content-Type: application/json" \
  -d '{
    "page": 1,
    "limit": 24,
    "filters": {
      "cuisine": "Italian",
      "minRating": 4.0
    },
    "sort": "rating"
  }'
```

**GET** (simple queries):
```bash
curl "/api/recipes/paginated?page=1&limit=24&cuisine=Italian&minRating=4.0"
```

**Response:**
```json
{
  "recipes": [...],
  "pagination": {
    "page": 1,
    "limit": 24,
    "total": 1543,
    "totalPages": 65,
    "hasMore": true
  }
}
```

**Caching:** 60s cache, 120s stale-while-revalidate

### Client Components

#### RecipeInfiniteList

Infinite scroll implementation with:
- **Intersection Observer** for auto-loading
- **Abort controllers** for request cancellation
- **Error handling** with retry
- **Loading states** for UX
- **Empty state** messaging

```tsx
<RecipeInfiniteList
  initialRecipes={recipes}
  initialPagination={pagination}
  filters={filters}
  sort={sort}
  emptyMessage="No recipes found"
/>
```

#### RecipeFilters

URL-based state management for:
- Search query
- Sort order
- Minimum rating
- Difficulty level
- Cuisine type
- System/community toggle

```tsx
<RecipeFilters
  showSearch={true}
  showSystemRecipeFilter={true}
  availableCuisines={['Italian', 'Mexican', 'Asian']}
/>
```

#### RecipeCard

Optimized with:
- `loading="lazy"` for images
- `decoding="async"` for non-blocking
- Background placeholder color
- Responsive aspect ratio
- Hover effects with GPU acceleration

---

## Setup & Installation

### 1. Apply Database Indexes

```bash
# Run migration script
pnpm tsx scripts/apply-performance-indexes.ts

# Or manually via Drizzle
pnpm db:push
```

### 2. Verify Indexes

```sql
-- Check indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'recipes'
  AND indexname LIKE 'idx_recipes_%';

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'recipes';
```

### 3. Update Statistics

```sql
-- Run after bulk imports
ANALYZE recipes;

-- Check table stats
SELECT
  n_live_tup,
  n_dead_tup,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE tablename = 'recipes';
```

---

## Usage Examples

### Basic Pagination

```tsx
// Server component
import { getRecipesPaginated } from '@/app/actions/recipes';

export default async function RecipesPage() {
  const result = await getRecipesPaginated({
    page: 1,
    limit: 24,
    sort: 'rating',
  });

  return (
    <RecipeInfiniteList
      initialRecipes={result.data.recipes}
      initialPagination={result.data.pagination}
    />
  );
}
```

### With Filters

```tsx
const filters = {
  cuisine: 'Italian',
  minRating: 4.0,
  difficulty: 'easy',
  isPublic: true,
};

const result = await getRecipesPaginated({
  page: 1,
  limit: 24,
  filters,
  sort: 'recent',
});
```

### URL-Based Filtering

```tsx
// /recipes?cuisine=Italian&minRating=4.0&sort=rating
export default async function RecipesPage({ searchParams }) {
  const filters = {
    cuisine: searchParams.cuisine,
    minRating: parseFloat(searchParams.minRating || '0'),
  };

  const sort = searchParams.sort || 'rating';

  // Fetch and render...
}
```

### Client-Side Pagination

```tsx
'use client';

const loadMore = async () => {
  const response = await fetch('/api/recipes/paginated', {
    method: 'POST',
    body: JSON.stringify({
      page: currentPage + 1,
      limit: 24,
      filters,
      sort,
    }),
  });

  const data = await response.json();
  setRecipes(prev => [...prev, ...data.recipes]);
  setPagination(data.pagination);
};
```

---

## Performance Targets

### Query Performance

- **First page load:** < 200ms (with indexes)
- **Subsequent pages:** < 150ms (cached query plans)
- **Count queries:** < 50ms (index-only scan)
- **Filter changes:** < 300ms (including re-render)

### Page Load Performance

- **Initial render:** < 2 seconds
- **Infinite scroll:** < 500ms per page
- **Image loading:** Progressive (lazy)
- **Layout stability:** No CLS (Cumulative Layout Shift)

### Scalability

- ✅ **100 recipes:** < 50ms queries
- ✅ **1,000 recipes:** < 100ms queries
- ✅ **10,000 recipes:** < 150ms queries
- ✅ **100,000 recipes:** < 200ms queries
- ✅ **400,000 recipes:** < 250ms queries

---

## Monitoring & Optimization

### Query Analysis

```sql
-- Explain plan for paginated query
EXPLAIN ANALYZE
SELECT *
FROM recipes
WHERE is_public = true
  AND system_rating >= 4.0
ORDER BY system_rating DESC, avg_user_rating DESC
LIMIT 24 OFFSET 0;

-- Expected: Index Scan using idx_recipes_rating
```

### Index Health

```sql
-- Check for bloat
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE tablename = 'recipes';

-- Reindex if needed
REINDEX TABLE recipes;
```

### Performance Metrics

Monitor these key metrics:
- Query execution time (p50, p95, p99)
- Index hit rate (should be > 95%)
- Cache hit rate (should be > 80%)
- Total recipe count
- Concurrent users

---

## Best Practices

### Database

1. **Run ANALYZE** after bulk imports
2. **Monitor index bloat** (reindex if > 20% bloat)
3. **Use prepared statements** (Drizzle does this automatically)
4. **Set appropriate work_mem** for large sorts
5. **Enable query logging** for slow queries (> 1s)

### Server-Side

1. **Cap page size** at 100 items maximum
2. **Validate pagination params** (no negative pages)
3. **Use consistent sorting** for stable pagination
4. **Cache count queries** when possible
5. **Handle edge cases** (empty results, last page)

### Client-Side

1. **Implement loading states** for all async operations
2. **Cancel in-flight requests** when filters change
3. **Show skeleton screens** during initial load
4. **Debounce search input** (300ms)
5. **Provide retry mechanism** on errors

### Images

1. **Use lazy loading** for all recipe images
2. **Set explicit dimensions** to prevent layout shift
3. **Provide placeholder colors** during load
4. **Optimize image formats** (WebP, AVIF)
5. **Use CDN** for external images

---

## Troubleshooting

### Slow Queries

**Problem:** Queries taking > 500ms

**Solutions:**
1. Check if indexes are being used: `EXPLAIN ANALYZE`
2. Run ANALYZE to update statistics
3. Check for sequential scans (bad)
4. Reduce page size
5. Add missing indexes for filter combinations

### High Memory Usage

**Problem:** Server running out of memory

**Solutions:**
1. Reduce page size (default 24 is optimal)
2. Limit concurrent requests
3. Implement request queuing
4. Use streaming for large result sets
5. Enable garbage collection monitoring

### Infinite Scroll Not Working

**Problem:** New pages not loading

**Solutions:**
1. Check browser console for errors
2. Verify API route is accessible
3. Check CORS configuration
4. Verify authentication state
5. Test with network throttling

### Stale Data

**Problem:** Filters not updating results

**Solutions:**
1. Clear Next.js cache: `router.refresh()`
2. Check URL parameter parsing
3. Verify revalidation paths
4. Check cache headers on API routes
5. Force dynamic rendering: `export const dynamic = 'force-dynamic'`

---

## Migration Guide

### From Old System

If migrating from `getRecipes()` to `getRecipesPaginated()`:

1. **Apply database indexes** first
2. **Update page components** to use new action
3. **Add pagination metadata** to UI
4. **Implement infinite scroll** component
5. **Test with production data** volumes

### Rollback Plan

If issues arise:

1. Keep old `getRecipes()` function
2. Use feature flag to toggle implementations
3. Monitor error rates and performance
4. Gradual rollout by user cohort
5. Full rollback if errors > 1%

---

## Testing

### Unit Tests

```typescript
describe('getRecipesPaginated', () => {
  it('returns paginated results', async () => {
    const result = await getRecipesPaginated({
      page: 1,
      limit: 10,
    });

    expect(result.success).toBe(true);
    expect(result.data.recipes).toHaveLength(10);
    expect(result.data.pagination.page).toBe(1);
  });

  it('filters by cuisine', async () => {
    const result = await getRecipesPaginated({
      filters: { cuisine: 'Italian' },
    });

    result.data.recipes.forEach(recipe => {
      expect(recipe.cuisine).toBe('Italian');
    });
  });
});
```

### Load Testing

```bash
# Test pagination endpoint
ab -n 1000 -c 10 \
  -p pagination-request.json \
  -T application/json \
  http://localhost:3004/api/recipes/paginated
```

### Integration Tests

```typescript
test('infinite scroll loads more recipes', async () => {
  const { container } = render(<RecipeInfiniteList {...props} />);

  // Scroll to bottom
  window.scrollTo(0, document.body.scrollHeight);

  // Wait for new recipes to load
  await waitFor(() => {
    expect(screen.getAllByTestId('recipe-card')).toHaveLength(48);
  });
});
```

---

## Future Enhancements

### Planned Features

1. **Cursor-based pagination** (for real-time updates)
2. **Virtual scrolling** (for 10K+ items on screen)
3. **Prefetching** (load next page in background)
4. **Client-side caching** (React Query integration)
5. **GraphQL API** (for flexible querying)

### Performance Improvements

1. **Redis caching** (for hot recipes)
2. **CDN edge caching** (for static content)
3. **Database sharding** (for 1M+ recipes)
4. **Full-text search** (PostgreSQL FTS)
5. **Materialized views** (for complex aggregations)

---

## Support

For issues or questions:
- **GitHub Issues:** Report bugs and feature requests
- **Documentation:** Check guides in `docs/`
- **Performance:** See monitoring dashboards
- **Database:** Check Neon dashboard for query metrics

---

**Last Updated:** 2025-10-15
**Version:** 1.0.0
