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
 * #142: a roundup page holds several recipes under one
 * URL, so a holder with a different name is not a duplicate. The write is then
 * repeated with a NULL `canonical_source_url` and stored.
 * Test: `src/lib/recipes/__tests__/canonical-url-conflict.test.ts`,
 * `src/lib/services/__tests__/autonomous-ingestion-dedup.test.ts`
 */

import { and, eq, isNull, type SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { recipes } from '@/lib/db/schema';
import {
  canonicalizeSourceUrl,
  type DedupDb,
  type DuplicateMatch,
  duplicateSkipReason,
  isSameRecipeName,
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

/**
 * The write's own URL and recipe name. `name` is the name the row has after
 * the write; it decides whether a holder of the URL is the same recipe.
 */
export interface CanonicalWriteCandidate {
  sourceUrl: string | null | undefined;
  name: string | null | undefined;
}

/**
 * Spread last into the written values. `{}` on the first attempt; on a
 * different-name clash, `{ canonical_source_url: null }`.
 */
export type CanonicalKeyOverride = { canonical_source_url?: null };

export type CanonicalWriteResult<T> =
  /** `storedWithoutKey`: the live holder of the URL; the row was written with a NULL key. */
  | { ok: true; value: T; storedWithoutKey?: DuplicateMatch }
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
 * unique-index violation as a duplicate, never as a crash. A roundup page holds
 * several recipes under one URL, and only one of them can hold the key (#142).
 * What: runs `write({})`. On success answers `{ ok: true, value }`. On a 23505
 * on `CANONICAL_SOURCE_URL_UNIQUE_INDEX`, loads the live holder of
 * `canonicalizeSourceUrl(candidate.sourceUrl)`:
 * - same name (`isSameRecipeName`): logs the skip and answers `{ ok: false, duplicate }`;
 * - different name: logs it, runs `write({ canonical_source_url: null })` and
 *   answers `{ ok: true, value, storedWithoutKey: holder }`. `source` is kept.
 *
 * Rethrows the original error when it is any other error, or when the holder
 * cannot be loaded (deleted in between, or the lookup failed), so nothing is
 * stored with a NULL key unseen. An error from the second write is rethrown.
 * Test: `src/lib/recipes/__tests__/canonical-url-conflict.test.ts`,
 * `src/lib/services/__tests__/autonomous-ingestion-dedup.test.ts`
 */
export async function withCanonicalConflict<T>(
  candidate: CanonicalWriteCandidate,
  write: (key: CanonicalKeyOverride) => Promise<T>,
  database?: DedupDb
): Promise<CanonicalWriteResult<T>> {
  try {
    return { ok: true, value: await write({}) };
  } catch (error) {
    const url = canonicalizeSourceUrl(candidate.sourceUrl);
    if (!url || !isCanonicalSourceUrlConflict(error)) throw error;
    const holder = await liveHolder(url, database).catch((lookupErr: unknown) => {
      console.error(`[dedup] #142: holder lookup failed for ${url}:`, lookupErr);
      return null;
    });
    if (!holder) throw error;
    if (isSameRecipeName(candidate.name, holder.name)) {
      console.warn(`[dedup] #142: ${url} is already live as ${holder.id}; write skipped`);
      return { ok: false, duplicate: holder };
    }
    console.warn(
      `[dedup] #142: ${url} is live as ${holder.id} under another name; storing with a NULL canonical_source_url`
    );
    // An error from this write propagates as is; it is never caught as a conflict.
    const value = await write({ canonical_source_url: null });
    return { ok: true, value, storedWithoutKey: holder };
  }
}

/** The recipes table, or an alias of it; `restoreSet` builds its condition on either. */
export type RecipesRef = typeof recipes;

/**
 * Why: restoring soft-deleted recipes puts them back under the D09 index. If
 * another live recipe took a URL meanwhile, or two restored rows share one,
 * the restore fails with 23505, and an account-deletion cancel or purge batch
 * fails with it. A subquery alone sees the pre-UPDATE snapshot, where none of
 * the restored rows is live yet, so it cannot settle rows restored together.
 * What: the `canonical_source_url` value for an `UPDATE recipes SET
 * deleted_at = NULL WHERE restoreSet(recipes)`. A row already live keeps its
 * URL. A restored row keeps it only when no live row holds it and no restored
 * row with a smaller id shares it (`restoreSet(peer)` names the same set);
 * otherwise NULL. So exactly one row per URL keeps it. `source` is kept.
 * Test: `src/lib/recipes/__tests__/canonical-url-conflict.test.ts`,
 * `src/lib/account-purge/__tests__/account-purge.test.ts`
 */
export function canonicalUrlOnRestore(restoreSet: (t: RecipesRef) => SQL): SQL {
  // An aliased table renders only its alias name, so the FROM below names it in full.
  const peer = alias(recipes, 'restore_peer');
  return sql`CASE WHEN "recipes"."deleted_at" IS NULL THEN "recipes"."canonical_source_url"
  WHEN EXISTS (
    SELECT 1 FROM "recipes" AS held
    WHERE held."canonical_source_url" = "recipes"."canonical_source_url"
      AND held."deleted_at" IS NULL AND held."id" <> "recipes"."id"
  ) OR EXISTS (
    SELECT 1 FROM "recipes" AS "restore_peer"
    WHERE ${peer.canonical_source_url} = "recipes"."canonical_source_url"
      AND ${peer.deleted_at} IS NOT NULL AND ${peer.id} < "recipes"."id"
      AND ${restoreSet(peer as unknown as RecipesRef)}
  ) THEN NULL ELSE "recipes"."canonical_source_url" END`;
}
