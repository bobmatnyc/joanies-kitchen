'use server';

import { and, asc, desc, eq, gte, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  type InventoryItem,
  inventoryItems,
  type InventoryStatus,
  inventoryUsageLog,
  type NewInventoryItem,
  type NewInventoryUsageLog,
  type NewWasteTracking,
  type StorageLocation,
  type UsageAction,
  type WasteOutcome,
  wasteTracking,
} from '@/lib/db/inventory-schema';
import { ingredients } from '@/lib/db/ingredients-schema';
import { recipeIngredients, recipes } from '@/lib/db/schema';
import { z } from 'zod';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/**
 * Validation schema for adding new inventory items
 */
const addInventoryItemSchema = z.object({
  ingredient_id: z.string().uuid('Invalid ingredient ID'),
  storage_location: z.enum(['fridge', 'freezer', 'pantry', 'other']),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().min(1, 'Unit is required').max(50),
  expiry_date: z.date().optional().nullable(),
  cost_usd: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

/**
 * Validation schema for updating inventory items
 */
const updateInventoryItemSchema = z.object({
  storage_location: z.enum(['fridge', 'freezer', 'pantry', 'other']).optional(),
  status: z
    .enum(['fresh', 'use_soon', 'expiring', 'expired', 'used', 'wasted'])
    .optional(),
  quantity: z.number().positive('Quantity must be positive').optional(),
  unit: z.string().min(1).max(50).optional(),
  expiry_date: z.date().optional().nullable(),
  cost_usd: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

/**
 * Validation schema for marking items as used
 */
const markAsUsedSchema = z.object({
  quantity_used: z.number().positive('Quantity used must be positive'),
  action: z.enum(['cooked', 'eaten_raw', 'composted', 'trashed', 'donated']),
  recipe_id: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

/**
 * Validation schema for marking items as wasted
 */
const markAsWastedSchema = z.object({
  outcome: z.enum(['expired', 'spoiled', 'forgot_about_it', 'bought_too_much', 'overcooked', 'other']),
  cost_usd: z.number().min(0).optional().nullable(),
  weight_oz: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ============================================================================
// 1. CRUD OPERATIONS
// ============================================================================

/**
 * Add a new item to user's inventory
 *
 * @param data - New inventory item data (validated)
 * @returns Success status and created item or error message
 */
export async function addInventoryItem(data: z.infer<typeof addInventoryItemSchema>) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Validate input
    const validatedData = addInventoryItemSchema.parse(data);

    // Verify ingredient exists
    const ingredient = await db
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(eq(ingredients.id, validatedData.ingredient_id))
      .limit(1);

    if (ingredient.length === 0) {
      return { success: false, error: 'Ingredient not found' };
    }

    // Determine initial status based on expiry date
    let status: InventoryStatus = 'fresh';
    if (validatedData.expiry_date) {
      const now = new Date();
      const expiryDate = validatedData.expiry_date;
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

    // Create inventory item
    const newItem: NewInventoryItem = {
      user_id: userId,
      ingredient_id: validatedData.ingredient_id,
      storage_location: validatedData.storage_location,
      status,
      quantity: validatedData.quantity.toString(),
      unit: validatedData.unit,
      expiry_date: validatedData.expiry_date || null,
      cost_usd: validatedData.cost_usd?.toString() || null,
      notes: validatedData.notes || null,
      acquisition_date: new Date(),
      updated_at: new Date(),
    };

    const result = await db.insert(inventoryItems).values(newItem).returning();

    revalidatePath('/inventory');
    return { success: true, data: result[0] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Validation error: ${error.errors.map((e) => e.message).join(', ')}`,
      };
    }
    console.error('Failed to add inventory item:', error);
    return { success: false, error: 'Failed to add inventory item' };
  }
}

/**
 * Update an existing inventory item
 *
 * @param id - Inventory item ID
 * @param updates - Partial inventory item updates (validated)
 * @returns Success status and updated item or error message
 */
export async function updateInventoryItem(
  id: string,
  updates: z.infer<typeof updateInventoryItemSchema>
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Validate input
    const validatedUpdates = updateInventoryItemSchema.parse(updates);

    // Check ownership
    const existingItem = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, id))
      .limit(1);

    if (existingItem.length === 0) {
      return { success: false, error: 'Inventory item not found' };
    }

    if (existingItem[0].user_id !== userId) {
      return { success: false, error: 'You do not have permission to update this item' };
    }

    // Prepare update data
    const updateData: Partial<InventoryItem> = {
      ...validatedUpdates,
      quantity: validatedUpdates.quantity?.toString(),
      cost_usd: validatedUpdates.cost_usd?.toString(),
      updated_at: new Date(),
    };

    const result = await db
      .update(inventoryItems)
      .set(updateData)
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.user_id, userId)))
      .returning();

    revalidatePath('/inventory');
    return { success: true, data: result[0] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Validation error: ${error.errors.map((e) => e.message).join(', ')}`,
      };
    }
    console.error('Failed to update inventory item:', error);
    return { success: false, error: 'Failed to update inventory item' };
  }
}

/**
 * Delete an inventory item
 *
 * @param id - Inventory item ID
 * @returns Success status or error message
 */
export async function deleteInventoryItem(id: string) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Check ownership
    const existingItem = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, id))
      .limit(1);

    if (existingItem.length === 0) {
      return { success: false, error: 'Inventory item not found' };
    }

    if (existingItem[0].user_id !== userId) {
      return { success: false, error: 'You do not have permission to delete this item' };
    }

    const result = await db
      .delete(inventoryItems)
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.user_id, userId)))
      .returning();

    revalidatePath('/inventory');
    return { success: true, data: result[0] };
  } catch (error) {
    console.error('Failed to delete inventory item:', error);
    return { success: false, error: 'Failed to delete inventory item' };
  }
}

/**
 * Get user's inventory with optional filters
 *
 * @param filters - Optional filters for storage, status, and expiry
 * @returns Success status and filtered inventory items with ingredient details
 */
export async function getUserInventory(filters?: {
  storage?: StorageLocation;
  status?: InventoryStatus;
  expiringWithinDays?: number;
}) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Build query conditions
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

    // Execute query with ingredient join
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
        },
      })
      .from(inventoryItems)
      .innerJoin(ingredients, eq(inventoryItems.ingredient_id, ingredients.id))
      .where(and(...conditions))
      .orderBy(asc(inventoryItems.expiry_date), desc(inventoryItems.created_at));

    return { success: true, data: results };
  } catch (error) {
    console.error('Failed to fetch inventory:', error);
    return { success: false, error: 'Failed to fetch inventory' };
  }
}

/**
 * Get a single inventory item by ID
 *
 * @param id - Inventory item ID
 * @returns Success status and item with ingredient details or error message
 */
export async function getInventoryItem(id: string) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    const result = await db
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
        },
      })
      .from(inventoryItems)
      .innerJoin(ingredients, eq(inventoryItems.ingredient_id, ingredients.id))
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.user_id, userId)))
      .limit(1);

    if (result.length === 0) {
      return { success: false, error: 'Inventory item not found' };
    }

    return { success: true, data: result[0] };
  } catch (error) {
    console.error('Failed to fetch inventory item:', error);
    return { success: false, error: 'Failed to fetch inventory item' };
  }
}

// ============================================================================
// 2. RECIPE MATCHING
// ============================================================================

/**
 * Match recipes based on user's current inventory
 * Uses SQL JOIN approach for optimal performance
 *
 * @param options - Match options (percentage threshold, prioritize expiring, limit)
 * @returns Success status and matched recipes with match percentage and missing ingredients
 */
export async function matchRecipesToInventory(options?: {
  minMatchPercentage?: number;
  prioritizeExpiring?: boolean;
  limit?: number;
}) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    const minMatchPercentage = options?.minMatchPercentage ?? 50;
    const limit = options?.limit ?? 20;
    const prioritizeExpiring = options?.prioritizeExpiring ?? false;

    // Get user's available inventory (excluding used/wasted items)
    const userInventory = await db
      .select({
        ingredient_id: inventoryItems.ingredient_id,
        quantity: inventoryItems.quantity,
        unit: inventoryItems.unit,
        expiry_date: inventoryItems.expiry_date,
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
      return { success: true, data: [] };
    }

    const inventoryIngredientIds = userInventory.map((item) => item.ingredient_id);

    // Find recipes with ingredient match calculation
    // This uses a CTE (Common Table Expression) for optimal performance
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
        r.is_public,
        r.is_system_recipe,
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
        r.is_public, r.is_system_recipe,
        rm.total_ingredients, rm.matched_ingredients, rm.match_percentage
      ORDER BY
        rm.match_percentage DESC,
        rm.total_ingredients ASC
      LIMIT ${limit}
    `);

    // If prioritize expiring, re-sort by recipes that use expiring ingredients
    let results = matchedRecipes.rows as any[];

    if (prioritizeExpiring) {
      const expiringIngredientIds = userInventory
        .filter((item) => item.status === 'expiring' || item.status === 'use_soon')
        .map((item) => item.ingredient_id);

      results = results.map((recipe) => {
        // Check if recipe uses any expiring ingredients
        const usesExpiringIngredients = expiringIngredientIds.some((id) =>
          inventoryIngredientIds.includes(id)
        );
        return {
          ...recipe,
          uses_expiring: usesExpiringIngredients,
        };
      });

      // Sort by expiring status first, then match percentage
      results.sort((a, b) => {
        if (a.uses_expiring !== b.uses_expiring) {
          return a.uses_expiring ? -1 : 1;
        }
        return b.match_percentage - a.match_percentage;
      });
    }

    return { success: true, data: results };
  } catch (error) {
    console.error('Failed to match recipes to inventory:', error);
    return { success: false, error: 'Failed to match recipes' };
  }
}

// ============================================================================
// 3. QUICK ACTIONS
// ============================================================================

/**
 * Mark an inventory item as used
 * Creates usage log entry and updates item status
 *
 * @param itemId - Inventory item ID
 * @param quantityUsed - Amount used
 * @param action - Usage action type
 * @param recipeId - Optional recipe reference
 * @param notes - Optional notes
 * @returns Success status or error message
 */
export async function markItemAsUsed(
  itemId: string,
  quantityUsed: number,
  action: UsageAction = 'cooked',
  recipeId?: string,
  notes?: string
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Validate input
    const validatedData = markAsUsedSchema.parse({
      quantity_used: quantityUsed,
      action,
      recipe_id: recipeId,
      notes,
    });

    // Get inventory item with ownership check
    const item = await db
      .select()
      .from(inventoryItems)
      .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.user_id, userId)))
      .limit(1);

    if (item.length === 0) {
      return { success: false, error: 'Inventory item not found' };
    }

    const inventoryItem = item[0];
    const currentQuantity = parseFloat(inventoryItem.quantity);
    const usedQuantity = validatedData.quantity_used;

    // Validate recipe exists if provided
    if (validatedData.recipe_id) {
      const recipe = await db
        .select({ id: recipes.id })
        .from(recipes)
        .where(eq(recipes.id, validatedData.recipe_id))
        .limit(1);

      if (recipe.length === 0) {
        return { success: false, error: 'Recipe not found' };
      }
    }

    // Create usage log entry
    const usageLogEntry: NewInventoryUsageLog = {
      inventory_item_id: itemId,
      recipe_id: validatedData.recipe_id || null,
      action: validatedData.action,
      quantity_used: usedQuantity.toString(),
      unit: inventoryItem.unit,
      notes: validatedData.notes || null,
      used_at: new Date(),
    };

    await db.insert(inventoryUsageLog).values(usageLogEntry);

    // Update inventory item quantity
    const newQuantity = currentQuantity - usedQuantity;

    if (newQuantity <= 0) {
      // Item fully used - mark as used
      await db
        .update(inventoryItems)
        .set({
          quantity: '0',
          status: 'used',
          updated_at: new Date(),
        })
        .where(eq(inventoryItems.id, itemId));
    } else {
      // Partial usage - update quantity
      await db
        .update(inventoryItems)
        .set({
          quantity: newQuantity.toString(),
          updated_at: new Date(),
        })
        .where(eq(inventoryItems.id, itemId));
    }

    revalidatePath('/inventory');
    return { success: true, data: { remaining_quantity: newQuantity } };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Validation error: ${error.errors.map((e) => e.message).join(', ')}`,
      };
    }
    console.error('Failed to mark item as used:', error);
    return { success: false, error: 'Failed to mark item as used' };
  }
}

/**
 * Mark an inventory item as wasted
 * Creates waste tracking entry and updates item status
 *
 * @param itemId - Inventory item ID
 * @param reason - Waste outcome reason
 * @param notes - Optional notes
 * @param costUsd - Optional cost (if not already tracked)
 * @param weightOz - Optional weight in ounces
 * @returns Success status or error message
 */
export async function markItemAsWasted(
  itemId: string,
  reason: WasteOutcome,
  notes?: string,
  costUsd?: number,
  weightOz?: number
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Validate input
    const validatedData = markAsWastedSchema.parse({
      outcome: reason,
      cost_usd: costUsd,
      weight_oz: weightOz,
      notes,
    });

    // Get inventory item with ownership check
    const item = await db
      .select()
      .from(inventoryItems)
      .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.user_id, userId)))
      .limit(1);

    if (item.length === 0) {
      return { success: false, error: 'Inventory item not found' };
    }

    const inventoryItem = item[0];

    // Calculate days owned
    const daysOwned = Math.floor(
      (new Date().getTime() - inventoryItem.acquisition_date.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Use item's cost if not provided
    const wasteCost = validatedData.cost_usd ?? (inventoryItem.cost_usd ? parseFloat(inventoryItem.cost_usd) : null);

    // Create waste tracking entry
    const wasteEntry: NewWasteTracking = {
      user_id: userId,
      ingredient_id: inventoryItem.ingredient_id,
      inventory_item_id: itemId,
      outcome: validatedData.outcome,
      cost_usd: wasteCost?.toString() || null,
      weight_oz: validatedData.weight_oz?.toString() || null,
      days_owned: daysOwned,
      notes: validatedData.notes || null,
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

    revalidatePath('/inventory');
    return { success: true, data: { days_owned: daysOwned } };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Validation error: ${error.errors.map((e) => e.message).join(', ')}`,
      };
    }
    console.error('Failed to mark item as wasted:', error);
    return { success: false, error: 'Failed to mark item as wasted' };
  }
}

/**
 * Bulk mark recipe ingredients as used from user's inventory
 * Automatically finds matching inventory items and marks them as used
 *
 * @param recipeId - Recipe ID to mark ingredients for
 * @returns Success status with details of marked items or error message
 */
export async function markRecipeIngredientsAsUsed(recipeId: string) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Verify recipe exists and user has access
    const recipe = await db
      .select()
      .from(recipes)
      .where(
        and(
          eq(recipes.id, recipeId),
          or(eq(recipes.user_id, userId), eq(recipes.is_public, true))
        )
      )
      .limit(1);

    if (recipe.length === 0) {
      return { success: false, error: 'Recipe not found or access denied' };
    }

    // Get recipe ingredients
    const recipeIngredientsData = await db
      .select({
        ingredient_id: recipeIngredients.ingredient_id,
        amount: recipeIngredients.amount,
        unit: recipeIngredients.unit,
      })
      .from(recipeIngredients)
      .where(eq(recipeIngredients.recipe_id, recipeId));

    if (recipeIngredientsData.length === 0) {
      return { success: false, error: 'Recipe has no ingredients listed' };
    }

    const ingredientIds = recipeIngredientsData.map((ri) => ri.ingredient_id);

    // Get user's available inventory for these ingredients
    const userInventory = await db
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.user_id, userId),
          sql`${inventoryItems.ingredient_id} = ANY(${ingredientIds})`,
          or(
            eq(inventoryItems.status, 'fresh'),
            eq(inventoryItems.status, 'use_soon'),
            eq(inventoryItems.status, 'expiring')
          )
        )
      );

    const markedItems: Array<{ ingredient_id: string; quantity_used: number }> = [];
    const missingIngredients: string[] = [];

    // Mark each ingredient as used (first available inventory item)
    for (const recipeIngredient of recipeIngredientsData) {
      const inventoryItem = userInventory.find(
        (item) => item.ingredient_id === recipeIngredient.ingredient_id
      );

      if (inventoryItem) {
        // Parse quantity (simplified - assumes numeric amount)
        const quantityToUse = recipeIngredient.amount
          ? parseFloat(recipeIngredient.amount) || 1
          : 1;

        // Mark as used
        await markItemAsUsed(
          inventoryItem.id,
          quantityToUse,
          'cooked',
          recipeId,
          `Used in recipe: ${recipe[0].name}`
        );

        markedItems.push({
          ingredient_id: recipeIngredient.ingredient_id,
          quantity_used: quantityToUse,
        });
      } else {
        missingIngredients.push(recipeIngredient.ingredient_id);
      }
    }

    revalidatePath('/inventory');
    return {
      success: true,
      data: {
        recipe_name: recipe[0].name,
        total_ingredients: recipeIngredientsData.length,
        marked_count: markedItems.length,
        missing_count: missingIngredients.length,
        marked_items: markedItems,
        missing_ingredients: missingIngredients,
      },
    };
  } catch (error) {
    console.error('Failed to mark recipe ingredients as used:', error);
    return { success: false, error: 'Failed to mark recipe ingredients as used' };
  }
}
