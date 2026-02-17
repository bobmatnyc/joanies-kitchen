# Chefs REST API - Quick Reference

## Base URL
```
http://localhost:3000/api/v1/chefs
```

## Authentication
All endpoints require authentication via Clerk session or API key.

Include in headers:
```
Authorization: Bearer YOUR_TOKEN
```

## Endpoints

### 1. List Chefs
```http
GET /api/v1/chefs
```

**Query Parameters:**
- `search` - Text search (name, bio, specialties)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `sortBy` - Sort field: `name`, `recipe_count`, `created_at`, `updated_at`
- `order` - Sort order: `asc`, `desc`
- `includeInactive` - Include inactive chefs (default: false)

**Example:**
```bash
curl "http://localhost:3000/api/v1/chefs?limit=10&sortBy=recipe_count&order=desc" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "chefs": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 42,
      "totalPages": 5,
      "hasMore": true
    }
  }
}
```

**Required Scope:** `read:chefs`

---

### 2. Create Chef (Admin)
```http
POST /api/v1/chefs
```

**Request Body:**
```json
{
  "slug": "gordon-ramsay",
  "name": "Gordon Ramsay",
  "display_name": "Chef Gordon Ramsay",
  "bio": "British celebrity chef and restaurateur",
  "profile_image_url": "https://example.com/gordon.jpg",
  "website": "https://gordonramsay.com",
  "social_links": {
    "instagram": "https://instagram.com/gordonramsay",
    "twitter": "https://twitter.com/gordonramsay"
  },
  "specialties": ["British", "Fine Dining", "Television"],
  "is_verified": true,
  "is_active": true,
  "location_city": "London",
  "location_country": "United Kingdom"
}
```

**Example:**
```bash
curl -X POST "http://localhost:3000/api/v1/chefs" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug":"test-chef","name":"Test Chef"}'
```

**Required Scope:** `write:chefs`

---

### 3. Get Chef by Slug
```http
GET /api/v1/chefs/:slug
```

**Example:**
```bash
curl "http://localhost:3000/api/v1/chefs/kenji-lopez-alt" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "slug": "kenji-lopez-alt",
    "name": "J. Kenji López-Alt",
    "recipe_count": 150,
    ...
  }
}
```

**Required Scope:** `read:chefs`

---

### 4. Update Chef (Admin)
```http
PATCH /api/v1/chefs/:slug
```

**Request Body:** (all fields optional)
```json
{
  "bio": "Updated biography",
  "specialties": ["Asian", "Science", "Technique"],
  "is_verified": true
}
```

**Example:**
```bash
curl -X PATCH "http://localhost:3000/api/v1/chefs/kenji-lopez-alt" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bio":"Updated bio"}'
```

**Required Scope:** `write:chefs`

---

### 5. Delete Chef (Admin)
```http
DELETE /api/v1/chefs/:slug
```

**Example:**
```bash
curl -X DELETE "http://localhost:3000/api/v1/chefs/test-chef" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "chefId": "uuid"
  }
}
```

**Required Scope:** `delete:chefs`

---

### 6. Get Chef Recipes
```http
GET /api/v1/chefs/:slug/recipes
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 24, max: 100)

**Example:**
```bash
curl "http://localhost:3000/api/v1/chefs/kenji-lopez-alt/recipes?page=1&limit=12" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recipes": [...],
    "pagination": {
      "page": 1,
      "limit": 12,
      "total": 150,
      "totalPages": 13,
      "hasMore": true
    }
  }
}
```

**Required Scopes:** `read:chefs` AND `read:recipes`

---

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": "Error message"
}
```

**Common Status Codes:**
- `400` - Invalid request (validation error, slug conflict)
- `401` - Not authenticated
- `403` - Insufficient permissions
- `404` - Chef not found
- `500` - Internal server error

---

## Scopes Required

| Endpoint | Scopes |
|----------|--------|
| GET /chefs | `read:chefs` |
| POST /chefs | `write:chefs` |
| GET /chefs/:slug | `read:chefs` |
| PATCH /chefs/:slug | `write:chefs` |
| DELETE /chefs/:slug | `delete:chefs` |
| GET /chefs/:slug/recipes | `read:chefs`, `read:recipes` |

---

## Testing with curl

### Create API Key (if needed)
```bash
# Create via admin interface or API
# Then use in Authorization header
```

### Test Sequence
```bash
# 1. List chefs
curl "http://localhost:3000/api/v1/chefs" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Create test chef (admin)
curl -X POST "http://localhost:3000/api/v1/chefs" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug":"test-123","name":"Test Chef"}'

# 3. Get chef
curl "http://localhost:3000/api/v1/chefs/test-123" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Update chef (admin)
curl -X PATCH "http://localhost:3000/api/v1/chefs/test-123" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bio":"Updated"}'

# 5. Get recipes
curl "http://localhost:3000/api/v1/chefs/test-123/recipes" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 6. Delete chef (admin)
curl -X DELETE "http://localhost:3000/api/v1/chefs/test-123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Implementation Files

```
src/lib/validations/chef-api.ts          - Validation schemas
src/app/api/v1/chefs/route.ts            - List, Create
src/app/api/v1/chefs/[slug]/route.ts     - Get, Update, Delete
src/app/api/v1/chefs/[slug]/recipes/route.ts - Chef recipes
```

---

## Next Steps

1. Start development server: `npm run dev`
2. Ensure database is running and migrated
3. Obtain authentication token (Clerk or API key)
4. Test endpoints using curl or API client
5. Check logs for any errors

For detailed implementation docs, see: `CHEFS_API_IMPLEMENTATION.md`
