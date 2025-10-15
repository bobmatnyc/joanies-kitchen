# Pagination Quick Start Guide

Get pagination up and running in 5 minutes.

## Prerequisites

- PostgreSQL database (Neon or local)
- Next.js 15 application running
- Drizzle ORM configured

## Step 1: Apply Database Indexes (2 minutes)

```bash
# Option 1: Run the script
pnpm db:indexes

# Option 2: Manual migration
pnpm db:push
```

**Verify indexes were created:**
```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'recipes' AND indexname LIKE 'idx_recipes_%';
```

Expected output: 8 indexes (rating, created, user_public, system, cuisine, difficulty, public_system, discovery_week)

## Step 2: Test the API (1 minute)

```bash
# Test paginated endpoint
curl "http://localhost:3004/api/recipes/paginated?page=1&limit=10&sort=rating"
```

Expected response:
```json
{
  "recipes": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 123,
    "totalPages": 13,
    "hasMore": true
  }
}
```

## Step 3: Visit Updated Pages (1 minute)

Open in browser:
- **My Recipes:** http://localhost:3004/recipes
- **Shared Recipes:** http://localhost:3004/shared

You should see:
- ✅ Filters at the top (search, sort, rating, difficulty, cuisine)
- ✅ Recipe cards in a grid
- ✅ Infinite scroll (load more as you scroll)
- ✅ Total count displayed
- ✅ "That's all!" message at the end

## Step 4: Test Filtering (1 minute)

Try these interactions:
1. **Search:** Type in search box (e.g., "pasta")
2. **Sort:** Change sort order (rating, recent, name)
3. **Filter:** Set minimum rating, difficulty, cuisine
4. **Scroll:** Scroll down to load more recipes
5. **URL State:** Notice URL updates with filters

## Troubleshooting

### Indexes Not Created

**Problem:** Script fails with permission error

**Solution:**
```bash
# Check database connection
psql $DATABASE_URL -c "SELECT version();"

# Run SQL manually
psql $DATABASE_URL -f drizzle/add-performance-indexes.sql
```

### API Returns Empty

**Problem:** `/api/recipes/paginated` returns no recipes

**Solution:**
```bash
# Check if you have recipes in database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM recipes;"

# Check authentication
curl "http://localhost:3004/api/recipes/paginated?isPublic=true"
```

### Infinite Scroll Not Working

**Problem:** Scrolling doesn't load more recipes

**Solution:**
1. Open browser DevTools → Console
2. Check for JavaScript errors
3. Verify `pagination.hasMore` is true
4. Check Network tab for failed requests

### Filters Not Updating

**Problem:** Changing filters doesn't update results

**Solution:**
1. Check URL updates when you change filters
2. Verify `RecipeFilters` component is rendered
3. Clear browser cache and reload
4. Check console for errors

## Performance Verification

### Test Query Speed

```bash
# Time a query
time curl "http://localhost:3004/api/recipes/paginated?page=1&limit=24"
```

Expected: < 500ms total time

### Test with Load

```bash
# Install apache bench (if not installed)
# macOS: brew install httpd
# Ubuntu: sudo apt-get install apache2-utils

# Run load test
ab -n 100 -c 10 http://localhost:3004/api/recipes/paginated?page=1&limit=24
```

Expected:
- Requests per second: > 20
- Time per request: < 500ms (mean)
- Failed requests: 0

### Check Database Performance

```sql
-- Check if indexes are being used
EXPLAIN ANALYZE
SELECT * FROM recipes
WHERE is_public = true
ORDER BY system_rating DESC, avg_user_rating DESC
LIMIT 24 OFFSET 0;

-- Look for: "Index Scan using idx_recipes_rating"
-- NOT: "Seq Scan on recipes"
```

## Next Steps

### Optimize Further

1. **Add Redis caching** (for hot recipes)
   ```bash
   pnpm add @vercel/kv
   ```

2. **Enable CDN caching** (for images)
   - Use Vercel Image Optimization
   - Or CloudFlare Images

3. **Implement prefetching** (next page)
   ```tsx
   // In RecipeInfiniteList
   useEffect(() => {
     // Prefetch next page when 80% scrolled
     if (scrollPercentage > 80) {
       prefetchNextPage();
     }
   }, [scrollPercentage]);
   ```

### Monitor Performance

1. **Set up monitoring:**
   - Vercel Analytics
   - Sentry for errors
   - New Relic for APM

2. **Track key metrics:**
   - API response time (p50, p95, p99)
   - Recipe list load time
   - Infinite scroll latency
   - Error rate

3. **Set alerts:**
   - API response > 1s
   - Error rate > 1%
   - 5xx responses > 0.1%

### Scale to 400K+ Recipes

When you have large datasets:

1. **Increase database resources**
   - More CPU/RAM for Postgres
   - Consider read replicas

2. **Add database connection pooling**
   ```bash
   pnpm add pg-pool
   ```

3. **Implement query result caching**
   - Cache popular filters
   - Cache count queries
   - Use stale-while-revalidate

4. **Consider alternative pagination**
   - Cursor-based (for real-time updates)
   - Keyset pagination (faster for large offsets)

## Success Criteria

✅ **Database:**
- 8 indexes created on recipes table
- ANALYZE completed
- Query plans use indexes (not seq scans)

✅ **API:**
- Response time < 500ms
- Correct pagination metadata
- Handles edge cases (empty, last page)

✅ **UI:**
- Initial load < 2 seconds
- Smooth infinite scroll
- Filters work correctly
- Images load lazily
- No layout shifts

✅ **Performance:**
- Works with 100 recipes: < 50ms
- Works with 1,000 recipes: < 100ms
- Works with 10,000 recipes: < 150ms
- Works with 100,000 recipes: < 200ms
- Works with 400,000 recipes: < 300ms

## Resources

- **Full Guide:** [PAGINATION_GUIDE.md](./PAGINATION_GUIDE.md)
- **API Reference:** [API Documentation](../api/RECIPES_API.md)
- **Performance:** [PERFORMANCE.md](../reference/PERFORMANCE.md)
- **Database:** [DATABASE.md](../reference/DATABASE.md)

## Support

Having issues? Check:
1. **Console logs** (browser DevTools)
2. **Network requests** (DevTools Network tab)
3. **Database logs** (Neon dashboard)
4. **Application logs** (Vercel logs)

Still stuck? Create an issue with:
- Error messages
- Browser/Node version
- Database stats (row count, index list)
- Steps to reproduce

---

**Setup Time:** ~5 minutes
**Difficulty:** Easy
**Last Updated:** 2025-10-15
