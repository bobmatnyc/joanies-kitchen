# Inventory Schema Quick Reference

**Schema File**: `src/lib/db/inventory-schema.ts`
**Tables**: 3 | **Enums**: 4 | **Indexes**: 17 | **LOC**: 394

---

## Tables at a Glance

| Table | Purpose | Rows/User | Key Fields |
|-------|---------|-----------|------------|
| **inventoryItems** | Food inventory tracking | ~100 | ingredient_id, storage_location, status, expiry_date |
| **inventoryUsageLog** | Usage history | ~200/mo | action, quantity_used, recipe_id |
| **wasteTracking** | Waste analysis | ~50/mo | outcome, cost_usd, weight_oz |

---

## Enums

```typescript
// Storage Location (where item is stored)
'fridge' | 'freezer' | 'pantry' | 'other'

// Inventory Status (freshness lifecycle)
'fresh' | 'use_soon' | 'expiring' | 'expired' | 'used' | 'wasted'

// Usage Action (how item was consumed)
'cooked' | 'eaten_raw' | 'composted' | 'trashed' | 'donated'

// Waste Outcome (why item was wasted)
'expired' | 'spoiled' | 'forgot_about_it' | 'bought_too_much' | 'overcooked' | 'other'
```

---

## Foreign Key Relationships

```
inventoryItems
  ├─→ ingredients.id (cascade delete)

inventoryUsageLog
  ├─→ inventoryItems.id (cascade delete)
  └─→ recipes.id (set null)

wasteTracking
  ├─→ ingredients.id (cascade delete)
  └─→ inventoryItems.id (set null)
```

---

## Common Query Patterns

### Get User's Inventory
```typescript
const items = await db.select()
  .from(inventoryItems)
  .leftJoin(ingredients, eq(inventoryItems.ingredient_id, ingredients.id))
  .where(eq(inventoryItems.user_id, userId));
```

### Items Expiring Soon
```typescript
const expiring = await db.select()
  .from(inventoryItems)
  .where(
    and(
      eq(inventoryItems.user_id, userId),
      inArray(inventoryItems.status, ['use_soon', 'expiring']),
      lt(inventoryItems.expiry_date, sql`NOW() + INTERVAL '3 days'`)
    )
  )
  .orderBy(inventoryItems.expiry_date);
```

### Log Item Usage
```typescript
await db.insert(inventoryUsageLog).values({
  inventory_item_id: itemId,
  recipe_id: recipeId,
  action: 'cooked',
  quantity_used: 2,
  unit: 'cups',
});
```

### Track Waste Event
```typescript
await db.insert(wasteTracking).values({
  user_id: userId,
  ingredient_id: ingredientId,
  inventory_item_id: itemId,
  outcome: 'forgot_about_it',
  cost_usd: 3.99,
  weight_oz: 8,
  days_owned: 12,
});
```

### Waste Statistics
```typescript
const stats = await db.select({
  ingredient_name: ingredients.display_name,
  count: sql<number>`count(*)`,
  total_cost: sql<number>`sum(${wasteTracking.cost_usd})`,
})
  .from(wasteTracking)
  .leftJoin(ingredients, eq(wasteTracking.ingredient_id, ingredients.id))
  .where(eq(wasteTracking.user_id, userId))
  .groupBy(wasteTracking.ingredient_id, ingredients.display_name)
  .orderBy(sql`count(*) DESC`)
  .limit(10);
```

---

## Type Exports

### Primary Types
```typescript
import type {
  InventoryItem,
  NewInventoryItem,
  InventoryUsageLog,
  NewInventoryUsageLog,
  WasteTracking,
  NewWasteTracking,
} from '@/lib/db/inventory-schema';
```

### Helper Types
```typescript
import type {
  InventoryItemWithDetails,
  WasteTrackingWithDetails,
  UsageLogWithDetails,
  InventoryStats,
  WasteStats,
} from '@/lib/db/inventory-schema';
```

### Validation Schemas
```typescript
import {
  insertInventoryItemSchema,
  selectInventoryItemSchema,
} from '@/lib/db/inventory-schema';

// Use in forms
const result = insertInventoryItemSchema.safeParse(formData);
```

---

## Index Coverage

### inventoryItems (7 indexes)
- ✅ User lookups: `user_id`
- ✅ Ingredient search: `ingredient_id`
- ✅ Status filtering: `(user_id, status)`
- ✅ Expiry sorting: `(user_id, expiry_date)`
- ✅ Location filtering: `(user_id, storage_location)`
- ✅ Expiring soon: `(user_id, status, expiry_date)` 🔥

### inventoryUsageLog (4 indexes)
- ✅ Item history: `inventory_item_id`
- ✅ Recipe usage: `recipe_id`
- ✅ Action filtering: `action`
- ✅ Timeline: `used_at DESC`

### wasteTracking (6 indexes)
- ✅ User history: `user_id`
- ✅ Ingredient waste: `ingredient_id`
- ✅ Outcome filtering: `(user_id, outcome)`
- ✅ Timeline: `(user_id, wasted_at DESC)`
- ✅ Inventory link: `inventory_item_id`
- ✅ Cost analysis: `(user_id, cost_usd DESC)` 🔥

**🔥 = Most important for performance**

---

## Status Lifecycle

```
                ┌─────────────────────┐
                │  Item Added         │
                │  status = 'fresh'   │
                └──────────┬──────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    ┌────────┐      ┌─────────┐      ┌──────────┐
    │use_soon│─────▶│expiring │─────▶│expired   │
    └────┬───┘      └────┬────┘      └────┬─────┘
         │               │                │
         │               │                │
         ├───────────────┴────────────────┤
         │                                │
         ▼                                ▼
    ┌────────┐                      ┌─────────┐
    │ used   │                      │ wasted  │
    └────────┘                      └─────────┘
```

---

## Migration Commands

```bash
# 1. Generate migration files
pnpm db:generate

# 2. Review SQL in drizzle/ directory

# 3. Apply migration
pnpm db:push

# 4. Verify in Drizzle Studio
pnpm db:studio
```

---

## Security Rules

### ✅ Always Do
```typescript
// Scope all queries by user_id
where(eq(inventoryItems.user_id, userId))

// Validate with Zod
insertInventoryItemSchema.parse(data)

// Check Clerk auth in server actions
const { userId } = await auth();
if (!userId) throw new Error('Unauthorized');
```

### ❌ Never Do
```typescript
// Query without user_id (security hole!)
where(eq(inventoryItems.id, itemId))

// Trust client input
await db.insert(inventoryItems).values(req.body)

// Skip auth checks
const items = await db.select().from(inventoryItems)
```

---

## Next Implementation Steps

1. **Generate Migration**: `pnpm db:generate`
2. **Create Server Actions**: `src/app/actions/inventory.ts`
3. **Build UI Components**: Inventory list, add form, expiry alerts
4. **Add Background Jobs**: Auto-update status based on expiry
5. **Create Dashboard**: Waste tracking analytics

---

## Related Files

- **Main Schema**: `src/lib/db/schema.ts`
- **Ingredients**: `src/lib/db/ingredients-schema.ts`
- **Implementation Docs**: `docs/guides/INVENTORY_SCHEMA_IMPLEMENTATION.md`

---

**Last Updated**: 2025-10-19
**Schema Version**: 1.0.0
**Status**: ✅ Ready for Migration
