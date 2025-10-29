# Recipe Ingestion API - Quick Start Guide

Get started with the Recipe Ingestion API in 5 minutes.

## Step 1: Generate API Key

### Option A: Use Test Script (Recommended)

The test script will automatically create a temporary API key:

```bash
npx tsx scripts/test-ingest-api.ts "https://www.sanaacooks.com/blog/tag/Dan+Barber"
```

### Option B: Create Permanent Key

```typescript
import { generateApiKey } from '@/lib/api-auth/key-generator';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/api-keys-schema';
import { SCOPES } from '@/lib/api-auth/scopes';

// Generate key
const generated = generateApiKey('development', 32);
console.log('API Key:', generated.key); // SAVE THIS!

// Save to database
await db.insert(apiKeys).values({
  user_id: 'your-user-id',
  name: 'My Recipe Ingestion Key',
  key_hash: generated.hash,
  key_prefix: generated.prefix,
  scopes: [SCOPES.WRITE_RECIPES, SCOPES.READ_RECIPES],
  is_active: true,
  environment: 'development',
  description: 'Key for recipe ingestion',
});
```

## Step 2: Test the API

### Single URL

```bash
curl -X POST http://localhost:3002/api/ingest-recipe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"url": "https://www.sanaacooks.com/blog/tag/Dan+Barber"}'
```

### Batch URLs

```bash
curl -X POST http://localhost:3002/api/ingest-recipe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "urls": [
      "https://example.com/recipe1",
      "https://example.com/recipe2"
    ]
  }'
```

## Step 3: Verify Results

### Check Database

```sql
-- View ingested recipes
SELECT id, name, slug, source, is_public, is_system_recipe, license
FROM recipes
ORDER BY created_at DESC
LIMIT 10;

-- View embeddings
SELECT recipe_id, model_name, created_at
FROM recipe_embeddings
ORDER BY created_at DESC
LIMIT 10;
```

### Check Web UI

Visit: `http://localhost:3002/recipes/{slug}`

## Common Use Cases

### 1. Import Single Recipe

```bash
curl -X POST http://localhost:3002/api/ingest-recipe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"url": "https://example.com/recipe"}'
```

### 2. Batch Import from File

Create `recipes.txt`:
```
https://example.com/recipe1
https://example.com/recipe2
https://example.com/recipe3
```

Then run:
```bash
# Convert to JSON array
URLS=$(cat recipes.txt | jq -R -s -c 'split("\n") | map(select(length > 0))')

curl -X POST http://localhost:3002/api/ingest-recipe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d "{\"urls\": $URLS}"
```

### 3. Automated Daily Import

Create `import-daily.sh`:
```bash
#!/bin/bash

# Your API key
API_KEY="jk_test_abc123..."

# Today's recipes
URLS='[
  "https://example.com/todays-recipe-1",
  "https://example.com/todays-recipe-2"
]'

curl -X POST http://localhost:3002/api/ingest-recipe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "{\"urls\": $URLS}"
```

Schedule with cron:
```bash
# Run daily at 6 AM
0 6 * * * /path/to/import-daily.sh
```

### 4. Node.js Integration

```typescript
async function ingestRecipe(url: string) {
  const response = await fetch('http://localhost:3002/api/ingest-recipe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.API_KEY}`,
    },
    body: JSON.stringify({ url }),
  });

  const result = await response.json();

  if (result.success) {
    console.log('Recipe ingested:', result.recipe.name);
    console.log('View at:', result.recipe.url);
  } else {
    console.error('Error:', result.error);
  }

  return result;
}

// Example usage
await ingestRecipe('https://example.com/recipe');
```

## Troubleshooting

### "Invalid API key" or "Authentication required"

1. Check API key format: `jk_test_...` or `jk_live_...`
2. Verify key is in database: `SELECT * FROM api_keys WHERE key_prefix = 'jk_test_abc1'`
3. Check key is active: `is_active = true`
4. Verify scopes include `write:recipes`

### "Failed to fetch content"

1. Check URL is publicly accessible (not behind paywall)
2. Verify URL is valid HTTP/HTTPS
3. Try accessing URL in browser
4. Check Firecrawl API key is set: `FIRECRAWL_API_KEY`

### "Could not extract valid recipe"

1. Page may not contain a recipe
2. Content may be too fragmented
3. Try a different recipe page from the same site

### "Recipe already exists"

1. Check existing recipes: `SELECT * FROM recipes WHERE slug = 'recipe-slug'`
2. Delete duplicate if needed: `DELETE FROM recipes WHERE id = 'uuid'`
3. Slug is generated from recipe name

## Response Examples

### Success

```json
{
  "success": true,
  "recipe": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Classic Pasta Carbonara",
    "slug": "classic-pasta-carbonara",
    "url": "/recipes/classic-pasta-carbonara"
  }
}
```

### Error

```json
{
  "success": false,
  "error": "Failed to fetch content"
}
```

### Batch Success

```json
{
  "success": true,
  "stats": {
    "total": 3,
    "success": 2,
    "failed": 1,
    "successRate": "66.7%"
  },
  "results": [
    {
      "url": "https://example.com/recipe1",
      "success": true,
      "recipe": {
        "id": "uuid-1",
        "name": "Recipe 1",
        "slug": "recipe-1",
        "url": "/recipes/recipe-1"
      }
    },
    {
      "url": "https://example.com/recipe2",
      "success": true,
      "recipe": {
        "id": "uuid-2",
        "name": "Recipe 2",
        "slug": "recipe-2",
        "url": "/recipes/recipe-2"
      }
    },
    {
      "url": "https://example.com/recipe3",
      "success": false,
      "error": "Invalid URL format"
    }
  ]
}
```

## API Reference

### Endpoint

```
POST /api/ingest-recipe
```

### Authentication

Required: `write:recipes` scope

```
Authorization: Bearer <API_KEY>
```

### Request Body

Single URL:
```json
{
  "url": "https://example.com/recipe"
}
```

Batch URLs:
```json
{
  "urls": [
    "https://example.com/recipe1",
    "https://example.com/recipe2"
  ]
}
```

### Response Codes

- `201 Created` - Single recipe ingested successfully
- `200 OK` - Batch ingestion completed (may have partial failures)
- `400 Bad Request` - Invalid request or URL
- `401 Unauthorized` - Authentication failed
- `403 Forbidden` - Insufficient permissions
- `500 Internal Server Error` - Server-side error

## Rate Limits

- **Single URL**: No rate limit
- **Batch URLs**: 1 second delay between URLs (automatic)

For production, implement per-API-key rate limits.

## Best Practices

1. **Test in development first** - Use `jk_test_` keys
2. **Use batch for multiple URLs** - More efficient than multiple requests
3. **Handle errors gracefully** - Check `success` field in response
4. **Store API keys securely** - Use environment variables
5. **Monitor usage** - Check `api_key_usage` table
6. **Cleanup test keys** - Delete temporary keys after testing

## Next Steps

- Read [full API documentation](./recipe-ingestion-api.md)
- Learn about [API authentication](./AUTHENTICATION.md)
- Explore [other endpoints](./ENDPOINTS_REFERENCE.md)
- Set up [production deployment](../deployment/PRODUCTION_SETUP.md)

## Support

For issues or questions:
1. Check [troubleshooting section](#troubleshooting)
2. Review [API documentation](./recipe-ingestion-api.md)
3. Check server logs for detailed errors
4. Test with curl to isolate issues
