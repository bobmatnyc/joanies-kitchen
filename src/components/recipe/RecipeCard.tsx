'use client';

import { ChefHat, Clock, Star, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Recipe } from '@/lib/db/schema';
import { categorizeTags, getCategoryColor, type TagCategory } from '@/lib/tag-ontology';
import { getPlaceholderImage } from '@/lib/utils/recipe-placeholders';

interface RecipeCardProps {
  recipe: Recipe;
  showSimilarity?: boolean;
  similarity?: number;
  showRank?: number;
  disableLink?: boolean;
  fromChefSlug?: string; // Optional chef slug to include in recipe link for back navigation
}

export function RecipeCard({
  recipe,
  showSimilarity = false,
  similarity = 0,
  showRank,
  disableLink = false,
  fromChefSlug,
}: RecipeCardProps) {
  // Safe JSON parsing with error handling
  let tags: string[] = [];
  let images: string[] = [];

  try {
    tags = recipe.tags ? JSON.parse(recipe.tags as string) : [];
  } catch (e) {
    console.warn('Failed to parse recipe tags:', recipe.id, e);
    tags = [];
  }

  try {
    images = recipe.images ? JSON.parse(recipe.images as string) : [];
  } catch (e) {
    console.warn('Failed to parse recipe images:', recipe.id, e);
    images = [];
  }

  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);

  // Use themed placeholder if no image available
  const displayImage = images[0] || recipe.image_url || getPlaceholderImage(tags);

  // Categorize tags using the ontology system
  const categorizedTags = categorizeTags(tags);
  const categoryEntries = Object.entries(categorizedTags) as [TagCategory, string[]][];

  // Check if recipe is top-rated (4.5+ rating)
  const systemRating = parseFloat(recipe.system_rating || '0') || 0;
  const userRating = parseFloat(recipe.avg_user_rating || '0') || 0;
  const isTopRated = systemRating >= 4.5 || userRating >= 4.5;

  // Use slug for URL if available, otherwise fall back to ID
  // Include chef slug in URL params if provided for back navigation
  let recipeUrl = recipe.slug ? `/recipes/${recipe.slug}` : `/recipes/${recipe.id}`;
  if (fromChefSlug) {
    recipeUrl += `?from=chef/${fromChefSlug}`;
  }

  const cardContent = (
    <Card className="recipe-card h-full flex flex-col hover:shadow-xl md:hover:-translate-y-1 transition-all duration-200 cursor-pointer border-jk-sage active:scale-[0.98] tap-feedback">
      {/* Rank badge if specified */}
      {showRank && (
        <div className="absolute -top-3 -left-3 z-10 bg-jk-tomato text-white rounded-full w-10 h-10 flex items-center justify-center font-bold shadow-lg font-heading">
          {showRank}
        </div>
      )}

      {displayImage && (
        <div className="aspect-[4/3] relative overflow-hidden rounded-t-jk bg-jk-sage/10">
          <Image
            src={displayImage}
            alt={recipe.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-200"
            loading="lazy"
            quality={75}
          />
          {images.length > 1 && (
            <Badge
              className="absolute bottom-2 left-2 bg-jk-clay/90 text-white"
              variant="secondary"
            >
              {images.length} images
            </Badge>
          )}
          {recipe.is_ai_generated && (
            <Badge
              className="absolute top-2 right-2 bg-jk-sage/90 text-jk-olive"
              variant="secondary"
            >
              AI Generated
            </Badge>
          )}
          {/* Top rated star (only show if not showing rank) */}
          {isTopRated && !showRank && (
            <Badge
              className="absolute top-2 right-2 bg-yellow-500 hover:bg-yellow-600 text-white shadow-md"
              aria-label="Top rated recipe"
              title="Top rated recipe (4.5+ stars)"
            >
              <Star className="w-3 h-3 fill-current" strokeWidth={0} />
            </Badge>
          )}
          {showSimilarity && similarity > 0 && (
            <Badge
              className="absolute bottom-2 right-2 bg-jk-tomato/90 text-white"
              variant="default"
            >
              {(similarity * 100).toFixed(0)}% match
            </Badge>
          )}
        </div>
      )}

      {/* Categorized Tags in 3 rows */}
      {categoryEntries.length > 0 && (
        <div className="px-4 pt-3 pb-3 space-y-2">
          {/* Row 1: Difficulty + Meal Type */}
          {(categorizedTags.Difficulty?.length > 0 || categorizedTags['Meal Type']?.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {categorizedTags.Difficulty?.map((tag, index) => (
                <Badge
                  key={`diff-${index}`}
                  className={`text-xs font-ui ${getCategoryColor('Difficulty')}`}
                  variant="outline"
                >
                  {tag}
                </Badge>
              ))}
              {categorizedTags['Meal Type']?.map((tag, index) => (
                <Badge
                  key={`meal-${index}`}
                  className={`text-xs font-ui ${getCategoryColor('Meal Type')}`}
                  variant="outline"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Row 2: Main Ingredient + Dietary */}
          {(categorizedTags['Main Ingredient']?.length > 0 ||
            categorizedTags.Dietary?.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {categorizedTags['Main Ingredient']?.slice(0, 3).map((tag, index) => (
                <Badge
                  key={`ing-${index}`}
                  className={`text-xs font-ui ${getCategoryColor('Main Ingredient')}`}
                  variant="outline"
                >
                  {tag}
                </Badge>
              ))}
              {(categorizedTags['Main Ingredient']?.length || 0) > 3 && (
                <Badge
                  className={`text-xs font-ui ${getCategoryColor('Main Ingredient')}`}
                  variant="outline"
                >
                  +{(categorizedTags['Main Ingredient']?.length || 0) - 3}
                </Badge>
              )}
              {categorizedTags.Dietary?.slice(0, 2).map((tag, index) => (
                <Badge
                  key={`diet-${index}`}
                  className={`text-xs font-ui ${getCategoryColor('Dietary')}`}
                  variant="outline"
                >
                  {tag}
                </Badge>
              ))}
              {(categorizedTags.Dietary?.length || 0) > 2 && (
                <Badge
                  className={`text-xs font-ui ${getCategoryColor('Dietary')}`}
                  variant="outline"
                >
                  +{(categorizedTags.Dietary?.length || 0) - 2}
                </Badge>
              )}
            </div>
          )}

          {/* Row 3: Season + Other (Expandable) */}
          {(categorizedTags.Season?.length > 0 || categorizedTags.Other?.length > 0) && (
            <details className="group/tags">
              <summary className="text-xs text-jk-olive/70 font-ui cursor-pointer hover:text-jk-olive flex items-center gap-1 list-none">
                <span className="group-open/tags:rotate-90 transition-transform inline-block">
                  ▸
                </span>
                <span>
                  More tags (
                  {(categorizedTags.Season?.length || 0) + (categorizedTags.Other?.length || 0)})
                </span>
              </summary>
              <div className="flex flex-wrap gap-1.5 mt-2 pt-1">
                {categorizedTags.Season?.map((tag, index) => (
                  <Badge
                    key={`season-${index}`}
                    className={`text-xs font-ui ${getCategoryColor('Season')}`}
                    variant="outline"
                  >
                    {tag}
                  </Badge>
                ))}
                {categorizedTags.Other?.map((tag, index) => (
                  <Badge
                    key={`other-${index}`}
                    className={`text-xs font-ui ${getCategoryColor('Other')}`}
                    variant="outline"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-jk-olive line-clamp-2 group-hover:text-jk-clay transition-colors text-lg md:text-xl">
          {recipe.name}
        </CardTitle>
        {recipe.description && (
          <CardDescription className="font-body text-jk-charcoal/70 line-clamp-2 text-sm md:text-base">
            {recipe.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        {/* Time and servings info */}
        <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-jk-charcoal/60 font-ui">
          {totalTime > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-jk-clay" />
              <span>{totalTime} min</span>
            </div>
          )}
          {recipe.servings && (
            <div className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 md:w-4 md:h-4 text-jk-clay" />
              <span>{recipe.servings} servings</span>
            </div>
          )}
        </div>

        {/* Cuisine aligned to bottom */}
        {recipe.cuisine && (
          <div className="flex items-center gap-1 text-xs md:text-sm text-jk-charcoal/60 font-ui mt-auto pt-3">
            <ChefHat className="w-3.5 h-3.5 md:w-4 md:h-4 text-jk-clay" />
            <span>{recipe.cuisine}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (disableLink) {
    return cardContent;
  }

  return (
    <Link
      href={recipeUrl}
      className="group block h-full"
      aria-label={`View recipe: ${recipe.name}`}
    >
      {cardContent}
    </Link>
  );
}
