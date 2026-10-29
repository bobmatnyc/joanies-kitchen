import { getRecipe } from '@/app/actions/recipes';
import { findSimilarToRecipe } from '@/app/actions/semantic-search';
import { SimilarRecipesWidget } from './SimilarRecipesWidget';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Why: #128 — fetched from the client, `findSimilarToRecipe` waited behind
 * `getRecipe` and the mount-time server actions in Next's serial action queue.
 * What: server component that resolves the recipe and calls `findSimilarToRecipe`
 * as a plain server-side function during the page request, so the visibility
 * rules, `similar-recipes` rate limit, cache and signed-in-only rerank are the
 * action's own. Renders the widget seeded with the result, or nothing when the
 * recipe is not readable.
 * Test: `#128 SimilarRecipesSection` in private-recipe-visibility.test.ts,
 * SimilarRecipesSection.test.tsx
 */
export async function SimilarRecipesSection({
  slugOrId,
  limit = 6,
}: {
  slugOrId: string;
  limit?: number;
}) {
  const source = await getRecipe(slugOrId);
  if (!source.success || !source.data) return null;
  // #128: a UUID URL redirects to the slug URL, which renders its own section.
  if (UUID.test(slugOrId) && source.data.slug) return null;

  const result = await findSimilarToRecipe(source.data.id, limit);
  return (
    <SimilarRecipesWidget
      key={source.data.id}
      recipeId={source.data.id}
      recipeName={source.data.name}
      limit={limit}
      initialResult={result}
    />
  );
}
