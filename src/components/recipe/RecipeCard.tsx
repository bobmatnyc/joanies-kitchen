'use client';

import { type Recipe } from '@/lib/db/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Users, ChefHat, Star } from 'lucide-react';
import Link from 'next/link';
import { categorizeTags, getCategoryColor, type TagCategory } from '@/lib/tag-ontology';

interface RecipeCardProps {
  recipe: Recipe;
  showSimilarity?: boolean;
  similarity?: number;
  showRank?: number;
}

export function RecipeCard({ recipe, showSimilarity = false, similarity = 0, showRank }: RecipeCardProps) {
  const tags = recipe.tags ? JSON.parse(recipe.tags as string) : [];
  const images = recipe.images ? JSON.parse(recipe.images as string) : [];
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
  const displayImage = images[0] || recipe.imageUrl;

  // Categorize tags using the ontology system
  const categorizedTags = categorizeTags(tags);
  const categoryEntries = Object.entries(categorizedTags) as [TagCategory, string[]][];

  // Check if recipe is top-rated (4.5+ rating)
  const systemRating = parseFloat(recipe.systemRating || '0') || 0;
  const userRating = parseFloat(recipe.avgUserRating || '0') || 0;
  const isTopRated = systemRating >= 4.5 || userRating >= 4.5;

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group block h-full"
      aria-label={`View recipe: ${recipe.name}`}
    >
      <Card className="recipe-card h-full flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer border-jk-sage">
        {/* Rank badge if specified */}
        {showRank && (
          <div className="absolute -top-3 -left-3 z-10 bg-jk-tomato text-white rounded-full w-10 h-10 flex items-center justify-center font-bold shadow-lg font-heading">
            {showRank}
          </div>
        )}

        {displayImage && (
          <div className="aspect-video relative overflow-hidden rounded-t-jk bg-jk-sage/10">
            <img
              src={displayImage}
              alt={recipe.name}
              loading="lazy"
              decoding="async"
              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-200"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            {images.length > 1 && (
              <Badge className="absolute bottom-2 left-2 bg-jk-clay/90 text-white" variant="secondary">
                {images.length} images
              </Badge>
            )}
            {recipe.isAiGenerated && (
              <Badge className="absolute top-2 right-2 bg-jk-sage/90 text-jk-olive" variant="secondary">
                AI Generated
              </Badge>
            )}
            {/* Top rated star (only show if not showing rank) */}
            {isTopRated && !showRank && (
              <div
                className="absolute top-2 right-2 bg-jk-tomato rounded-full p-2 shadow-lg"
                aria-label="Top rated recipe"
                title="Top rated recipe (4.5+ stars)"
              >
                <Star className="h-4 w-4 fill-white text-white" />
              </div>
            )}
            {showSimilarity && similarity > 0 && (
              <Badge className="absolute bottom-2 right-2 bg-jk-tomato/90 text-white" variant="default">
                {(similarity * 100).toFixed(0)}% match
              </Badge>
            )}
          </div>
        )}
        <CardHeader>
          <CardTitle className="font-heading text-jk-olive line-clamp-2 group-hover:text-jk-clay transition-colors">
            {recipe.name}
          </CardTitle>
          {recipe.description && (
            <CardDescription className="font-body text-jk-charcoal/70 line-clamp-2">
              {recipe.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex-grow space-y-3">
          <div className="flex flex-wrap gap-2">
            {recipe.cuisine && (
              <Badge variant="outline" className="border-jk-clay text-jk-clay font-ui">
                <ChefHat className="w-3 h-3 mr-1" />
                {recipe.cuisine}
              </Badge>
            )}
            {recipe.difficulty && (
              <Badge variant="outline" className={`font-ui ${
                recipe.difficulty === 'easy' ? 'border-green-600 text-green-600' :
                recipe.difficulty === 'medium' ? 'border-yellow-600 text-yellow-600' :
                'border-red-600 text-red-600'
              }`}>
                {recipe.difficulty}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-jk-charcoal/60 font-ui">
            {totalTime > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-jk-clay" />
                <span>{totalTime} min</span>
              </div>
            )}
            {recipe.servings && (
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4 text-jk-clay" />
                <span>{recipe.servings} servings</span>
              </div>
            )}
          </div>

          {/* Categorized Tags */}
          {categoryEntries.length > 0 && (
            <div className="space-y-2">
              {categoryEntries.slice(0, 2).map(([category, categoryTags]) => (
                <div key={category} className="space-y-1">
                  <span className="text-xs font-semibold text-jk-olive/70 font-ui">
                    {category}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {categoryTags.slice(0, 3).map((tag, index) => (
                      <Badge
                        key={index}
                        className={`text-xs font-ui ${getCategoryColor(category)}`}
                        variant="outline"
                      >
                        {tag}
                      </Badge>
                    ))}
                    {categoryTags.length > 3 && (
                      <Badge
                        className={`text-xs font-ui ${getCategoryColor(category)}`}
                        variant="outline"
                      >
                        +{categoryTags.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              {categoryEntries.length > 2 && (
                <span className="text-xs text-jk-charcoal/50 font-ui">
                  +{categoryEntries.length - 2} more categories
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}