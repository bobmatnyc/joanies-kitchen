import { Suspense } from 'react';
import { SimilarRecipesSection } from '@/components/recipe/SimilarRecipesSection';
import { SimilarRecipesSkeleton } from '@/components/recipe/SimilarRecipesWidget';
import RecipePageClient from './RecipePageClient';

/**
 * Why: #128 — the client page could only start the similar-recipes server action
 * after its own `getRecipe` action, and Next runs client-called actions one at a time.
 * What: server wrapper around the client page. It starts the similar-recipes
 * fetch during this request and streams it into the page through a Suspense slot.
 * Test: SimilarRecipesSection.test.tsx
 */
export default async function RecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <RecipePageClient
      params={params}
      similarRecipes={
        <Suspense fallback={<SimilarRecipesSkeleton />}>
          <SimilarRecipesSection slugOrId={slug} />
        </Suspense>
      }
    />
  );
}
