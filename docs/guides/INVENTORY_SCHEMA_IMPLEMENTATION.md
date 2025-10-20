# Inventory Schema Implementation Summary

**Date**: 2025-10-19
**Status**: ✅ COMPLETED - Ready for Migration
**Schema File**: `src/lib/db/inventory-schema.ts`

---

## Overview

Implemented corrected Fridge/Pantry feature database schema based on comprehensive technical validation. The schema follows all critical design decisions identified during validation and adheres to project conventions.

---

## Tables Implemented

### 1. `inventoryItems` - Core Inventory Management

**Purpose**: Tracks food items in user's fridge/freezer/pantry

**Key Features**:
- Foreign key to existing `ingredients` table (NOT duplicate food database)
- Storage location tracking (fridge/freezer/pantry/other)
- Status lifecycle (fresh → use_soon → expiring → expired/used/wasted)
- Quantity and unit tracking
- Acquisition and expiry date tracking
- Optional cost tracking for waste impact analysis

**Columns**:
```typescript
- id: uuid (PK)
- user_id: text (Clerk user ID)
- ingredient_id: uuid (FK to ingredients)
- storage_location: enum(fridge|freezer|pantry|other)
- status: enum(fresh|use_soon|expiring|expired|used|wasted)
- quantity: decimal(10,2)
- unit: varchar(50)
- acquisition_date: timestamp
- expiry_date: timestamp (nullable)
- cost_usd: decimal(8,2) (nullable)
- notes: text (nullable)
- created_at: timestamp
- updated_at: timestamp
```

**Indexes** (7 total):
- `user_id` - User's inventory lookup
- `ingredient_id` - Find all instances of ingredient
- `(user_id, status)` - Filter by status
- `(user_id, expiry_date)` - Sort by expiry
- `(user_id, storage_location)` - Filter by location
- `(user_id, status, expiry_date)` - Compound index for "expiring soon" queries

---

### 2. `inventoryUsageLog` - Usage Tracking

**Purpose**: Tracks how inventory items are used (separate from waste)

**Key Features**:
- Tracks ALL usage (cooked, eaten raw, composted, etc.)
- Optional recipe reference for cooking usage
- Quantity tracking for consumption analysis
- Timeline of usage patterns

**Columns**:
```typescript
- id: uuid (PK)
- inventory_item_id: uuid (FK to inventoryItems)
- recipe_id: text (FK to recipes, nullable)
- action: enum(cooked|eaten_raw|composted|trashed|donated)
- quantity_used: decimal(10,2)
- unit: varchar(50)
- notes: text (nullable)
- used_at: timestamp
- created_at: timestamp
```

**Indexes** (4 total):
- `inventory_item_id` - Usage history for specific item
- `recipe_id` - Recipes using inventory
- `action` - Filter by action type
- `used_at DESC` - Timeline queries

---

### 3. `wasteTracking` - Food Waste Analysis

**Purpose**: Captures detailed waste metrics for user insights

**Key Features**:
- Foreign key to ingredients (required for categorization)
- Optional inventory item reference (waste can be logged without pre-tracking)
- Outcome categorization (expired/spoiled/forgot/bought_too_much/etc.)
- Impact metrics (cost, weight)
- Context tracking (days owned, could-have-been-used-in)

**Columns**:
```typescript
- id: uuid (PK)
- user_id: text (Clerk user ID)
- ingredient_id: uuid (FK to ingredients)
- inventory_item_id: uuid (FK to inventoryItems, nullable)
- outcome: enum(expired|spoiled|forgot_about_it|bought_too_much|overcooked|other)
- cost_usd: decimal(8,2) (nullable)
- weight_oz: decimal(10,2) (nullable)
- days_owned: integer (nullable)
- could_have_been_used_in: text (JSON array, nullable)
- notes: text (nullable)
- wasted_at: timestamp
- created_at: timestamp
```

**Indexes** (6 total):
- `user_id` - User's waste history
- `ingredient_id` - Most wasted ingredients
- `(user_id, outcome)` - Waste by reason
- `(user_id, wasted_at DESC)` - Timeline
- `inventory_item_id` - Link to inventory
- `(user_id, cost_usd DESC)` - Cost analysis

---

## Enums Defined

### 1. `storage_location`
```typescript
'fridge' | 'freezer' | 'pantry' | 'other'
```

### 2. `inventory_status`
```typescript
'fresh' | 'use_soon' | 'expiring' | 'expired' | 'used' | 'wasted'
```

### 3. `usage_action`
```typescript
'cooked' | 'eaten_raw' | 'composted' | 'trashed' | 'donated'
```

### 4. `waste_outcome`
```typescript
'expired' | 'spoiled' | 'forgot_about_it' | 'bought_too_much' | 'overcooked' | 'other'
```

---

## TypeScript Types Exported

### Primary Types
```typescript
- InventoryItem, NewInventoryItem
- InventoryUsageLog, NewInventoryUsageLog
- WasteTracking, NewWasteTracking
- StorageLocation, InventoryStatus, UsageAction, WasteOutcome
```

### Helper Types
```typescript
- InventoryItemWithDetails (with ingredient join)
- WasteTrackingWithDetails (with ingredient and inventory joins)
- UsageLogWithDetails (with inventory and recipe joins)
- InventoryStats (dashboard analytics)
- WasteStats (waste reduction insights)
```

---

## Zod Validation Schemas

All tables have insert/select schemas generated via `drizzle-zod`:

```typescript
- insertInventoryItemSchema, selectInventoryItemSchema
- insertInventoryUsageLogSchema, selectInventoryUsageLogSchema
- insertWasteTrackingSchema, selectWasteTrackingSchema
```

---

## Foreign Key Relationships

### To Existing Tables
```
inventoryItems.ingredient_id → ingredients.id (cascade delete)
inventoryUsageLog.inventory_item_id → inventoryItems.id (cascade delete)
inventoryUsageLog.recipe_id → recipes.id (set null)
wasteTracking.ingredient_id → ingredients.id (cascade delete)
wasteTracking.inventory_item_id → inventoryItems.id (set null)
```

### Cascade Behavior
- **Cascade Delete**: When ingredient/inventory item deleted, all related records deleted
- **Set Null**: When recipe/inventory item deleted, foreign key set to null (preserves history)

---

## Index Summary

**Total Indexes**: 17 across all 3 tables

### Performance Optimizations
1. **User-scoped queries** - All tables indexed on `user_id`
2. **Timeline queries** - Timestamp columns indexed with DESC for recent-first sorting
3. **Filtering** - Enum columns (status, outcome, action) indexed for faceted queries
4. **Compound indexes** - Multi-column indexes for common query patterns

### Most Important Queries Optimized
```sql
-- What's expiring soon?
SELECT * FROM inventory_items
WHERE user_id = ? AND status IN ('use_soon', 'expiring')
ORDER BY expiry_date ASC;
-- Uses: (user_id, status, expiry_date) compound index

-- What are my most wasted ingredients?
SELECT ingredient_id, COUNT(*), SUM(cost_usd)
FROM waste_tracking
WHERE user_id = ?
GROUP BY ingredient_id
ORDER BY COUNT(*) DESC;
-- Uses: (user_id) and (ingredient_id) indexes

-- What did I cook with my inventory?
SELECT * FROM inventory_usage_log
WHERE recipe_id = ?;
-- Uses: (recipe_id) index
```

---

## Critical Design Decisions (from Validation)

### ✅ 1. Use Existing Ingredients Table
- **Decision**: Foreign key to `ingredients` table, NOT duplicate "foodDatabase"
- **Rationale**: Single source of truth, leverages existing infrastructure
- **Implementation**: `inventoryItems.ingredient_id → ingredients.id`

### ✅ 2. Storage Location Field
- **Decision**: Add `storage_location` enum to inventoryItems
- **Rationale**: Physical location affects expiry tracking and user workflow
- **Implementation**: `storageLocationEnum` with 4 values

### ✅ 3. Enhanced Waste Tracking
- **Decision**: Separate outcome tracking with cost/weight metrics
- **Rationale**: Behavioral insights require detailed categorization
- **Implementation**: `wasteTracking` table with outcome enum and impact fields

### ✅ 4. Separate Usage Logging
- **Decision**: Usage log separate from waste tracking
- **Rationale**: Track ALL usage, not just waste events
- **Implementation**: `inventoryUsageLog` table with action enum

### ✅ 5. Status Lifecycle
- **Decision**: 6-state status enum (fresh → use_soon → expiring → expired/used/wasted)
- **Rationale**: Clear lifecycle tracking for UI and automated alerts
- **Implementation**: `inventoryStatusEnum` with transition logic

---

## Next Steps

### 1. Generate Migration
```bash
pnpm db:generate
```
This will create migration files in `drizzle/` directory.

### 2. Review Migration SQL
Before applying, review the generated SQL to ensure:
- All enums created correctly
- Foreign keys reference correct tables
- Indexes created as expected
- No conflicts with existing schema

### 3. Apply Migration
```bash
# Development
pnpm db:push

# OR with migration files
pnpm db:migrate
```

### 4. Verify in Drizzle Studio
```bash
pnpm db:studio
```
Check that all 3 tables appear with correct columns and relationships.

### 5. Update Schema Exports
Add to `src/lib/db/schema.ts`:
```typescript
// Re-export inventory types and schemas for convenience
export {
  insertInventoryItemSchema,
  insertInventoryUsageLogSchema,
  insertWasteTrackingSchema,
  type InventoryItem,
  type InventoryItemWithDetails,
  inventoryItems,
  type InventoryStats,
  type InventoryStatus,
  inventoryUsageLog,
  type NewInventoryItem,
  type NewInventoryUsageLog,
  type NewWasteTracking,
  selectInventoryItemSchema,
  selectInventoryUsageLogSchema,
  selectWasteTrackingSchema,
  type StorageLocation,
  type UsageAction,
  type WasteOutcome,
  type WasteStats,
  wasteTracking,
  type WasteTrackingWithDetails,
} from './inventory-schema';
```

### 6. Create Server Actions
Next implementation phase:
- `src/app/actions/inventory.ts` - CRUD operations
- `src/app/actions/inventory-usage.ts` - Usage logging
- `src/app/actions/waste-tracking.ts` - Waste analysis

### 7. Create UI Components
- Inventory list/grid view
- Add item form
- Expiry alerts
- Waste tracking dashboard

---

## Validation Checklist

- ✅ Schema compiles without TypeScript errors
- ✅ All foreign key references are valid
- ✅ No duplicate column names
- ✅ Proper cascade/set null on deletes
- ✅ Indexes on all commonly queried fields
- ✅ Zod schemas generated for validation
- ✅ Helper types defined for joins
- ✅ Follows project conventions (uuid, text for userId, timestamps)
- ✅ Enums defined for all categorical fields
- ✅ Documentation complete

---

## Files Created

1. **Schema File**: `src/lib/db/inventory-schema.ts` (486 lines)
2. **Documentation**: `docs/guides/INVENTORY_SCHEMA_IMPLEMENTATION.md` (this file)

---

## Database Size Estimate

### Per User (rough estimates)
- **inventoryItems**: ~50-200 items (avg 100 items × 500 bytes = 50 KB)
- **inventoryUsageLog**: ~100-500 logs/month (avg 200 bytes = 100 KB/month)
- **wasteTracking**: ~20-50 waste events/month (avg 300 bytes = 15 KB/month)

### 1000 Active Users
- inventoryItems: ~50 MB
- inventoryUsageLog: ~100 MB/month (accumulates)
- wasteTracking: ~15 MB/month (accumulates)

### Recommended Retention
- **inventoryItems**: Delete when status='used' or 'wasted' after 30 days
- **inventoryUsageLog**: Keep last 12 months, archive older
- **wasteTracking**: Keep indefinitely (valuable long-term insights)

---

## Security Considerations

### Row-Level Security (RLS)
All queries MUST scope by `user_id`:
```typescript
// CORRECT
await db.select().from(inventoryItems).where(eq(inventoryItems.user_id, userId));

// WRONG - Security vulnerability!
await db.select().from(inventoryItems).where(eq(inventoryItems.id, itemId));
```

### Server Actions
- Validate `userId` from Clerk on every operation
- Use Zod schemas for input validation
- Never expose inventory across users

---

## Performance Considerations

### Query Optimization
1. **Always use indexes** - All queries should hit indexed columns
2. **Limit results** - Paginate large result sets (e.g., usage logs)
3. **Aggregate in DB** - Use COUNT(), SUM() for statistics

### Caching Strategy
- **Inventory stats**: Cache for 5-10 minutes (frequently accessed)
- **Waste stats**: Cache for 1 hour (less frequently accessed)
- **Expiring items**: Real-time (no cache - time-sensitive)

### Background Jobs (Future)
- **Daily**: Update status based on expiry dates
- **Weekly**: Calculate waste statistics
- **Monthly**: Generate waste reduction insights

---

## Testing Plan (Future)

### Unit Tests
- Schema validation (Zod)
- Foreign key constraints
- Enum values

### Integration Tests
- CRUD operations
- Cascade deletes
- Join queries

### E2E Tests
- Add item flow
- Use item in recipe
- Track waste event

---

## Related Documentation

- Technical Validation: See previous task conversation
- Database Schema: `src/lib/db/schema.ts`
- Ingredients Schema: `src/lib/db/ingredients-schema.ts`
- Drizzle Documentation: https://orm.drizzle.team/docs

---

**Implementation Status**: ✅ SCHEMA COMPLETE
**Next Milestone**: Generate and apply database migration
**Estimated Time to MVP**: 2-3 days (migrations + server actions + basic UI)
