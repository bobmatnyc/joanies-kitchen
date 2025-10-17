'use server';

import { auth } from '@clerk/nextjs/server';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { type Recipe, recipes } from '@/lib/db/schema';
import { recipeViews } from '@/lib/db/user-discovery-schema';

/**
 * Recipe Views Server Actions
 *
 * Track recipe views for analytics and "recently viewed" feature.
 * Supports both authenticated and anonymous views.
 */

// ============================================================================
// TRACK VIEWS
// ============================================================================

/**
 * Track when a user views a recipe
 * Works for both authenticated and anonymous users
 */
export async function trackRecipeView(recipeId: string): Promise<void> {
  try {
    const { userId } = await auth();

    // Verify recipe exists
    const [recipe] = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(eq(recipes.id, recipeId))
      .limit(1);

    if (!recipe) {
      console.error('Recipe not found for view tracking:', recipeId);
      return;
    }

    // If user is authenticated, ensure they have a profile
    // This prevents foreign key constraint violations
    if (userId) {
      const { ensureUserProfile } = await import('./user-profiles');
      await ensureUserProfile();
    }

    // Record view (userId can be null for anonymous views)
    await db.insert(recipeViews).values({
      recipe_id: recipeId,
      user_id: userId || null,
    });

    // Note: We don't revalidate paths here to avoid performance impact
    // View tracking should be silent and not affect page rendering
  } catch (error) {
    // Silent fail - view tracking shouldn't break the page
    console.error('Error tracking recipe view:', error);
  }
}

// ============================================================================
// GET RECENTLY VIEWED
// ============================================================================

/**
 * Get user's recently viewed recipes
 * Only works for authenticated users
 */
export async function getRecentlyViewedRecipes(limit: number = 10): Promise<Recipe[]> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return [];
    }

    // Get unique recently viewed recipes (most recent first)
    // Use DISTINCT ON to get the most recent view of each recipe
    const recentViews = await db
      .select({
        recipe: recipes,
        viewed_at: recipeViews.viewed_at,
      })
      .from(recipeViews)
      .innerJoin(recipes, eq(recipeViews.recipe_id, recipes.id))
      .where(eq(recipeViews.user_id, userId))
      .orderBy(desc(recipeViews.viewed_at))
      .limit(limit * 2); // Get extra to handle duplicates

    // Remove duplicates (keep most recent view of each recipe)
    const uniqueRecipes = new Map<string, Recipe>();
    for (const view of recentViews) {
      if (!uniqueRecipes.has(view.recipe.id)) {
        uniqueRecipes.set(view.recipe.id, view.recipe);
      }
      if (uniqueRecipes.size >= limit) {
        break;
      }
    }

    return Array.from(uniqueRecipes.values());
  } catch (error) {
    console.error('Error fetching recently viewed recipes:', error);
    return [];
  }
}

// ============================================================================
// GET POPULAR RECIPES
// ============================================================================

/**
 * Get popular recipes based on view count
 * Supports filtering by timeframe
 */
export async function getPopularRecipes(
  timeframe: 'day' | 'week' | 'month' | 'all' = 'week',
  limit: number = 10
): Promise<Recipe[]> {
  try {
    // Calculate timeframe cutoff
    let cutoffDate: Date | null = null;
    const now = new Date();

    switch (timeframe) {
      case 'day':
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        cutoffDate = null;
        break;
    }

    // Build query with timeframe filter
    const viewsQuery = db
      .select({
        recipe_id: recipeViews.recipe_id,
        view_count: sql<number>`count(*)::int`.as('view_count'),
      })
      .from(recipeViews)
      .groupBy(recipeViews.recipe_id)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    // Add timeframe filter if applicable
    const viewsWithTimeframe = cutoffDate
      ? viewsQuery.where(gte(recipeViews.viewed_at, cutoffDate))
      : viewsQuery;

    const popularRecipeIds = await viewsWithTimeframe;

    if (popularRecipeIds.length === 0) {
      return [];
    }

    // Fetch full recipe data
    const recipeIdList = popularRecipeIds.map((r) => r.recipe_id);
    const popularRecipes = await db
      .select()
      .from(recipes)
      .where(
        and(
          sql`${recipes.id} = ANY(${recipeIdList})`,
          eq(recipes.is_public, true) // Only show public recipes
        )
      );

    // Sort recipes by view count (maintain order from popularity query)
    const recipeMap = new Map(popularRecipes.map((r) => [r.id, r]));
    return popularRecipeIds
      .map((pId) => recipeMap.get(pId.recipe_id))
      .filter((r): r is Recipe => r !== undefined);
  } catch (error) {
    console.error('Error fetching popular recipes:', error);
    return [];
  }
}

// ============================================================================
// GET VIEW STATISTICS
// ============================================================================

/**
 * Get view count for a specific recipe
 * Includes both authenticated and anonymous views
 */
export async function getRecipeViewCount(recipeId: string): Promise<number> {
  try {
    const [result] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(recipeViews)
      .where(eq(recipeViews.recipe_id, recipeId));

    return result?.count || 0;
  } catch (error) {
    console.error('Error getting recipe view count:', error);
    return 0;
  }
}

/**
 * Get view statistics for a recipe
 * Includes total views, unique viewers, and recent view count
 */
export async function getRecipeViewStats(recipeId: string): Promise<{
  totalViews: number;
  uniqueViewers: number;
  recentViews: number; // Last 7 days
}> {
  try {
    // Get total views
    const [totalResult] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(recipeViews)
      .where(eq(recipeViews.recipe_id, recipeId));

    // Get unique viewers (authenticated only)
    const [uniqueResult] = await db
      .select({
        count: sql<number>`count(DISTINCT ${recipeViews.user_id})::int`,
      })
      .from(recipeViews)
      .where(and(eq(recipeViews.recipe_id, recipeId), sql`${recipeViews.user_id} IS NOT NULL`));

    // Get recent views (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recentResult] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(recipeViews)
      .where(and(eq(recipeViews.recipe_id, recipeId), gte(recipeViews.viewed_at, sevenDaysAgo)));

    return {
      totalViews: totalResult?.count || 0,
      uniqueViewers: uniqueResult?.count || 0,
      recentViews: recentResult?.count || 0,
    };
  } catch (error) {
    console.error('Error getting recipe view stats:', error);
    return {
      totalViews: 0,
      uniqueViewers: 0,
      recentViews: 0,
    };
  }
}

/**
 * Get user's view history with pagination
 */
export async function getUserViewHistory(
  limit: number = 20,
  offset: number = 0
): Promise<{ recipes: Recipe[]; total: number }> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { recipes: [], total: 0 };
    }

    // Get total count
    const [countResult] = await db
      .select({
        count: sql<number>`count(DISTINCT ${recipeViews.recipe_id})::int`,
      })
      .from(recipeViews)
      .where(eq(recipeViews.user_id, userId));

    const total = countResult?.count || 0;

    // Get paginated view history
    const viewHistory = await db
      .select({
        recipe: recipes,
        last_viewed: sql<Date>`MAX(${recipeViews.viewed_at})`.as('last_viewed'),
      })
      .from(recipeViews)
      .innerJoin(recipes, eq(recipeViews.recipe_id, recipes.id))
      .where(eq(recipeViews.user_id, userId))
      .groupBy(recipes.id)
      .orderBy(desc(sql`MAX(${recipeViews.viewed_at})`))
      .limit(limit)
      .offset(offset);

    return {
      recipes: viewHistory.map((v) => v.recipe),
      total,
    };
  } catch (error) {
    console.error('Error fetching user view history:', error);
    return { recipes: [], total: 0 };
  }
}
