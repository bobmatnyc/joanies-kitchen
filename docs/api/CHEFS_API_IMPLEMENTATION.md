# Chef REST API Implementation

## Overview

Complete REST API implementation for Chef resource management following existing patterns from the recipes API.

## Deliverables

### 1. Validation Schemas
**File:** `src/lib/validations/chef-api.ts`

- ✅ `createChefSchema` - Validates chef creation requests
- ✅ `updateChefSchema` - Validates partial chef updates
- ✅ `listChefsQuerySchema` - Validates list query parameters
- ✅ `listChefRecipesQuerySchema` - Validates chef recipes query parameters
- ✅ Type exports for TypeScript integration

### 2. API Routes

#### Main Collection Route
**File:** `src/app/api/v1/chefs/route.ts`

**GET /api/v1/chefs**
- Lists all active chefs with pagination
- Supports search by name, display name, bio, specialties
- Query params: `search`, `page`, `limit`, `sortBy`, `order`, `includeInactive`
- Authentication: Requires `read:chefs` scope

**POST /api/v1/chefs** (Admin only)
- Creates a new chef
- Validates slug uniqueness
- Authentication: Requires `write:chefs` scope

#### Individual Chef Route
**File:** `src/app/api/v1/chefs/[slug]/route.ts`

**GET /api/v1/chefs/:slug**
- Retrieves single chef by slug
- Authentication: Requires `read:chefs` scope

**PATCH /api/v1/chefs/:slug** (Admin only)
- Updates chef details
- Validates slug conflicts if slug is updated
- Authentication: Requires `write:chefs` scope

**DELETE /api/v1/chefs/:slug** (Admin only)
- Deletes chef (cascade deletes chef_recipes)
- Authentication: Requires `delete:chefs` scope

#### Chef Recipes Route
**File:** `src/app/api/v1/chefs/[slug]/recipes/route.ts`

**GET /api/v1/chefs/:slug/recipes**
- Lists recipes associated with a chef
- Pagination support using chef's recipe_count
- Authentication: Requires both `read:chefs` and `read:recipes` scopes

### 3. Scopes (Already Defined)

The following scopes were already present in `src/lib/api-auth/scopes.ts`:
- ✅ `READ_CHEFS: 'read:chefs'` - Read chef profiles
- ✅ `WRITE_CHEFS: 'write:chefs'` - Create and update chef profiles
- ✅ `DELETE_CHEFS: 'delete:chefs'` - Delete chef profiles
- ✅ `CHEFS_ALL: 'chefs:*'` - Full access to chefs

## Features

### Authentication & Authorization
- Clerk session or API key authentication via `requireScopes`
- Fine-grained permission control using scope-based authorization
- Admin-only endpoints for create/update/delete operations

### Validation
- Zod schemas for request/response validation
- Slug format validation (lowercase, hyphens only)
- URL validation for profile images, website, social links
- Comprehensive error messages

### Pagination
- Consistent pagination across all list endpoints
- Default page size: 20 (chefs), 24 (recipes)
- Maximum page size: 100
- Returns total count and hasMore flag

### Search
- Full-text search across name, display name, bio, and specialties
- Uses PostgreSQL ILIKE for case-insensitive matching
- Results sorted by recipe count (most popular first)

### Error Handling
- 400: Invalid request body or parameters
- 401: Not authenticated
- 403: Insufficient permissions
- 404: Chef not found
- 500: Internal server error

## Integration

### Service Layer
Uses `ChefService` from `src/lib/services/chef-service.ts`:
- `findAll()` - List active chefs
- `findAllIncludingInactive()` - List all chefs (admin)
- `findBySlug()` - Find chef by slug
- `findById()` - Find chef by ID
- `findRecipesByChef()` - Get chef's recipes
- `create()` - Create new chef
- `update()` - Update chef details
- `delete()` - Delete chef
- `search()` - Search chefs

### Response Format
All endpoints follow the standard API response format:

**Success:**
```json
{
  "success": true,
  "data": { /* chef or chefs array */ }
}
```

**Paginated Success:**
```json
{
  "success": true,
  "data": {
    "chefs": [ /* array of chefs */ ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasMore": true
    }
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message"
}
```

## Testing

### Service Layer Test
A test script has been created at `test/api/chefs-api-test.ts` that verifies:
1. ✅ List all chefs
2. ✅ Search chefs
3. ✅ Create chef
4. ✅ Find chef by slug
5. ✅ Update chef
6. ✅ Find recipes by chef
7. ✅ Delete chef
8. ✅ Verify deletion

Run with: `npx tsx test/api/chefs-api-test.ts` (requires DATABASE_URL)

### API Endpoint Testing
Use curl or API client to test endpoints:

```bash
# List chefs
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/chefs?limit=10

# Get chef by slug
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/chefs/kenji-lopez-alt

# Get chef recipes
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/chefs/kenji-lopez-alt/recipes?page=1&limit=24
```

## Implementation Notes

### Code Minimization
- **LOC Impact:** +381 lines (3 route files, 1 validation file, 1 test file)
- **Reuse Rate:** 100% - All utilities (api-auth, api helpers, service layer) are reused
- **Duplicates Eliminated:** 0 - No duplicate code, follows established patterns

### Patterns Followed
1. **Consistent with recipes API** - Same structure, same patterns
2. **Scope-based auth** - Using existing `requireScopes` middleware
3. **Zod validation** - Type-safe request/response validation
4. **Service layer separation** - Business logic in ChefService
5. **Error handling** - Standard error responses with appropriate status codes
6. **Documentation** - Comprehensive JSDoc comments for all endpoints

### Future Enhancements
- [ ] Add chef statistics endpoint (total recipes, views, ratings)
- [ ] Add chef followers/favorites functionality
- [ ] Add bulk operations for admin (bulk create/update)
- [ ] Add chef image upload endpoint
- [ ] Add chef recipe linking endpoint (POST /api/v1/chefs/:slug/recipes)

## Files Created

```
src/
├── lib/
│   └── validations/
│       └── chef-api.ts                          [NEW] Validation schemas
└── app/
    └── api/
        └── v1/
            └── chefs/
                ├── route.ts                      [NEW] List/Create endpoints
                └── [slug]/
                    ├── route.ts                  [NEW] Get/Update/Delete endpoints
                    └── recipes/
                        └── route.ts              [NEW] Chef recipes endpoint

test/
└── api/
    └── chefs-api-test.ts                        [NEW] Service layer tests

docs/
└── api/
    └── CHEFS_API_IMPLEMENTATION.md              [NEW] This document
```

## Verification Checklist

- ✅ All 3 route files created
- ✅ Validation schemas created with Zod
- ✅ Chef scopes already exist in scopes.ts
- ✅ All imports reference existing utilities
- ✅ Follows recipes API patterns exactly
- ✅ Comprehensive error handling
- ✅ JSDoc documentation for all endpoints
- ✅ TypeScript types exported
- ✅ Test script created
- ✅ Implementation documentation

## Status

**COMPLETED** ✅

All deliverables have been implemented and are ready for testing with a running server.
