import { and, eq, ne } from 'drizzle-orm';
import { recipes } from '@/lib/db/schema';

/**
 * #102: the SQL meaning of "a public recipe".
 *
 * Why: the flag queue's hide action sets `moderation_status = 'rejected'`
 * and must not touch `is_public`, so undo restores exactly the prior
 * visibility. Every public surface therefore has to treat a rejected recipe
 * as not public.
 * What: `is_public = true AND moderation_status <> 'rejected'`. The column is
 * NOT NULL, so `<>` needs no null guard. Use it wherever a query meant
 * `eq(recipes.is_public, true)`.
 * Test: `src/app/actions/__tests__/report-moderation.test.ts`
 */
export const systemRecipe = and(
  eq(recipes.is_system_recipe, true),
  ne(recipes.moderation_status, 'rejected')
)!;

export const publicRecipe = and(
  eq(recipes.is_public, true),
  ne(recipes.moderation_status, 'rejected')
)!;

/** Plain-object form of `publicRecipe` for in-memory checks. */
export function isPublicRecipe(recipe: {
  is_public: boolean | null;
  moderation_status?: string | null;
}): boolean {
  return recipe.is_public === true && recipe.moderation_status !== 'rejected';
}
