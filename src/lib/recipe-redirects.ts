import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * #135: old-URL lookup for recipes merged away by the duplicate-recipe merge.
 *
 * Why: the merge soft-deletes each duplicate and keeps one survivor. Links to a
 * duplicate's id or slug must reach the survivor instead of a 404.
 * What: reads `recipe_redirects` (table and migration owned by the merge apply
 * script) with raw SQL, so this module needs no drizzle table definition.
 * Test: `src/app/recipes/[slug]/__tests__/recipe-redirects.test.ts`
 */

/** The survivor a merged-away recipe URL points to. */
export interface RecipeRedirectTarget {
  id: string;
  slug: string | null;
}

/** HTTP status for a merged-recipe redirect. */
export type RecipeRedirectStatus = 307 | 308;

/**
 * Why: #135 — a 308 is cached permanently by browsers and crawlers, so a bad merge
 * could not be rolled back. Redirects stay temporary until the post-apply check passes.
 * What: 308 when `RECIPE_REDIRECT_STATUS` is exactly `308` (whitespace trimmed);
 * 307 when it is unset, `307`, or any other value. Read on every call.
 * Test: `src/app/recipes/[slug]/__tests__/recipe-redirects.test.ts`
 */
export function recipeRedirectStatus(): RecipeRedirectStatus {
  return process.env.RECIPE_REDIRECT_STATUS?.trim() === '308' ? 308 : 307;
}

/** Path segment for a recipe URL: the slug, or the id when there is no slug. */
export function recipeRedirectSegment(target: RecipeRedirectTarget): string {
  return target.slug || target.id;
}

/** SQLSTATE 42P01 (undefined_table) on the error or on drizzle's wrapped `cause`. */
function isUndefinedTable(error: unknown): boolean {
  const code = (e: unknown) =>
    typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
  const cause =
    typeof error === 'object' && error !== null ? (error as { cause?: unknown }).cause : undefined;
  return code(error) === '42P01' || code(cause) === '42P01';
}

/**
 * Why: #135 — call this only on the miss path (no live, visible recipe), so the
 * normal hit path pays no extra query.
 * What: one query. Matches `from_recipe_id` (primary key) or `from_slug` (unique
 * index), preferring an id match. Returns the survivor only when:
 * - no live recipe has this id or slug, so a live recipe (visible or hidden) is
 *   never redirected;
 * - the survivor is live and public, so there is no redirect chain and no
 *   redirect to a page that would 404 or reveal a private slug.
 *
 * Otherwise `null`, and the caller keeps its existing not-found behaviour. A
 * missing `recipe_redirects` table (migration not yet applied) also gives `null`,
 * with a warning; any other database error throws.
 * Test: `src/app/recipes/[slug]/__tests__/recipe-redirects.test.ts`
 */
export async function findRecipeRedirect(slugOrId: string): Promise<RecipeRedirectTarget | null> {
  try {
    const result = await db.execute(sql`
      SELECT t.id, t.slug
      FROM recipe_redirects r
      JOIN recipes t ON t.id = r.to_recipe_id
      WHERE (r.from_recipe_id = ${slugOrId} OR r.from_slug = ${slugOrId})
        AND t.deleted_at IS NULL
        AND t.is_public = true
        AND t.moderation_status IS DISTINCT FROM 'rejected'
        AND NOT EXISTS (
          SELECT 1 FROM recipes f
          WHERE (f.id = ${slugOrId} OR f.slug = ${slugOrId}) AND f.deleted_at IS NULL
        )
      ORDER BY (r.from_recipe_id = ${slugOrId}) DESC
      LIMIT 1
    `);
    const row = (result.rows as Array<{ id: string; slug: string | null }>)[0];
    return row ? { id: row.id, slug: row.slug ?? null } : null;
  } catch (error) {
    if (isUndefinedTable(error)) {
      console.warn('[#135] recipe_redirects table is missing; old recipe URLs will 404.');
      return null;
    }
    throw error;
  }
}

/**
 * Why: #135 — API clients holding an old duplicate's id should land on the survivor
 * the same way browsers do; a 307/308 keeps the method and is followed automatically.
 * What: on a redirect hit, a `recipeRedirectStatus()` redirect (307 by default) to `/api/v1/recipes/<survivor id><suffix>` with the
 * request's query string kept; `null` otherwise. Call only after the lookup missed.
 * The survivor id, not its slug, because the id never changes.
 * Test: `src/app/recipes/[slug]/__tests__/recipe-redirects.test.ts`
 */
export async function apiRecipeRedirect(
  requestUrl: string,
  slugOrId: string,
  suffix = ''
): Promise<NextResponse | null> {
  const target = await findRecipeRedirect(slugOrId);
  if (!target) return null;
  const url = new URL(requestUrl);
  url.pathname = `/api/v1/recipes/${encodeURIComponent(target.id)}${suffix}`;
  // #135: 307 until RECIPE_REDIRECT_STATUS=308 is set after the post-apply check.
  return NextResponse.redirect(url, recipeRedirectStatus());
}
