/**
 * #142 (owner ruling D09): handling for the partial unique index on
 * `recipes.canonical_source_url` (migration 0008).
 *
 * Why: the #135 pre-check (`findDuplicateRecipe`) sees only recipes the
 * inserting user may see, and it runs in a separate statement. A private
 * recipe of another user, or a concurrent insert, can still hold the URL, and
 * the insert then fails with 23505. A crawl or cron run must not count that as
 * a failure or abort its batch.
 * What: `withCanonicalConflict` runs a write. When the write fails on this
 * index, it loads the live recipe that holds the URL and answers it as a
 * `source-url` duplicate, the same shape the #135 pre-check answers. Any other
 * error is rethrown unchanged. Callers then skip (and link, where they already
 * link a #135 duplicate) exactly as they do for a pre-check match.
 * Test: `src/lib/recipes/__tests__/canonical-url-conflict.test.ts`
 */

import { and, eq, isNull, sql } from 'drizzle-orm';
import { recipes } from '@/lib/db/schema';
import {
  canonicalizeSourceUrl,
  type DedupDb,
  type DuplicateMatch,
  duplicateSkipReason,
} from '@/lib/recipes/dedup';

/** The index migration 0008 creates; Postgres reports it as the violated constraint. */
export const CANONICAL_SOURCE_URL_UNIQUE_INDEX = 'recipes_canonical_source_url_live_unique';

/**
 * True when `error`, or an error on its `cause` chain (Drizzle wraps the
 * driver error), is a unique violation on `CANONICAL_SOURCE_URL_UNIQUE_INDEX`.
 */
export function isCanonicalSourceUrlConflict(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const { code, constraint } = current as { code?: unknown; constraint?: unknown };
    if (code === '23505' && constraint === CANONICAL_SOURCE_URL_UNIQUE_INDEX) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** Thrown by a service-layer write whose URL a live recipe already holds; carries the match. */
export class CanonicalUrlConflictError extends Error {
  constructor(readonly match: DuplicateMatch) {
    super(duplicateSkipReason(match));
    this.name = 'CanonicalUrlConflictError';
  }
}

export type CanonicalWriteResult<T> =
  | { ok: true; value: T }
  | { ok: false; duplicate: DuplicateMatch };

async function liveHolder(url: string, database?: DedupDb): Promise<DuplicateMatch | null> {
  // '@/lib/db' throws at import when DATABASE_URL is unset, so resolve it lazily.
  const dbx = database ?? ((await import('@/lib/db')).db as unknown as DedupDb);
  const [row] = await dbx
    .select({
      id: recipes.id,
      name: recipes.name,
      source: recipes.source,
      user_id: recipes.user_id,
      is_public: recipes.is_public,
      moderation_status: recipes.moderation_status,
    })
    .from(recipes)
    .where(and(eq(recipes.canonical_source_url, url), isNull(recipes.deleted_at)))
    .limit(1);
  return row ? { ...row, reason: 'source-url' } : null;
}

/**
 * Why: every recipe write that sets `canonical_source_url` must treat the
 * D09 unique violation as a duplicate, never as a crash or a stored recipe.
 * What: runs `write`. On success answers `{ ok: true, value }`. On a 23505 on
 * `CANONICAL_SOURCE_URL_UNIQUE_INDEX`, logs the skip and answers
 * `{ ok: false, duplicate }` naming the live holder of
 * `canonicalizeSourceUrl(sourceUrl)`. Rethrows the original error when it is
 * any other error, or when the holder cannot be loaded (deleted in between,
 * or the lookup failed), so that case is reported as a failure.
 * Test: `src/lib/recipes/__tests__/canonical-url-conflict.test.ts`
 */
export async function withCanonicalConflict<T>(
  sourceUrl: string | null | undefined,
  write: () => Promise<T>,
  database?: DedupDb
): Promise<CanonicalWriteResult<T>> {
  try {
    return { ok: true, value: await write() };
  } catch (error) {
    const url = canonicalizeSourceUrl(sourceUrl);
    if (!url || !isCanonicalSourceUrlConflict(error)) throw error;
    const duplicate = await liveHolder(url, database).catch((lookupErr: unknown) => {
      console.error(`[dedup] #142: holder lookup failed for ${url}:`, lookupErr);
      return null;
    });
    if (!duplicate) throw error;
    console.warn(`[dedup] #142: ${url} is already live as ${duplicate.id}; write skipped`);
    return { ok: false, duplicate };
  }
}

/**
 * Why: restoring a soft-deleted recipe puts it back under the D09 index. If
 * another live recipe took its URL meanwhile, the restore would fail with
 * 23505, and an account-deletion cancel or purge batch would fail with it.
 * What: the `canonical_source_url` value for an `UPDATE recipes SET
 * deleted_at = NULL`: NULL when another live recipe holds the URL, else
 * unchanged. `source` is kept, so the restored recipe keeps its credit.
 * Test: `src/lib/recipes/__tests__/canonical-url-conflict.test.ts`
 */
export const canonicalUrlOnRestore = sql`CASE WHEN EXISTS (
  SELECT 1 FROM "recipes" AS held
  WHERE held."canonical_source_url" = "recipes"."canonical_source_url"
    AND held."deleted_at" IS NULL AND held."id" <> "recipes"."id"
) THEN NULL ELSE "recipes"."canonical_source_url" END`;
