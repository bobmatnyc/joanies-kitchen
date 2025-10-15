# Common Issues and Solutions

Frequently encountered problems and their solutions.

## Installation Issues

### Port Already in Use

**Problem:** Port 3004 is already in use

**Solution:**
```bash
# Kill the process using the port
lsof -ti:3004 | xargs kill -9

# Then restart
pnpm dev
```

### Module Not Found Errors

**Problem:** Cannot find module errors after installation

**Solution:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Build Errors

**Problem:** Next.js build fails

**Solution:**
```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
pnpm build
```

## Database Issues

### Database Connection Errors

**Problem:** Cannot connect to database

**Solutions:**

1. **Check DATABASE_URL format:**
```bash
# Should look like:
postgresql://user:password@host:5432/database?sslmode=require
```

2. **Test connection:**
```bash
pnpm db:studio
```

3. **Verify database exists:**
- Check Neon dashboard
- Ensure database is not paused
- Verify network connectivity

### Schema Migration Errors

**Problem:** Schema push fails

**Solution:**
```bash
# Generate migrations first
pnpm db:generate

# Then push
pnpm db:push

# Or use migration
pnpm db:migrate
```

### pgvector Extension Error

**Problem:** `extension "vector" does not exist`

**Solution:**
```sql
-- Connect to your database and run:
CREATE EXTENSION IF NOT EXISTS vector;
```

## Authentication Issues

### Clerk Authentication Not Working

**Problem:** Users cannot sign in

**Solutions:**

1. **Validate Clerk configuration:**
```bash
pnpm auth:validate
```

2. **Check environment variables:**
```bash
cat .env.local | grep CLERK
```

3. **Verify keys match:**
- Publishable and secret keys must be from same Clerk instance
- Check for `pk_test_` and `sk_test_` pairing
- Or `pk_live_` and `sk_live_` for production

4. **Check allowed origins:**
- Go to Clerk Dashboard → Configure → Domains
- Ensure `http://localhost:3004` is added for development

### Session Issues

**Problem:** User session not persisting

**Solutions:**

1. **Check cookie settings:**
- Ensure cookies are enabled in browser
- Clear browser cookies and cache

2. **Verify middleware:**
- Check `/src/middleware.ts` is configured correctly

## AI Features Issues

### OpenRouter API Errors

**Problem:** Recipe generation fails

**Solutions:**

1. **Verify API key:**
```bash
cat .env.local | grep OPENROUTER
```

2. **Check API quota:**
- Visit https://openrouter.ai/account
- Verify sufficient credits
- Check rate limits

3. **Test API key:**
```bash
node scripts/test-production-keys.js
```

### Embedding Generation Fails

**Problem:** Semantic search not working

**Solutions:**

1. **Check Hugging Face API key:**
```bash
echo $HUGGINGFACE_API_KEY
```

2. **Note:** Embeddings are optional
- Recipes can be stored without embeddings
- Text search still works
- Only affects semantic search

3. **Regenerate embeddings:**
```bash
npx tsx scripts/test-embeddings.ts
```

## Development Server Issues

### Hot Reload Not Working

**Problem:** Changes not reflecting in browser

**Solutions:**

1. **Restart development server:**
```bash
# Stop the server (Ctrl+C)
pnpm dev
```

2. **Clear Next.js cache:**
```bash
rm -rf .next
pnpm dev
```

### TypeScript Errors

**Problem:** Type checking failures

**Solutions:**

1. **Regenerate types:**
```bash
pnpm db:generate
```

2. **Clear TypeScript cache:**
```bash
rm -rf .next/cache
```

3. **Check TypeScript version:**
```bash
npx tsc --version
# Should be 5.x
```

## Search and Discovery Issues

### No Search Results

**Problem:** Semantic search returns no results

**Solutions:**

1. **Lower similarity threshold:**
```typescript
minSimilarity: 0.3  // Instead of 0.7
```

2. **Check embeddings exist:**
```sql
SELECT COUNT(*) FROM recipe_embeddings;
```

3. **Verify HNSW index:**
```sql
SELECT * FROM pg_indexes WHERE tablename = 'recipe_embeddings';
```

### Recipe Crawl Fails

**Problem:** Recipe discovery not finding recipes

**Solutions:**

1. **Check Brave Search API:**
```bash
node scripts/test-brave-search.js
```

2. **Verify API keys:**
```bash
echo $BRAVE_SEARCH_API_KEY
```

3. **Check logs:**
```bash
pm2 logs recipe-scraper
```

## Performance Issues

### Slow Page Loads

**Solutions:**

1. **Check database connection:**
- Ensure using pooled connection
- Verify Neon database not paused

2. **Optimize queries:**
- Use LIMIT on large result sets
- Add database indexes if needed

3. **Enable caching:**
- Use Next.js caching strategies
- Implement Redis for session storage

### Slow AI Generation

**Solutions:**

1. **Cold start delay is normal:**
- First request may take 5-10 seconds
- Subsequent requests faster

2. **Use faster models:**
```typescript
model: "google/gemini-2.0-flash-exp:free"  // Fastest
```

## Deployment Issues

### Vercel Build Fails

**Problem:** Deployment fails on Vercel

**Solutions:**

1. **Check build locally:**
```bash
pnpm build
```

2. **Verify environment variables:**
- All required vars set in Vercel dashboard
- Correct scope (Production/Preview)

3. **Check build logs:**
```bash
vercel logs
```

### Environment Variables Not Loading

**Problem:** Variables not available in production

**Solutions:**

1. **Verify in Vercel dashboard:**
- Settings → Environment Variables
- Check correct scope selected

2. **Redeploy after adding variables:**
- Trigger new deployment
- Variables only loaded on build

## Getting Additional Help

If issues persist:

1. **Check Logs:**
```bash
# Development
# Check terminal output

# Production (Vercel)
vercel logs
```

2. **Review Documentation:**
- [Installation Guide](../getting-started/installation.md)
- [Environment Setup](../getting-started/environment-setup.md)
- [Authentication Guide](../guides/authentication.md)

3. **Open an Issue:**
- Provide error message
- Include relevant logs
- Describe steps to reproduce

---

**Last Updated:** October 2025
**Version:** 1.0.0
