/**
 * #104 (D7c S5): which Vercel Blob files a purge may delete.
 *
 * Why: a forked recipe copies the original's image URL, and kept recipes keep
 * theirs, so deleting every blob the user ever uploaded breaks other rows.
 * What: `collectPurgeBlobUrls` gathers Vercel Blob URLs from the user's
 * deleted recipes, meals, collections and profile, then drops any URL that a
 * surviving row (another user's row, or a kept recipe) still references.
 * Test: `src/lib/account-purge/__tests__/account-purge.test.ts`
 */

import { and, eq, ne, not, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { meals } from '@/lib/db/meals-schema';
import { recipes } from '@/lib/db/schema';
import { collections, userProfiles } from '@/lib/db/user-discovery-schema';
import { keptRecipe, type PurgeTarget, survivingRecipe } from './statements';

/** True for URLs served by Vercel Blob; other URLs (external images) are never deleted. */
export function isVercelBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

/** URLs in `recipes.images` (a JSON array). Unparseable values yield none. */
function parseImages(images: string | null): string[] {
  if (!images) return [];
  try {
    const parsed: unknown = JSON.parse(images);
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === 'string') : [];
  } catch {
    return [];
  }
}

/** True when a row that survives the purge still references `url`. */
async function referencedElsewhere(t: PurgeTarget, url: string): Promise<boolean> {
  const inRecipe = or(eq(recipes.image_url, url), sql`position(${url} in ${recipes.images}) > 0`);
  const [recipeHit, mealHit, collectionHit, profileHit] = await Promise.all([
    db
      .select({ id: recipes.id })
      .from(recipes)
      .where(and(survivingRecipe(t), inRecipe))
      .limit(1),
    db
      .select({ id: meals.id })
      .from(meals)
      .where(and(ne(meals.user_id, t.userId), eq(meals.image_url, url)))
      .limit(1),
    db
      .select({ id: collections.id })
      .from(collections)
      .where(and(ne(collections.user_id, t.userId), eq(collections.cover_image_url, url)))
      .limit(1),
    db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(and(ne(userProfiles.user_id, t.userId), eq(userProfiles.profile_image_url, url)))
      .limit(1),
  ]);
  return [recipeHit, mealHit, collectionHit, profileHit].some((rows) => rows.length > 0);
}

/** Blob URLs safe to delete for this purge. Rejects if any query fails. */
export async function collectPurgeBlobUrls(t: PurgeTarget): Promise<string[]> {
  const uid = t.userId;
  const [ownRecipes, ownMeals, ownCollections, ownProfiles] = await Promise.all([
    db
      .select({ image_url: recipes.image_url, images: recipes.images })
      .from(recipes)
      .where(and(eq(recipes.user_id, uid), not(keptRecipe(t)))),
    db.select({ url: meals.image_url }).from(meals).where(eq(meals.user_id, uid)),
    db
      .select({ url: collections.cover_image_url })
      .from(collections)
      .where(eq(collections.user_id, uid)),
    db
      .select({ url: userProfiles.profile_image_url })
      .from(userProfiles)
      .where(eq(userProfiles.user_id, uid)),
  ]);

  const candidates = new Set<string>();
  const add = (url: string | null) => {
    if (url && isVercelBlobUrl(url)) candidates.add(url);
  };
  for (const r of ownRecipes) {
    add(r.image_url);
    for (const u of parseImages(r.images)) add(u);
  }
  for (const row of [...ownMeals, ...ownCollections, ...ownProfiles]) add(row.url);

  const urls = [...candidates];
  const shared = await Promise.all(urls.map((url) => referencedElsewhere(t, url)));
  return urls.filter((_, i) => !shared[i]);
}
