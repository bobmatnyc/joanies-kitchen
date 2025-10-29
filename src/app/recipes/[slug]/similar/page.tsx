'use client';

import { ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { notFound, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { getRecipe } from '@/app/actions/recipes';
import { findSimilarToRecipe, type RecipeWithSimilarity } from '@/app/actions/semantic-search';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { parseRecipe } from '@/lib/utils/recipe-utils';

/**
 * Check if a string is a UUID format
 */
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

interface SimilarRecipesPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default function SimilarRecipesPage({ params }: SimilarRecipesPageProps) {
  const [sourceRecipe, setSourceRecipe] = useState<any>(null);
  const [similarRecipes, setSimilarRecipes] = useState<RecipeWithSimilarity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slugOrId, setSlugOrId] = useState<string>('');
  const router = useRouter();

  // Unwrap params
  useEffect(() => {
    params.then((p) => setSlugOrId(p.slug));
  }, [params]);

  // Fetch source recipe and similar recipes
  const fetchData = useCallback(async () => {
    if (!slugOrId) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch source recipe (works with both slug and GUID)
      const recipeResult = await getRecipe(slugOrId);

      if (!recipeResult.success || !recipeResult.data) {
        notFound();
        return;
      }

      const parsedRecipe = parseRecipe(recipeResult.data);
      setSourceRecipe(parsedRecipe);

      // If accessed via slug instead of GUID, redirect to GUID-based URL
      // This ensures consistent URLs for sharing similar recipes
      if (!isUUID(slugOrId) && recipeResult.data.id) {
        router.replace(`/recipes/${recipeResult.data.id}/similar`);
        return;
      }

      // Fetch similar recipes using semantic search
      const similarResult = await findSimilarToRecipe(recipeResult.data.id, 24);

      if (similarResult.success) {
        setSimilarRecipes(similarResult.recipes);
      } else {
        setError(similarResult.error || 'Failed to find similar recipes');
      }
    } catch (err: any) {
      console.error('Failed to fetch similar recipes:', err);
      setError(err.message || 'An error occurred while loading similar recipes');
    } finally {
      setLoading(false);
    }
  }, [slugOrId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header Skeleton */}
        <div className="mb-8 space-y-4">
          <div className="h-10 bg-muted rounded-md w-32" />
          <div className="h-10 bg-muted rounded-md w-3/4" />
          <div className="h-6 bg-muted rounded-md w-1/2" />
        </div>

        {/* Grid Skeleton */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-[400px] bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!sourceRecipe) {
    notFound();
    return null;
  }

  // Build back URL - use slug if available, otherwise ID
  const backUrl = sourceRecipe.slug
    ? `/recipes/${sourceRecipe.slug}`
    : `/recipes/${sourceRecipe.id}`;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Back Button */}
      <Link
        href={backUrl}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6 min-h-[44px] min-w-[44px] -ml-2 pl-2 pr-4 py-2 rounded-md hover:bg-accent transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to Recipe
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <Sparkles className="w-8 h-8 text-primary" />
          <h1 className="text-3xl sm:text-4xl font-bold">Recipes Like This</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Similar to <span className="font-semibold text-foreground">"{sourceRecipe.name}"</span>
        </p>
        {sourceRecipe.cuisine && (
          <p className="text-sm text-muted-foreground mt-2">
            Based on {sourceRecipe.cuisine} cuisine, ingredients, and cooking style
          </p>
        )}
      </div>

      {/* Error State */}
      {error && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Similar Recipes</CardTitle>
            <CardDescription>{error}</CardDescription>
            <Button onClick={fetchData} variant="outline" className="mt-4">
              Try Again
            </Button>
          </CardHeader>
        </Card>
      )}

      {/* Similar Recipes Grid */}
      {!error && similarRecipes.length > 0 && (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {similarRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              showSimilarity
              similarity={recipe.similarity}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!error && similarRecipes.length === 0 && (
        <Card>
          <CardHeader className="text-center py-12">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-muted-foreground" />
            </div>
            <CardTitle>No Similar Recipes Found</CardTitle>
            <CardDescription className="mt-2">
              We couldn't find any recipes similar to this one yet. Try exploring other recipes or
              check back later as we add more to our collection.
            </CardDescription>
            <div className="mt-6">
              <Link href="/recipes">
                <Button variant="outline">Browse All Recipes</Button>
              </Link>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Footer Info */}
      {!error && similarRecipes.length > 0 && (
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Showing {similarRecipes.length} recipe{similarRecipes.length !== 1 ? 's' : ''} similar
            to "{sourceRecipe.name}"
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Similarity is calculated using AI-powered semantic analysis of ingredients, cooking
            methods, and flavor profiles.
          </p>
        </div>
      )}
    </div>
  );
}
