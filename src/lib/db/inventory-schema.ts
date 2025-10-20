import {
  boolean,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { ingredients } from './ingredients-schema';
import { recipes } from './schema';

/**
 * Inventory Schema - Fridge/Pantry Feature
 *
 * Architecture:
 * - inventoryItems: User's current food inventory with storage tracking
 * - inventoryUsageLog: Tracks how inventory items are used (cooked, eaten, etc.)
 * - wasteTracking: Food waste analysis with outcome categorization
 *
 * Key Design Decisions (from Technical Validation):
 * 1. Foreign key to existing ingredients table (no duplicate food database)
 * 2. Storage location enum (fridge/freezer/pantry/other)
 * 3. Enhanced waste tracking with outcome metrics
 * 4. Separate usage logging from waste tracking
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Storage locations for inventory items
 * Maps to physical locations in user's kitchen
 */
export const storageLocationEnum = pgEnum('storage_location', [
  'fridge',
  'freezer',
  'pantry',
  'other',
]);

/**
 * Inventory item status lifecycle
 * Tracks freshness and usage state
 */
export const inventoryStatusEnum = pgEnum('inventory_status', [
  'fresh',        // Recently added, well within expiry
  'use_soon',     // Approaching expiry (within 3-7 days)
  'expiring',     // Very close to expiry (within 1-2 days)
  'expired',      // Past expiry date
  'used',         // Successfully used/consumed
  'wasted',       // Discarded/wasted
]);

/**
 * Usage actions for inventory items
 * Tracks how items are actually consumed
 */
export const usageActionEnum = pgEnum('usage_action', [
  'cooked',       // Used in cooking (possibly with recipe)
  'eaten_raw',    // Consumed without cooking
  'composted',    // Composted (eco-friendly disposal)
  'trashed',      // Thrown away
  'donated',      // Donated to food bank/charity
]);

/**
 * Waste outcome categorization
 * Helps identify root causes of food waste
 */
export const wasteOutcomeEnum = pgEnum('waste_outcome', [
  'expired',              // Passed expiration date
  'spoiled',              // Went bad before expiry
  'forgot_about_it',      // Lost in back of fridge
  'bought_too_much',      // Over-purchased
  'overcooked',           // Cooking mistake
  'other',                // Other reasons
]);

// ============================================================================
// 1. INVENTORY ITEMS TABLE
// ============================================================================

/**
 * Core inventory management table
 * Tracks food items in user's fridge/freezer/pantry
 *
 * Foreign Keys:
 * - ingredient_id: References canonical ingredients table
 *
 * Lifecycle:
 * 1. Created with status='fresh'
 * 2. Auto-update status based on expiry proximity
 * 3. Mark as 'used' when consumed in recipe
 * 4. Mark as 'wasted' if discarded
 */
export const inventoryItems = pgTable(
  'inventory_items',
  {
    // Primary Key
    id: uuid('id').primaryKey().defaultRandom(),

    // Ownership
    user_id: text('user_id').notNull(), // Clerk user ID

    // Ingredient Reference (NOT free text - references canonical table)
    ingredient_id: uuid('ingredient_id')
      .notNull()
      .references(() => ingredients.id, { onDelete: 'cascade' }),

    // Storage Information
    storage_location: storageLocationEnum('storage_location').notNull(),

    // Status Tracking
    status: inventoryStatusEnum('status').notNull().default('fresh'),

    // Quantity Information
    quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull(), // e.g., 2.5
    unit: varchar('unit', { length: 50 }).notNull(), // e.g., 'lbs', 'pieces', 'cups'

    // Date Tracking
    acquisition_date: timestamp('acquisition_date').notNull().defaultNow(), // When added to inventory
    expiry_date: timestamp('expiry_date'), // Optional expiration date

    // Cost Tracking (optional - for waste impact calculation)
    cost_usd: decimal('cost_usd', { precision: 8, scale: 2 }), // Purchase cost

    // Notes
    notes: text('notes'), // User notes (e.g., "from farmers market")

    // Timestamps
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // Query Optimization Indexes
    userIdIdx: index('inventory_items_user_id_idx').on(table.user_id), // User's inventory
    ingredientIdIdx: index('inventory_items_ingredient_id_idx').on(table.ingredient_id), // Find all instances of ingredient
    statusIdx: index('inventory_items_status_idx').on(table.user_id, table.status), // Filter by status
    expiryDateIdx: index('inventory_items_expiry_date_idx').on(table.user_id, table.expiry_date), // Sort by expiry
    storageLocationIdx: index('inventory_items_storage_location_idx').on(
      table.user_id,
      table.storage_location
    ), // Filter by location

    // Compound index for common "what's expiring soon?" query
    userStatusExpiryIdx: index('inventory_items_user_status_expiry_idx').on(
      table.user_id,
      table.status,
      table.expiry_date
    ),
  })
);

// ============================================================================
// 2. INVENTORY USAGE LOG TABLE
// ============================================================================

/**
 * Tracks how inventory items are used
 * Separate from waste tracking to log ALL usage (not just waste)
 *
 * Foreign Keys:
 * - inventory_item_id: Required reference to inventory item
 * - recipe_id: Optional reference if used in recipe
 *
 * Use Cases:
 * - Track recipe ingredient usage
 * - Analyze consumption patterns
 * - Generate usage reports
 */
export const inventoryUsageLog = pgTable(
  'inventory_usage_log',
  {
    // Primary Key
    id: uuid('id').primaryKey().defaultRandom(),

    // Relationships
    inventory_item_id: uuid('inventory_item_id')
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'cascade' }),

    recipe_id: text('recipe_id')
      .references(() => recipes.id, { onDelete: 'set null' }), // Optional recipe reference

    // Usage Information
    action: usageActionEnum('action').notNull(),
    quantity_used: decimal('quantity_used', { precision: 10, scale: 2 }).notNull(),
    unit: varchar('unit', { length: 50 }).notNull(),

    // Metadata
    notes: text('notes'), // User notes about usage

    // Timestamps
    used_at: timestamp('used_at').notNull().defaultNow(),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    // Query Optimization Indexes
    inventoryItemIdIdx: index('inventory_usage_log_inventory_item_id_idx').on(
      table.inventory_item_id
    ),
    recipeIdIdx: index('inventory_usage_log_recipe_id_idx').on(table.recipe_id), // Recipes using inventory
    actionIdx: index('inventory_usage_log_action_idx').on(table.action), // Filter by action type
    usedAtIdx: index('inventory_usage_log_used_at_idx').on(table.used_at.desc()), // Timeline queries
  })
);

// ============================================================================
// 3. WASTE TRACKING TABLE
// ============================================================================

/**
 * Food waste analysis and impact tracking
 * Captures detailed waste metrics for user insights
 *
 * Foreign Keys:
 * - ingredient_id: Required reference to ingredient
 * - inventory_item_id: Optional reference to specific inventory instance
 *
 * Design Rationale:
 * - ingredient_id required for waste categorization
 * - inventory_item_id optional (waste can be logged without pre-adding to inventory)
 * - Outcome tracking helps identify behavioral patterns
 * - Cost/weight metrics quantify waste impact
 */
export const wasteTracking = pgTable(
  'waste_tracking',
  {
    // Primary Key
    id: uuid('id').primaryKey().defaultRandom(),

    // Ownership
    user_id: text('user_id').notNull(), // Clerk user ID

    // Ingredient Reference (required for categorization)
    ingredient_id: uuid('ingredient_id')
      .notNull()
      .references(() => ingredients.id, { onDelete: 'cascade' }),

    // Optional Inventory Reference
    inventory_item_id: uuid('inventory_item_id')
      .references(() => inventoryItems.id, { onDelete: 'set null' }), // May be null if not tracked in inventory

    // Waste Classification
    outcome: wasteOutcomeEnum('outcome').notNull(),

    // Impact Metrics
    cost_usd: decimal('cost_usd', { precision: 8, scale: 2 }), // Financial impact
    weight_oz: decimal('weight_oz', { precision: 10, scale: 2 }), // Weight in ounces (for environmental impact)

    // Context Fields
    days_owned: integer('days_owned'), // How long before waste (acquisition to waste)
    could_have_been_used_in: text('could_have_been_used_in'), // JSON array of recipe names/IDs

    // User Notes
    notes: text('notes'), // Additional context

    // Timestamps
    wasted_at: timestamp('wasted_at').notNull().defaultNow(),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    // Query Optimization Indexes
    userIdIdx: index('waste_tracking_user_id_idx').on(table.user_id), // User's waste history
    ingredientIdIdx: index('waste_tracking_ingredient_id_idx').on(table.ingredient_id), // Most wasted ingredients
    outcomeIdx: index('waste_tracking_outcome_idx').on(table.user_id, table.outcome), // Waste by reason
    wastedAtIdx: index('waste_tracking_wasted_at_idx').on(table.user_id, table.wasted_at.desc()), // Timeline
    inventoryItemIdIdx: index('waste_tracking_inventory_item_id_idx').on(table.inventory_item_id),

    // Cost analysis index
    costIdx: index('waste_tracking_cost_idx').on(table.user_id, table.cost_usd.desc()),
  })
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Storage Location
export type StorageLocation = typeof storageLocationEnum.enumValues[number];

// Inventory Status
export type InventoryStatus = typeof inventoryStatusEnum.enumValues[number];

// Usage Action
export type UsageAction = typeof usageActionEnum.enumValues[number];

// Waste Outcome
export type WasteOutcome = typeof wasteOutcomeEnum.enumValues[number];

// Inventory Items
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type NewInventoryItem = typeof inventoryItems.$inferInsert;

// Inventory Usage Log
export type InventoryUsageLog = typeof inventoryUsageLog.$inferSelect;
export type NewInventoryUsageLog = typeof inventoryUsageLog.$inferInsert;

// Waste Tracking
export type WasteTracking = typeof wasteTracking.$inferSelect;
export type NewWasteTracking = typeof wasteTracking.$inferInsert;

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

export const insertInventoryItemSchema = createInsertSchema(inventoryItems);
export const selectInventoryItemSchema = createSelectSchema(inventoryItems);

export const insertInventoryUsageLogSchema = createInsertSchema(inventoryUsageLog);
export const selectInventoryUsageLogSchema = createSelectSchema(inventoryUsageLog);

export const insertWasteTrackingSchema = createInsertSchema(wasteTracking);
export const selectWasteTrackingSchema = createSelectSchema(wasteTracking);

// ============================================================================
// HELPER TYPES FOR APPLICATION USE
// ============================================================================

/**
 * Extended inventory item with ingredient details
 * Used when fetching inventory with joins
 */
export type InventoryItemWithDetails = InventoryItem & {
  ingredient: {
    id: string;
    name: string;
    display_name: string;
    category: string | null;
  };
};

/**
 * Waste tracking with ingredient details
 * Used for waste analysis reports
 */
export type WasteTrackingWithDetails = WasteTracking & {
  ingredient: {
    id: string;
    name: string;
    display_name: string;
    category: string | null;
  };
  inventoryItem?: InventoryItem | null;
};

/**
 * Usage log with full context
 * Used for usage history views
 */
export type UsageLogWithDetails = InventoryUsageLog & {
  inventoryItem: InventoryItemWithDetails;
  recipe?: {
    id: string;
    name: string;
    slug: string | null;
  } | null;
};

/**
 * Inventory summary statistics
 * Used for dashboard analytics
 */
export type InventoryStats = {
  total_items: number;
  items_by_status: Record<InventoryStatus, number>;
  items_by_location: Record<StorageLocation, number>;
  expiring_soon_count: number; // Items expiring within 3 days
  total_value_usd: number;
};

/**
 * Waste analysis statistics
 * Used for waste reduction insights
 */
export type WasteStats = {
  total_waste_events: number;
  total_cost_usd: number;
  total_weight_oz: number;
  waste_by_outcome: Record<WasteOutcome, number>;
  most_wasted_ingredients: Array<{
    ingredient_id: string;
    ingredient_name: string;
    waste_count: number;
    total_cost_usd: number;
  }>;
  average_days_to_waste: number;
};
