import { and, eq, isNull, or, type SQL } from 'drizzle-orm';
import { checkAdminAccess } from '@/lib/admin';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { isPublicRecipe, publicRecipe } from '@/lib/recipe-public';

/**
 * Private-recipe read rule — #32.
 *
 * Why: several read paths returned recipes by id or by link table with no
 * visibility check, so a private recipe reached anonymous and other-user
 * callers. One rule, in one place, keeps every read path in agreement.
 * What: a private recipe (`is_public` not true) is visible only to its owner
 * and to an admin. Admin is read from `users.is_admin` by `checkAdminAccess()`
 * (#22), never from the JWT. Callers that deny must answer exactly as they do
 * for a nonexistent recipe.
 * Test: `src/app/actions/__tests__/private-recipe-visibility.test.ts`
 */

export interface RecipeViewer {
  userId: string | null;
  isAdmin: boolean;
}

/** A signed-out viewer: sees public recipes only. */
export const ANONYMOUS_VIEWER: RecipeViewer = { userId: null, isAdmin: false };

/** Resolves the current caller. Signed out or a failed admin lookup yields a non-admin viewer. */
export async function getRecipeViewer(): Promise<RecipeViewer> {
  const { userId, isAdmin } = await checkAdminAccess();
  return { userId, isAdmin: isAdmin && userId !== null };
}

/** True when the viewer may read this recipe row. */
export function canViewRecipe(
  recipe: { is_public: boolean | null; user_id: string; moderation_status?: string | null },
  viewer: RecipeViewer
): boolean {
  // #102: a rejected (hidden) recipe is public to no one; its owner and admins still see it.
  if (isPublicRecipe(recipe) || viewer.isAdmin) return true;
  return viewer.userId !== null && recipe.user_id === viewer.userId;
}

/**
 * SQL form of `canViewRecipe` for queries on `recipes`. Returns undefined for
 * an admin (no restriction); drizzle's `and()` ignores an undefined operand.
 */
export function recipeVisibilityCondition(viewer: RecipeViewer): SQL | undefined {
  if (viewer.isAdmin) return undefined;
  if (viewer.userId) return or(publicRecipe, eq(recipes.user_id, viewer.userId));
  return publicRecipe;
}

/**
 * #41: lookup used by every attach path (collections, favorites, meals, likes,
 * views, flags). Returns the recipe only when it exists, is not soft-deleted
 * and the viewer may read it; otherwise null, so a private recipe and a
 * nonexistent one get the same answer.
 */
export async function findViewableRecipe(recipeId: string, viewer: RecipeViewer) {
  const [recipe] = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), isNull(recipes.deleted_at)))
    .limit(1);
  return recipe && canViewRecipe(recipe, viewer) ? recipe : null;
}

/** Cache-key segment that separates viewers whose visible recipe sets differ. */
export function recipeViewerScope(viewer: RecipeViewer): string {
  if (viewer.isAdmin) return 'admin';
  return viewer.userId ? `user:${viewer.userId}` : 'anonymous';
}
