import { and, eq, isNull, sql } from 'drizzle-orm';
import { recipes } from '@/lib/db/schema';

/**
 * #102: the SQL meaning of "a public recipe".
 *
 * Why: the flag queue's hide action sets `moderation_status = 'rejected'`
 * and must not touch `is_public`, so undo restores exactly the prior
 * visibility. Every public surface therefore has to treat a rejected recipe
 * as not public.
 * #103: a soft-deleted recipe (`deleted_at` set — account deletion or admin
 * removal) is not public either.
 * What: `is_public = true AND moderation_status <> 'rejected' AND deleted_at IS NULL`. The column is
 * NOT NULL in production; `is distinct from` also keeps a NULL visible. Use it wherever a query meant
 * `eq(recipes.is_public, true)`.
 * Test: `src/app/actions/__tests__/report-moderation.test.ts`,
 * `src/app/actions/__tests__/deleted-recipe-surfaces.test.ts`
 */
const notRejected = sql`${recipes.moderation_status} is distinct from 'rejected'`;

const notDeleted = isNull(recipes.deleted_at); // #103

export const systemRecipe = and(eq(recipes.is_system_recipe, true), notRejected, notDeleted)!;

export const publicRecipe = and(eq(recipes.is_public, true), notRejected, notDeleted)!;

/** Plain-object form of `publicRecipe` for in-memory checks. */
export function isPublicRecipe(recipe: {
  is_public: boolean | null;
  moderation_status?: string | null;
  deleted_at?: Date | null;
}): boolean {
  return (
    recipe.is_public === true &&
    recipe.moderation_status !== 'rejected' &&
    // #103: soft-deleted is not public.
    (recipe.deleted_at === undefined || recipe.deleted_at === null)
  );
}
