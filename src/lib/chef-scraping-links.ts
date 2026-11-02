/**
 * Duplicate checks and chef links for the chef-scraping actions.
 *
 * Why: the #142 link handling pushed `src/app/actions/chef-scraping.ts` past
 * the 500-line cap, so its helpers live here. Server-internal and deliberately
 * NOT 'use server': none of these is a client-callable action.
 * Test: `src/app/actions/__tests__/chef-scraping-link.test.ts`,
 * `src/app/actions/__tests__/chef-scraping-dedup.test.ts`
 */

import { linkRecipeToChef } from '@/app/actions/chefs';
import { deleteRecipesWithChefRecount } from '@/lib/chef-recipe-count';
import {
  type DuplicateMatch,
  duplicateRefusal,
  duplicateSkipReason,
  findDuplicateRecipe,
  isDisclosableDuplicate,
} from '@/lib/recipes/dedup';
import { toErrorMessage } from '@/lib/utils/error-handling';

/**
 * #135: the stored recipe this candidate duplicates, logged as skipped; null
 * when it is new. Scraped recipes are system recipes, so the owner is 'system'.
 */
export async function skippedDuplicate(candidate: {
  sourceUrl: string | undefined;
  title?: string;
}) {
  const match = await findDuplicateRecipe(candidate, { ownerId: 'system', titleRule: true });
  if (match) {
    console.log(
      `[ChefScraping] ${duplicateSkipReason(match)} (${match.reason}): ${candidate.sourceUrl}`
    );
  }
  return match;
}

/**
 * Why: a scraped page whose source URL is already stored must still appear on
 * the chef's page (#142).
 * What: links the stored recipe of a `source-url` match to the chef, keeping
 * any other chef's `chef_id` on it, and returns true. A `title-and-host` match
 * is not linked (it is a probable copy, not the same page); returns false.
 * Throws when the link fails, so the caller reports a failure, not a skip.
 * Test: `src/app/actions/__tests__/chef-scraping-link.test.ts`
 */
export async function linkSkippedDuplicate(
  chefId: string,
  match: DuplicateMatch,
  url: string
): Promise<boolean> {
  if (match.reason !== 'source-url') return false;
  const res = await linkRecipeToChef({
    chefId,
    recipeId: match.id,
    originalUrl: url,
    keepExistingRecipeChef: true,
  });
  if (!res.success) {
    throw new Error(`failed to link duplicate ${match.id} to chef ${chefId}: ${res.error}`);
  }
  return true;
}

/**
 * #142: links a recipe this job just inserted. A link failure, returned or
 * thrown (e.g. by `requireAdmin`), deletes the recipe and throws, so no recipe
 * is left stored but missing from the chef's page. If the delete also fails,
 * the thrown message carries both errors.
 */
export async function linkInsertedRecipe(
  chefId: string,
  recipeId: string,
  url: string
): Promise<void> {
  let linkError: string;
  try {
    const res = await linkRecipeToChef({ chefId, recipeId, originalUrl: url });
    if (res.success) return;
    linkError = res.error ?? 'unknown error';
  } catch (error) {
    linkError = toErrorMessage(error); // #142: a thrown failure takes the same cleanup path
  }
  const message = `failed to link recipe to chef ${chefId}: ${linkError}`;
  try {
    // #165: the link may exist (e.g. revalidatePath threw after the recount); the cascade drops it.
    // #174: the delete and the chef recount commit or fail together.
    await deleteRecipesWithChefRecount([recipeId]);
  } catch (deleteError) {
    // #142: report the link error too, not only the delete error.
    throw new Error(
      `${message}; cleanup delete of recipe ${recipeId} also failed: ${toErrorMessage(deleteError)}`
    );
  }
  throw new Error(message);
}

/**
 * #135: `scrapeSingleRecipe`'s answer for a duplicate; nothing was inserted.
 * #142: a source-URL match is linked to the chef first (`linkedToChef: true`);
 * a failed link throws into `scrapeSingleRecipe`'s failure answer instead.
 */
export async function skippedResult(chefId: string, match: DuplicateMatch, url: string) {
  const linked = await linkSkippedDuplicate(chefId, match, url);
  return {
    success: false as const,
    error: duplicateSkipReason(match),
    duplicateOf: match.id,
    ...(linked ? { linkedToChef: true as const } : {}),
  };
}

/** Scraped recipes are system recipes; the owner every duplicate check uses. */
const SYSTEM_USER_ID = 'system';

/**
 * Why: a write-time conflict on the D09 index (#142) usually means another
 * user's PRIVATE recipe holds the URL. Linking it would write `chef_recipes`
 * and `chef_id` onto a row the system user may not see.
 * What: links the holder like `linkSkippedDuplicate` only when it is
 * disclosable to the system user (`isDisclosableDuplicate`); otherwise logs
 * the skip and writes nothing. Returns true when it linked.
 * Test: `src/lib/recipes/__tests__/canonical-url-conflict.test.ts`
 */
export async function linkConflictHolder(
  chefId: string,
  match: DuplicateMatch,
  url: string
): Promise<boolean> {
  if (isDisclosableDuplicate(match, SYSTEM_USER_ID)) {
    return linkSkippedDuplicate(chefId, match, url);
  }
  console.log(`[ChefScraping] #142: ${url} is held by a recipe the system may not see; not linked`);
  return false;
}

/**
 * #142: `scrapeSingleRecipe`'s answer for a write-time conflict. A disclosable
 * holder gets `skippedResult` (linked); any other gets the #135 refusal that
 * names no recipe, and nothing is written to it.
 */
export async function conflictSkippedResult(chefId: string, match: DuplicateMatch, url: string) {
  if (isDisclosableDuplicate(match, SYSTEM_USER_ID)) return skippedResult(chefId, match, url);
  await linkConflictHolder(chefId, match, url); // logs the unlinked skip
  return { success: false as const, ...duplicateRefusal(match, SYSTEM_USER_ID) };
}
