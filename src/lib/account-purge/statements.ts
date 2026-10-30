/**
 * #104 (D7c S5): the per-account purge statements and the column inventory they cover.
 *
 * Why: a purge must reach every row that names the user, and nothing else.
 * What: `purgeStatements` returns the ordered DB writes for one account, to be
 * sent as one `db.batch` (one transaction on neon-http): a guard that aborts
 * the batch unless the account is still due, an id-ordered lock on every
 * recipes row the batch writes (#158), the kept-recipe reassignment,
 * the deletes (with a `like_count` recount for recipes the user favorited, #167,
 * and a `recipe_count` recount for chefs linked to the deleted recipes, #174),
 * the actor-column anonymization, and the `users` delete last.
 * `PURGE_COLUMN_PLAN` names how each user/recipe reference column is handled;
 * the inventory test fails when the schema gains a column missing from it.
 * Test: `src/lib/account-purge/__tests__/account-purge.test.ts`
 */

import {
  type AnyColumn,
  and,
  asc,
  eq,
  inArray,
  isNull,
  lte,
  ne,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import { accountDeletionMarker } from '@/lib/account-deletion';
import { chefRecountBeforeDelete } from '@/lib/chef-recipe-count';
import { db } from '@/lib/db';
import { apiKeys, apiKeyUsage } from '@/lib/db/api-keys-schema';
import { accounts, users, verificationTokens } from '@/lib/db/auth-schema';
import { recipeDiscoveryRunItems, recipeOfTheDay } from '@/lib/db/autonomous-scraper-schema';
import { chefRecipes } from '@/lib/db/chef-schema';
import { recipeIngredients } from '@/lib/db/ingredients-schema';
import { inventoryItems, inventoryUsageLog, wasteTracking } from '@/lib/db/inventory-schema';
import { mealRecipes, meals, mealTemplates, shoppingLists } from '@/lib/db/meals-schema';
import {
  joanieComments,
  recipeComments,
  recipeEmbeddings,
  recipeFlags,
  recipeForks,
  recipeLikes,
  recipeRatings,
  recipes,
  recipeTasks,
  recipeTools,
} from '@/lib/db/schema';
import {
  collectionRecipes,
  collections,
  favorites,
  recipeViews,
  userProfiles,
} from '@/lib/db/user-discovery-schema';

/** `recipes.user_id` of recipes kept under the "keep" choice. No `users` row; no FK needs one. */
export const DELETED_USER_ID = 'deleted-user';

/**
 * How the purge handles every `user_id`, `*_by`, `recipe_id` and
 * `original_recipe_id` column, keyed `table.column`. "own recipes" means the
 * user's recipes that are deleted (all of them except kept ones).
 */
export const PURGE_COLUMN_PLAN: Readonly<Record<string, string>> = {
  'accounts.user_id': 'delete',
  'api_keys.user_id': 'delete (with api_key_usage)',
  'api_keys.created_by': 'anonymize',
  'api_keys.revoked_by': 'anonymize',
  'user_profiles.user_id': 'delete',
  'collections.user_id': 'delete (with collection_recipes)',
  'favorites.user_id': 'delete',
  'recipe_views.user_id': 'delete',
  'recipes.user_id': 'reassign kept public recipes to deleted-user; delete the rest',
  'recipes.deleted_by': 'clear marker on kept recipes; anonymize',
  'recipes.moderated_by': 'anonymize',
  'recipes.image_regeneration_requested_by': 'anonymize',
  'recipe_comments.user_id': 'delete',
  'recipe_ratings.user_id': 'delete',
  'recipe_likes.user_id': 'delete',
  'recipe_forks.user_id': 'delete',
  'recipe_flags.user_id': 'delete',
  'recipe_flags.reviewed_by': 'anonymize',
  'meals.user_id': 'delete (with meal_recipes, joanie_comments)',
  'shopping_lists.user_id': 'delete',
  'meal_templates.created_by': 'delete own; anonymize on system templates',
  'inventory_items.user_id': 'delete (with inventory_usage_log)',
  'waste_tracking.user_id': 'delete',
  'recipe_ingredients.recipe_id': 'delete for own recipes',
  'recipe_tasks.recipe_id': 'delete for own recipes',
  'recipe_tools.recipe_id': 'delete for own recipes',
  'recipe_embeddings.recipe_id': 'delete for own recipes',
  'recipe_comments.recipe_id': 'delete for own recipes',
  'recipe_ratings.recipe_id': 'delete for own recipes',
  'recipe_likes.recipe_id': 'delete for own recipes',
  'recipe_flags.recipe_id': 'delete for own recipes',
  'recipe_forks.recipe_id': 'delete for own recipes',
  'recipe_forks.original_recipe_id': 'delete for own recipes',
  'favorites.recipe_id': 'delete for own recipes',
  'collection_recipes.recipe_id': 'delete for own recipes',
  'recipe_views.recipe_id': 'delete for own recipes',
  'meal_recipes.recipe_id': 'delete for own recipes',
  'chef_recipes.recipe_id': 'delete for own recipes',
  'joanie_comments.recipe_id': 'delete for own recipes',
  'recipe_of_the_day.recipe_id': 'set null for own recipes',
  'inventory_usage_log.recipe_id': 'set null for own recipes',
  'recipe_discovery_run_items.recipe_id': 'set null for own recipes',
};

export interface PurgeTarget {
  userId: string;
  email: string | null;
  keepRecipes: boolean;
  /** The account must have requested deletion at or before this time. */
  cutoff: Date;
}

/** SQL condition: the user's `users` row is still due for purge at `cutoff`. */
export function stillDue(t: PurgeTarget): SQL {
  return and(
    eq(users.id, t.userId),
    lte(users.deletion_requested_at, t.cutoff),
    eq(users.is_admin, false)
  ) as SQL;
}

/** SQL condition: a recipe the purge keeps (reassigns) rather than deletes. */
export function keptRecipe(t: PurgeTarget): SQL {
  if (!t.keepRecipes) return sql`false`;
  // coalesce: a NULL column must read as "not kept", so NOT(kept) still selects the row.
  return sql`coalesce(${and(
    eq(recipes.user_id, t.userId),
    eq(recipes.is_public, true),
    eq(recipes.deleted_by, accountDeletionMarker(t.userId))
  )}, false)`;
}

/**
 * The ordered writes for one account. Precondition: sent as one batch, so a
 * failing statement rolls back all of them and the `users` row stays.
 */
export function purgeStatements(t: PurgeTarget) {
  const uid = t.userId;
  // Evaluated per statement: after the reassignment, the user's remaining recipes.
  const ownRecipeIds = db.select({ id: recipes.id }).from(recipes).where(eq(recipes.user_id, uid));
  const own = (col: AnyColumn) => inArray(col, ownRecipeIds);
  const ownMealIds = db.select({ id: meals.id }).from(meals).where(eq(meals.user_id, uid));
  const ownCollectionIds = db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.user_id, uid));
  const ownItemIds = db
    .select({ id: inventoryItems.id })
    .from(inventoryItems)
    .where(eq(inventoryItems.user_id, uid));
  const ownKeyIds = db.select({ id: apiKeys.id }).from(apiKeys).where(eq(apiKeys.user_id, uid));
  // #167 (D26): recipes the user favorited; their like_count is recounted before the delete.
  const favoritedRecipeIds = db
    .select({ id: favorites.recipe_id })
    .from(favorites)
    .where(eq(favorites.user_id, uid));

  return [
    // Guard: 1/0 aborts the whole batch when the account is no longer due.
    db
      .select({ ok: sql<number>`1 / count(*)::int` })
      .from(users)
      .where(stillDue(t)),
    // #158: lock every recipes row this batch writes, in id order, before any
    // recipe_ratings delete: rateRecipe/deleteRating lock the recipe row first.
    db
      .select({ id: recipes.id })
      .from(recipes)
      .where(
        or(
          eq(recipes.user_id, uid),
          eq(recipes.deleted_by, uid),
          eq(recipes.moderated_by, uid),
          eq(recipes.image_regeneration_requested_by, uid),
          // #167 (D26): the like_count recount below writes these rows too.
          inArray(recipes.id, favoritedRecipeIds)
        )
      )
      .orderBy(asc(recipes.id))
      .for('update'),
    // Kept recipes: credited to deleted-user and shown again.
    db
      .update(recipes)
      .set({ user_id: DELETED_USER_ID, deleted_at: null, deleted_by: null })
      .where(keptRecipe(t)),
    // Rows hanging off the user's own (deleted) recipes, including other users' rows.
    db
      .delete(recipeIngredients)
      .where(own(recipeIngredients.recipe_id)),
    db.delete(recipeTasks).where(own(recipeTasks.recipe_id)),
    db.delete(recipeTools).where(own(recipeTools.recipe_id)),
    db.delete(recipeEmbeddings).where(own(recipeEmbeddings.recipe_id)),
    db.delete(recipeComments).where(own(recipeComments.recipe_id)),
    db.delete(recipeRatings).where(own(recipeRatings.recipe_id)),
    db.delete(recipeLikes).where(own(recipeLikes.recipe_id)),
    db.delete(recipeFlags).where(own(recipeFlags.recipe_id)),
    db
      .delete(recipeForks)
      .where(or(own(recipeForks.recipe_id), own(recipeForks.original_recipe_id))),
    db.delete(favorites).where(own(favorites.recipe_id)),
    db.delete(collectionRecipes).where(own(collectionRecipes.recipe_id)),
    db.delete(recipeViews).where(own(recipeViews.recipe_id)),
    db.delete(mealRecipes).where(own(mealRecipes.recipe_id)),
    // #174: lock (chefs in id order, after the #158 recipes lock) and recount every
    // chef linked to the user's deleted recipes, while those links still exist.
    ...chefRecountBeforeDelete(ownRecipeIds),
    db.delete(chefRecipes).where(own(chefRecipes.recipe_id)),
    db.delete(joanieComments).where(own(joanieComments.recipe_id)),
    db.update(recipeOfTheDay).set({ recipe_id: null }).where(own(recipeOfTheDay.recipe_id)),
    db.update(inventoryUsageLog).set({ recipe_id: null }).where(own(inventoryUsageLog.recipe_id)),
    db
      .update(recipeDiscoveryRunItems)
      .set({ recipe_id: null })
      .where(own(recipeDiscoveryRunItems.recipe_id)),
    // The user's own rows on anyone's recipes (others' comments on kept recipes stay).
    db
      .delete(recipeComments)
      .where(eq(recipeComments.user_id, uid)),
    db.delete(recipeRatings).where(eq(recipeRatings.user_id, uid)),
    db.delete(recipeLikes).where(eq(recipeLikes.user_id, uid)),
    db.delete(recipeForks).where(eq(recipeForks.user_id, uid)),
    db.delete(recipeFlags).where(eq(recipeFlags.user_id, uid)),
    db.delete(recipes).where(eq(recipes.user_id, uid)),
    // Meals, collections, inventory and keys: children before parents.
    db
      .delete(mealRecipes)
      .where(inArray(mealRecipes.meal_id, ownMealIds)),
    db.delete(joanieComments).where(inArray(joanieComments.meal_id, ownMealIds)),
    db.delete(shoppingLists).where(eq(shoppingLists.user_id, uid)),
    db.delete(meals).where(eq(meals.user_id, uid)),
    db
      .delete(mealTemplates)
      .where(
        and(
          eq(mealTemplates.created_by, uid),
          or(eq(mealTemplates.is_system, false), isNull(mealTemplates.is_system))
        )
      ),
    db.delete(collectionRecipes).where(inArray(collectionRecipes.collection_id, ownCollectionIds)),
    db.delete(collections).where(eq(collections.user_id, uid)),
    // #167 (D26): recount like_count for every recipe the user favorited, as it
    // will be once their favorites are deleted (the next statement). Runs first
    // so the id list still exists; counts every favorite except the user's.
    db
      .update(recipes)
      .set({
        like_count: sql`(SELECT count(*)::int FROM "favorites" f WHERE f."recipe_id" = "recipes"."id" AND f."user_id" <> ${uid})`,
      })
      .where(inArray(recipes.id, favoritedRecipeIds)),
    db.delete(favorites).where(eq(favorites.user_id, uid)),
    db.delete(recipeViews).where(eq(recipeViews.user_id, uid)),
    db.delete(inventoryUsageLog).where(inArray(inventoryUsageLog.inventory_item_id, ownItemIds)),
    db.delete(wasteTracking).where(eq(wasteTracking.user_id, uid)),
    db.delete(inventoryItems).where(eq(inventoryItems.user_id, uid)),
    db.delete(apiKeyUsage).where(inArray(apiKeyUsage.api_key_id, ownKeyIds)),
    db.delete(apiKeys).where(eq(apiKeys.user_id, uid)),
    db.delete(userProfiles).where(eq(userProfiles.user_id, uid)),
    // Actor columns that name the user on rows that are not theirs.
    db
      .update(recipes)
      .set({ deleted_by: DELETED_USER_ID })
      .where(eq(recipes.deleted_by, uid)),
    db.update(recipes).set({ moderated_by: DELETED_USER_ID }).where(eq(recipes.moderated_by, uid)),
    db
      .update(recipes)
      .set({ image_regeneration_requested_by: DELETED_USER_ID })
      .where(eq(recipes.image_regeneration_requested_by, uid)),
    db
      .update(recipeFlags)
      .set({ reviewed_by: DELETED_USER_ID })
      .where(eq(recipeFlags.reviewed_by, uid)),
    db.update(apiKeys).set({ created_by: DELETED_USER_ID }).where(eq(apiKeys.created_by, uid)),
    db.update(apiKeys).set({ revoked_by: DELETED_USER_ID }).where(eq(apiKeys.revoked_by, uid)),
    db
      .update(mealTemplates)
      .set({ created_by: DELETED_USER_ID })
      .where(eq(mealTemplates.created_by, uid)),
    // Auth rows, then the users row last.
    db
      .delete(accounts)
      .where(eq(accounts.userId, uid)),
    ...(t.email
      ? [db.delete(verificationTokens).where(eq(verificationTokens.identifier, t.email))]
      : []),
    db.delete(users).where(stillDue(t)),
  ];
}

/** Recipes that survive the purge: anyone else's, plus the user's kept ones. */
export function survivingRecipe(t: PurgeTarget): SQL {
  return or(ne(recipes.user_id, t.userId), keptRecipe(t)) as SQL;
}
