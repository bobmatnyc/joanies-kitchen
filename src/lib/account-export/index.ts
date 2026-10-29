/**
 * #58 (D7c S2): self-serve JSON export of the signed-in user's own data.
 *
 * Why: /privacy promises access and export; a self-serve download removes
 * the manual by-email step before sign-up opens.
 * What: `buildUserExport` reads every user-owned table, scoped to one user id,
 * and returns `{ exported_at, schema_version, user_id, data }`. Columns come
 * from the drizzle table definitions minus `EXCLUDED_COLUMNS` (a deny-list).
 * All queries run together; any one failure rejects the whole export, so the
 * caller never returns a partial file. Image fields are exported as stored URLs.
 * Test: `src/lib/account-export/__tests__/account-export.test.ts`
 */

import { and, eq, getTableColumns, inArray, isNull, or } from 'drizzle-orm';
import type { PgColumn, PgDatabase, PgQueryResultHKT, PgTable } from 'drizzle-orm/pg-core';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { apiKeys } from '@/lib/db/api-keys-schema';
import { accounts, users } from '@/lib/db/auth-schema';
import { recipeIngredients } from '@/lib/db/ingredients-schema';
import { inventoryItems, inventoryUsageLog, wasteTracking } from '@/lib/db/inventory-schema';
import { mealRecipes, meals, mealTemplates, shoppingLists } from '@/lib/db/meals-schema';
import {
  recipeComments,
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

/** Bump when the export's shape changes in a way a reader must notice. */
export const EXPORT_SCHEMA_VERSION = 1;

/**
 * Deny-list, keyed by SQL table name, of columns never exported. These are
 * credentials: OAuth tokens and the API key hash. Every other column of an
 * exported table is the user's own data and is included.
 */
export const EXCLUDED_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  accounts: ['refresh_token', 'access_token', 'id_token', 'session_state'],
  api_keys: ['key_hash'],
};

// biome-ignore lint/suspicious/noExplicitAny: accepts neon-http and pglite clients alike.
export type ExportDb = Pick<PgDatabase<PgQueryResultHKT, any>, 'select'>;

/** Table columns minus the deny-list, as a drizzle select shape. */
function exportColumns(table: PgTable): Record<string, PgColumn> {
  const denied = new Set(EXCLUDED_COLUMNS[getTableConfig(table).name] ?? []);
  const columns = getTableColumns(table) as Record<string, PgColumn>;
  return Object.fromEntries(Object.entries(columns).filter(([, col]) => !denied.has(col.name)));
}

/**
 * One export section per user-owned table. `rows` runs the scoped query.
 * Child tables (ingredients, tasks, tools, meal_recipes, collection_recipes,
 * usage log) are scoped through a subquery on the parent's owner column.
 */
function sections(db: ExportDb, userId: string) {
  const from = (table: PgTable) => db.select(exportColumns(table)).from(table);
  const ownRecipeIds = db
    .select({ id: recipes.id })
    .from(recipes)
    .where(eq(recipes.user_id, userId));
  const ownMealIds = db.select({ id: meals.id }).from(meals).where(eq(meals.user_id, userId));
  const ownCollectionIds = db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.user_id, userId));
  const ownItemIds = db
    .select({ id: inventoryItems.id })
    .from(inventoryItems)
    .where(eq(inventoryItems.user_id, userId));

  return {
    users: from(users).where(eq(users.id, userId)),
    accounts: from(accounts).where(eq(accounts.userId, userId)),
    user_profiles: from(userProfiles).where(eq(userProfiles.user_id, userId)),
    collections: from(collections).where(eq(collections.user_id, userId)),
    collection_recipes: from(collectionRecipes).where(
      inArray(collectionRecipes.collection_id, ownCollectionIds)
    ),
    favorites: from(favorites).where(eq(favorites.user_id, userId)),
    recipe_views: from(recipeViews).where(eq(recipeViews.user_id, userId)),
    recipes: from(recipes).where(eq(recipes.user_id, userId)),
    recipe_ingredients: from(recipeIngredients).where(
      inArray(recipeIngredients.recipe_id, ownRecipeIds)
    ),
    recipe_tasks: from(recipeTasks).where(inArray(recipeTasks.recipe_id, ownRecipeIds)),
    recipe_tools: from(recipeTools).where(inArray(recipeTools.recipe_id, ownRecipeIds)),
    recipe_comments: from(recipeComments).where(eq(recipeComments.user_id, userId)),
    recipe_ratings: from(recipeRatings).where(eq(recipeRatings.user_id, userId)),
    recipe_likes: from(recipeLikes).where(eq(recipeLikes.user_id, userId)),
    recipe_forks: from(recipeForks).where(eq(recipeForks.user_id, userId)),
    recipe_flags: from(recipeFlags).where(eq(recipeFlags.user_id, userId)),
    meals: from(meals).where(eq(meals.user_id, userId)),
    meal_recipes: from(mealRecipes).where(inArray(mealRecipes.meal_id, ownMealIds)),
    shopping_lists: from(shoppingLists).where(eq(shoppingLists.user_id, userId)),
    meal_templates: from(mealTemplates).where(
      and(
        eq(mealTemplates.created_by, userId),
        or(eq(mealTemplates.is_system, false), isNull(mealTemplates.is_system))
      )
    ),
    inventory_items: from(inventoryItems).where(eq(inventoryItems.user_id, userId)),
    inventory_usage_log: from(inventoryUsageLog).where(
      inArray(inventoryUsageLog.inventory_item_id, ownItemIds)
    ),
    waste_tracking: from(wasteTracking).where(eq(wasteTracking.user_id, userId)),
    api_keys: from(apiKeys).where(eq(apiKeys.user_id, userId)),
  };
}

export type ExportSection = keyof ReturnType<typeof sections>;

/** SQL table names the export covers; the coverage test compares this to the schema. */
export const EXPORTED_TABLES: readonly ExportSection[] = [
  'users',
  'accounts',
  'user_profiles',
  'collections',
  'collection_recipes',
  'favorites',
  'recipe_views',
  'recipes',
  'recipe_ingredients',
  'recipe_tasks',
  'recipe_tools',
  'recipe_comments',
  'recipe_ratings',
  'recipe_likes',
  'recipe_forks',
  'recipe_flags',
  'meals',
  'meal_recipes',
  'shopping_lists',
  'meal_templates',
  'inventory_items',
  'inventory_usage_log',
  'waste_tracking',
  'api_keys',
];

export interface UserExport {
  exported_at: string;
  schema_version: number;
  user_id: string;
  data: Record<ExportSection, unknown[]>;
}

/** Rejects if any section's query fails; never resolves with partial data. */
export async function buildUserExport(
  db: ExportDb,
  userId: string,
  now: Date = new Date()
): Promise<UserExport> {
  if (!userId) throw new Error('buildUserExport requires a user id');
  const queries = sections(db, userId);
  const names = Object.keys(queries) as ExportSection[];
  const results = await Promise.all(names.map((name) => queries[name] as Promise<unknown[]>));
  const data = Object.fromEntries(names.map((name, i) => [name, results[i]])) as Record<
    ExportSection,
    unknown[]
  >;
  return {
    exported_at: now.toISOString(),
    schema_version: EXPORT_SCHEMA_VERSION,
    user_id: userId,
    data,
  };
}
