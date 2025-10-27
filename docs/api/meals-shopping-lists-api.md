# Meals & Shopping Lists REST API v1

Comprehensive REST API endpoints for meal planning and shopping list operations with unified authentication middleware.

## Authentication

All endpoints require authentication via:
- **Clerk Session**: Browser-based authentication
- **API Key**: Machine-to-machine authentication via `Authorization: Bearer <api-key>`

## Scopes Required

| Operation | Scope | Description |
|-----------|-------|-------------|
| List/Read Meals | `read:meals` | View meals and shopping lists |
| Create/Update Meals | `write:meals` | Create and modify meals |
| Delete Meals | `delete:meals` | Remove meals and shopping lists |

---

## Meals Endpoints

### GET /api/v1/meals

List meals for the authenticated user with optional filtering.

**Query Parameters:**
```
page: number (default: 1)
limit: number (default: 20, max: 100)
sortBy: 'created_at' | 'updated_at' | 'name' (default: 'created_at')
order: 'asc' | 'desc' (default: 'desc')
mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert' | 'party' | 'holiday' | 'custom'
isTemplate: boolean
isPublic: boolean
```

**Response:**
```json
{
  "success": true,
  "data": {
    "meals": [
      {
        "id": "uuid",
        "name": "Sunday Dinner",
        "description": "Family meal",
        "meal_type": "dinner",
        "serves": 4,
        "tags": ["family", "sunday"],
        "is_public": false,
        "is_template": false,
        "created_at": "2025-10-27T...",
        "updated_at": "2025-10-27T..."
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

**Errors:**
- `401`: Not authenticated
- `403`: Missing `read:meals` scope
- `400`: Invalid query parameters
- `500`: Internal server error

---

### POST /api/v1/meals

Create a new meal for the authenticated user.

**Request Body:**
```json
{
  "name": "Sunday Dinner",
  "description": "Family meal with roast chicken and sides",
  "meal_type": "dinner",
  "occasion": "Sunday Dinner",
  "serves": 6,
  "tags": ["family", "sunday", "roast"],
  "is_template": false,
  "is_public": false,
  "estimated_total_cost": "45.50",
  "estimated_cost_per_serving": "7.58",
  "recipes": [
    {
      "recipeId": "recipe-uuid-1",
      "servingMultiplier": 1.5,
      "courseCategory": "main",
      "displayOrder": 0,
      "preparationNotes": "Start this first"
    },
    {
      "recipeId": "recipe-uuid-2",
      "servingMultiplier": 1,
      "courseCategory": "side",
      "displayOrder": 1
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "clerk_user_id",
    "name": "Sunday Dinner",
    "description": "Family meal with roast chicken and sides",
    "meal_type": "dinner",
    "serves": 6,
    "slug": "sunday-dinner-2025-10-27",
    "created_at": "2025-10-27T..."
  }
}
```

**Errors:**
- `401`: Not authenticated
- `403`: Missing `write:meals` scope
- `400`: Invalid request body
- `500`: Internal server error

---

### GET /api/v1/meals/:id

Get a single meal by ID with all recipes.

**Path Parameters:**
- `id`: Meal ID (UUID)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Sunday Dinner",
    "description": "Family meal",
    "meal_type": "dinner",
    "serves": 6,
    "recipes": [
      {
        "mealRecipe": {
          "id": "uuid",
          "meal_id": "uuid",
          "recipe_id": "recipe-uuid",
          "course_category": "main",
          "serving_multiplier": "1.50",
          "display_order": 0,
          "preparation_notes": "Start this first"
        },
        "recipe": {
          "id": "recipe-uuid",
          "name": "Roast Chicken",
          "prep_time": 15,
          "cook_time": 90
        }
      }
    ]
  }
}
```

**Errors:**
- `401`: Not authenticated
- `403`: Missing `read:meals` scope or not meal owner
- `404`: Meal not found
- `500`: Internal server error

---

### PATCH /api/v1/meals/:id

Update a meal (partial update).

**Path Parameters:**
- `id`: Meal ID (UUID)

**Request Body:** (all fields optional)
```json
{
  "name": "Updated Sunday Dinner",
  "description": "Updated description",
  "serves": 8,
  "tags": ["family", "updated"],
  "is_public": true,
  "image_url": "https://example.com/meal.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Updated Sunday Dinner",
    "updated_at": "2025-10-27T..."
  }
}
```

**Errors:**
- `401`: Not authenticated
- `403`: Missing `write:meals` scope or not meal owner
- `404`: Meal not found
- `400`: Invalid request body
- `500`: Internal server error

---

### DELETE /api/v1/meals/:id

Delete a meal (hard delete, cascades to meal_recipes).

**Path Parameters:**
- `id`: Meal ID (UUID)

**Response:**
```json
{
  "success": true
}
```

**Errors:**
- `401`: Not authenticated
- `403`: Missing `delete:meals` scope or not meal owner
- `404`: Meal not found
- `500`: Internal server error

---

## Meal Recipes Endpoints

### POST /api/v1/meals/:id/recipes

Add a recipe to a meal.

**Path Parameters:**
- `id`: Meal ID (UUID)

**Request Body:**
```json
{
  "recipeId": "recipe-uuid",
  "servingMultiplier": 1.5,
  "courseCategory": "main",
  "displayOrder": 0,
  "preparationNotes": "Start this first, takes longest"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "meal-recipe-uuid",
    "meal_id": "meal-uuid",
    "recipe_id": "recipe-uuid",
    "course_category": "main",
    "serving_multiplier": "1.50",
    "display_order": 0,
    "preparation_notes": "Start this first, takes longest",
    "created_at": "2025-10-27T..."
  }
}
```

**Errors:**
- `401`: Not authenticated
- `403`: Missing `write:meals` scope or not meal owner
- `404`: Meal not found
- `400`: Invalid request body
- `500`: Internal server error

---

### DELETE /api/v1/meals/:id/recipes

Remove a recipe from a meal.

**Path Parameters:**
- `id`: Meal ID (UUID)

**Query Parameters:**
- `mealRecipeId`: Meal Recipe relationship ID (UUID) - from `meal_recipes` table

**Example:**
```
DELETE /api/v1/meals/meal-uuid/recipes?mealRecipeId=meal-recipe-uuid
```

**Response:**
```json
{
  "success": true
}
```

**Errors:**
- `401`: Not authenticated
- `403`: Missing `write:meals` scope or not meal owner
- `404`: Meal or meal recipe not found
- `400`: Missing `mealRecipeId` query parameter
- `500`: Internal server error

---

## Shopping List Generation

### POST /api/v1/meals/:id/shopping-list

Generate a shopping list from a meal's recipes with smart consolidation.

**Path Parameters:**
- `id`: Meal ID (UUID)

**Request Body:** (empty)
```json
{}
```

**Features:**
- ✅ Consolidates ingredients with smart quantity merging
- ✅ Filters out non-purchaseable items (water, ice)
- ✅ Groups by category (produce, proteins, dairy, etc.)
- ✅ Tracks which recipes each ingredient comes from
- ✅ Applies serving multipliers from meal recipes

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "shopping-list-uuid",
    "user_id": "clerk_user_id",
    "meal_id": "meal-uuid",
    "name": "Sunday Dinner - Shopping List",
    "items": [
      {
        "name": "Tomatoes",
        "quantity": 4,
        "unit": "whole",
        "category": "vegetables",
        "checked": false,
        "from_recipes": ["recipe-uuid-1", "recipe-uuid-2"]
      },
      {
        "name": "Chicken Breast",
        "quantity": 2.5,
        "unit": "lbs",
        "category": "proteins",
        "checked": false,
        "from_recipes": ["recipe-uuid-1"]
      }
    ],
    "status": "draft",
    "created_at": "2025-10-27T...",
    "updated_at": "2025-10-27T..."
  }
}
```

**Errors:**
- `401`: Not authenticated
- `403`: Missing `write:meals` scope or not meal owner
- `404`: Meal not found
- `500`: Internal server error

---

### GET /api/v1/meals/:id/shopping-list

Get existing shopping list for a meal.

**Path Parameters:**
- `id`: Meal ID (UUID)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "shopping-list-uuid",
    "meal_id": "meal-uuid",
    "name": "Sunday Dinner - Shopping List",
    "items": [...],
    "status": "draft",
    "created_at": "2025-10-27T..."
  }
}
```

If no shopping list exists, returns `data: null`.

**Errors:**
- `401`: Not authenticated
- `403`: Missing `read:meals` scope or not meal owner
- `404`: Meal not found
- `500`: Internal server error

---

## Shopping Lists Collection

### GET /api/v1/shopping-lists

List shopping lists for the authenticated user with optional filtering.

**Query Parameters:**
```
page: number (default: 1)
limit: number (default: 20, max: 100)
sortBy: 'created_at' | 'updated_at' | 'name' (default: 'created_at')
order: 'asc' | 'desc' (default: 'desc')
mealId: string (UUID) - filter by meal
status: 'draft' | 'active' | 'shopping' | 'completed' | 'archived'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "shoppingLists": [
      {
        "id": "uuid",
        "meal_id": "meal-uuid",
        "name": "Sunday Dinner - Shopping List",
        "items": [...],
        "status": "draft",
        "created_at": "2025-10-27T..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 3,
      "totalPages": 1,
      "hasMore": false
    }
  }
}
```

**Errors:**
- `401`: Not authenticated
- `403`: Missing `read:meals` scope
- `400`: Invalid query parameters
- `500`: Internal server error

---

## Individual Shopping List

### GET /api/v1/shopping-lists/:id

Get a single shopping list by ID.

**Path Parameters:**
- `id`: Shopping List ID (UUID)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "clerk_user_id",
    "meal_id": "meal-uuid",
    "name": "Sunday Dinner - Shopping List",
    "notes": "Don't forget to check pantry first",
    "items": [
      {
        "name": "Tomatoes",
        "quantity": 4,
        "unit": "whole",
        "category": "vegetables",
        "checked": false,
        "from_recipes": ["recipe-uuid-1"],
        "notes": "Get organic if available"
      }
    ],
    "status": "draft",
    "estimated_total_cost": "45.50",
    "created_at": "2025-10-27T...",
    "updated_at": "2025-10-27T..."
  }
}
```

**Errors:**
- `401`: Not authenticated
- `403`: Missing `read:meals` scope or not shopping list owner
- `404`: Shopping list not found
- `500`: Internal server error

---

### PATCH /api/v1/shopping-lists/:id

Update a shopping list (partial update).

**Path Parameters:**
- `id`: Shopping List ID (UUID)

**Request Body:** (all fields optional)
```json
{
  "name": "Updated Shopping List",
  "notes": "Updated notes",
  "items": [
    {
      "name": "Tomatoes",
      "quantity": 4,
      "unit": "whole",
      "category": "vegetables",
      "checked": true,
      "from_recipes": ["recipe-uuid-1"]
    }
  ],
  "status": "shopping",
  "estimated_total_cost": "48.75"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Updated Shopping List",
    "status": "shopping",
    "updated_at": "2025-10-27T..."
  }
}
```

**Errors:**
- `401`: Not authenticated
- `403`: Missing `write:meals` scope or not shopping list owner
- `404`: Shopping list not found
- `400`: Invalid request body
- `500`: Internal server error

---

### DELETE /api/v1/shopping-lists/:id

Delete a shopping list (hard delete).

**Path Parameters:**
- `id`: Shopping List ID (UUID)

**Response:**
```json
{
  "success": true
}
```

**Errors:**
- `401`: Not authenticated
- `403`: Missing `delete:meals` scope or not shopping list owner
- `404`: Shopping list not found
- `500`: Internal server error

---

## Usage Examples

### Creating a Complete Meal with Recipes

```bash
# 1. Create meal
curl -X POST https://api.example.com/api/v1/meals \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sunday Dinner",
    "description": "Family meal",
    "meal_type": "dinner",
    "serves": 6,
    "recipes": [
      {
        "recipeId": "recipe-uuid-1",
        "servingMultiplier": 1.5,
        "courseCategory": "main"
      }
    ]
  }'

# 2. Generate shopping list
curl -X POST https://api.example.com/api/v1/meals/MEAL_ID/shopping-list \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

# 3. Update shopping list (mark items as checked)
curl -X PATCH https://api.example.com/api/v1/shopping-lists/SHOPPING_LIST_ID \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "shopping",
    "items": [
      {
        "name": "Tomatoes",
        "quantity": 4,
        "unit": "whole",
        "category": "vegetables",
        "checked": true,
        "from_recipes": ["recipe-uuid-1"]
      }
    ]
  }'
```

---

## Implementation Details

### Files Created

1. **Validation Schemas**: `/src/lib/validations/meal-api.ts`
   - Comprehensive Zod schemas for all request/response types
   - Type-safe input validation with descriptive error messages

2. **Meals Collection**: `/src/app/api/v1/meals/route.ts`
   - `GET`: List meals with filtering
   - `POST`: Create meal with optional recipes

3. **Individual Meal**: `/src/app/api/v1/meals/[id]/route.ts`
   - `GET`: Get meal with recipes
   - `PATCH`: Update meal
   - `DELETE`: Delete meal

4. **Meal Recipes**: `/src/app/api/v1/meals/[id]/recipes/route.ts`
   - `POST`: Add recipe to meal
   - `DELETE`: Remove recipe from meal

5. **Shopping List Generation**: `/src/app/api/v1/meals/[id]/shopping-list/route.ts`
   - `POST`: Generate shopping list
   - `GET`: Get existing shopping list

6. **Shopping Lists Collection**: `/src/app/api/v1/shopping-lists/route.ts`
   - `GET`: List shopping lists with filtering

7. **Individual Shopping List**: `/src/app/api/v1/shopping-lists/[id]/route.ts`
   - `GET`: Get shopping list
   - `PATCH`: Update shopping list
   - `DELETE`: Delete shopping list

### Integration with Existing Code

All routes reuse existing server actions from `/src/app/actions/meals.ts`:
- `createMeal()`, `updateMeal()`, `deleteMeal()`
- `getMealById()`, `getUserMeals()`
- `addRecipeToMeal()`, `removeRecipeFromMeal()`
- `generateShoppingList()`, `getShoppingListById()`, `updateShoppingList()`

### Authentication Middleware

Uses unified authentication from `/src/lib/api-auth`:
- `requireScopes()` - Enforces scope-based permissions
- Supports both Clerk sessions and API keys
- Automatic ownership verification for protected resources

### Scopes

- `read:meals` - View meals and shopping lists
- `write:meals` - Create/update meals and shopping lists
- `delete:meals` - Delete meals and shopping lists

---

## Success Criteria

✅ Full CRUD for meals via REST API
✅ Shopping list generation and management
✅ Add/remove recipes from meals
✅ Protected with auth middleware and scopes
✅ Reuses existing server action logic
✅ Proper error handling
✅ TypeScript compiles without errors
✅ Comprehensive validation with Zod
✅ Ownership verification for all mutations
✅ Pagination support for list endpoints
✅ Smart ingredient consolidation in shopping lists
✅ Non-purchaseable item filtering

---

## Next Steps

1. **Testing**: Create integration tests for all endpoints
2. **Documentation**: Add OpenAPI/Swagger specification
3. **Rate Limiting**: Implement rate limiting for API endpoints
4. **Caching**: Add caching layer for frequently accessed meals
5. **Webhooks**: Add webhook support for meal/shopping list events
