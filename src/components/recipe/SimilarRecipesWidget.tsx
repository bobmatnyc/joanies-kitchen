'use client';

import { useEffect, useState } from 'react';
import { findSimilarToRecipe, type RecipeWithSimilarity } from '@/app/actions/semantic-search';
import { RecipeCard } from './RecipeCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export interface SimilarRecipesWidgetProps {
  recipeId: string;
  recipeName?: string;
  limit?: number;
  autoLoad?: boolean;
}

export function SimilarRecipesWidget({
  recipeId,
  recipeName,
  limit = 6,
  autoLoad = true,
}: SimilarRecipesWidgetProps) {
  const [recipes, setRecipes] = useState<RecipeWithSimilarity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    if (autoLoad) {
      loadSimilarRecipes();
    }
  }, [recipeId, autoLoad]);

  const loadSimilarRecipes = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await findSimilarToRecipe(recipeId, limit);

      if (result.success) {
        setRecipes(result.recipes);
      } else {
        setError(result.error || 'Failed to find similar recipes');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const scrollContainer = (direction: 'left' | 'right') => {
    const container = document.getElementById(`similar-recipes-${recipeId}`);
    if (!container) return;

    const scrollAmount = 320; // Approximate card width + gap
    const newPosition = direction === 'left'
      ? Math.max(0, scrollPosition - scrollAmount)
      : scrollPosition + scrollAmount;

    container.scrollTo({
      left: newPosition,
      behavior: 'smooth',
    });

    setScrollPosition(newPosition);
  };

  if (!autoLoad && !loading && recipes.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <Button onClick={loadSimilarRecipes} variant="outline" className="w-full">
            <Sparkles className="w-4 h-4 mr-2" />
            Find Similar Recipes
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            Recipes Like This
          </CardTitle>
          <CardDescription>
            Finding similar recipes using AI...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="min-w-[280px] h-[400px] bg-muted/50 rounded-lg animate-pulse"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            onClick={loadSimilarRecipes}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (recipes.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Recipes Like This
            </CardTitle>
            <CardDescription>
              {recipeName
                ? `Similar to ${recipeName}`
                : 'Discover recipes with similar flavors and styles'}
            </CardDescription>
          </div>
          {recipes.length > 3 && (
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => scrollContainer('left')}
                disabled={scrollPosition === 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => scrollContainer('right')}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div
          id={`similar-recipes-${recipeId}`}
          className="flex gap-4 overflow-x-auto pb-4 scroll-smooth"
          style={{ scrollbarWidth: 'thin' }}
        >
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="min-w-[280px] max-w-[280px] relative"
            >
              <Link href={`/recipes/${recipe.id}`}>
                <div className="group cursor-pointer">
                  <RecipeCard recipe={recipe} />
                  {recipe.similarity > 0 && (
                    <Badge
                      variant="secondary"
                      className="absolute top-2 right-2 z-10 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                    >
                      {(recipe.similarity * 100).toFixed(0)}% similar
                    </Badge>
                  )}
                </div>
              </Link>
            </div>
          ))}
        </div>

        {recipes.length >= limit && (
          <div className="text-center pt-2">
            <Link href={`/recipes/${recipeId}/similar`}>
              <Button variant="ghost" size="sm">
                View All Similar Recipes
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact version of the widget for smaller spaces
 */
export function SimilarRecipesCompact({
  recipeId,
  limit = 3,
}: {
  recipeId: string;
  limit?: number;
}) {
  const [recipes, setRecipes] = useState<RecipeWithSimilarity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    findSimilarToRecipe(recipeId, limit).then((result) => {
      if (result.success) {
        setRecipes(result.recipes);
      }
      setLoading(false);
    });
  }, [recipeId, limit]);

  if (loading || recipes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Similar Recipes</h3>
      </div>
      <div className="space-y-2">
        {recipes.map((recipe) => (
          <Link
            key={recipe.id}
            href={`/recipes/${recipe.id}`}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors"
          >
            {recipe.images && JSON.parse(recipe.images)[0] && (
              <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0">
                <img
                  src={JSON.parse(recipe.images)[0]}
                  alt={recipe.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{recipe.name}</p>
              <p className="text-xs text-muted-foreground">
                {(recipe.similarity * 100).toFixed(0)}% similar
              </p>
            </div>
          </Link>
        ))}
      </div>
      <Link href={`/recipes/${recipeId}/similar`} className="block">
        <Button variant="ghost" size="sm" className="w-full">
          View More
        </Button>
      </Link>
    </div>
  );
}
