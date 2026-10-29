import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { getRecipe } from '@/app/actions/recipes';

// #134: getRecipe answers "no such recipe" and "not visible to this viewer" with this one
// string, so both become the same 404 and the response never shows a private recipe exists.
const HIDDEN_RECIPE_ERRORS = new Set(['Recipe not found']);

function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Why: #134 — the recipe page answered 200 with a client-rendered "Recipe Not Found"
 * for missing and private recipes, and indexable metadata.
 * What: loads the recipe through `getRecipe` (the #32 visibility rule). A missing or
 * hidden recipe calls `notFound()`; a visible recipe reached by UUID redirects to its
 * slug. Any other failure throws, so a database outage is a 500, not a 404.
 * Memoised per request, so the layout and `generateMetadata` share one lookup.
 * Test: `src/app/recipes/[slug]/__tests__/recipe-not-found.test.ts`
 */
export const loadVisibleRecipeOrNotFound = cache(async (slugOrId: string) => {
  const result = await getRecipe(slugOrId);
  if (!result.success || !result.data) {
    if (result.error && HIDDEN_RECIPE_ERRORS.has(result.error)) notFound();
    throw new Error(`Failed to load recipe: ${result.error ?? 'unknown error'}`);
  }
  // #134: redirect only after the visibility check, so a UUID never reveals a hidden slug.
  if (isUUID(slugOrId) && result.data.slug) {
    redirect(`/recipes/${result.data.slug}`);
  }
  return result.data;
});
