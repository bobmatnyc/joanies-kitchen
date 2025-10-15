'use client';

import { type Recipe } from '@/lib/db/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Users, ChefHat, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { deleteRecipe } from '@/app/actions/recipes';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import { categorizeTags, getCategoryColor, type TagCategory } from '@/lib/tag-ontology';

interface RecipeCardProps {
  recipe: Recipe;
  onDelete?: () => void;
  showSimilarity?: boolean;
  similarity?: number;
}

export function RecipeCard({ recipe, onDelete, showSimilarity = false, similarity = 0 }: RecipeCardProps) {
  const router = useRouter();
  const tags = recipe.tags ? JSON.parse(recipe.tags as string) : [];
  const images = recipe.images ? JSON.parse(recipe.images as string) : [];
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
  const displayImage = images[0] || recipe.imageUrl;

  // Categorize tags using the ontology system
  const categorizedTags = categorizeTags(tags);
  const categoryEntries = Object.entries(categorizedTags) as [TagCategory, string[]][];

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent card navigation
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this recipe?')) {
      return;
    }

    const result = await deleteRecipe(recipe.id);
    if (result.success) {
      toast.success('Recipe deleted successfully');
      if (onDelete) {
        onDelete();
      }
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to delete recipe');
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent card navigation
    e.stopPropagation();
  };

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group block h-full"
      aria-label={`View recipe: ${recipe.name}`}
    >
      <Card className="recipe-card h-full flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer border-jk-sage">
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

        {/* Action Buttons - Only Edit and Delete */}
        <div className="px-6 pb-4 flex gap-2">
          <Link
            href={`/recipes/${recipe.id}/edit`}
            onClick={handleEdit}
            className="flex-1"
          >
            <Button
              variant="outline"
              size="sm"
              className="w-full border-jk-sage text-jk-olive hover:bg-jk-sage hover:text-jk-olive font-ui"
            >
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            className="border-jk-sage text-jk-olive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive font-ui"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </Link>
  );
}