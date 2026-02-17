import { and, asc, desc, eq, gte, isNotNull, lte, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { ingredients } from '@/lib/db/ingredients-schema';
import {
  type InventoryItem,
  type InventoryStatus,
  inventoryItems,
  inventoryUsageLog,
  type NewInventoryItem,
  type NewInventoryUsageLog,
  type NewWasteTracking,
  type StorageLocation,
  type UsageAction,
  type WasteOutcome,
  wasteTracking,
} from '@/lib/db/inventory-schema';
import { recipeIngredients, recipes } from '@/lib/db/schema';

/**
 * InventoryService - Business logic for inventory management
 *
 * Responsibilities:
 * - CRUD operations for inventory items
 * - Recipe matching based on available inventory
 * - Usage tracking and waste analysis
 *
 * Note: This service is stateless. Caller must provide userId.
 */
export class InventoryService {
  /**
   * Get user's inventory with optional filters
   */
  async findByUserId(
    userId: string,
    filters?: {
      storage?: StorageLocation;
      status?: InventoryStatus;
      expiringWithinDays?: number;
    }
  ): Promise<Array<InventoryItem & { ingredient: typeof ingredients.$inferSelect }>> {
    const conditions = [eq(inventoryItems.user_id, userId)];

    if (filters?.storage) {
      conditions.push(eq(inventoryItems.storage_location, filters.storage));
    }

    if (filters?.status) {
      conditions.push(eq(inventoryItems.status, filters.status));
    }

    if (filters?.expiringWithinDays !== undefined) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + filters.expiringWithinDays);
      conditions.push(
        and(
          isNotNull(inventoryItems.expiry_date),
          lte(inventoryItems.expiry_date, futureDate),
          gte(inventoryItems.expiry_date, new Date())
        ) as any
      );
    }

    const results = await db
      .select({
        id: inventoryItems.id,
        user_id: inventoryItems.user_id,
        ingredient_id: inventoryItems.ingredient_id,
        storage_location: inventoryItems.storage_location,
        status: inventoryItems.status,
        quantity: inventoryItems.quantity,
        unit: inventoryItems.unit,
        acquisition_date: inventoryItems.acquisition_date,
        expiry_date: inventoryItems.expiry_date,
        cost_usd: inventoryItems.cost_usd,
        notes: inventoryItems.notes,
        created_at: inventoryItems.created_at,
        updated_at: inventoryItems.updated_at,
        ingredient: {
          id: ingredients.id,
          name: ingredients.name,
          display_name: ingredients.display_name,
          category: ingredients.category,
          slug: ingredients.slug,
          type: ingredients.type,
          subtype: ingredients.subtype,
          is_purchaseable: ingredients.is_purchaseable,
          common_units: ingredients.common_units,
          aliases: ingredients.aliases,
          description: ingredients.description,
          storage_tips: ingredients.storage_tips,
          substitutions: ingredients.substitutions,
          image_url: ingredients.image_url,
          is_common: ingredients.is_common,
          is_allergen: ingredients.is_allergen,
          typical_unit: ingredients.typical_unit,
          usage_count: ingredients.usage_count,
          created_at: ingredients.created_at,
          updated_at: ingredients.updated_at,
        },
      })
      .from(inventoryItems)
      .innerJoin(ingredients, eq(inventoryItems.ingredient_id, ingredients.id))
      .where(and(...conditions))
      .orderBy(asc(inventoryItems.expiry_date), desc(inventoryItems.created_at));

    return results as any;
  }

  /**
   * Find inventory item by ID
   */
  async findById(id: string): Promise<InventoryItem | null> {
    const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1);

    return item || null;
  }

  /**
   * Create a new inventory item
   */
  async create(userId: string, data: Omit<NewInventoryItem, 'user_id'>): Promise<InventoryItem> {
    // Determine initial status based on expiry date
    let status: InventoryStatus = 'fresh';
    if (data.expiry_date) {
      const now = new Date();
      const expiryDate = new Date(data.expiry_date);
      const daysUntilExpiry = Math.floor(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilExpiry < 0) {
        status = 'expired';
      } else if (daysUntilExpiry <= 1) {
        status = 'expiring';
      } else if (daysUntilExpiry <= 3) {
        status = 'use_soon';
      }
    }

    const [newItem] = await db
      .insert(inventoryItems)
      .values({
        user_id: userId,
        ...data,
        status,
        acquisition_date: new Date(),
        updated_at: new Date(),
      })
      .returning();

    if (!newItem) {
      throw new Error('Failed to create inventory item');
    }

    return newItem;
  }

  /**
   * Update an inventory item
   */
  async update(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem | null> {
    const [updatedItem] = await db
      .update(inventoryItems)
      .set({
        ...updates,
        updated_at: new Date(),
      })
      .where(eq(inventoryItems.id, id))
      .returning();

    return updatedItem || null;
  }

  /**
   * Delete an inventory item
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(inventoryItems).where(eq(inventoryItems.id, id)).returning();

    return result.length > 0;
  }

  /**
   * Mark an item as used
   */
  async markAsUsed(
    itemId: string,
    quantityUsed: number,
    action: UsageAction = 'cooked',
    recipeId?: string,
    notes?: string
  ): Promise<{ remainingQuantity: number }> {
    // Get inventory item
    const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, itemId)).limit(1);

    if (!item) {
      throw new Error('Inventory item not found');
    }

    const currentQuantity = parseFloat(item.quantity);
    const newQuantity = currentQuantity - quantityUsed;

    // Create usage log entry
    const usageLogEntry: NewInventoryUsageLog = {
      inventory_item_id: itemId,
      recipe_id: recipeId || null,
      action,
      quantity_used: quantityUsed.toString(),
      unit: item.unit,
      notes: notes || null,
      used_at: new Date(),
    };

    await db.insert(inventoryUsageLog).values(usageLogEntry);

    // Update inventory item
    if (newQuantity <= 0) {
      await db
        .update(inventoryItems)
        .set({
          quantity: '0',
          status: 'used',
          updated_at: new Date(),
        })
        .where(eq(inventoryItems.id, itemId));
    } else {
      await db
        .update(inventoryItems)
        .set({
          quantity: newQuantity.toString(),
          updated_at: new Date(),
        })
        .where(eq(inventoryItems.id, itemId));
    }

    return { remainingQuantity: newQuantity };
  }

  /**
   * Mark an item as wasted
   */
  async markAsWasted(
    itemId: string,
    outcome: WasteOutcome,
    options?: {
      notes?: string;
      costUsd?: number;
      weightOz?: number;
    }
  ): Promise<{ daysOwned: number }> {
    const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, itemId)).limit(1);

    if (!item) {
      throw new Error('Inventory item not found');
    }

    // Calculate days owned
    const daysOwned = Math.floor(
      (Date.now() - item.acquisition_date.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Use item's cost if not provided
    const wasteCost =
      options?.costUsd ?? (item.cost_usd ? parseFloat(item.cost_usd) : null);

    // Create waste tracking entry
    const wasteEntry: NewWasteTracking = {
      user_id: item.user_id,
      ingredient_id: item.ingredient_id,
      inventory_item_id: itemId,
      outcome,
      cost_usd: wasteCost?.toString() || null,
      weight_oz: options?.weightOz?.toString() || null,
      days_owned: daysOwned,
      notes: options?.notes || null,
      wasted_at: new Date(),
    };

    await db.insert(wasteTracking).values(wasteEntry);

    // Update inventory item status
    await db
      .update(inventoryItems)
      .set({
        status: 'wasted',
        updated_at: new Date(),
      })
      .where(eq(inventoryItems.id, itemId));

    return { daysOwned };
  }

  /**
   * Match recipes to user's current inventory
   * Returns recipes that can be made with available ingredients
   */
  async matchRecipes(
    userId: string,
    options?: {
      minMatchPercentage?: number;
      prioritizeExpiring?: boolean;
      limit?: number;
    }
  ): Promise<
    Array<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      image_url: string | null;
      images: string[] | null;
      prep_time: number | null;
      cook_time: number | null;
      servings: number | null;
      difficulty: string | null;
      cuisine: string | null;
      match_percentage: number;
      total_ingredients: number;
      matched_ingredients: number;
      missing_ingredients: any[];
    }>
  > {
    const { minMatchPercentage = 50, limit = 20, prioritizeExpiring = false } = options || {};

    // Get user's available inventory
    const userInventory = await db
      .select({
        ingredient_id: inventoryItems.ingredient_id,
        status: inventoryItems.status,
      })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.user_id, userId),
          or(
            eq(inventoryItems.status, 'fresh'),
            eq(inventoryItems.status, 'use_soon'),
            eq(inventoryItems.status, 'expiring')
          )
        )
      );

    if (userInventory.length === 0) {
      return [];
    }

    const inventoryIngredientIds = userInventory.map((item) => item.ingredient_id);

    // Find matching recipes using SQL
    const matchedRecipes = await db.execute(sql`
      WITH recipe_ingredient_counts AS (
        SELECT
          ri.recipe_id,
          COUNT(DISTINCT ri.ingredient_id) as total_ingredients,
          COUNT(DISTINCT CASE
            WHEN ri.ingredient_id = ANY(${inventoryIngredientIds})
            THEN ri.ingredient_id
          END) as matched_ingredients
        FROM recipe_ingredients ri
        GROUP BY ri.recipe_id
      ),
      recipe_matches AS (
        SELECT
          ric.recipe_id,
          ric.total_ingredients,
          ric.matched_ingredients,
          ROUND((ric.matched_ingredients::decimal / ric.total_ingredients::decimal) * 100) as match_percentage
        FROM recipe_ingredient_counts ric
        WHERE ric.total_ingredients > 0
          AND (ric.matched_ingredients::decimal / ric.total_ingredients::decimal) * 100 >= ${minMatchPercentage}
      )
      SELECT
        r.id,
        r.name,
        r.slug,
        r.description,
        r.image_url,
        r.images,
        r.prep_time,
        r.cook_time,
        r.servings,
        r.difficulty,
        r.cuisine,
        rm.total_ingredients,
        rm.matched_ingredients,
        rm.match_percentage,
        ARRAY_AGG(
          DISTINCT CASE
            WHEN ri.ingredient_id != ALL(${inventoryIngredientIds})
            THEN jsonb_build_object(
              'ingredient_id', ri.ingredient_id,
              'ingredient_name', i.display_name,
              'amount', ri.amount,
              'unit', ri.unit
            )
          END
        ) FILTER (WHERE ri.ingredient_id != ALL(${inventoryIngredientIds})) as missing_ingredients
      FROM recipes r
      INNER JOIN recipe_matches rm ON r.id = rm.recipe_id
      LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
      LEFT JOIN ingredients i ON ri.ingredient_id = i.id
      WHERE
        r.deleted_at IS NULL
        AND (r.user_id = ${userId} OR r.is_public = true)
      GROUP BY
        r.id, r.name, r.slug, r.description, r.image_url, r.images,
        r.prep_time, r.cook_time, r.servings, r.difficulty, r.cuisine,
        rm.total_ingredients, rm.matched_ingredients, rm.match_percentage
      ORDER BY
        rm.match_percentage DESC,
        rm.total_ingredients ASC
      LIMIT ${limit}
    `);

    let results = matchedRecipes.rows as any[];

    // Optionally prioritize recipes using expiring ingredients
    if (prioritizeExpiring) {
      const expiringIngredientIds = userInventory
        .filter((item) => item.status === 'expiring' || item.status === 'use_soon')
        .map((item) => item.ingredient_id);

      results = results.map((recipe) => ({
        ...recipe,
        uses_expiring: expiringIngredientIds.some((id) => inventoryIngredientIds.includes(id)),
      }));

      results.sort((a, b) => {
        if (a.uses_expiring !== b.uses_expiring) {
          return a.uses_expiring ? -1 : 1;
        }
        return b.match_percentage - a.match_percentage;
      });
    }

    return results;
  }
}

// Export singleton instance
export const inventoryService = new InventoryService();
