'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { checkAdminAccess } from '@/lib/admin';
import { db } from '@/lib/db';
import { joanieComments, type NewJoanieComment } from '@/lib/db/schema';

/**
 * Joanie Comments Server Actions
 *
 * Personal notes and observations from Joanie attached to recipes, meals, or ingredients.
 * These are NOT user-generated - they're Joanie's authentic voice and cooking wisdom.
 *
 * Reads are public. Create, update and delete require an admin (#13).
 */

/**
 * Get comment for a specific recipe
 */
export async function getCommentForRecipe(recipeId: string) {
  try {
    const comment = await db
      .select()
      .from(joanieComments)
      .where(eq(joanieComments.recipe_id, recipeId))
      .limit(1);

    return {
      success: true,
      data: comment[0] || null,
    };
  } catch (error) {
    console.error('Failed to fetch Joanie comment for recipe:', error);
    return {
      success: false,
      error: 'Failed to fetch comment',
    };
  }
}

/**
 * Get comment for a specific meal
 */
export async function getCommentForMeal(mealId: string) {
  try {
    const comment = await db
      .select()
      .from(joanieComments)
      .where(eq(joanieComments.meal_id, mealId))
      .limit(1);

    return {
      success: true,
      data: comment[0] || null,
    };
  } catch (error) {
    console.error('Failed to fetch Joanie comment for meal:', error);
    return {
      success: false,
      error: 'Failed to fetch comment',
    };
  }
}

/**
 * Get comment for a specific ingredient
 */
export async function getCommentForIngredient(ingredientId: string) {
  try {
    const comment = await db
      .select()
      .from(joanieComments)
      .where(eq(joanieComments.ingredient_id, ingredientId))
      .limit(1);

    return {
      success: true,
      data: comment[0] || null,
    };
  } catch (error) {
    console.error('Failed to fetch Joanie comment for ingredient:', error);
    return {
      success: false,
      error: 'Failed to fetch comment',
    };
  }
}

/**
 * Get all comments (for admin dashboard)
 */
export async function getAllComments() {
  try {
    const comments = await db.select().from(joanieComments).orderBy(joanieComments.created_at);

    return {
      success: true,
      data: comments,
    };
  } catch (error) {
    console.error('Failed to fetch all Joanie comments:', error);
    return {
      success: false,
      error: 'Failed to fetch comments',
    };
  }
}

/**
 * Create a new Joanie comment
 * Admin only (#13).
 */
export async function createComment(data: NewJoanieComment) {
  try {
    const { isAdmin } = await checkAdminAccess(); // See #13: Joanie's voice is admin-written
    if (!isAdmin) {
      return { success: false, error: 'Admin access required' };
    }

    // Validate that exactly one reference is provided
    const referenceCount = [data.recipe_id, data.meal_id, data.ingredient_id].filter(
      Boolean
    ).length;

    if (referenceCount !== 1) {
      return {
        success: false,
        error: 'Must provide exactly one reference (recipe_id, meal_id, or ingredient_id)',
      };
    }

    // Validate comment text
    if (!data.comment_text || data.comment_text.trim().length === 0) {
      return {
        success: false,
        error: 'Comment text is required',
      };
    }

    const [comment] = await db.insert(joanieComments).values(data).returning();

    // Revalidate relevant paths
    if (data.recipe_id) {
      revalidatePath(`/recipes/${data.recipe_id}`);
    } else if (data.meal_id) {
      revalidatePath(`/meals/${data.meal_id}`);
    }

    return {
      success: true,
      data: comment,
    };
  } catch (error) {
    console.error('Failed to create Joanie comment:', error);
    return {
      success: false,
      error: 'Failed to create comment',
    };
  }
}

/**
 * Update an existing Joanie comment
 * Admin only (#13).
 */
export async function updateComment(id: string, commentText: string) {
  try {
    const { isAdmin } = await checkAdminAccess(); // See #13: Joanie's voice is admin-written
    if (!isAdmin) {
      return { success: false, error: 'Admin access required' };
    }

    if (!commentText || commentText.trim().length === 0) {
      return {
        success: false,
        error: 'Comment text is required',
      };
    }

    const [comment] = await db
      .update(joanieComments)
      .set({
        comment_text: commentText,
        updated_at: new Date(),
      })
      .where(eq(joanieComments.id, id))
      .returning();

    if (!comment) {
      return {
        success: false,
        error: 'Comment not found',
      };
    }

    // Revalidate relevant paths
    if (comment.recipe_id) {
      revalidatePath(`/recipes/${comment.recipe_id}`);
    } else if (comment.meal_id) {
      revalidatePath(`/meals/${comment.meal_id}`);
    }

    return {
      success: true,
      data: comment,
    };
  } catch (error) {
    console.error('Failed to update Joanie comment:', error);
    return {
      success: false,
      error: 'Failed to update comment',
    };
  }
}

/**
 * Delete a Joanie comment
 * Admin only (#13).
 */
export async function deleteComment(id: string) {
  try {
    const { isAdmin } = await checkAdminAccess(); // See #13: Joanie's voice is admin-written
    if (!isAdmin) {
      return { success: false, error: 'Admin access required' };
    }

    const [comment] = await db.delete(joanieComments).where(eq(joanieComments.id, id)).returning();

    if (!comment) {
      return {
        success: false,
        error: 'Comment not found',
      };
    }

    // Revalidate relevant paths
    if (comment.recipe_id) {
      revalidatePath(`/recipes/${comment.recipe_id}`);
    } else if (comment.meal_id) {
      revalidatePath(`/meals/${comment.meal_id}`);
    }

    return {
      success: true,
      data: comment,
    };
  } catch (error) {
    console.error('Failed to delete Joanie comment:', error);
    return {
      success: false,
      error: 'Failed to delete comment',
    };
  }
}

/**
 * Get comment by ID
 */
export async function getCommentById(id: string) {
  try {
    const [comment] = await db
      .select()
      .from(joanieComments)
      .where(eq(joanieComments.id, id))
      .limit(1);

    return {
      success: true,
      data: comment || null,
    };
  } catch (error) {
    console.error('Failed to fetch Joanie comment:', error);
    return {
      success: false,
      error: 'Failed to fetch comment',
    };
  }
}
