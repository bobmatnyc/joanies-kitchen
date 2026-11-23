/**
 * Known-URL skip for the autonomous crawl (#142, owner ruling D7c).
 *
 * Why: the scheduled cron re-discovers URLs it already stored; fetching them
 * again pays for an extraction that ends as a duplicate skip. A manual or admin
 * run is a deliberate request, so it re-fetches.
 * What: `skipsKnownUrls` says which run types skip; `findKnownUrls` answers the
 * discovered URLs a live recipe already holds by `canonical_source_url` (the key
 * recipe inserts write, 9fc9245; unique among live rows since migration 0008),
 * or the empty set, without a query, for a run that re-fetches. Also matches the
 * legacy exact `recipes.source` / `chef_recipes.original_url` check.
 * Test: `src/lib/services/__tests__/autonomous-ingestion-dedup.test.ts`
 */

import { and, inArray, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { canonicalizeSourceUrl } from '@/lib/recipes/dedup';
import { checkUrlDuplicates } from './autonomous-ingestion-store';
import type { DiscoveryRunType } from './discovery-run-store';

/** #142 D7c: only the scheduled cron run (`daily`) skips a known URL; `manual` and `local` re-fetch. */
export function skipsKnownUrls(runType: DiscoveryRunType): boolean {
  return runType === 'daily';
}

/**
 * The subset of `urls` already stored, or an empty set when `runType` re-fetches.
 * A failed lookup logs and answers the empty set: the per-URL #135 check before
 * extraction then still refuses a duplicate.
 */
export async function findKnownUrls(
  urls: string[],
  runType: DiscoveryRunType
): Promise<Set<string>> {
  if (!skipsKnownUrls(runType) || urls.length === 0) return new Set();

  const known = await checkUrlDuplicates(urls);
  const canonicalByUrl = new Map<string, string>();
  for (const url of urls) {
    const canonical = canonicalizeSourceUrl(url);
    if (canonical) canonicalByUrl.set(url, canonical);
  }
  if (canonicalByUrl.size === 0) return known;

  try {
    const rows = await findLiveRecipesByCanonicalUrl([...new Set(canonicalByUrl.values())]);
    const held = new Set(rows.map((r) => r.canonical));
    for (const [url, canonical] of canonicalByUrl) if (held.has(canonical)) known.add(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[AutonomousIngestion] #142: canonical URL lookup failed (not skipping): ${msg}`);
  }
  return known;
}

/** A live recipe found by its `canonical_source_url`. */
export interface KnownRecipe {
  id: string;
  name: string;
  slug: string | null;
  canonical: string | null;
  user_id: string;
  is_public: boolean | null;
  moderation_status: string | null;
}

/**
 * #142 D7c: the live (not soft-deleted) recipes holding any of `canonicals` as
 * `canonical_source_url`, the rows `recipes_canonical_source_url_live_unique`
 * covers. Shared by the daily crawl skip and the manual import (`findKnownRecipe`).
 */
export async function findLiveRecipesByCanonicalUrl(canonicals: string[]): Promise<KnownRecipe[]> {
  if (canonicals.length === 0) return [];
  return db
    .select({
      id: recipes.id,
      name: recipes.name,
      slug: recipes.slug,
      canonical: recipes.canonical_source_url,
      user_id: recipes.user_id,
      is_public: recipes.is_public,
      moderation_status: recipes.moderation_status,
    })
    .from(recipes)
    .where(and(isNull(recipes.deleted_at), inArray(recipes.canonical_source_url, canonicals)));
}

/**
 * Why: #142 owner ruling — a manual import of a URL the site already holds
 * returns that recipe instead of paying for a re-fetch and re-extraction.
 * What: canonicalises `url` and looks it up with the daily crawl's query; the
 * live recipe holding it, or null. A failed lookup logs and answers null, so
 * the #135 duplicate check before the scrape still runs.
 * Test: `src/app/api/ingest-recipe/__tests__/route-known-url.test.ts`
 */
export async function findKnownRecipe(url: string): Promise<KnownRecipe | null> {
  const canonical = canonicalizeSourceUrl(url);
  if (!canonical) return null;
  try {
    return (await findLiveRecipesByCanonicalUrl([canonical]))[0] ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Ingest API] #142: canonical URL lookup failed (not skipping): ${msg}`);
    return null;
  }
}
