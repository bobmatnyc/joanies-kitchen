/**
 * #96 D57: calibrated cosine-similarity cutoffs for recipe embeddings.
 *
 * Why: under `BAAI/bge-small-en-v1.5` nearly every pair scores >= 0.5, so the
 * old 0.3 / 0.4 / 0.5 cutoffs filtered nothing and nonsense queries returned
 * results.
 * What: the values below were measured read-only on production on 2026-10-29
 * (5033 recipe embeddings, 25 real and 15 nonsense queries):
 * - query to recipe: nonsense rank-1 scored 0.471-0.626, real rank-1
 *   0.699-0.882; a 0.65 floor has 0 false accepts and 0 false rejects at
 *   rank 1. Nonsense scores are flat, so only the floor rejects them; the
 *   relative delta trims weak tails on real queries.
 * - recipe to recipe: random pairs median 0.68, p95 0.763; top-6 neighbours
 *   p5 0.779. At 0.72, 3 recipes have no neighbour and 12 have fewer than 6.
 *
 * Re-measure these after any embedding-model change or a large import.
 * Test: `src/lib/search/__tests__/similarity-cutoffs.test.ts`
 *
 * This module has no server imports, so client components can read it.
 */

/** Absolute floor for a search query against recipe embeddings. */
export const SEARCH_MIN_SIMILARITY = 0.65;

/** A search result must score within this distance of the top result. */
export const SEARCH_RELATIVE_DELTA = 0.1;

/** Floor for recipe-to-recipe neighbours ("Recipes Like This"). */
export const RECIPE_SIMILAR_MIN_SIMILARITY = 0.72;

/**
 * Keeps the items with `similarity >= max(floor, top1 - delta)`.
 *
 * Why: the SQL floor cannot see the best score, so the relative step runs on
 * the scores the query returned.
 * What: `top1` is the highest similarity among `items`; input order is kept.
 * An empty input returns an empty array.
 * Test: `keeps only scores at or above max(0.65, top1 - 0.10)`
 */
export function applySearchCutoff<T extends { similarity: number }>(
  items: readonly T[],
  floor: number = SEARCH_MIN_SIMILARITY,
  delta: number = SEARCH_RELATIVE_DELTA
): T[] {
  if (items.length === 0) return [];
  const top1 = Math.max(...items.map((item) => item.similarity));
  const cutoff = Math.max(floor, top1 - delta);
  return items.filter((item) => item.similarity >= cutoff);
}
