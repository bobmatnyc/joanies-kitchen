# Brave Search API Route

## Quick Reference

**Endpoint:** `POST /api/brave-search`
**Auth:** Required (Clerk)

## Request
```json
{
  "query": "recipe search term",
  "count": 10
}
```

## Response
```json
{
  "web": {
    "results": [
      {
        "title": "Recipe Title",
        "url": "https://example.com",
        "description": "Recipe description"
      }
    ]
  }
}
```

## Security Features
- ✅ Clerk authentication required
- ✅ Input validation (query, count)
- ✅ API key protection (never exposed)
- ✅ Comprehensive error handling
- ✅ Rate limit handling
- ✅ Method restriction (POST only)

## Error Codes
- `401` - Not authenticated
- `400` - Invalid request
- `429` - Rate limit exceeded
- `503` - Service unavailable
- `500` - Server error

## Environment Setup
```bash
# .env.local
BRAVE_SEARCH_API_KEY=your_api_key_here
```

Get your API key: https://brave.com/search/api/

---

See [BRAVE_SEARCH_API.md](../../../BRAVE_SEARCH_API.md) for full documentation.
