'use server';

import { and, count, desc, eq, like, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

/**
 * Admin Server Actions
 * All actions require admin access via requireAdmin() check
 */

// ==================== Statistics ====================

export interface AdminRecipeStats {
  totalRecipes: number;
  publicRecipes: number;
  systemRecipes: number;
  privateRecipes: number;
  totalUsers: number;
  aiGeneratedRecipes: number;
}

/**
 * Get recipe statistics for admin dashboard
 */
export async function getAdminRecipeStats() {
  try {
    await requireAdmin();

    const stats = await db
      .select({
        totalRecipes: count(),
        publicRecipes: sql<number>`count(*) filter (where ${recipes.is_public} = true)`,
        systemRecipes: sql<number>`count(*) filter (where ${recipes.is_system_recipe} = true)`,
        privateRecipes: sql<number>`count(*) filter (where ${recipes.is_public} = false)`,
        aiGeneratedRecipes: sql<number>`count(*) filter (where ${recipes.is_ai_generated} = true)`,
        totalUsers: sql<number>`count(distinct ${recipes.user_id})`,
      })
      .from(recipes);

    const result: AdminRecipeStats = {
      totalRecipes: Number(stats[0].totalRecipes) || 0,
      publicRecipes: Number(stats[0].publicRecipes) || 0,
      systemRecipes: Number(stats[0].systemRecipes) || 0,
      privateRecipes: Number(stats[0].privateRecipes) || 0,
      totalUsers: Number(stats[0].totalUsers) || 0,
      aiGeneratedRecipes: Number(stats[0].aiGeneratedRecipes) || 0,
    };

    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to fetch admin recipe stats:', error);
    return { success: false, error: 'Failed to fetch recipe statistics' };
  }
}

// ==================== Recipe Management ====================

export interface AdminRecipeFilters {
  search?: string;
  isPublic?: boolean;
  isSystemRecipe?: boolean;
  difficulty?: 'easy' | 'medium' | 'hard';
  cuisine?: string;
  isAiGenerated?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Get all recipes for admin with filtering and pagination
 */
export async function getAllRecipesForAdmin(filters?: AdminRecipeFilters) {
  try {
    await requireAdmin();

    const conditions = [];

    // Search filter
    if (filters?.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          like(recipes.name, searchPattern),
          like(recipes.description, searchPattern),
          like(recipes.cuisine, searchPattern),
          like(recipes.tags, searchPattern)
        )
      );
    }

    // Boolean filters
    if (filters?.isPublic !== undefined) {
      conditions.push(eq(recipes.is_public, filters.isPublic));
    }

    if (filters?.isSystemRecipe !== undefined) {
      conditions.push(eq(recipes.is_system_recipe, filters.isSystemRecipe));
    }

    if (filters?.isAiGenerated !== undefined) {
      conditions.push(eq(recipes.is_ai_generated, filters.isAiGenerated));
    }

    // Difficulty filter
    if (filters?.difficulty) {
      conditions.push(eq(recipes.difficulty, filters.difficulty));
    }

    // Cuisine filter
    if (filters?.cuisine) {
      conditions.push(eq(recipes.cuisine, filters.cuisine));
    }

    // Build query
    let query = db.select().from(recipes);

    if (conditions.length > 0) {
      query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions)) as any;
    }

    // Apply ordering
    query = query.orderBy(desc(recipes.created_at)) as any;

    // Apply pagination
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }

    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }

    const results = await query;

    return { success: true, data: results };
  } catch (error) {
    console.error('Failed to fetch admin recipes:', error);
    return { success: false, error: 'Failed to fetch recipes' };
  }
}

/**
 * Toggle recipe public/private status (admin override)
 */
export async function adminToggleRecipePublic(id: string, isPublic: boolean) {
  try {
    await requireAdmin();

    const result = await db
      .update(recipes)
      .set({
        is_public: isPublic,
        updated_at: new Date(),
      })
      .where(eq(recipes.id, id))
      .returning();

    if (result.length === 0) {
      return { success: false, error: 'Recipe not found' };
    }

    revalidatePath('/admin/recipes');
    revalidatePath('/recipes');
    revalidatePath('/shared');
    revalidatePath(`/recipes/${id}`);

    return { success: true, data: result[0] };
  } catch (error) {
    console.error('Failed to toggle recipe public status:', error);
    return { success: false, error: 'Failed to update recipe visibility' };
  }
}

/**
 * Toggle system recipe status (admin only)
 */
export async function adminToggleSystemRecipe(id: string, isSystem: boolean) {
  try {
    await requireAdmin();

    const result = await db
      .update(recipes)
      .set({
        is_system_recipe: isSystem,
        // System recipes must be public
        is_public: isSystem ? true : undefined,
        updated_at: new Date(),
      })
      .where(eq(recipes.id, id))
      .returning();

    if (result.length === 0) {
      return { success: false, error: 'Recipe not found' };
    }

    revalidatePath('/admin/recipes');
    revalidatePath('/shared');
    revalidatePath(`/recipes/${id}`);

    return { success: true, data: result[0] };
  } catch (error) {
    console.error('Failed to toggle system recipe status:', error);
    return { success: false, error: 'Failed to update recipe status' };
  }
}

/**
 * Delete any recipe (admin override)
 */
export async function adminDeleteRecipe(id: string) {
  try {
    await requireAdmin();

    const result = await db.delete(recipes).where(eq(recipes.id, id)).returning();

    if (result.length === 0) {
      return { success: false, error: 'Recipe not found' };
    }

    revalidatePath('/admin/recipes');
    revalidatePath('/recipes');
    revalidatePath('/shared');

    return { success: true, data: result[0] };
  } catch (error) {
    console.error('Failed to delete recipe:', error);
    return { success: false, error: 'Failed to delete recipe' };
  }
}

/**
 * Bulk toggle public status for multiple recipes
 */
export async function adminBulkTogglePublic(ids: string[], isPublic: boolean) {
  try {
    await requireAdmin();

    if (ids.length === 0) {
      return { success: false, error: 'No recipes selected' };
    }

    // Update all recipes in the list
    const conditions = ids.map((id) => eq(recipes.id, id));
    const result = await db
      .update(recipes)
      .set({
        is_public: isPublic,
        updated_at: new Date(),
      })
      .where(or(...conditions))
      .returning();

    revalidatePath('/admin/recipes');
    revalidatePath('/recipes');
    revalidatePath('/shared');

    return {
      success: true,
      data: {
        updated: result.length,
        recipes: result,
      },
    };
  } catch (error) {
    console.error('Failed to bulk toggle recipes:', error);
    return { success: false, error: 'Failed to update recipes' };
  }
}

/**
 * Bulk delete multiple recipes
 */
export async function adminBulkDeleteRecipes(ids: string[]) {
  try {
    await requireAdmin();

    if (ids.length === 0) {
      return { success: false, error: 'No recipes selected' };
    }

    // Delete all recipes in the list
    const conditions = ids.map((id) => eq(recipes.id, id));
    const result = await db
      .delete(recipes)
      .where(or(...conditions))
      .returning();

    revalidatePath('/admin/recipes');
    revalidatePath('/recipes');
    revalidatePath('/shared');

    return {
      success: true,
      data: {
        deleted: result.length,
        recipes: result,
      },
    };
  } catch (error) {
    console.error('Failed to bulk delete recipes:', error);
    return { success: false, error: 'Failed to delete recipes' };
  }
}

// ==================== User Management ====================

export interface UserWithRecipes {
  userId: string;
  recipeCount: number;
  publicRecipeCount: number;
  systemRecipeCount: number;
  latestRecipeDate: Date | null;
}

/**
 * Get users who have created recipes
 */
export async function getUsersWithRecipes() {
  try {
    await requireAdmin();

    const users = await db
      .select({
        userId: recipes.user_id,
        recipeCount: count(),
        publicRecipeCount: sql<number>`count(*) filter (where ${recipes.is_public} = true)`,
        systemRecipeCount: sql<number>`count(*) filter (where ${recipes.is_system_recipe} = true)`,
        latestRecipeDate: sql<Date>`max(${recipes.created_at})`,
      })
      .from(recipes)
      .groupBy(recipes.user_id)
      .orderBy(desc(sql`count(*)`));

    const result: UserWithRecipes[] = users.map((user) => ({
      userId: user.userId,
      recipeCount: Number(user.recipeCount) || 0,
      publicRecipeCount: Number(user.publicRecipeCount) || 0,
      systemRecipeCount: Number(user.systemRecipeCount) || 0,
      latestRecipeDate: user.latestRecipeDate,
    }));

    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to fetch users with recipes:', error);
    return { success: false, error: 'Failed to fetch users' };
  }
}

// ==================== Recent Activity ====================

/**
 * Get recent recipe activity for admin dashboard
 */
export async function getRecentRecipeActivity(limit: number = 10) {
  try {
    await requireAdmin();

    const recentRecipes = await db
      .select()
      .from(recipes)
      .orderBy(desc(recipes.created_at))
      .limit(limit);

    return { success: true, data: recentRecipes };
  } catch (error) {
    console.error('Failed to fetch recent activity:', error);
    return { success: false, error: 'Failed to fetch recent activity' };
  }
}
