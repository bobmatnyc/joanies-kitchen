# Favorites API Quick Reference

## Endpoints

### Favorites Collection

#### List User's Favorites
```http
GET /api/v1/favorites
```

**Auth**: Required (Bearer token or Clerk session)
**Scope**: `read:favorites`

**Query Parameters**:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `sortBy` - Sort field: `created_at`, `name`, `updated_at` (default: `created_at`)
- `order` - Sort order: `asc`, `desc` (default: `desc`)

**Response**:
```json
{
  "success": true,
  "data": {
    "items": [{ /* Recipe objects */ }],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3,
      "hasMore": true
    }
  }
}
```

---

### Favorites by Recipe

#### Check Favorite Status
```http
GET /api/v1/favorites/:recipeId
```

**Auth**: Required
**Scope**: `read:favorites`

**Response**:
```json
{
  "success": true,
  "data": {
    "isFavorite": true,
    "recipeId": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

#### Add to Favorites
```http
POST /api/v1/favorites/:recipeId
```

**Auth**: Required
**Scope**: `write:favorites`

**Response** (201):
```json
{
  "success": true,
  "data": {
    "message": "Recipe added to favorites",
    "recipeId": "123e4567-e89b-12d3-a456-426614174000",
    "isFavorite": true
  }
}
```

#### Remove from Favorites
```http
DELETE /api/v1/favorites/:recipeId
```

**Auth**: Required
**Scope**: `write:favorites`

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Recipe removed from favorites",
    "recipeId": "123e4567-e89b-12d3-a456-426614174000",
    "isFavorite": false
  }
}
```

---

### Recipe Likes (Alternative Interface)

#### Get Like Status & Count
```http
GET /api/v1/recipes/:id/like
```

**Auth**: Optional (public endpoint)
**Returns user's like status if authenticated**

**Response**:
```json
{
  "success": true,
  "data": {
    "recipeId": "123e4567-e89b-12d3-a456-426614174000",
    "likeCount": 42,
    "isLiked": true  // Only if authenticated
  }
}
```

#### Like Recipe
```http
POST /api/v1/recipes/:id/like
```

**Auth**: Required
**Scope**: `write:favorites`

**Response** (201):
```json
{
  "success": true,
  "data": {
    "message": "Recipe liked",
    "recipeId": "123e4567-e89b-12d3-a456-426614174000",
    "isLiked": true,
    "likeCount": 43
  }
}
```

#### Unlike Recipe
```http
DELETE /api/v1/recipes/:id/like
```

**Auth**: Required
**Scope**: `write:favorites`

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Recipe unliked",
    "recipeId": "123e4567-e89b-12d3-a456-426614174000",
    "isLiked": false,
    "likeCount": 42
  }
}
```

---

## Error Responses

All endpoints return standard error format:

```json
{
  "success": false,
  "error": "Error message",
  "reason": "error_code"
}
```

**Common Error Codes**:
- `401` - Not authenticated (missing or invalid credentials)
- `403` - Insufficient permissions (missing required scope)
- `404` - Recipe not found
- `400` - Invalid parameters (e.g., invalid UUID)
- `500` - Internal server error

---

## Authentication

### Bearer Token (API Key)
```http
Authorization: Bearer <api_key>
```

### Clerk Session (Cookie)
Automatically handled by Next.js middleware for browser requests.

---

## Example Usage

### JavaScript/TypeScript

```typescript
// Add to favorites
const response = await fetch('/api/v1/favorites/123e4567-e89b-12d3-a456-426614174000', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`
  }
});

const result = await response.json();
if (result.success) {
  console.log('Added to favorites!');
}

// List favorites with pagination
const favorites = await fetch('/api/v1/favorites?page=1&limit=10&sortBy=name&order=asc', {
  headers: {
    'Authorization': `Bearer ${apiKey}`
  }
});

const data = await favorites.json();
console.log(data.data.items); // Array of recipes
console.log(data.data.pagination.hasMore); // true/false

// Get like count (public, no auth)
const likes = await fetch('/api/v1/recipes/123e4567-e89b-12d3-a456-426614174000/like');
const likeData = await likes.json();
console.log(`This recipe has ${likeData.data.likeCount} likes`);
```

### cURL

```bash
# List favorites
curl -H "Authorization: Bearer your_api_key" \
  "https://your-domain.com/api/v1/favorites?page=1&limit=20"

# Add to favorites
curl -X POST \
  -H "Authorization: Bearer your_api_key" \
  "https://your-domain.com/api/v1/favorites/123e4567-e89b-12d3-a456-426614174000"

# Remove from favorites
curl -X DELETE \
  -H "Authorization: Bearer your_api_key" \
  "https://your-domain.com/api/v1/favorites/123e4567-e89b-12d3-a456-426614174000"

# Get like count (public, no auth needed)
curl "https://your-domain.com/api/v1/recipes/123e4567-e89b-12d3-a456-426614174000/like"

# Like a recipe
curl -X POST \
  -H "Authorization: Bearer your_api_key" \
  "https://your-domain.com/api/v1/recipes/123e4567-e89b-12d3-a456-426614174000/like"
```

---

## Notes

- **Idempotent Operations**: Adding/removing favorites multiple times is safe
- **Likes = Favorites**: Both endpoints modify the same underlying data
- **Public Like Counts**: Anyone can see how many likes a recipe has
- **Private User Likes**: Individual user's like status requires authentication
- **Recipe Validation**: All operations verify the recipe exists before proceeding
- **UUID Format**: Recipe IDs must be valid UUIDs (e.g., `123e4567-e89b-12d3-a456-426614174000`)
