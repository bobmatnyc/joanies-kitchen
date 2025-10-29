'use client';

import { AlertCircle, RefreshCw, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import {
  getFlaggedRecipes,
  regenerateAllFlaggedImages,
  regenerateRecipeImage,
  unflagRecipeImage,
} from '@/app/actions/admin-recipes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FlaggedRecipe {
  id: string;
  name: string;
  image_url: string | null;
  images: string | null;
  image_flagged_for_regeneration: boolean | null;
  image_regeneration_requested_at: Date | null;
  image_regeneration_requested_by: string | null;
  slug: string | null;
  description: string | null;
}

export function FlaggedImagesManager() {
  const [flaggedRecipes, setFlaggedRecipes] = useState<FlaggedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [regeneratingAll, setRegeneratingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const loadFlaggedRecipes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getFlaggedRecipes();
      if (result.success && result.data) {
        setFlaggedRecipes(result.data);
      } else {
        setError(result.error || 'Failed to load flagged recipes');
      }
    } catch (err) {
      setError('An error occurred while loading flagged recipes');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlaggedRecipes();
  }, [loadFlaggedRecipes]);

  const handleRegenerateOne = async (recipeId: string) => {
    setRegeneratingId(recipeId);
    setError(null);
    startTransition(async () => {
      try {
        const result = await regenerateRecipeImage(recipeId);
        if (result.success) {
          await loadFlaggedRecipes();
          router.refresh();
        } else {
          setError(result.error || 'Failed to regenerate image');
        }
      } catch (err) {
        setError('An error occurred while regenerating image');
        console.error(err);
      } finally {
        setRegeneratingId(null);
      }
    });
  };

  const handleRegenerateAll = async () => {
    if (
      !confirm(
        `Regenerate images for ${flaggedRecipes.length} flagged recipes? This may take a while.`
      )
    ) {
      return;
    }

    setRegeneratingAll(true);
    setError(null);
    startTransition(async () => {
      try {
        const result = await regenerateAllFlaggedImages();
        if (result.success) {
          alert(
            `Batch regeneration complete:\n${result.data?.succeeded} succeeded\n${result.data?.failed} failed`
          );
          await loadFlaggedRecipes();
          router.refresh();
        } else {
          setError(result.error || 'Failed to regenerate images');
        }
      } catch (err) {
        setError('An error occurred during batch regeneration');
        console.error(err);
      } finally {
        setRegeneratingAll(false);
      }
    });
  };

  const handleUnflag = async (recipeId: string) => {
    startTransition(async () => {
      try {
        const result = await unflagRecipeImage(recipeId);
        if (result.success) {
          await loadFlaggedRecipes();
          router.refresh();
        } else {
          setError(result.error || 'Failed to unflag image');
        }
      } catch (err) {
        setError('An error occurred while unflagging image');
        console.error(err);
      }
    });
  };

  const getImageUrl = (recipe: FlaggedRecipe): string => {
    if (recipe.images) {
      try {
        const imageArray = JSON.parse(recipe.images);
        if (Array.isArray(imageArray) && imageArray.length > 0) {
          return imageArray[0];
        }
      } catch {
        // Fall through to image_url
      }
    }
    return recipe.image_url || '/placeholder-recipe.jpg';
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading flagged images...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
        <Button onClick={loadFlaggedRecipes} variant="outline" size="sm" className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  if (flaggedRecipes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Flag className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No images flagged for regeneration</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with batch action */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Flagged Images ({flaggedRecipes.length})</h3>
          <p className="text-sm text-gray-600">Images marked for AI regeneration</p>
        </div>
        <Button
          onClick={handleRegenerateAll}
          disabled={regeneratingAll || isPending}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${regeneratingAll ? 'animate-spin' : ''}`} />
          {regeneratingAll ? 'Regenerating All...' : 'Regenerate All'}
        </Button>
      </div>

      {/* Flagged recipes grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {flaggedRecipes.map((recipe) => {
          const isRegenerating = regeneratingId === recipe.id;

          return (
            <Card key={recipe.id} className="border-orange-200">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base line-clamp-2">
                    <Link
                      href={recipe.slug ? `/recipes/${recipe.slug}` : `/recipes/${recipe.id}`}
                      className="hover:text-blue-600"
                    >
                      {recipe.name}
                    </Link>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnflag(recipe.id)}
                    disabled={isPending || isRegenerating}
                    className="h-8 w-8 p-0"
                    title="Remove flag"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Image preview */}
                <div className="relative aspect-video mb-3 rounded-lg overflow-hidden bg-gray-100">
                  <Image
                    src={getImageUrl(recipe)}
                    alt={recipe.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                  {isRegenerating && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <RefreshCw className="w-8 h-8 text-white animate-spin" />
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="text-xs text-gray-500 mb-3">
                  Flagged:{' '}
                  {recipe.image_regeneration_requested_at
                    ? new Date(recipe.image_regeneration_requested_at).toLocaleString()
                    : 'Unknown'}
                </div>

                {/* Actions */}
                <Button
                  onClick={() => handleRegenerateOne(recipe.id)}
                  disabled={isRegenerating || isPending || regeneratingAll}
                  className="w-full"
                  size="sm"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
                  {isRegenerating ? 'Regenerating...' : 'Regenerate Image'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Flag({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
    </svg>
  );
}
