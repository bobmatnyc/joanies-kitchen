# Recipe Crawl API

## Endpoint

```
POST /api/crawl/weekly
```

## Authentication

- **Localhost**: No authentication required
- **Production**: Requires authentication (to be implemented)

## Request Body

```json
{
  "weeksAgo": 0,        // 0-52, number of weeks ago to search
  "maxResults": 10,     // 1-50, max recipes to discover
  "autoApprove": false, // auto-approve or validate
  "cuisine": "Italian"  // optional cuisine filter
}
```

## Response

```json
{
  "success": true,
  "weekInfo": {
    "year": 2025,
    "week": 42,
    "startDate": "2025-10-14",
    "endDate": "2025-10-20"
  },
  "stats": {
    "searched": 10,
    "converted": 8,
    "approved": 7,
    "stored": 7,
    "failed": 3
  },
  "recipes": [
    {
      "id": "recipe-uuid",
      "name": "Recipe Name",
      "url": "https://example.com/recipe",
      "status": "stored"
    }
  ]
}
```

## Examples

### This Week
```bash
curl -X POST http://localhost:3001/api/crawl/weekly \
  -H "Content-Type: application/json" \
  -d '{"weeksAgo": 0, "maxResults": 10}'
```

### Last Week with Cuisine
```bash
curl -X POST http://localhost:3001/api/crawl/weekly \
  -H "Content-Type: application/json" \
  -d '{"weeksAgo": 1, "maxResults": 10, "cuisine": "Italian"}'
```

### Two Weeks Ago with Auto-Approve
```bash
curl -X POST http://localhost:3001/api/crawl/weekly \
  -H "Content-Type: application/json" \
  -d '{"weeksAgo": 2, "maxResults": 5, "autoApprove": true}'
```

### Node.js/TypeScript
```typescript
const result = await fetch('http://localhost:3001/api/crawl/weekly', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    weeksAgo: 0,
    maxResults: 10,
  }),
});

const data = await result.json();
console.log(data);
```

### Python
```python
import requests

response = requests.post('http://localhost:3001/api/crawl/weekly', json={
    'weeksAgo': 0,
    'maxResults': 10,
    'cuisine': 'Italian'
})

data = response.json()
print(data)
```

## Error Responses

### Invalid Input
```json
{
  "error": "weeksAgo must be a number between 0 and 52"
}
```

### Unauthorized (Production)
```json
{
  "error": "Authentication required"
}
```

### Internal Error
```json
{
  "success": false,
  "error": "Error message",
  "stack": "Stack trace (development only)"
}
```

## Testing

### Check API Status
```bash
curl http://localhost:3001/api/crawl/weekly
```

Response:
```json
{
  "status": "ok",
  "message": "Recipe crawl API is running",
  "usage": {
    "endpoint": "/api/crawl/weekly",
    "method": "POST",
    "body": {
      "weeksAgo": "number (0-52)",
      "cuisine": "string (optional)",
      "maxResults": "number (max 50)",
      "autoApprove": "boolean"
    }
  }
}
```

### Run Test Script
```bash
npm run test:crawl
```

## Pipeline Stages

The API runs a 4-stage pipeline:

1. **Search**: Discovers recipes using Perplexity AI with date filters
2. **Convert**: Extracts recipe data from URLs using Claude Haiku
3. **Approve**: Validates recipe quality and completeness
4. **Store**: Saves to database with embeddings and week tracking

## Rate Limiting

- 2-second delay between recipe processing
- Recommended: No more than 10 recipes per request
- Maximum: 50 recipes per request

## Tips

- Use `autoApprove: false` (default) for quality control
- Start with small `maxResults` (5-10) for testing
- The API may take several minutes for large batches
- Check recipe status in response for failures
- Failed recipes include `reason` field with error details
