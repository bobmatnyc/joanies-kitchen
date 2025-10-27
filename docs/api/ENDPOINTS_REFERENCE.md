# API Endpoints Reference

Complete reference for all Joanie's Kitchen REST API endpoints.

---

## Table of Contents

- [Base URL](#base-url)
- [Authentication & API Keys](#authentication--api-keys)
- [Recipes](#recipes)
- [Meals](#meals)
- [Shopping Lists](#shopping-lists)
- [Common Patterns](#common-patterns)
- [Error Responses](#error-responses)

---

## Base URL

```
https://your-domain.com/api/v1
```

All endpoints are relative to this base URL.

---

## Authentication & API Keys

Manage API keys for programmatic access.

**Important**: API key CRUD operations require Clerk session authentication (not API key auth). This prevents API keys from creating other API keys.

### Create API Key

Create a new API key for the authenticated user.

**Endpoint**: `POST /api/v1/auth/keys`

**Authentication**: Clerk session **ONLY** (API key auth not allowed)

**Required Scope**: None (Clerk session required)

**Request Body**:
```json
{
  "name": "Mobile App",
  "scopes": ["read:recipes", "write:recipes", "read:meals", "write:meals"],
  "description": "API key for iOS mobile app",
  "expiresAt": "2026-12-31T23:59:59Z"
}
```

**Request Schema**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Human-readable key name |
| `scopes` | string[] | Yes | Array of permission scopes |
| `description` | string | No | Optional description |
| `expiresAt` | string | No | ISO 8601 expiration date |

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "apiKey": "jk_live_abc123def456...",
    "keyPrefix": "jk_live_abc1",
    "name": "Mobile App",
    "scopes": ["read:recipes", "write:recipes", "read:meals", "write:meals"],
    "description": "API key for iOS mobile app",
    "expiresAt": "2026-12-31T23:59:59Z",
    "createdAt": "2025-10-27T12:00:00Z",
    "warning": "This key will only be shown once. Store it securely."
  }
}
```

**Important**: The full `apiKey` is shown **only once**. Store it securely!

**Example**:
```bash
curl -X POST "https://your-domain.com/api/v1/auth/keys" \
  -b "cookies.txt" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mobile App",
    "scopes": ["read:recipes", "write:recipes"],
    "description": "iOS mobile app key"
  }'
```

---

### List API Keys

Get all API keys for the authenticated user.

**Endpoint**: `GET /api/v1/auth/keys`

**Authentication**: Clerk session ONLY

**Required Scope**: None

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "keyPrefix": "jk_live_abc1",
      "name": "Mobile App",
      "scopes": ["read:recipes", "write:recipes"],
      "description": "iOS mobile app key",
      "isActive": true,
      "lastUsedAt": "2025-10-27T11:30:00Z",
      "totalRequests": 1523,
      "expiresAt": null,
      "environment": "production",
      "createdAt": "2025-10-20T10:00:00Z",
      "updatedAt": "2025-10-27T11:30:00Z"
    }
  ]
}
```

**Example**:
```bash
curl -X GET "https://your-domain.com/api/v1/auth/keys" \
  -b "cookies.txt"
```

---

### Get API Key Details

Get details for a specific API key.

**Endpoint**: `GET /api/v1/auth/keys/:id`

**Authentication**: Clerk session or API key (can view own details)

**Required Scope**: None

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | API key ID (UUID) |

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "keyPrefix": "jk_live_abc1",
    "name": "Mobile App",
    "scopes": ["read:recipes", "write:recipes"],
    "description": "iOS mobile app key",
    "isActive": true,
    "lastUsedAt": "2025-10-27T11:30:00Z",
    "totalRequests": 1523,
    "expiresAt": null,
    "environment": "production",
    "createdAt": "2025-10-20T10:00:00Z",
    "updatedAt": "2025-10-27T11:30:00Z"
  }
}
```

**Example**:
```bash
curl -X GET "https://your-domain.com/api/v1/auth/keys/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $JOANIE_API_KEY"
```

---

### Update API Key

Update an API key's name, scopes, or description.

**Endpoint**: `PATCH /api/v1/auth/keys/:id`

**Authentication**: Clerk session ONLY

**Required Scope**: None

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | API key ID (UUID) |

**Request Body** (all fields optional):
```json
{
  "name": "Updated Mobile App",
  "scopes": ["read:recipes", "write:recipes", "read:meals"],
  "description": "Updated description"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "keyPrefix": "jk_live_abc1",
    "name": "Updated Mobile App",
    "scopes": ["read:recipes", "write:recipes", "read:meals"],
    "description": "Updated description",
    "isActive": true,
    "updatedAt": "2025-10-27T12:00:00Z"
  }
}
```

**Example**:
```bash
curl -X PATCH "https://your-domain.com/api/v1/auth/keys/550e8400-e29b-41d4-a716-446655440000" \
  -b "cookies.txt" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Mobile App",
    "scopes": ["read:recipes", "write:recipes", "read:meals"]
  }'
```

---

### Revoke API Key

Revoke (delete) an API key. This action is permanent.

**Endpoint**: `DELETE /api/v1/auth/keys/:id`

**Authentication**: Clerk session ONLY

**Required Scope**: None

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | API key ID (UUID) |

**Response** (200 OK):
```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

**Example**:
```bash
curl -X DELETE "https://your-domain.com/api/v1/auth/keys/550e8400-e29b-41d4-a716-446655440000" \
  -b "cookies.txt"
```

---

### Get API Key Usage Statistics

Get usage statistics for an API key.

**Endpoint**: `GET /api/v1/auth/keys/:id/usage`

**Authentication**: Clerk session or API key (can view own usage)

**Required Scope**: None

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | API key ID (UUID) |

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | No | Start date (ISO 8601) |
| `endDate` | string | No | End date (ISO 8601) |
| `groupBy` | string | No | Group by: `day`, `hour` |

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "keyId": "550e8400-e29b-41d4-a716-446655440000",
    "totalRequests": 1523,
    "successfulRequests": 1498,
    "failedRequests": 25,
    "lastUsedAt": "2025-10-27T11:30:00Z",
    "topEndpoints": [
      { "endpoint": "/api/v1/recipes", "count": 856 },
      { "endpoint": "/api/v1/meals", "count": 423 }
    ]
  }
}
```

**Example**:
```bash
curl -X GET "https://your-domain.com/api/v1/auth/keys/550e8400-e29b-41d4-a716-446655440000/usage?startDate=2025-10-01&endDate=2025-10-27" \
  -H "Authorization: Bearer $JOANIE_API_KEY"
```

---

## Recipes

Create, read, update, and delete recipes.

### List Recipes

Get a paginated list of recipes with optional filtering.

**Endpoint**: `GET /api/v1/recipes`

**Authentication**: Clerk session or API key

**Required Scope**: `read:recipes`

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max: 100) |
| `search` | string | - | Text search query |
| `tags` | string | - | Comma-separated tag list |
| `cuisine` | string | - | Filter by cuisine type |
| `difficulty` | string | - | Filter: `easy`, `medium`, `hard` |
| `isPublic` | boolean | - | Filter by public status |
| `sortBy` | string | created_at | Sort field: `created_at`, `updated_at`, `name` |
| `order` | string | desc | Sort order: `asc`, `desc` |

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "recipes": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Chocolate Chip Cookies",
        "description": "Classic homemade cookies",
        "ingredients": ["2 cups flour", "1 cup butter", "..."],
        "instructions": ["Preheat oven...", "Mix ingredients..."],
        "prep_time": 15,
        "cook_time": 12,
        "servings": 24,
        "difficulty": "easy",
        "cuisine": "American",
        "is_public": false,
        "user_id": "user_123",
        "created_at": "2025-10-27T10:00:00Z",
        "updated_at": "2025-10-27T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 42,
      "totalPages": 3,
      "hasMore": true
    }
  }
}
```

**Example**:
```bash
# List all recipes
curl -X GET "https://your-domain.com/api/v1/recipes" \
  -H "Authorization: Bearer $JOANIE_API_KEY"

# Search recipes
curl -X GET "https://your-domain.com/api/v1/recipes?search=chocolate&difficulty=easy&limit=10" \
  -H "Authorization: Bearer $JOANIE_API_KEY"

# Filter by tags
curl -X GET "https://your-domain.com/api/v1/recipes?tags=dessert,baking" \
  -H "Authorization: Bearer $JOANIE_API_KEY"
```

---

### Create Recipe

Create a new recipe.

**Endpoint**: `POST /api/v1/recipes`

**Authentication**: Clerk session or API key

**Required Scope**: `write:recipes`

**Request Body**:
```json
{
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
  "servings": 24,
  "difficulty": "easy",
  "cuisine": "American",
  "tags": ["dessert", "cookies", "baking"],
  "is_public": false,
  "is_meal_prep_friendly": true,
  "nutrition_info": {
    "calories": 150,
    "protein": "2g",
    "carbs": "18g",
    "fat": "8g"
  },
  "video_url": "https://youtube.com/watch?v=...",
  "source": "Family Recipe",
  "license": "CC_BY"
}
```

**Request Schema**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Recipe name |
| `description` | string | No | Recipe description |
| `ingredients` | string[] | Yes | List of ingredients |
| `instructions` | string[] | Yes | Step-by-step instructions |
| `prep_time` | number | No | Prep time in minutes |
| `cook_time` | number | No | Cook time in minutes |
| `servings` | number | No | Number of servings |
| `difficulty` | string | No | `easy`, `medium`, or `hard` |
| `cuisine` | string | No | Cuisine type |
| `tags` | string[] | No | Recipe tags |
| `images` | string[] | No | Image URLs |
| `is_public` | boolean | No | Public/private (default: false) |
| `is_meal_prep_friendly` | boolean | No | Meal prep friendly |
| `nutrition_info` | object | No | Nutritional information |
| `video_url` | string | No | Video tutorial URL |
| `source` | string | No | Recipe source |
| `license` | string | No | License type |

**License Options**: `PUBLIC_DOMAIN`, `CC_BY`, `CC_BY_SA`, `CC_BY_NC`, `CC_BY_NC_SA`, `ALL_RIGHTS_RESERVED`

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Chocolate Chip Cookies",
    "description": "Classic homemade cookies",
    "ingredients": ["2 cups flour", "..."],
    "instructions": ["Preheat oven...", "..."],
    "prep_time": 15,
    "cook_time": 12,
    "servings": 24,
    "difficulty": "easy",
    "user_id": "user_123",
    "created_at": "2025-10-27T12:00:00Z",
    "updated_at": "2025-10-27T12:00:00Z"
  }
}
```

**Example**:
```bash
curl -X POST "https://your-domain.com/api/v1/recipes" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Chocolate Chip Cookies",
    "ingredients": ["flour", "butter", "sugar", "eggs", "chocolate chips"],
    "instructions": ["Mix ingredients", "Bake at 375F for 12 minutes"],
    "prep_time": 15,
    "cook_time": 12,
    "servings": 24
  }'
```

---

### Get Recipe

Get a single recipe by ID or slug.

**Endpoint**: `GET /api/v1/recipes/:id`

**Authentication**: Clerk session or API key

**Required Scope**: `read:recipes`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Recipe ID or slug |

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Chocolate Chip Cookies",
    "description": "Classic homemade cookies",
    "ingredients": ["2 cups flour", "..."],
    "instructions": ["Preheat oven...", "..."],
    "prep_time": 15,
    "cook_time": 12,
    "servings": 24,
    "difficulty": "easy",
    "cuisine": "American",
    "is_public": false,
    "user_id": "user_123",
    "created_at": "2025-10-27T10:00:00Z",
    "updated_at": "2025-10-27T10:00:00Z"
  }
}
```

**Example**:
```bash
curl -X GET "https://your-domain.com/api/v1/recipes/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $JOANIE_API_KEY"
```

---

### Update Recipe

Update a recipe (partial update).

**Endpoint**: `PATCH /api/v1/recipes/:id`

**Authentication**: Clerk session or API key

**Required Scope**: `write:recipes`

**Authorization**: Must be recipe owner or admin

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Recipe ID or slug |

**Request Body** (all fields optional):
```json
{
  "name": "Updated Recipe Name",
  "difficulty": "medium",
  "prep_time": 20,
  "is_public": true
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Updated Recipe Name",
    "difficulty": "medium",
    "prep_time": 20,
    "is_public": true,
    "updated_at": "2025-10-27T12:30:00Z"
  }
}
```

**Example**:
```bash
curl -X PATCH "https://your-domain.com/api/v1/recipes/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Recipe Name",
    "difficulty": "medium"
  }'
```

---

### Delete Recipe

Delete a recipe.

**Endpoint**: `DELETE /api/v1/recipes/:id`

**Authentication**: Clerk session or API key

**Required Scope**: `delete:recipes`

**Authorization**: Must be recipe owner or admin

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Recipe ID or slug |

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Recipe deleted successfully"
}
```

**Example**:
```bash
curl -X DELETE "https://your-domain.com/api/v1/recipes/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $JOANIE_API_KEY"
```

---

### Get Similar Recipes

Get recipes similar to a specific recipe.

**Endpoint**: `GET /api/v1/recipes/:id/similar`

**Authentication**: Clerk session or API key

**Required Scope**: `read:recipes`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Recipe ID or slug |

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 5 | Number of similar recipes |

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "similar": [
      {
        "id": "...",
        "name": "Oatmeal Cookies",
        "similarity": 0.85,
        "...": "..."
      }
    ]
  }
}
```

**Example**:
```bash
curl -X GET "https://your-domain.com/api/v1/recipes/550e8400-e29b-41d4-a716-446655440000/similar?limit=10" \
  -H "Authorization: Bearer $JOANIE_API_KEY"
```

---

## Meals

Create and manage meal plans with multiple courses.

### List Meals

Get a paginated list of meals.

**Endpoint**: `GET /api/v1/meals`

**Authentication**: Clerk session or API key

**Required Scope**: `read:meals`

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max: 100) |
| `mealType` | string | - | Filter: `breakfast`, `lunch`, `dinner`, `snack`, `dessert` |
| `isTemplate` | boolean | - | Filter by template status |
| `isPublic` | boolean | - | Filter by public status |
| `sortBy` | string | created_at | Sort field |
| `order` | string | desc | Sort order: `asc`, `desc` |

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "meals": [
      {
        "id": "...",
        "name": "Sunday Dinner",
        "description": "Complete family dinner",
        "meal_type": "dinner",
        "serves": 4,
        "is_template": false,
        "is_public": false,
        "created_at": "2025-10-27T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "totalPages": 1,
      "hasMore": false
    }
  }
}
```

**Example**:
```bash
curl -X GET "https://your-domain.com/api/v1/meals?mealType=dinner&limit=10" \
  -H "Authorization: Bearer $JOANIE_API_KEY"
```

---

### Create Meal

Create a new meal, optionally with recipes.

**Endpoint**: `POST /api/v1/meals`

**Authentication**: Clerk session or API key

**Required Scope**: `write:meals`

**Request Body**:
```json
{
  "name": "Sunday Dinner",
  "description": "Complete family dinner",
  "meal_type": "dinner",
  "occasion": "Family Gathering",
  "serves": 4,
  "tags": ["family", "weekend"],
  "is_template": false,
  "is_public": false,
  "estimated_total_cost": "45.00",
  "estimated_cost_per_serving": "11.25",
  "recipes": [
    {
      "recipeId": "recipe-uuid-1",
      "servingMultiplier": 1.0,
      "courseCategory": "main",
      "displayOrder": 1,
      "preparationNotes": "Make ahead"
    },
    {
      "recipeId": "recipe-uuid-2",
      "servingMultiplier": 1.5,
      "courseCategory": "side",
      "displayOrder": 2
    }
  ]
}
```

**Request Schema**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Meal name |
| `description` | string | Yes | Meal description |
| `meal_type` | string | No | Meal type |
| `occasion` | string | No | Special occasion |
| `serves` | number | No | Number of servings |
| `tags` | string[] | No | Meal tags |
| `is_template` | boolean | No | Template status |
| `is_public` | boolean | No | Public/private |
| `recipes` | array | No | Recipes to include |

**Meal Types**: `breakfast`, `brunch`, `lunch`, `dinner`, `snack`, `dessert`, `appetizer`

**Course Categories**: `appetizer`, `main`, `side`, `salad`, `dessert`, `beverage`

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "meal-uuid",
    "name": "Sunday Dinner",
    "description": "Complete family dinner",
    "meal_type": "dinner",
    "serves": 4,
    "created_at": "2025-10-27T12:00:00Z"
  }
}
```

**Example**:
```bash
curl -X POST "https://your-domain.com/api/v1/meals" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sunday Dinner",
    "description": "Complete family dinner",
    "meal_type": "dinner",
    "serves": 4,
    "recipes": [
      {
        "recipeId": "550e8400-...",
        "courseCategory": "main",
        "servingMultiplier": 1.0
      }
    ]
  }'
```

---

### Get Meal

Get a single meal with all recipes.

**Endpoint**: `GET /api/v1/meals/:id`

**Authentication**: Clerk session or API key

**Required Scope**: `read:meals`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Meal ID (UUID) |

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "meal-uuid",
    "name": "Sunday Dinner",
    "description": "Complete family dinner",
    "meal_type": "dinner",
    "serves": 4,
    "recipes": [
      {
        "mealRecipe": {
          "course_category": "main",
          "serving_multiplier": "1.00",
          "display_order": 1
        },
        "recipe": {
          "id": "recipe-uuid",
          "name": "Grilled Chicken",
          "...": "..."
        }
      }
    ],
    "created_at": "2025-10-27T10:00:00Z"
  }
}
```

**Example**:
```bash
curl -X GET "https://your-domain.com/api/v1/meals/meal-uuid" \
  -H "Authorization: Bearer $JOANIE_API_KEY"
```

---

### Update Meal

Update a meal (partial update).

**Endpoint**: `PATCH /api/v1/meals/:id`

**Authentication**: Clerk session or API key

**Required Scope**: `write:meals`

**Authorization**: Must be meal owner or admin

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Meal ID (UUID) |

**Request Body** (all fields optional):
```json
{
  "name": "Updated Meal Name",
  "serves": 6,
  "is_public": true
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "meal-uuid",
    "name": "Updated Meal Name",
    "serves": 6,
    "is_public": true,
    "updated_at": "2025-10-27T12:30:00Z"
  }
}
```

**Example**:
```bash
curl -X PATCH "https://your-domain.com/api/v1/meals/meal-uuid" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Meal Name",
    "serves": 6
  }'
```

---

### Delete Meal

Delete a meal.

**Endpoint**: `DELETE /api/v1/meals/:id`

**Authentication**: Clerk session or API key

**Required Scope**: `delete:meals`

**Authorization**: Must be meal owner or admin

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Meal ID (UUID) |

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Meal deleted successfully"
}
```

**Example**:
```bash
curl -X DELETE "https://your-domain.com/api/v1/meals/meal-uuid" \
  -H "Authorization: Bearer $JOANIE_API_KEY"
```

---

### Add Recipe to Meal

Add a recipe to an existing meal.

**Endpoint**: `POST /api/v1/meals/:id/recipes`

**Authentication**: Clerk session or API key

**Required Scope**: `write:meals`

**Authorization**: Must be meal owner or admin

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Meal ID (UUID) |

**Request Body**:
```json
{
  "recipeId": "recipe-uuid",
  "servingMultiplier": 1.5,
  "courseCategory": "side",
  "displayOrder": 3,
  "preparationNotes": "Prepare in advance"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "meal_id": "meal-uuid",
    "recipe_id": "recipe-uuid",
    "course_category": "side",
    "serving_multiplier": "1.50",
    "display_order": 3
  }
}
```

**Example**:
```bash
curl -X POST "https://your-domain.com/api/v1/meals/meal-uuid/recipes" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "recipeId": "recipe-uuid",
    "courseCategory": "side",
    "servingMultiplier": 1.5
  }'
```

---

### Remove Recipe from Meal

Remove a recipe from a meal.

**Endpoint**: `DELETE /api/v1/meals/:id/recipes`

**Authentication**: Clerk session or API key

**Required Scope**: `write:meals`

**Authorization**: Must be meal owner or admin

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Meal ID (UUID) |

**Request Body**:
```json
{
  "recipeId": "recipe-uuid"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Recipe removed from meal"
}
```

**Example**:
```bash
curl -X DELETE "https://your-domain.com/api/v1/meals/meal-uuid/recipes" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "recipeId": "recipe-uuid"
  }'
```

---

## Shopping Lists

Generate and manage shopping lists from meals.

### Generate Shopping List

Generate a shopping list from a meal's recipes.

**Endpoint**: `POST /api/v1/meals/:id/shopping-list`

**Authentication**: Clerk session or API key

**Required Scope**: `write:meals`

**Authorization**: Must be meal owner or admin

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Meal ID (UUID) |

**Request Body**: Empty (`{}`)

**Features**:
- Consolidates ingredients with smart quantity merging
- Filters out non-purchasable items (water, ice, etc.)
- Groups by category (produce, proteins, dairy, etc.)
- Tracks which recipes each ingredient comes from

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "shopping-list-uuid",
    "meal_id": "meal-uuid",
    "name": "Sunday Dinner Shopping List",
    "items": [
      {
        "name": "chicken breast",
        "quantity": 2,
        "unit": "lbs",
        "category": "proteins",
        "checked": false,
        "from_recipes": ["Grilled Chicken"],
        "estimated_price": "8.99"
      },
      {
        "name": "broccoli",
        "quantity": 2,
        "unit": "cups",
        "category": "produce",
        "checked": false,
        "from_recipes": ["Roasted Vegetables"]
      }
    ],
    "status": "draft",
    "created_at": "2025-10-27T12:00:00Z",
    "updated_at": "2025-10-27T12:00:00Z"
  }
}
```

**Example**:
```bash
curl -X POST "https://your-domain.com/api/v1/meals/meal-uuid/shopping-list" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

### Get Meal's Shopping List

Get the shopping list for a meal.

**Endpoint**: `GET /api/v1/meals/:id/shopping-list`

**Authentication**: Clerk session or API key

**Required Scope**: `read:meals`

**Authorization**: Must be meal owner (or public meal)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Meal ID (UUID) |

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "shopping-list-uuid",
    "meal_id": "meal-uuid",
    "name": "Sunday Dinner Shopping List",
    "items": [...],
    "status": "active",
    "created_at": "2025-10-27T12:00:00Z"
  }
}
```

**Response** (200 OK - No List):
```json
{
  "success": true,
  "data": null
}
```

**Example**:
```bash
curl -X GET "https://your-domain.com/api/v1/meals/meal-uuid/shopping-list" \
  -H "Authorization: Bearer $JOANIE_API_KEY"
```

---

### List Shopping Lists

Get all shopping lists for the authenticated user.

**Endpoint**: `GET /api/v1/shopping-lists`

**Authentication**: Clerk session or API key

**Required Scope**: `read:meals`

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter: `draft`, `active`, `completed` |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "shoppingLists": [
      {
        "id": "shopping-list-uuid",
        "meal_id": "meal-uuid",
        "name": "Sunday Dinner Shopping List",
        "status": "active",
        "total_items": 12,
        "checked_items": 5,
        "created_at": "2025-10-27T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1,
      "hasMore": false
    }
  }
}
```

**Example**:
```bash
curl -X GET "https://your-domain.com/api/v1/shopping-lists?status=active" \
  -H "Authorization: Bearer $JOANIE_API_KEY"
```

---

### Get Shopping List

Get a specific shopping list by ID.

**Endpoint**: `GET /api/v1/shopping-lists/:id`

**Authentication**: Clerk session or API key

**Required Scope**: `read:meals`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Shopping list ID (UUID) |

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "shopping-list-uuid",
    "meal_id": "meal-uuid",
    "name": "Sunday Dinner Shopping List",
    "items": [...],
    "status": "active",
    "created_at": "2025-10-27T12:00:00Z"
  }
}
```

**Example**:
```bash
curl -X GET "https://your-domain.com/api/v1/shopping-lists/shopping-list-uuid" \
  -H "Authorization: Bearer $JOANIE_API_KEY"
```

---

### Update Shopping List

Update a shopping list (mark items as checked, update status, etc.).

**Endpoint**: `PATCH /api/v1/shopping-lists/:id`

**Authentication**: Clerk session or API key

**Required Scope**: `write:meals`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Shopping list ID (UUID) |

**Request Body** (all fields optional):
```json
{
  "name": "Updated List Name",
  "status": "completed",
  "items": [
    {
      "name": "chicken breast",
      "quantity": 2,
      "unit": "lbs",
      "checked": true
    }
  ]
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "shopping-list-uuid",
    "name": "Updated List Name",
    "status": "completed",
    "updated_at": "2025-10-27T13:00:00Z"
  }
}
```

**Example**:
```bash
curl -X PATCH "https://your-domain.com/api/v1/shopping-lists/shopping-list-uuid" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed"
  }'
```

---

### Delete Shopping List

Delete a shopping list.

**Endpoint**: `DELETE /api/v1/shopping-lists/:id`

**Authentication**: Clerk session or API key

**Required Scope**: `write:meals`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Shopping list ID (UUID) |

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Shopping list deleted successfully"
}
```

**Example**:
```bash
curl -X DELETE "https://your-domain.com/api/v1/shopping-lists/shopping-list-uuid" \
  -H "Authorization: Bearer $JOANIE_API_KEY"
```

---

## Common Patterns

### Standard Response Format

All endpoints return a standard response format:

**Success**:
```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

**Error**:
```json
{
  "success": false,
  "error": "Error message",
  "reason": "error_code",
  "details": [
    // Optional validation errors
  ]
}
```

### Pagination

List endpoints return paginated results:

```json
{
  "success": true,
  "data": {
    "items": [...],
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

### Ownership Verification

Endpoints that modify resources (PATCH, DELETE) verify ownership:
- User must own the resource
- OR user must be admin
- Public resources can be read by anyone

### Timestamps

All resources include timestamps:
- `created_at`: ISO 8601 creation timestamp
- `updated_at`: ISO 8601 last update timestamp
- `last_used_at`: ISO 8601 last usage (API keys)

---

## Error Responses

### HTTP Status Codes

| Code | Meaning | When it occurs |
|------|---------|----------------|
| `200` | OK | Request successful |
| `201` | Created | Resource created |
| `400` | Bad Request | Invalid request data |
| `401` | Unauthorized | Missing/invalid auth |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource not found |
| `500` | Internal Server Error | Server error |

### Error Reason Codes

| Reason | Description |
|--------|-------------|
| `missing_auth` | No authentication provided |
| `invalid_credentials` | Invalid API key or session |
| `insufficient_scope` | Missing required scope |
| `invalid_format` | Request format invalid |
| `not_found` | Resource not found |
| `access_denied` | No permission to access |

### Example Error Responses

**401 Unauthorized**:
```json
{
  "success": false,
  "error": "Authentication required",
  "reason": "missing_auth"
}
```

**403 Forbidden**:
```json
{
  "success": false,
  "error": "Insufficient permissions",
  "reason": "insufficient_scope",
  "details": {
    "required": ["write:recipes"],
    "provided": ["read:recipes"]
  }
}
```

**400 Validation Error**:
```json
{
  "success": false,
  "error": "Invalid request body",
  "details": [
    {
      "field": "ingredients",
      "message": "Required"
    },
    {
      "field": "servings",
      "message": "Expected number, received string"
    }
  ]
}
```

**404 Not Found**:
```json
{
  "success": false,
  "error": "Recipe not found"
}
```

---

## Next Steps

- [Test these endpoints →](./TESTING_GUIDE.md)
- [Learn about authentication →](./AUTHENTICATION.md)
- [Return to API overview →](./README.md)

---

**Questions?** Check our [Testing Guide](./TESTING_GUIDE.md) for examples or review the [Authentication Guide](./AUTHENTICATION.md).
