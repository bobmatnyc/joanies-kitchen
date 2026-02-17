# Inventory/Fridge REST API Implementation

## Overview
Successfully implemented complete REST API endpoints for user inventory management following existing codebase patterns.

## Files Created

### 1. Validation Schemas
**Location:** `/src/lib/validations/inventory-api.ts`

Zod schemas for request/response validation:
- `createInventoryItemSchema` - Add items to inventory
- `updateInventoryItemSchema` - Update existing items (PATCH)
- `listInventoryQuerySchema` - Query parameters for listing
- `markAsUsedSchema` - Mark items as used/consumed
- `matchRecipesQuerySchema` - Recipe matching parameters

### 2. API Route: Collection Endpoint
**Location:** `/src/app/api/v1/inventory/route.ts`

**Endpoints:**
- `GET /api/v1/inventory` - List user's inventory items
  - Query params: `page`, `limit`, `sortBy`, `order`, `storage`, `status`, `expiringWithinDays`
  - Auth: Required (Clerk)
  - Scopes: `read:inventory`
  - Response: Paginated list of inventory items with ingredient details

- `POST /api/v1/inventory` - Add new item
  - Body: `ingredient_id`, `storage_location`, `quantity`, `unit`, `expiry_date?`, `cost_usd?`, `notes?`
  - Auth: Required (Clerk)
  - Scopes: `write:inventory`
  - Response: Created inventory item

### 3. API Route: Item Operations
**Location:** `/src/app/api/v1/inventory/[id]/route.ts`

**Endpoints:**
- `GET /api/v1/inventory/:id` - Get single item
  - Auth: Required (Clerk)
  - Scopes: `read:inventory`
  - Ownership: Verified
  - Response: Inventory item details

- `PATCH /api/v1/inventory/:id` - Update item
  - Body: Any field from `updateInventoryItemSchema`
  - Auth: Required (Clerk)
  - Scopes: `write:inventory`
  - Ownership: Verified
  - Response: Updated inventory item

- `DELETE /api/v1/inventory/:id` - Remove item
  - Auth: Required (Clerk)
  - Scopes: `delete:inventory`
  - Ownership: Verified
  - Response: `{ deleted: true }`

### 4. API Route: Usage Tracking
**Location:** `/src/app/api/v1/inventory/[id]/use/route.ts`

**Endpoint:**
- `POST /api/v1/inventory/:id/use` - Mark item as used
  - Body: `quantity`, `action?`, `recipe_id?`, `notes?`
  - Auth: Required (Clerk)
  - Scopes: `write:inventory`
  - Ownership: Verified
  - Validation: Quantity doesn't exceed available
  - Response: `{ remainingQuantity: number }`

### 5. API Route: Recipe Matching
**Location:** `/src/app/api/v1/inventory/matches/route.ts`

**Endpoint:**
- `GET /api/v1/inventory/matches` - Find recipes matching inventory
  - Query params: `limit`, `minMatchPercentage`, `prioritizeExpiring`
  - Auth: Required (Clerk)
  - Scopes: `read:inventory`, `read:recipes`
  - Response: Array of recipes with match percentage and missing ingredients

## Implementation Patterns Followed

### 1. Authentication & Authorization
- Used `requireScopes()` middleware for all routes
- Verified resource ownership with `verifyResourceOwnership()` helper
- Proper scope checking: `READ_INVENTORY`, `WRITE_INVENTORY`, `DELETE_INVENTORY`

### 2. Request Validation
- All requests validated with Zod schemas
- Used `parseQueryParams()` for GET requests
- Used `parseJsonBody()` for POST/PATCH requests
- Proper error responses with validation details

### 3. Response Formatting
- Used `apiSuccess()` for successful responses (200, 201)
- Used `apiSuccessPaginated()` for list endpoints
- Used `apiError()` for error responses
- Used `apiNotFound()` and `apiForbidden()` for specific errors

### 4. Service Layer Integration
- All business logic delegated to `InventoryService`
- No direct database queries in routes
- Clean separation of concerns

### 5. Route Parameter Handling
- Used `await getRouteParams(context)` for Next.js 15 compatibility
- Proper async/await handling for route params

## Scopes Configuration

All inventory scopes were already defined in `/src/lib/api-auth/scopes.ts`:
```typescript
READ_INVENTORY: 'read:inventory',
WRITE_INVENTORY: 'write:inventory',
DELETE_INVENTORY: 'delete:inventory',
INVENTORY_ALL: 'inventory:*',
```

## Key Features

### 1. Filtering & Pagination
- Filter by storage location (fridge/freezer/pantry/other)
- Filter by status (fresh/use_soon/expiring/expired/used/wasted)
- Filter by expiring within N days
- Sorting by created_at, updated_at, expiry_date
- Pagination with page/limit parameters

### 2. Ownership Protection
- All operations verify user ownership
- Admin override support built-in
- Proper 403 Forbidden responses for unauthorized access

### 3. Usage Tracking
- Track quantity used
- Link usage to recipes (optional)
- Multiple action types (cooked, eaten_raw, composted, etc.)
- Automatic quantity validation

### 4. Recipe Matching
- Find recipes based on available ingredients
- Match percentage calculation
- Missing ingredients list
- Option to prioritize recipes using expiring ingredients
- Configurable minimum match threshold

## TypeScript Compilation

All files compile successfully with Next.js build system. The routes follow existing patterns from:
- `/src/app/api/v1/recipes/route.ts`
- `/src/app/api/v1/meals/route.ts`

## Integration with Existing Codebase

### Service Layer
Uses existing `InventoryService` from `/src/lib/services/inventory-service.ts`:
- `findByUserId()` - Get user's inventory with filters
- `findById()` - Get single item
- `create()` - Add new item
- `update()` - Update item
- `delete()` - Remove item
- `markAsUsed()` - Track usage
- `matchRecipes()` - Find matching recipes

### API Utilities
Uses existing helpers from `/src/lib/api/`:
- Request parsing: `parseQueryParams()`, `parseJsonBody()`, `getRouteParams()`
- Responses: `apiSuccess()`, `apiError()`, `apiSuccessPaginated()`
- Auth: `verifyResourceOwnership()`
- Query operations: `applyPagination()`, `applySorting()`

### Authentication
Uses existing auth system from `/src/lib/api-auth/`:
- `requireScopes()` middleware
- Clerk integration
- Scope-based permissions

## Testing Recommendations

1. **Unit Tests**: Test each endpoint with valid/invalid data
2. **Auth Tests**: Verify ownership checks work correctly
3. **Integration Tests**: Test full user flow (add → use → match recipes)
4. **Edge Cases**:
   - Using more quantity than available
   - Accessing other user's items
   - Expired items in recipe matching
   - Empty inventory recipe matching

## Example API Calls

### Add Item to Inventory
```bash
POST /api/v1/inventory
Content-Type: application/json
Authorization: Bearer <token>

{
  "ingredient_id": "uuid-here",
  "storage_location": "fridge",
  "quantity": 2.5,
  "unit": "lbs",
  "expiry_date": "2026-02-20",
  "cost_usd": 5.99,
  "notes": "From farmers market"
}
```

### List Inventory (Expiring Soon)
```bash
GET /api/v1/inventory?expiringWithinDays=3&sortBy=expiry_date&order=asc
Authorization: Bearer <token>
```

### Mark as Used
```bash
POST /api/v1/inventory/{id}/use
Content-Type: application/json
Authorization: Bearer <token>

{
  "quantity": 1.0,
  "action": "cooked",
  "recipe_id": "recipe-uuid",
  "notes": "Used for dinner"
}
```

### Match Recipes
```bash
GET /api/v1/inventory/matches?minMatchPercentage=70&prioritizeExpiring=true&limit=10
Authorization: Bearer <token>
```

## Completion Status

✅ All 4 route files created
✅ Validation schemas implemented
✅ Scopes already defined (no changes needed)
✅ TypeScript compilation successful
✅ Follows existing codebase patterns
✅ Proper error handling
✅ Authentication and authorization
✅ Service layer integration

## Net LOC Impact

**Added:**
- `/src/lib/validations/inventory-api.ts`: ~135 lines
- `/src/app/api/v1/inventory/route.ts`: ~160 lines
- `/src/app/api/v1/inventory/[id]/route.ts`: ~170 lines
- `/src/app/api/v1/inventory/[id]/use/route.ts`: ~85 lines
- `/src/app/api/v1/inventory/matches/route.ts`: ~80 lines

**Total: ~630 lines added**

**Deleted: 0 lines** (No consolidation opportunities - new feature)

**Reuse Rate: 100%** - All routes leverage existing:
- API utilities
- Auth middleware
- Service layer
- Response helpers
- Validation patterns

The implementation achieves maximum code reuse by following established patterns and delegating all business logic to the existing service layer.
