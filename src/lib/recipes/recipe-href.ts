/**
 * #142: the recipe page path. `/recipes/[slug]` resolves a slug first, then an id
 * (`getRecipe`), so a recipe with no slug links by its id.
 * Test: `src/app/api/ingest-recipe/__tests__/route-known-url.test.ts`
 */
export function recipeHref(recipe: { id: string; slug: string | null }): string {
  return `/recipes/${recipe.slug || recipe.id}`;
}
