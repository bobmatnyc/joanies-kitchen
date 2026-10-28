/**
 * #33: the explicit allowlist of recipe columns a caller may write through
 * `createRecipe` / `updateRecipe`. A server action is callable by anyone over
 * POST with any payload, so the action copies only these keys; every other
 * column (owner, ids, timestamps, slug, moderation, ratings and counters, QA,
 * soft-delete, admin flags) is set server-side or left at its default.
 */

import type { NewRecipe } from '@/lib/db/schema';

/** Columns any signed-in owner may set on their own recipe. */
const USER_RECIPE_FIELDS = [
  'name',
  'description',
  'ingredients',
  'instructions',
  'prep_time',
  'cook_time',
  'servings',
  'difficulty',
  'cuisine',
  'tags',
  'image_url',
  'images',
  'is_public',
  'is_meal_prep_friendly',
  'nutrition_info',
  'video_url',
  'source',
  'is_ai_generated',
  'model_used',
  'submission_notes',
] as const satisfies readonly (keyof NewRecipe)[];

/** Columns only an admin (`users.is_admin`) may set (#33). */
const ADMIN_RECIPE_FIELDS = [
  'is_system_recipe',
  'chef_id',
  'license',
] as const satisfies readonly (keyof NewRecipe)[];

function present(data: object, key: string): boolean {
  return Object.hasOwn(data, key) && (data as Record<string, unknown>)[key] !== undefined;
}

/** True when the payload carries any admin-only column, so the caller must check admin. */
export function hasAdminRecipeFields(data: object): boolean {
  return ADMIN_RECIPE_FIELDS.some((key) => present(data, key));
}

/**
 * Why: a client-built payload must not set the owner, a system flag, chef
 * attribution, license, moderation state or ranking counters (#33).
 * What: returns a new object holding only the allowlisted keys present in
 * `data` (undefined values skipped, so partial updates stay partial). The
 * admin-only keys are copied only when `isAdmin` is true. Unknown keys are
 * dropped, never rejected.
 * Test: `src/app/actions/__tests__/recipe-field-injection.test.ts`
 */
export function pickRecipeWriteFields(data: object, isAdmin: boolean): Partial<NewRecipe> {
  const source = data as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  const keys: readonly string[] = isAdmin
    ? [...USER_RECIPE_FIELDS, ...ADMIN_RECIPE_FIELDS]
    : USER_RECIPE_FIELDS;
  for (const key of keys) {
    if (present(source, key)) picked[key] = source[key];
  }
  return picked as Partial<NewRecipe>;
}
