# API v1 Refactoring Pattern Guide

Quick reference for refactoring the remaining 9 API endpoints using the established utilities.

---

## Standard Imports

Add these imports to every endpoint file:

```typescript
import type { NextRequest } from 'next/server';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import type { RouteContext } from '@/lib/api-auth/types';
import {
  apiSuccess,
  apiSuccessPaginated,
  apiError,
  parseQueryParams,
  parseJsonBody,
  getRequiredParam,
  parseParamAndBody,
  verifyResourceOwnership,
  handleActionResult,
  applyFilters,
  applySorting,
  applyPagination,
} from '@/lib/api';
```

**Remove**:
- `import { NextResponse } from 'next/server';`
- `import { ZodError } from 'zod';`

---

## Pattern 1: LIST Endpoint (GET with pagination)

**Replace**:
```typescript
// ❌ OLD
const searchParams = request.nextUrl.searchParams;
const queryParams: Record<string, any> = {};
searchParams.forEach((value, key) => {
  queryParams[key] = value;
});

let validatedQuery: ListQuery;
try {
  validatedQuery = listQuerySchema.parse(queryParams);
} catch (error) {
  if (error instanceof ZodError) {
    return NextResponse.json({ success: false, error: 'Invalid query parameters', details: error.errors }, { status: 400 });
  }
  throw error;
}
```

**With**:
```typescript
// ✅ NEW
const parsed = parseQueryParams(request, listQuerySchema);
if ('error' in parsed) return parsed.error;

const { data: validatedQuery } = parsed;
```

**Replace**:
```typescript
// ❌ OLD
const total = items.length;
const startIndex = (validatedQuery.page - 1) * validatedQuery.limit;
const endIndex = startIndex + validatedQuery.limit;
const paginatedItems = items.slice(startIndex, endIndex);

return NextResponse.json({
  success: true,
  data: {
    items: paginatedItems,
    pagination: {
      page: validatedQuery.page,
      limit: validatedQuery.limit,
      total,
      totalPages: Math.ceil(total / validatedQuery.limit),
      hasMore: endIndex < total,
    },
  },
});
```

**With**:
```typescript
// ✅ NEW
const { items: paginatedItems, total } = applyPagination(
  items,
  validatedQuery.page!,
  validatedQuery.limit!
);

return apiSuccessPaginated(paginatedItems, validatedQuery.page!, validatedQuery.limit!, total);
```

---

## Pattern 2: CREATE Endpoint (POST)

**Replace**:
```typescript
// ❌ OLD
const body = await request.json();

let validatedData: CreateInput;
try {
  validatedData = createSchema.parse(body);
} catch (error) {
  if (error instanceof ZodError) {
    return NextResponse.json({ success: false, error: 'Invalid request body', details: error.errors }, { status: 400 });
  }
  throw error;
}

const result = await createResource(validatedData);

if (!result.success) {
  return NextResponse.json({ success: false, error: result.error || 'Failed to create' }, { status: 500 });
}

return NextResponse.json({ success: true, data: result.data }, { status: 201 });
```

**With**:
```typescript
// ✅ NEW
const parsed = await parseJsonBody(request, createSchema);
if ('error' in parsed) return parsed.error;

const { data: validatedData } = parsed;

const result = await createResource(validatedData);
const check = handleActionResult(result);
if ('error' in check) return check.error;

return apiSuccess(check.data, 201);
```

---

## Pattern 3: GET by ID Endpoint

**Replace**:
```typescript
// ❌ OLD
const params = context?.params ? await context.params : {};
const id = params?.id as string;

if (!id) {
  return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
}

const result = await getResource(id);

if (!result.success) {
  const statusCode = result.error === 'Not found' ? 404 : result.error === 'Access denied' ? 403 : 500;
  return NextResponse.json({ success: false, error: result.error || 'Failed to fetch' }, { status: statusCode });
}

return NextResponse.json({ success: true, data: result.data });
```

**With**:
```typescript
// ✅ NEW
const idResult = await getRequiredParam(context, 'id');
if ('error' in idResult) return idResult.error;

const { data: id } = idResult;

const result = await getResource(id);
const check = handleActionResult(result);
if ('error' in check) return check.error;

return apiSuccess(check.data);
```

---

## Pattern 4: UPDATE Endpoint (PATCH with ownership)

**Replace**:
```typescript
// ❌ OLD
const params = context?.params ? await context.params : {};
const id = params?.id as string;

if (!id) {
  return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
}

const existingResource = await getResource(id);

if (!existingResource.success || !existingResource.data) {
  const statusCode = existingResource.error === 'Not found' ? 404 : 500;
  return NextResponse.json({ success: false, error: existingResource.error }, { status: statusCode });
}

// Check ownership
if (existingResource.data.user_id !== auth.userId) {
  const isAdmin = auth.metadata?.isAdmin === true;
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
  }
}

const body = await request.json();

let validatedData: UpdateInput;
try {
  validatedData = updateSchema.parse(body);
} catch (error) {
  if (error instanceof ZodError) {
    return NextResponse.json({ success: false, error: 'Invalid body', details: error.errors }, { status: 400 });
  }
  throw error;
}

const result = await updateResource(existingResource.data.id, validatedData);

if (!result.success) {
  return NextResponse.json({ success: false, error: result.error || 'Failed to update' }, { status: 500 });
}

return NextResponse.json({ success: true, data: result.data });
```

**With**:
```typescript
// ✅ NEW
const parsed = await parseParamAndBody(context, request, 'id', updateSchema);
if ('error' in parsed) return parsed.error;

const { param: id, body: validatedData } = parsed.data;

const existingResource = await getResource(id);
const resourceCheck = handleActionResult(existingResource);
if ('error' in resourceCheck) return resourceCheck.error;

const ownershipCheck = verifyResourceOwnership(resourceCheck.data, auth, 'resource');
if ('error' in ownershipCheck) return ownershipCheck.error;

const result = await updateResource(ownershipCheck.resource.id, validatedData);
const updateCheck = handleActionResult(result);
if ('error' in updateCheck) return updateCheck.error;

return apiSuccess(updateCheck.data);
```

---

## Pattern 5: DELETE Endpoint (with ownership)

**Replace**:
```typescript
// ❌ OLD
const params = context?.params ? await context.params : {};
const id = params?.id as string;

if (!id) {
  return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
}

const existingResource = await getResource(id);

if (!existingResource.success || !existingResource.data) {
  const statusCode = existingResource.error === 'Not found' ? 404 : 500;
  return NextResponse.json({ success: false, error: existingResource.error }, { status: statusCode });
}

if (existingResource.data.user_id !== auth.userId) {
  const isAdmin = auth.metadata?.isAdmin === true;
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
  }
}

const result = await deleteResource(existingResource.data.id);

if (!result.success) {
  return NextResponse.json({ success: false, error: result.error || 'Failed to delete' }, { status: 500 });
}

return NextResponse.json({ success: true, data: result.data });
```

**With**:
```typescript
// ✅ NEW
const idResult = await getRequiredParam(context, 'id');
if ('error' in idResult) return idResult.error;

const { data: id } = idResult;

const existingResource = await getResource(id);
const resourceCheck = handleActionResult(existingResource);
if ('error' in resourceCheck) return resourceCheck.error;

const ownershipCheck = verifyResourceOwnership(resourceCheck.data, auth, 'resource');
if ('error' in ownershipCheck) return ownershipCheck.error;

const result = await deleteResource(ownershipCheck.resource.id);
const deleteCheck = handleActionResult(result);
if ('error' in deleteCheck) return deleteCheck.error;

return apiSuccess(deleteCheck.data);
```

---

## Pattern 6: Error Handling

**Replace all instances**:

```typescript
// ❌ OLD
catch (error) {
  console.error('Error:', error);
  return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
}
```

**With**:
```typescript
// ✅ NEW
catch (error) {
  console.error('Error:', error);
  return apiError('Internal server error');
}
```

---

## Pattern 7: Filtering and Sorting (for LIST endpoints)

**Replace**:
```typescript
// ❌ OLD
if (validatedQuery.field1) {
  items = items.filter(item => item.field1 === validatedQuery.field1);
}

if (validatedQuery.field2) {
  items = items.filter(item => item.field2 === validatedQuery.field2);
}

items.sort((a, b) => {
  const aValue = a[validatedQuery.sortBy] || '';
  const bValue = b[validatedQuery.sortBy] || '';
  const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
  return validatedQuery.order === 'asc' ? comparison : -comparison;
});
```

**With**:
```typescript
// ✅ NEW
const filters: Record<string, unknown> = {};
if (validatedQuery.field1) filters.field1 = validatedQuery.field1;
if (validatedQuery.field2) filters.field2 = validatedQuery.field2;

items = applyFilters(items, filters);
items = applySorting(items, validatedQuery.sortBy!, validatedQuery.order!);
```

---

## Common Gotchas

### 1. Non-null Assertions for Schema Defaults

If a Zod schema has `.default()`, TypeScript will still infer the type as optional. Use non-null assertion:

```typescript
// Schema has: page: z.coerce.number().default(1)
// TypeScript infers: number | undefined

// ✅ Use non-null assertion (safe because schema has default)
validatedQuery.page!
validatedQuery.limit!
validatedQuery.sortBy!
validatedQuery.order!
```

### 2. Resource Type Naming

Use descriptive resource names for better error messages:

```typescript
// ✅ Good
verifyResourceOwnership(meal.data, auth, 'meal');
verifyResourceOwnership(recipe.data, auth, 'recipe');

// ❌ Generic
verifyResourceOwnership(resource.data, auth, 'resource');
```

### 3. Combined Parsing

When an endpoint needs both route param AND request body, use `parseParamAndBody`:

```typescript
// ✅ Use combined helper
const parsed = await parseParamAndBody(context, request, 'id', updateSchema);
if ('error' in parsed) return parsed.error;

const { param: id, body: updateData } = parsed.data;

// ❌ Don't do separately (more code)
const idResult = await getRequiredParam(context, 'id');
const bodyResult = await parseJsonBody(request, updateSchema);
```

---

## Remaining Endpoints to Refactor

Apply these patterns to:

1. ✅ `src/app/api/v1/recipes/route.ts` (DONE)
2. ✅ `src/app/api/v1/recipes/[id]/route.ts` (DONE)
3. ✅ `src/app/api/v1/recipes/[id]/similar/route.ts` (DONE)
4. ⏳ `src/app/api/v1/meals/route.ts` (GET, POST)
5. ⏳ `src/app/api/v1/meals/[id]/route.ts` (GET, PATCH, DELETE)
6. ⏳ `src/app/api/v1/meals/[id]/recipes/route.ts` (GET, POST, DELETE)
7. ⏳ `src/app/api/v1/meals/[id]/shopping-list/route.ts` (GET, POST)
8. ⏳ `src/app/api/v1/shopping-lists/route.ts` (GET, POST)
9. ⏳ `src/app/api/v1/shopping-lists/[id]/route.ts` (GET, PATCH, DELETE)
10. ⏳ `src/app/api/v1/auth/keys/route.ts` (GET, POST)
11. ⏳ `src/app/api/v1/auth/keys/[id]/route.ts` (GET, PATCH, DELETE)
12. ⏳ `src/app/api/v1/auth/keys/[id]/usage/route.ts` (GET)

**Estimated time**: 10-15 minutes per endpoint (2-3 hours total)

---

## Verification Checklist

After refactoring each endpoint:

- [ ] All imports updated (removed `NextResponse`, `ZodError`)
- [ ] Added utility imports from `@/lib/api`
- [ ] Replaced manual query parsing with `parseQueryParams`
- [ ] Replaced manual body parsing with `parseJsonBody`
- [ ] Replaced route param extraction with `getRequiredParam` or `parseParamAndBody`
- [ ] Replaced ownership checks with `verifyResourceOwnership`
- [ ] Replaced all `NextResponse.json()` with `apiSuccess`, `apiError`, etc.
- [ ] Used `handleActionResult` for server action responses
- [ ] Error handling uses `apiError`
- [ ] TypeScript compilation passes: `pnpm tsc --noEmit`
- [ ] File has fewer lines than before

---

**Generated**: 2025-10-27
**Reference**: PHASE_1_REFACTORING_SUMMARY.md
