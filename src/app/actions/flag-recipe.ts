/**
 * Server Actions for Recipe Flagging
 *
 * Handles content moderation through user-submitted flags:
 * - Flag inappropriate/spam content
 * - Track flag status (pending, reviewed, resolved, dismissed)
 * - Admin review and management
 */

'use server';

import { auth } from '@clerk/nextjs/server';
import { and, count, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { recipeFlags, recipes } from '@/lib/db/schema';

export type FlagReason = 'inappropriate' | 'spam' | 'copyright' | 'quality' | 'other';
export type FlagStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export interface FlagRecipeResult {
  success: boolean;
  error?: string;
  flagId?: string;
}

/**
 * Flag a recipe for review
 *
 * @param recipeId - Recipe ID to flag
 * @param reason - Reason for flagging
 * @param description - Optional detailed description
 * @returns Result with success status
 */
export async function flagRecipe(
  recipeId: string,
  reason: FlagReason,
  description?: string
): Promise<FlagRecipeResult> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return {
        success: false,
        error: 'You must be logged in to flag recipes',
      };
    }

    // Validate reason
    const validReasons: FlagReason[] = ['inappropriate', 'spam', 'copyright', 'quality', 'other'];
    if (!validReasons.includes(reason)) {
      return {
        success: false,
        error: 'Invalid flag reason',
      };
    }

    // Verify recipe exists
    const recipe = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(eq(recipes.id, recipeId))
      .limit(1);

    if (recipe.length === 0) {
      return {
        success: false,
        error: 'Recipe not found',
      };
    }

    // Create flag
    const [newFlag] = await db
      .insert(recipeFlags)
      .values({
        recipe_id: recipeId,
        user_id: userId,
        reason,
        description: description || null,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning({ id: recipeFlags.id });

    console.log(`[Flag Recipe] User ${userId} flagged recipe ${recipeId} for ${reason}`);

    // Revalidate paths
    revalidatePath(`/recipes/${recipeId}`);
    revalidatePath('/admin/flags');

    return {
      success: true,
      flagId: newFlag.id,
    };
  } catch (error: any) {
    console.error('[Flag Recipe] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to flag recipe',
    };
  }
}

/**
 * Get flag count for a recipe
 *
 * @param recipeId - Recipe ID
 * @returns Count of pending flags
 */
export async function getFlagCount(recipeId: string): Promise<number> {
  try {
    const result = await db
      .select({ count: count() })
      .from(recipeFlags)
      .where(and(eq(recipeFlags.recipe_id, recipeId), eq(recipeFlags.status, 'pending')));

    return result[0]?.count || 0;
  } catch (error: any) {
    console.error('[Get Flag Count] Error:', error);
    return 0;
  }
}

/**
 * Check if current user has flagged a recipe
 *
 * @param recipeId - Recipe ID
 * @returns True if user has an active flag on this recipe
 */
export async function hasUserFlagged(recipeId: string): Promise<boolean> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return false;
    }

    const flags = await db
      .select({ id: recipeFlags.id })
      .from(recipeFlags)
      .where(
        and(
          eq(recipeFlags.recipe_id, recipeId),
          eq(recipeFlags.user_id, userId),
          eq(recipeFlags.status, 'pending')
        )
      )
      .limit(1);

    return flags.length > 0;
  } catch (error: any) {
    console.error('[Has User Flagged] Error:', error);
    return false;
  }
}

/**
 * Get all flags (admin only)
 *
 * @param status - Filter by status (optional)
 * @param limit - Max number of flags to return
 * @returns Array of flags with recipe info
 */
export async function getAllFlags(
  status?: FlagStatus,
  limit: number = 50
): Promise<
  {
    id: string;
    recipe_id: string;
    recipeName: string;
    user_id: string;
    reason: string;
    description: string | null;
    status: string;
    reviewed_by: string | null;
    reviewed_at: Date | null;
    review_notes: string | null;
    created_at: Date | null;
  }[]
> {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const metadata = sessionClaims?.metadata as { isAdmin?: string } | undefined;
    if (metadata?.isAdmin !== 'true') {
      throw new Error('Admin access required');
    }

    // Query flags with recipe information
    const query = db
      .select({
        id: recipeFlags.id,
        recipe_id: recipeFlags.recipe_id,
        recipeName: recipes.name,
        user_id: recipeFlags.user_id,
        reason: recipeFlags.reason,
        description: recipeFlags.description,
        status: recipeFlags.status,
        reviewed_by: recipeFlags.reviewed_by,
        reviewed_at: recipeFlags.reviewed_at,
        review_notes: recipeFlags.review_notes,
        created_at: recipeFlags.created_at,
      })
      .from(recipeFlags)
      .leftJoin(recipes, eq(recipeFlags.recipe_id, recipes.id))
      .orderBy(desc(recipeFlags.created_at))
      .limit(limit);

    // Add status filter if provided
    const flags = status ? await query.where(eq(recipeFlags.status, status)) : await query;

    return flags.map((flag) => ({
      id: flag.id,
      recipe_id: flag.recipe_id,
      recipeName: flag.recipeName || 'Unknown Recipe',
      user_id: flag.user_id,
      reason: flag.reason || 'other',
      description: flag.description,
      status: flag.status || 'pending',
      reviewed_by: flag.reviewed_by,
      reviewed_at: flag.reviewed_at,
      review_notes: flag.review_notes,
      created_at: flag.created_at,
    }));
  } catch (error: any) {
    console.error('[Get All Flags] Error:', error);
    throw error;
  }
}

/**
 * Review a flag (admin only)
 *
 * @param flagId - Flag ID to review
 * @param status - New status (reviewed, resolved, dismissed)
 * @param reviewNotes - Optional admin notes
 * @returns Success status
 */
export async function reviewFlag(
  flagId: string,
  status: 'reviewed' | 'resolved' | 'dismissed',
  reviewNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return {
        success: false,
        error: 'You must be logged in',
      };
    }

    // Check if user is admin
    const metadata = sessionClaims?.metadata as { isAdmin?: string } | undefined;
    if (metadata?.isAdmin !== 'true') {
      return {
        success: false,
        error: 'Admin access required',
      };
    }

    // Validate status
    const validStatuses = ['reviewed', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return {
        success: false,
        error: 'Invalid status',
      };
    }

    // Update flag
    await db
      .update(recipeFlags)
      .set({
        status,
        reviewed_by: userId,
        reviewed_at: new Date(),
        review_notes: reviewNotes || null,
        updated_at: new Date(),
      })
      .where(eq(recipeFlags.id, flagId));

    console.log(`[Review Flag] Admin ${userId} reviewed flag ${flagId} as ${status}`);

    revalidatePath('/admin/flags');

    return { success: true };
  } catch (error: any) {
    console.error('[Review Flag] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to review flag',
    };
  }
}

/**
 * Get flags for a specific recipe (admin only)
 *
 * @param recipeId - Recipe ID
 * @returns Array of flags for this recipe
 */
export async function getRecipeFlags(recipeId: string): Promise<
  {
    id: string;
    user_id: string;
    reason: string;
    description: string | null;
    status: string;
    created_at: Date | null;
  }[]
> {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const metadata = sessionClaims?.metadata as { isAdmin?: string } | undefined;
    if (metadata?.isAdmin !== 'true') {
      throw new Error('Admin access required');
    }

    const flags = await db
      .select({
        id: recipeFlags.id,
        user_id: recipeFlags.user_id,
        reason: recipeFlags.reason,
        description: recipeFlags.description,
        status: recipeFlags.status,
        created_at: recipeFlags.created_at,
      })
      .from(recipeFlags)
      .where(eq(recipeFlags.recipe_id, recipeId))
      .orderBy(desc(recipeFlags.created_at));

    return flags.map((flag) => ({
      id: flag.id,
      user_id: flag.user_id,
      reason: flag.reason || 'other',
      description: flag.description,
      status: flag.status || 'pending',
      created_at: flag.created_at,
    }));
  } catch (error: any) {
    console.error('[Get Recipe Flags] Error:', error);
    throw error;
  }
}
