import { eq, or, type SQL } from 'drizzle-orm';
import { checkAdminAccess } from '@/lib/admin';
import { recipes } from '@/lib/db/schema';

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
  recipe: { is_public: boolean | null; user_id: string },
  viewer: RecipeViewer
): boolean {
  if (recipe.is_public === true || viewer.isAdmin) return true;
  return viewer.userId !== null && recipe.user_id === viewer.userId;
}

/**
 * SQL form of `canViewRecipe` for queries on `recipes`. Returns undefined for
 * an admin (no restriction); drizzle's `and()` ignores an undefined operand.
 */
export function recipeVisibilityCondition(viewer: RecipeViewer): SQL | undefined {
  if (viewer.isAdmin) return undefined;
  if (viewer.userId) return or(eq(recipes.is_public, true), eq(recipes.user_id, viewer.userId));
  return eq(recipes.is_public, true);
}

/** Cache-key segment that separates viewers whose visible recipe sets differ. */
export function recipeViewerScope(viewer: RecipeViewer): string {
  if (viewer.isAdmin) return 'admin';
  return viewer.userId ? `user:${viewer.userId}` : 'anonymous';
}
