'use client';

import { ChefHat } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useRecipeImageFallback } from '@/hooks/useRecipeImageFallback';
import type { Recipe } from '@/lib/db/schema';
import { getRecipeImageUrls, toUsableImageUrl } from '@/lib/utils/recipe-image';

interface SharedRecipeCarouselProps {
  recipes: Recipe[];
}

// #94: a load error advances to the next candidate, then the themed placeholder.
function RecipeHeroImage({ recipe }: { recipe: Recipe }) {
  const { src, onError } = useRecipeImageFallback(recipe);
  return (
    <Image
      src={src}
      alt={recipe.name}
      fill
      className="object-cover"
      loading="lazy"
      onError={onError}
    />
  );
}

export function SharedRecipeCarousel({ recipes }: SharedRecipeCarouselProps) {
  if (recipes.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory scrollbar-hide scroll-smooth">
        {recipes.map((recipe) => {
          // #94: shared resolver; the old unguarded JSON.parse here could throw and break the carousel.
          // #172: a data: placeholder in image_url does not count as an image
          const imageCount =
            getRecipeImageUrls(recipe.images).length ||
            (toUsableImageUrl(recipe.image_url) ? 1 : 0);

          return (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              className="flex-none w-64 snap-start group"
            >
              <div className="relative aspect-video rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all hover:scale-105 bg-gray-200">
                <RecipeHeroImage recipe={recipe} />

                {/* Gradient overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                {/* Recipe info overlay */}
                <div className="absolute inset-0 flex flex-col justify-end p-4">
                  <h3 className="text-white font-semibold text-lg line-clamp-2 mb-2">
                    {recipe.name}
                  </h3>

                  <div className="flex items-center gap-2 flex-wrap">
                    {recipe.cuisine && (
                      <Badge variant="secondary" className="text-xs bg-white/90 text-gray-800">
                        <ChefHat className="w-3 h-3 mr-1" />
                        {recipe.cuisine}
                      </Badge>
                    )}
                    {recipe.difficulty && (
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          recipe.difficulty === 'easy'
                            ? 'bg-green-500/90 text-white'
                            : recipe.difficulty === 'medium'
                              ? 'bg-yellow-500/90 text-white'
                              : 'bg-red-500/90 text-white'
                        }`}
                      >
                        {recipe.difficulty}
                      </Badge>
                    )}
                    {imageCount > 1 && (
                      <Badge variant="secondary" className="text-xs bg-white/90 text-gray-800">
                        {imageCount} images
                      </Badge>
                    )}
                  </div>
                </div>

                {/* AI Generated badge in top right */}
                {recipe.is_ai_generated && (
                  <Badge className="absolute top-2 right-2 text-xs bg-purple-500/90 text-white">
                    AI Generated
                  </Badge>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Custom CSS for hiding scrollbar while maintaining functionality */}
      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
