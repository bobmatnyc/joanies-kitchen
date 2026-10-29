/**
 * #58: PGlite fixture with two users, each owning one row in every exported table.
 *
 * Why: the scoping lives in SQL WHERE clauses; only real queries show what they admit.
 * What: `seedExportDb` builds the exported tables in PGlite and seeds users A and
 * B. It returns every string id seeded for B, so a test can assert none leaks.
 * Test: `src/lib/account-export/__tests__/account-export.test.ts`
 */
import { randomUUID } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import type { PgTable } from 'drizzle-orm/pg-core';
import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
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

export const EXPORT_TABLES: PgTable[] = [
  users,
  accounts,
  userProfiles,
  collections,
  collectionRecipes,
  favorites,
  recipeViews,
  recipes,
  recipeIngredients,
  recipeTasks,
  recipeTools,
  recipeComments,
  recipeRatings,
  recipeLikes,
  recipeForks,
  recipeFlags,
  meals,
  mealRecipes,
  shoppingLists,
  mealTemplates,
  inventoryItems,
  inventoryUsageLog,
  wasteTracking,
  apiKeys,
];

export const SECRETS = {
  access: 'SECRET-ACCESS-TOKEN',
  refresh: 'SECRET-REFRESH-TOKEN',
  idToken: 'SECRET-ID-TOKEN',
  keyHash: 'f'.repeat(64),
};

async function insert(client: PGlite, table: string, row: Record<string, unknown>) {
  const cols = Object.keys(row);
  const params = cols.map((_, i) => `$${i + 1}`).join(', ');
  const names = cols.map((c) => `"${c}"`).join(', ');
  await client.query(`INSERT INTO "${table}" (${names}) VALUES (${params})`, Object.values(row));
}

/** Seeds one row per table for `userId`; returns every string id it wrote. */
async function seedUser(client: PGlite, userId: string, tag: string): Promise<string[]> {
  const ids: string[] = [userId];
  const id = () => {
    const value = randomUUID();
    ids.push(value);
    return value;
  };
  const recipeId = `recipe-${tag}-${randomUUID()}`;
  ids.push(recipeId);
  const collectionId = id();
  const mealId = id();
  const itemId = id();

  await insert(client, 'users', { id: userId, name: `User ${tag}`, email: `${tag}@example.com` });
  await insert(client, 'accounts', {
    user_id: userId,
    type: 'oauth',
    provider: 'google',
    provider_account_id: `google-${tag}-${randomUUID()}`,
    access_token: SECRETS.access,
    refresh_token: SECRETS.refresh,
    id_token: SECRETS.idToken,
    token_type: 'bearer',
  });
  await insert(client, 'user_profiles', { id: id(), user_id: userId, username: `chef-${tag}` });
  await insert(client, 'collections', { id: collectionId, user_id: userId, name: `Box ${tag}` });
  await insert(client, 'collection_recipes', {
    id: id(),
    collection_id: collectionId,
    recipe_id: recipeId,
  });
  await insert(client, 'favorites', { id: id(), user_id: userId, recipe_id: recipeId });
  await insert(client, 'recipe_views', { id: id(), user_id: userId, recipe_id: recipeId });
  await insert(client, 'recipes', {
    id: recipeId,
    user_id: userId,
    name: `Soup ${tag}`,
    is_public: tag === 'a',
    image_url: `https://blob.example.com/${tag}.jpg`,
  });
  for (const table of ['recipe_ingredients', 'recipe_tasks', 'recipe_tools']) {
    await insert(client, table, { id: id(), recipe_id: recipeId });
  }
  for (const table of [
    'recipe_comments',
    'recipe_ratings',
    'recipe_likes',
    'recipe_forks',
    'recipe_flags',
  ]) {
    await insert(client, table, { id: id(), recipe_id: recipeId, user_id: userId });
  }
  await insert(client, 'meals', { id: mealId, user_id: userId, name: `Dinner ${tag}` });
  await insert(client, 'meal_recipes', { id: id(), meal_id: mealId, recipe_id: recipeId });
  await insert(client, 'shopping_lists', { id: id(), user_id: userId, meal_id: mealId });
  await insert(client, 'meal_templates', { id: id(), created_by: userId, is_system: false });
  await insert(client, 'inventory_items', { id: itemId, user_id: userId });
  await insert(client, 'inventory_usage_log', { id: id(), inventory_item_id: itemId });
  await insert(client, 'waste_tracking', { id: id(), user_id: userId, inventory_item_id: itemId });
  await insert(client, 'api_keys', {
    id: id(),
    user_id: userId,
    name: `Key ${tag}`,
    key_hash: SECRETS.keyHash,
    key_prefix: 'jk_live_abcd',
  });
  return ids;
}

export async function seedExportDb() {
  const { client, db } = await createVisibilityDb(EXPORT_TABLES, {});
  const userA = `user-a-${randomUUID()}`;
  const userB = `user-b-${randomUUID()}`;
  const aIds = await seedUser(client, userA, 'a');
  const bIds = await seedUser(client, userB, 'b');
  // A system template that names A as creator is not A's data.
  const systemTemplateId = randomUUID();
  await insert(client, 'meal_templates', {
    id: systemTemplateId,
    created_by: userA,
    is_system: true,
  });
  return { client, db, userA, userB, aIds, bIds, systemTemplateId };
}
