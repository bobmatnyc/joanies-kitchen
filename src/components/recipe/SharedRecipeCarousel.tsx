'use client';

import Link from 'next/link';
import Image from 'next/image';
import { type Recipe } from '@/lib/db/schema';
import { Badge } from '@/components/ui/badge';
import { ChefHat } from 'lucide-react';

interface SharedRecipeCarouselProps {
  recipes: Recipe[];
}

export function SharedRecipeCarousel({ recipes }: SharedRecipeCarouselProps) {
  const getHeroImage = (recipe: Recipe): string => {
    // Parse images JSON and get first image
    if (recipe.images) {
      try {
        const parsed = JSON.parse(recipe.images as string);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed[0];
        }
      } catch (e) {
        // Continue to fallback
      }
    }
    // Fallback to imageUrl or placeholder
    return recipe.imageUrl || '/placeholder-recipe.jpg';
  };

  if (recipes.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory scrollbar-hide scroll-smooth">
        {recipes.map((recipe) => {
          const heroImage = getHeroImage(recipe);
          const images = recipe.images ? JSON.parse(recipe.images as string) : [];
          const imageCount = images.length > 0 ? images.length : (recipe.imageUrl ? 1 : 0);

          return (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              className="flex-none w-64 snap-start group"
            >
              <div className="relative aspect-video rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all hover:scale-105 bg-gray-200">
                <Image
                  src={heroImage}
                  alt={recipe.name}
                  fill
                  className="object-cover"
                  loading="lazy"
                  onError={(e) => {
                    // Fallback to a colored background on error
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />

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
                {recipe.isAiGenerated && (
                  <Badge
                    className="absolute top-2 right-2 text-xs bg-purple-500/90 text-white"
                  >
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
