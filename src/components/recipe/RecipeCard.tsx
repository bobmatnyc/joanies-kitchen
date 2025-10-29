'use client';

import { Bookmark, ChefHat, Clock, GitFork, Heart, Star, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Recipe } from '@/lib/db/schema';
import {
  categorizeTag,
  categorizeTags,
  getCategoryColor,
  type TagCategory,
} from '@/lib/tag-ontology';
import { getTagLabel, normalizeTagToId } from '@/lib/tags';
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

  // Prioritize working external URLs (http/https) over local paths
  const workingImages = images.filter(img =>
    img.startsWith('http://') || img.startsWith('https://')
  );
  const displayImage = workingImages[0] || recipe.image_url || images[0] || getPlaceholderImage(tags);

  // Check if image is external (not from our domain or known CDNs)
  const isExternalImage = Boolean(
    displayImage?.startsWith('http') &&
      !displayImage.includes('vercel') &&
      !displayImage.includes('unsplash.com') &&
      !displayImage.includes('themealdb.com')
  );

  // Categorize tags using the ontology system
  const categorizedTags = categorizeTags(tags);
  const _categoryEntries = Object.entries(categorizedTags) as [TagCategory, string[]][];

  // State for expandable tags
  const [showAllTags, setShowAllTags] = useState(false);

  // Primary tags (always visible): Main Ingredient, Dietary
  // Exclude Difficulty (internal) and Cuisine (shown at bottom)
  const primaryTags = [
    ...(categorizedTags['Main Ingredient'] || []).slice(0, 2), // Up to 2 main ingredients
    ...(categorizedTags.Dietary || []).slice(0, 1), // 1 dietary preference
  ]
    .filter(Boolean)
    .slice(0, 3); // Max 3 primary tags

  // Other tags (collapsible): Everything else, excluding Difficulty and Cuisine
  const otherTags = [
    ...(categorizedTags['Meal Type'] || []),
    ...(categorizedTags['Cooking Method'] || []),
    ...(categorizedTags.Course || []),
    ...(categorizedTags.Season || []),
    ...(categorizedTags.Time || []),
    ...(categorizedTags.Other || []),
  ]
    .filter((tag) => {
      // Exclude Difficulty and Cuisine tags
      const tagId = normalizeTagToId(tag);
      return !tagId.startsWith('difficulty.') && !tagId.startsWith('cuisine.');
    })
    .slice(0, 10); // Max 10 other tags

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
      <CardContent className="flex flex-col flex-1 p-0">
        {/* Image - Fixed aspect ratio */}
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
              unoptimized={isExternalImage}
            />
            {/* Favorite Button - Top Left */}
            <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
              <FavoriteButton recipeId={recipe.id} variant="default" size="icon" />
            </div>

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
            {/* Top rated star */}
            {isTopRated && (
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

        {/* Content area with padding */}
        <div className="flex flex-col flex-1 p-4">
          {/* Primary Tags Row - Always visible */}
          {(primaryTags.length > 0 || otherTags.length > 0) && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {primaryTags.map((tag, index) => {
                const tagId = normalizeTagToId(tag);
                const label = getTagLabel(tagId);
                const category = categorizeTag(tag);
                const colorClass = getCategoryColor(category);

                return (
                  <Badge
                    key={`primary-${index}`}
                    className={`text-xs px-2 py-0.5 font-ui ${colorClass}`}
                    variant="outline"
                  >
                    {label}
                  </Badge>
                );
              })}
              {otherTags.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowAllTags(!showAllTags);
                  }}
                  className="h-6 px-2 text-xs text-jk-olive/70 hover:text-jk-olive"
                >
                  {showAllTags ? '− Less' : `+ ${otherTags.length} more`}
                </Button>
              )}
            </div>
          )}

          {/* Expanded Tags (if showing) */}
          {showAllTags && otherTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {otherTags.map((tag, index) => {
                const tagId = normalizeTagToId(tag);
                const label = getTagLabel(tagId);
                const category = categorizeTag(tag);
                const colorClass = getCategoryColor(category);

                return (
                  <Badge
                    key={`other-${index}`}
                    className={`text-xs px-2 py-0.5 font-ui opacity-80 ${colorClass}`}
                    variant="secondary"
                  >
                    {label}
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Title - Fixed height (2 lines) */}
          <h3 className="text-lg md:text-xl font-heading text-jk-olive group-hover:text-jk-clay transition-colors line-clamp-2 leading-snug mb-2">
            {recipe.name}
          </h3>

          {/* Description - Fixed height (3 lines) */}
          {recipe.description && (
            <p className="text-sm md:text-base font-body text-jk-charcoal/70 line-clamp-3 leading-relaxed mb-4">
              {recipe.description}
            </p>
          )}

          {/* Time and servings info */}
          {(totalTime > 0 || recipe.servings) && (
            <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-jk-charcoal/60 font-ui mb-3">
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
          )}

          {/* Cuisine - Bottom aligned with mt-auto */}
          {recipe.cuisine && (
            <div className="flex items-center gap-1.5 text-sm md:text-base text-jk-charcoal/60 font-ui mt-auto">
              <ChefHat className="w-4 h-4 text-jk-clay flex-shrink-0" />
              <span>{recipe.cuisine}</span>
            </div>
          )}

          {/* Engagement Metrics - Compact */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 pt-2 border-t border-jk-sage/20">
            <span className="flex items-center gap-1" title="Likes">
              <Heart className="w-3 h-3" />
              {recipe.like_count || 0}
            </span>
            <span className="flex items-center gap-1" title="Forks">
              <GitFork className="w-3 h-3" />
              {recipe.fork_count || 0}
            </span>
            <span className="flex items-center gap-1" title="Collections">
              <Bookmark className="w-3 h-3" />
              {recipe.collection_count || 0}
            </span>
          </div>
        </div>
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
