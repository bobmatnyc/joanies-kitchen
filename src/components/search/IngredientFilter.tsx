'use client';

import { ChevronDown, ChevronRight, Loader2, Package } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { getIngredientsByCategory, getPopularIngredients } from '@/app/actions/ingredient-search';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { INGREDIENT_CATEGORIES } from '@/lib/db/ingredients-schema';
import type { Ingredient } from '@/lib/db/schema';
import { cn } from '@/lib/utils';

interface IngredientFilterProps {
  selectedIngredients: Ingredient[];
  onIngredientsChange: (ingredients: Ingredient[]) => void;
  className?: string;
}

interface CategorySection {
  category: string;
  count: number;
  ingredients: Ingredient[];
  isExpanded: boolean;
  isLoading: boolean;
}

export function IngredientFilter({
  selectedIngredients,
  onIngredientsChange,
  className,
}: IngredientFilterProps) {
  const [categories, setCategories] = useState<CategorySection[]>([]);
  const [popularIngredients, setPopularIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load popular ingredients and initialize categories
      const popularResult = await getPopularIngredients(15);

      // Initialize categories from static list
      setCategories(
        INGREDIENT_CATEGORIES.map((cat) => ({
          category: cat,
          count: 0, // Will be updated when expanded
          ingredients: [],
          isExpanded: false,
          isLoading: false,
        }))
      );

      if (popularResult.success) {
        setPopularIngredients(popularResult.ingredients);
      }
    } catch (err) {
      console.error('Error loading ingredient data:', err);
      setError('Failed to load ingredients. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load categories and popular ingredients on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toggle category expansion and load ingredients if not loaded
  const toggleCategory = async (categoryName: string) => {
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.category === categoryName) {
          const willExpand = !cat.isExpanded;

          // Load ingredients if expanding and not loaded yet
          if (willExpand && cat.ingredients.length === 0) {
            loadCategoryIngredients(categoryName);
            return { ...cat, isExpanded: willExpand, isLoading: true };
          }

          return { ...cat, isExpanded: willExpand };
        }
        return cat;
      })
    );
  };

  // Load ingredients for a specific category
  const loadCategoryIngredients = async (categoryName: string) => {
    const result = await getIngredientsByCategory(categoryName);

    if (result.success) {
      setCategories((prev) =>
        prev.map((cat) =>
          cat.category === categoryName
            ? { ...cat, ingredients: result.ingredients, isLoading: false }
            : cat
        )
      );
    } else {
      setCategories((prev) =>
        prev.map((cat) => (cat.category === categoryName ? { ...cat, isLoading: false } : cat))
      );
    }
  };

  // Handle ingredient selection
  const handleToggleIngredient = (ingredient: Ingredient, checked: boolean) => {
    if (checked) {
      onIngredientsChange([...selectedIngredients, ingredient]);
    } else {
      onIngredientsChange(selectedIngredients.filter((i) => i.id !== ingredient.id));
    }
  };

  // Select all ingredients in a category
  const handleSelectAllCategory = (categoryIngredients: Ingredient[]) => {
    const newIngredients = [...selectedIngredients];
    categoryIngredients.forEach((ingredient) => {
      if (!newIngredients.some((i) => i.id === ingredient.id)) {
        newIngredients.push(ingredient);
      }
    });
    onIngredientsChange(newIngredients);
  };

  // Clear all ingredients in a category
  const handleClearCategory = (categoryIngredients: Ingredient[]) => {
    const categoryIds = new Set(categoryIngredients.map((i) => i.id));
    onIngredientsChange(selectedIngredients.filter((i) => !categoryIds.has(i.id)));
  };

  // Check if ingredient is selected
  const isIngredientSelected = (ingredientId: string) => {
    return selectedIngredients.some((i) => i.id === ingredientId);
  };

  // Get category icon color based on category name
  const getCategoryColor = (categoryName: string): string => {
    const colorMap: Record<string, string> = {
      vegetables: 'text-green-600',
      fruits: 'text-orange-500',
      proteins: 'text-red-600',
      dairy: 'text-blue-500',
      grains: 'text-yellow-600',
      herbs: 'text-green-700',
      spices: 'text-amber-700',
      seafood: 'text-cyan-600',
      meat: 'text-red-700',
      poultry: 'text-orange-600',
    };
    return colorMap[categoryName] || 'text-jk-clay';
  };

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-jk-clay" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={loadData} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Popular Ingredients Section */}
      {popularIngredients.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-jk-olive font-heading">
              Popular Ingredients
            </h3>
            <Badge variant="secondary" className="text-xs">
              {popularIngredients.filter((i) => isIngredientSelected(i.id)).length}/
              {popularIngredients.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {popularIngredients.map((ingredient) => (
              <div key={ingredient.id} className="flex items-center gap-2 group">
                <Checkbox
                  id={`popular-${ingredient.id}`}
                  checked={isIngredientSelected(ingredient.id)}
                  onCheckedChange={(checked) =>
                    handleToggleIngredient(ingredient, checked as boolean)
                  }
                  aria-label={`Select ${ingredient.display_name}`}
                />
                <label
                  htmlFor={`popular-${ingredient.id}`}
                  className="flex-1 text-sm font-ui cursor-pointer group-hover:text-jk-olive transition-colors"
                >
                  {ingredient.display_name}
                </label>
                {ingredient.category && (
                  <Badge variant="outline" className="text-xs border-jk-sage/50">
                    {ingredient.category}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Sections */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-jk-olive font-heading mb-3">
          Browse by Category
        </h3>
        {categories.map((category) => {
          const selectedCount = category.ingredients.filter((i) =>
            isIngredientSelected(i.id)
          ).length;

          return (
            <div
              key={category.category}
              className="border border-jk-sage/30 rounded-md overflow-hidden"
            >
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.category)}
                className="w-full flex items-center justify-between p-3 hover:bg-jk-sage/10 transition-colors"
                aria-expanded={category.isExpanded}
                aria-controls={`category-${category.category}`}
              >
                <div className="flex items-center gap-2">
                  {category.isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-jk-clay" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-jk-clay" />
                  )}
                  <Package className={cn('h-4 w-4', getCategoryColor(category.category))} />
                  <span className="text-sm font-ui font-medium capitalize text-jk-olive">
                    {category.category}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {category.count}
                  </Badge>
                </div>
                {selectedCount > 0 && (
                  <Badge variant="default" className="bg-jk-tomato text-white text-xs">
                    {selectedCount} selected
                  </Badge>
                )}
              </button>

              {/* Category Content */}
              {category.isExpanded && (
                <div
                  id={`category-${category.category}`}
                  className="border-t border-jk-sage/30 bg-jk-sage/5 p-3"
                >
                  {category.isLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-jk-clay" />
                    </div>
                  ) : (
                    <>
                      {/* Category Actions */}
                      {category.ingredients.length > 0 && (
                        <div className="flex gap-2 mb-3 pb-3 border-b border-jk-sage/30">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSelectAllCategory(category.ingredients)}
                            className="text-xs h-7"
                          >
                            Select All
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleClearCategory(category.ingredients)}
                            className="text-xs h-7"
                            disabled={selectedCount === 0}
                          >
                            Clear All
                          </Button>
                        </div>
                      )}

                      {/* Ingredient List */}
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {category.ingredients.length === 0 ? (
                          <p className="text-sm text-jk-charcoal/60 text-center py-4">
                            No ingredients in this category
                          </p>
                        ) : (
                          category.ingredients.map((ingredient) => (
                            <div key={ingredient.id} className="flex items-center gap-2 group">
                              <Checkbox
                                id={`cat-${ingredient.id}`}
                                checked={isIngredientSelected(ingredient.id)}
                                onCheckedChange={(checked) =>
                                  handleToggleIngredient(ingredient, checked as boolean)
                                }
                                aria-label={`Select ${ingredient.display_name}`}
                              />
                              <label
                                htmlFor={`cat-${ingredient.id}`}
                                className="flex-1 text-sm font-ui cursor-pointer group-hover:text-jk-olive transition-colors"
                              >
                                {ingredient.display_name}
                              </label>
                              {ingredient.is_common && (
                                <Badge variant="secondary" className="text-xs">
                                  Popular
                                </Badge>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
