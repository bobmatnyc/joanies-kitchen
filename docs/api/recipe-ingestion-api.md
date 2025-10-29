# Recipe Ingestion API

Automated recipe ingestion from URLs using Firecrawl and AI parsing.

## Endpoint

```
POST /api/ingest-recipe
```

## Authentication

Requires `write:recipes` scope. Two authentication methods supported:

1. **API Key (Recommended for automation)**
   ```bash
   Authorization: Bearer <YOUR_API_KEY>
   ```

2. **Clerk Admin Session**
   - Logged in as admin user
   - Session-based authentication

## Request Format

### Single URL

```json
{
  "url": "https://example.com/recipe"
}
```

### Batch URLs

```json
{
  "urls": [
    "https://example.com/recipe1",
    "https://example.com/recipe2",
    "https://example.com/recipe3"
  ]
}
```

## Response Format

### Single URL Success (201 Created)

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

### Single URL Error (400 Bad Request)

```json
{
  "success": false,
  "error": "Failed to fetch content"
}
```

### Batch URLs Success (200 OK)

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

## Default Recipe Settings

All ingested recipes are created with these defaults:

- `is_public: true` - Shared/public by default
- `is_system_recipe: true` - System-managed recipe
- `license: 'PUBLIC_DOMAIN'` - Public domain license
- `chef_id: null` - No chef attribution (unless detected)

## Workflow

1. **Validate URL** - Checks URL format and domain accessibility
2. **Fetch Content** - Uses Firecrawl to scrape page content (handles JS-rendered pages)
3. **Parse with AI** - Claude Sonnet 4.5 extracts structured recipe data
4. **Generate Slug** - Creates SEO-friendly URL slug (auto-handles duplicates)
5. **Check Duplicates** - Prevents duplicate recipes by slug
6. **Generate Embedding** - Creates vector embedding for semantic search (non-blocking)
7. **Save to Database** - Stores recipe with all metadata
8. **Return Result** - Returns recipe info or error details

## Error Handling

### Common Errors

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Invalid URL format | URL is not valid HTTP/HTTPS |
| 400 | Local URLs are not allowed | Localhost/127.0.0.1 not permitted |
| 400 | Failed to fetch content | Firecrawl couldn't access the page |
| 400 | Could not extract valid recipe | Page doesn't contain a recognizable recipe |
| 400 | Recipe already exists | Duplicate slug detected |
| 500 | Internal server error | Server-side processing error |

### Paywalled Content

If a page is behind a paywall or requires authentication, Firecrawl may fail. The API will return:

```json
{
  "success": false,
  "error": "Failed to fetch content"
}
```

## Rate Limiting

- **Single URL**: No rate limit
- **Batch URLs**: 1 second delay between requests (automatic)

For production use, implement additional rate limiting based on your needs.

## Testing

### Test with curl

```bash
# Single URL
curl -X POST http://localhost:3002/api/ingest-recipe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"url": "https://www.sanaacooks.com/blog/tag/Dan+Barber"}'

# Batch URLs
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

### Test with Node.js

```typescript
const response = await fetch('http://localhost:3002/api/ingest-recipe', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY',
  },
  body: JSON.stringify({
    url: 'https://www.sanaacooks.com/blog/tag/Dan+Barber',
  }),
});

const result = await response.json();
console.log(result);
```

## API Information Endpoint

```bash
GET /api/ingest-recipe
```

Returns API documentation and usage examples.

## Production Considerations

1. **Rate Limiting**: Implement per-user/API-key rate limits
2. **Queue System**: For large batch imports, use a job queue (Bull, BullMQ)
3. **Webhook Notifications**: Notify on completion for async processing
4. **Content Validation**: Add additional quality checks for production recipes
5. **License Detection**: Enhance to detect and respect source licenses
6. **Chef Attribution**: Improve chef detection from URL or content

## Example Integrations

### Zapier Webhook

```javascript
// Zapier webhook that ingests recipes from new bookmarks
{
  "url": "{{bookmark_url}}"
}
```

### GitHub Actions

```yaml
# .github/workflows/ingest-recipes.yml
name: Ingest Recipes
on:
  schedule:
    - cron: '0 0 * * *' # Daily at midnight

jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - name: Ingest recipes
        run: |
          curl -X POST https://your-domain.com/api/ingest-recipe \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.API_KEY }}" \
            -d '{"url": "${{ secrets.RECIPE_URL }}"}'
```

### Node.js Script

```typescript
import fs from 'fs';

// Read URLs from file
const urls = fs.readFileSync('recipes.txt', 'utf-8')
  .split('\n')
  .filter(line => line.trim().length > 0);

// Batch ingest
const response = await fetch('http://localhost:3002/api/ingest-recipe', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.API_KEY}`,
  },
  body: JSON.stringify({ urls }),
});

const result = await response.json();
console.log(`Success: ${result.stats.success}/${result.stats.total}`);
```

## Troubleshooting

### "Invalid API key"
- Check that your API key is valid and has `write:recipes` scope
- Ensure Authorization header format: `Bearer <key>`

### "Failed to fetch content"
- URL may be behind a paywall or blocked
- Check that the domain is accessible from your server
- Verify the URL is correct and publicly accessible

### "Could not extract valid recipe"
- Page doesn't contain a recognizable recipe
- Content may be too fragmented or poorly structured
- Try a different recipe page from the same site

### "Recipe already exists"
- A recipe with the same slug already exists
- Check existing recipes at `/recipes/<slug>`
- Manually delete the duplicate if needed

## Security

- API keys are hashed with SHA-256 before storage
- All requests are logged for audit purposes
- Failed authentication attempts are tracked
- Usage statistics are recorded per API key

## Related Documentation

- [API Authentication Guide](./AUTHENTICATION.md)
- [API Key Management](./api-keys-schema.md)
- [Recipe Ingestion Parser](../../src/lib/ai/recipe-ingestion-parser.ts)
- [Firecrawl Client](../../src/lib/firecrawl/client.ts)
