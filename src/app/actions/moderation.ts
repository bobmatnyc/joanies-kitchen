'use server';

import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { toErrorMessage } from '@/lib/utils/error-handling';

/**
 * Recipe Moderation Server Actions
 * All actions require admin access via requireAdmin() check
 */

// ==================== Types ====================

export interface PendingRecipe {
  id: string;
  name: string;
  description: string | null;
  cuisine: string | null;
  difficulty: string | null;
  prep_time: number | null;
  cook_time: number | null;
  servings: number | null;
  images: string | null;
  ingredients: string | null;
  instructions: string | null;
  tags: string | null;
  user_id: string;
  created_at: Date;
  moderation_status: string;
  submission_notes: string | null;
  is_public: boolean;
}

export interface ModerationHistoryEntry {
  id: string;
  name: string;
  moderation_status: string;
  moderation_notes: string | null;
  moderated_by: string | null;
  moderated_at: Date | null;
  user_id: string;
  created_at: Date;
}

export interface ModerationStats {
  totalPending: number;
  approvedToday: number;
  rejectedToday: number;
  flaggedCount: number;
  averageModerationTimeHours: number;
}

// ==================== Get Pending Recipes ====================

/**
 * Get pending recipes for moderation queue
 * @param limit Maximum number of recipes to return
 * @param offset Number of recipes to skip for pagination
 */
export async function getPendingRecipes(limit = 20, offset = 0) {
  try {
    await requireAdmin();

    const pendingRecipes = await db
      .select({
        id: recipes.id,
        name: recipes.name,
        description: recipes.description,
        cuisine: recipes.cuisine,
        difficulty: recipes.difficulty,
        prep_time: recipes.prep_time,
        cook_time: recipes.cook_time,
        servings: recipes.servings,
        images: recipes.images,
        ingredients: recipes.ingredients,
        instructions: recipes.instructions,
        tags: recipes.tags,
        user_id: recipes.user_id,
        created_at: recipes.created_at,
        moderation_status: recipes.moderation_status,
        submission_notes: recipes.submission_notes,
        is_public: recipes.is_public,
      })
      .from(recipes)
      .where(eq(recipes.moderation_status, 'pending'))
      .orderBy(desc(recipes.created_at))
      .limit(limit)
      .offset(offset);

    return { success: true, data: pendingRecipes };
  } catch (error) {
    console.error('Failed to fetch pending recipes:', error);
    return { success: false, error: 'Failed to fetch pending recipes' };
  }
}

// ==================== Get Recipes by Status ====================

/**
 * Get recipes by moderation status
 */
export async function getRecipesByStatus(
  status: 'pending' | 'approved' | 'rejected' | 'flagged',
  limit = 20,
  offset = 0
) {
  try {
    await requireAdmin();

    const statusRecipes = await db
      .select({
        id: recipes.id,
        name: recipes.name,
        description: recipes.description,
        cuisine: recipes.cuisine,
        difficulty: recipes.difficulty,
        prep_time: recipes.prep_time,
        cook_time: recipes.cook_time,
        servings: recipes.servings,
        images: recipes.images,
        ingredients: recipes.ingredients,
        instructions: recipes.instructions,
        tags: recipes.tags,
        user_id: recipes.user_id,
        created_at: recipes.created_at,
        moderation_status: recipes.moderation_status,
        submission_notes: recipes.submission_notes,
        moderation_notes: recipes.moderation_notes,
        moderated_by: recipes.moderated_by,
        moderated_at: recipes.moderated_at,
        is_public: recipes.is_public,
      })
      .from(recipes)
      .where(eq(recipes.moderation_status, status))
      .orderBy(desc(recipes.created_at))
      .limit(limit)
      .offset(offset);

    return { success: true, data: statusRecipes };
  } catch (error) {
    console.error(`Failed to fetch ${status} recipes:`, error);
    return { success: false, error: `Failed to fetch ${status} recipes` };
  }
}

// ==================== Approve Recipe ====================

/**
 * Approve a recipe and make it visible if it was submitted as public
 * @param recipeId Recipe ID to approve
 * @param moderatorNotes Optional notes from moderator
 */
export async function approveRecipe(recipeId: string, moderatorNotes?: string) {
  try {
    const { userId } = await requireAdmin();

    // Get the current recipe to check if it should be public
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);

    if (!recipe) {
      return { success: false, error: 'Recipe not found' };
    }

    // Update the recipe with approval
    const result = await db
      .update(recipes)
      .set({
        moderation_status: 'approved',
        moderation_notes: moderatorNotes || null,
        moderated_by: userId,
        moderated_at: new Date(),
        // If recipe was intended to be public, make it public on approval
        is_public: recipe.is_public ? true : recipe.is_public,
        updated_at: new Date(),
      })
      .where(eq(recipes.id, recipeId))
      .returning();

    if (result.length === 0) {
      return { success: false, error: 'Failed to approve recipe' };
    }

    // Revalidate relevant paths
    revalidatePath('/admin/recipe-moderation');
    revalidatePath('/recipes');
    revalidatePath('/shared');
    revalidatePath(`/recipes/${recipeId}`);

    return { success: true, data: result[0] };
  } catch (error) {
    console.error('Failed to approve recipe:', error);
    return { success: false, error: 'Failed to approve recipe' };
  }
}

// ==================== Reject Recipe ====================

/**
 * Reject a recipe with a reason
 * @param recipeId Recipe ID to reject
 * @param reason Reason for rejection (required)
 */
export async function rejectRecipe(recipeId: string, reason: string) {
  try {
    const { userId } = await requireAdmin();

    if (!reason || reason.trim() === '') {
      return { success: false, error: 'Rejection reason is required' };
    }

    const result = await db
      .update(recipes)
      .set({
        moderation_status: 'rejected',
        moderation_notes: reason,
        moderated_by: userId,
        moderated_at: new Date(),
        is_public: false, // Rejected recipes are always private
        updated_at: new Date(),
      })
      .where(eq(recipes.id, recipeId))
      .returning();

    if (result.length === 0) {
      return { success: false, error: 'Recipe not found' };
    }

    // Revalidate relevant paths
    revalidatePath('/admin/recipe-moderation');
    revalidatePath('/recipes');

    return { success: true, data: result[0] };
  } catch (error) {
    console.error('Failed to reject recipe:', error);
    return { success: false, error: 'Failed to reject recipe' };
  }
}

// ==================== Flag Recipe ====================

/**
 * Flag a recipe for review (can be done on approved recipes)
 * @param recipeId Recipe ID to flag
 * @param reason Reason for flagging (required)
 */
export async function flagRecipe(recipeId: string, reason: string) {
  try {
    const { userId } = await requireAdmin();

    if (!reason || reason.trim() === '') {
      return { success: false, error: 'Flag reason is required' };
    }

    const result = await db
      .update(recipes)
      .set({
        moderation_status: 'flagged',
        moderation_notes: reason,
        moderated_by: userId,
        moderated_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(recipes.id, recipeId))
      .returning();

    if (result.length === 0) {
      return { success: false, error: 'Recipe not found' };
    }

    // Revalidate relevant paths
    revalidatePath('/admin/recipe-moderation');
    revalidatePath('/admin/flags');
    revalidatePath(`/recipes/${recipeId}`);

    return { success: true, data: result[0] };
  } catch (error) {
    console.error('Failed to flag recipe:', error);
    return { success: false, error: 'Failed to flag recipe' };
  }
}

// ==================== Get Moderation History ====================

/**
 * Get moderation history (all moderated recipes)
 * @param limit Maximum number of entries to return
 * @param offset Number of entries to skip for pagination
 */
export async function getModerationHistory(limit = 50, offset = 0) {
  try {
    await requireAdmin();

    const history = await db
      .select({
        id: recipes.id,
        name: recipes.name,
        moderation_status: recipes.moderation_status,
        moderation_notes: recipes.moderation_notes,
        moderated_by: recipes.moderated_by,
        moderated_at: recipes.moderated_at,
        user_id: recipes.user_id,
        created_at: recipes.created_at,
      })
      .from(recipes)
      .where(
        and(
          eq(recipes.moderation_status, 'approved'),
          isNull(recipes.moderated_at) // Only get recipes that have been moderated
        )
      )
      .orderBy(desc(recipes.moderated_at))
      .limit(limit)
      .offset(offset);

    return { success: true, data: history };
  } catch (error) {
    console.error('Failed to fetch moderation history:', error);
    return { success: false, error: 'Failed to fetch moderation history' };
  }
}

// ==================== Get Moderation Stats ====================

/**
 * Get moderation statistics for the dashboard
 */
export async function getModerationStats() {
  try {
    await requireAdmin();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get counts
    const [stats] = await db
      .select({
        totalPending: sql<number>`count(*) filter (where ${recipes.moderation_status} = 'pending')`,
        approvedToday: sql<number>`count(*) filter (where ${recipes.moderation_status} = 'approved' and ${recipes.moderated_at} >= ${startOfToday})`,
        rejectedToday: sql<number>`count(*) filter (where ${recipes.moderation_status} = 'rejected' and ${recipes.moderated_at} >= ${startOfToday})`,
        flaggedCount: sql<number>`count(*) filter (where ${recipes.moderation_status} = 'flagged')`,
      })
      .from(recipes);

    // Calculate average moderation time for recipes moderated in last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const moderatedRecipes = await db
      .select({
        created_at: recipes.created_at,
        moderated_at: recipes.moderated_at,
      })
      .from(recipes)
      .where(
        and(
          sql`${recipes.moderated_at} >= ${thirtyDaysAgo}`,
          sql`${recipes.moderated_at} is not null`
        )
      );

    let averageModerationTimeHours = 0;
    if (moderatedRecipes.length > 0) {
      const totalHours = moderatedRecipes.reduce((sum, recipe) => {
        if (recipe.moderated_at && recipe.created_at) {
          const hours =
            (recipe.moderated_at.getTime() - recipe.created_at.getTime()) / (1000 * 60 * 60);
          return sum + hours;
        }
        return sum;
      }, 0);
      averageModerationTimeHours = Math.round(totalHours / moderatedRecipes.length);
    }

    const result: ModerationStats = {
      totalPending: Number(stats.totalPending) || 0,
      approvedToday: Number(stats.approvedToday) || 0,
      rejectedToday: Number(stats.rejectedToday) || 0,
      flaggedCount: Number(stats.flaggedCount) || 0,
      averageModerationTimeHours,
    };

    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to fetch moderation stats:', error);
    return { success: false, error: 'Failed to fetch moderation stats' };
  }
}

// ==================== Get Full Recipe Details ====================

/**
 * Get full recipe details for preview (admin can see any recipe)
 * @param recipeId Recipe ID
 */
export async function getRecipeForModeration(recipeId: string) {
  try {
    await requireAdmin();

    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);

    if (!recipe) {
      return { success: false, error: 'Recipe not found' };
    }

    return { success: true, data: recipe };
  } catch (error) {
    console.error('Failed to fetch recipe:', error);
    return { success: false, error: 'Failed to fetch recipe details' };
  }
}
