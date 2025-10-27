# Joanie's Kitchen REST API Documentation

**Version**: 1.0
**Base URL**: `https://your-domain.com/api/v1`
**Last Updated**: October 27, 2025

Welcome to the Joanie's Kitchen REST API documentation. This API enables programmatic access to recipes, meals, shopping lists, and more.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [Base URL & Versioning](#base-url--versioning)
- [Request/Response Format](#requestresponse-format)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [API Resources](#api-resources)
- [Additional Documentation](#additional-documentation)

---

## Quick Start

### 1. Get Your API Key

API keys can only be created through the web interface using your Clerk session:

```bash
# Login to https://your-domain.com
# Navigate to Settings > API Keys
# Click "Create API Key"
# Copy the key immediately (shown only once!)
```

### 2. Make Your First Request

```bash
curl -X GET "https://your-domain.com/api/v1/recipes" \
  -H "Authorization: Bearer jk_live_abc123..." \
  -H "Content-Type: application/json"
```

### 3. Create a Recipe

```bash
curl -X POST "https://your-domain.com/api/v1/recipes" \
  -H "Authorization: Bearer jk_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Chocolate Chip Cookies",
    "description": "Classic homemade cookies",
    "ingredients": [
      "2 cups all-purpose flour",
      "1 cup butter, softened",
      "3/4 cup brown sugar",
      "2 eggs",
      "2 cups chocolate chips"
    ],
    "instructions": [
      "Preheat oven to 375°F",
      "Cream butter and sugar",
      "Add eggs and mix well",
      "Gradually add flour",
      "Fold in chocolate chips",
      "Bake for 10-12 minutes"
    ],
    "prep_time": 15,
    "cook_time": 12,
    "servings": 24
  }'
```

---

## Authentication

The Joanie's Kitchen API supports two authentication methods:

### 1. API Keys (Recommended for Programmatic Access)

Use API keys for server-to-server communication, mobile apps, or scripts:

```bash
Authorization: Bearer jk_live_abc123...
```

**Key Format**:
- Production: `jk_live_` + random string
- Development: `jk_test_` + random string

**Creating API Keys**:
- Must be created via Clerk session (web interface)
- Cannot create API keys using another API key (security)
- Keys are shown only once at creation
- Each key has specific scopes (permissions)

See [AUTHENTICATION.md](./AUTHENTICATION.md) for detailed examples.

### 2. Clerk Session (Web Interface)

For web applications, use Clerk's session-based authentication. The API will automatically detect and use the Clerk session if no `Authorization` header is provided.

**Authentication Priority**:
1. `Authorization: Bearer <api_key>` (highest priority)
2. `Authorization: Basic <credentials>` (not yet implemented)
3. Clerk session cookies (web apps)
4. Unauthenticated (will return 401)

---

## Base URL & Versioning

### Base URL

```
https://your-domain.com/api/v1
```

### Versioning

The API uses URL-based versioning:
- **Current version**: `v1`
- **Stability**: Stable (production-ready)
- **Breaking changes**: Will result in a new version (v2)

All endpoints are prefixed with `/api/v1`.

---

## Request/Response Format

### Content Type

All requests and responses use JSON:

```
Content-Type: application/json
```

### Standard Response Format

**Success Response**:
```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Error message",
  "details": [
    // Optional validation errors
  ]
}
```

### Pagination

List endpoints support pagination:

```json
{
  "success": true,
  "data": {
    "recipes": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasMore": true
    }
  }
}
```

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| `200` | OK | Request successful |
| `201` | Created | Resource created successfully |
| `400` | Bad Request | Invalid request data |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource not found |
| `500` | Internal Server Error | Server error |

### Error Response Format

```json
{
  "success": false,
  "error": "Human-readable error message",
  "reason": "error_code",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### Common Error Reasons

- `missing_auth`: No authentication provided
- `invalid_credentials`: Invalid API key or session
- `insufficient_scope`: Missing required permissions
- `invalid_format`: Request format invalid
- `not_found`: Resource not found
- `access_denied`: No permission to access resource

---

## Rate Limiting

**Current Status**: Not implemented

Rate limiting will be added in a future release. For now, please:
- Implement exponential backoff for retries
- Cache responses when appropriate
- Batch requests when possible

**Future Limits** (planned):
- 1000 requests per hour per API key
- 100 requests per minute per API key
- Headers will include: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## API Resources

### Authentication & API Keys

Manage API keys for programmatic access:

- `POST /api/v1/auth/keys` - Create API key (Clerk session only)
- `GET /api/v1/auth/keys` - List your API keys
- `GET /api/v1/auth/keys/:id` - Get key details
- `PATCH /api/v1/auth/keys/:id` - Update key
- `DELETE /api/v1/auth/keys/:id` - Revoke key
- `GET /api/v1/auth/keys/:id/usage` - Get usage statistics

**Required Scope**: None (Clerk session required)

[Learn more about authentication →](./AUTHENTICATION.md)

### Recipes

Create, read, update, and delete recipes:

- `GET /api/v1/recipes` - List recipes with filters
- `POST /api/v1/recipes` - Create new recipe
- `GET /api/v1/recipes/:id` - Get recipe details
- `PATCH /api/v1/recipes/:id` - Update recipe
- `DELETE /api/v1/recipes/:id` - Delete recipe
- `GET /api/v1/recipes/:id/similar` - Get similar recipes

**Required Scopes**: `read:recipes`, `write:recipes`, `delete:recipes`

### Meals

Plan complete meals with multiple courses:

- `GET /api/v1/meals` - List meals
- `POST /api/v1/meals` - Create new meal
- `GET /api/v1/meals/:id` - Get meal details
- `PATCH /api/v1/meals/:id` - Update meal
- `DELETE /api/v1/meals/:id` - Delete meal
- `POST /api/v1/meals/:id/recipes` - Add recipe to meal
- `DELETE /api/v1/meals/:id/recipes` - Remove recipe from meal

**Required Scopes**: `read:meals`, `write:meals`, `delete:meals`

### Shopping Lists

Generate and manage shopping lists from meals:

- `GET /api/v1/shopping-lists` - List shopping lists
- `GET /api/v1/shopping-lists/:id` - Get shopping list
- `PATCH /api/v1/shopping-lists/:id` - Update shopping list
- `DELETE /api/v1/shopping-lists/:id` - Delete shopping list
- `POST /api/v1/meals/:id/shopping-list` - Generate from meal
- `GET /api/v1/meals/:id/shopping-list` - Get meal's shopping list

**Required Scopes**: `read:meals`, `write:meals`

---

## Additional Documentation

### Detailed Guides

- **[AUTHENTICATION.md](./AUTHENTICATION.md)** - Complete authentication guide with code examples
- **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - How to test the API with curl, Postman, and code
- **[ENDPOINTS_REFERENCE.md](./ENDPOINTS_REFERENCE.md)** - Complete endpoint reference with schemas

### Security Best Practices

1. **Never commit API keys** - Use environment variables
2. **Use HTTPS only** - All requests must use HTTPS
3. **Rotate keys regularly** - Create new keys, revoke old ones
4. **Use minimal scopes** - Only request permissions you need
5. **Store keys securely** - Use secure key management systems
6. **Monitor usage** - Check API key usage logs regularly

### Support

- **Documentation Issues**: Open an issue on GitHub
- **API Questions**: Contact support@joanies-kitchen.com
- **Feature Requests**: Submit via GitHub Discussions

---

## Examples

### JavaScript/TypeScript (fetch)

```typescript
const apiKey = process.env.JOANIE_API_KEY;

const response = await fetch('https://your-domain.com/api/v1/recipes', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }
});

const result = await response.json();
console.log(result.data.recipes);
```

### Python (requests)

```python
import os
import requests

api_key = os.environ['JOANIE_API_KEY']

response = requests.get(
    'https://your-domain.com/api/v1/recipes',
    headers={
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
)

result = response.json()
print(result['data']['recipes'])
```

### cURL

```bash
curl -X GET "https://your-domain.com/api/v1/recipes" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json"
```

---

## Next Steps

1. [Set up authentication →](./AUTHENTICATION.md)
2. [Test with curl or Postman →](./TESTING_GUIDE.md)
3. [Browse endpoint reference →](./ENDPOINTS_REFERENCE.md)
4. Build something amazing!

---

**Need Help?** Check our [Testing Guide](./TESTING_GUIDE.md) for step-by-step examples.
