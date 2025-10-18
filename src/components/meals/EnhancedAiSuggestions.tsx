'use client';

import {
  ChevronDown,
  ChevronUp,
  DollarSign,
  Filter,
  Leaf,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import Image from 'next/image';
import { memo, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  getSmartMealSuggestions,
  type CourseSuggestions,
  type EnhancedRecipeSuggestion,
  type MealSuggestionsParams,
} from '@/app/actions/meal-suggestions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import type { Recipe } from '@/lib/db/schema';

interface EnhancedAiSuggestionsProps {
  description: string;
  tags: string[];
  mealType?: string;
  onAddRecipe: (recipe: Recipe, courseCategory: string) => void;
}

// Detect current season based on month
function getCurrentSeason(): 'spring' | 'summer' | 'fall' | 'winter' {
  const month = new Date().getMonth() + 1; // 1-12
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

export const EnhancedAiSuggestions = memo(function EnhancedAiSuggestions({
  description,
  tags,
  mealType,
  onAddRecipe,
}: EnhancedAiSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<CourseSuggestions>({
    appetizer: [],
    main: [],
    side: [],
    dessert: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['main']));

  // Filter state
  const [filterOpen, setFilterOpen] = useState(false);
  const [dietary, setDietary] = useState<MealSuggestionsParams['dietary']>({});
  const [maxBudget, setMaxBudget] = useState<number>(50);
  const [preferBudgetFriendly, setPreferBudgetFriendly] = useState(false);
  const [preferSeasonal, setPreferSeasonal] = useState(true);
  const [balanceProtein, setBalanceProtein] = useState(false);
  const [balanceVegetables, setBalanceVegetables] = useState(true);

  const toggleSection = useCallback((course: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(course)) {
        newSet.delete(course);
      } else {
        newSet.add(course);
      }
      return newSet;
    });
  }, []);

  const fetchSuggestions = useCallback(async () => {
    if (!description.trim()) {
      return;
    }

    setIsLoading(true);

    try {
      const params: MealSuggestionsParams = {
        description,
        tags,
        dietary: dietary && Object.keys(dietary).length > 0 ? dietary : undefined,
        budget: preferBudgetFriendly || maxBudget < 50 ? { max: maxBudget, preferBudgetFriendly } : undefined,
        nutrition: {
          balanceProtein,
          balanceVegetables,
        },
        preferSeasonal,
        currentSeason: getCurrentSeason(),
        limit: 3,
        minSimilarity: 0.4,
      };

      const result = await getSmartMealSuggestions(params);

      if (result.success && result.suggestions) {
        setSuggestions(result.suggestions);
      } else {
        toast.error(result.error || 'Failed to fetch suggestions');
      }
    } catch (error) {
      console.error('Failed to fetch AI suggestions:', error);
      toast.error('Failed to fetch recipe suggestions');
    } finally {
      setIsLoading(false);
    }
  }, [description, tags, dietary, maxBudget, preferBudgetFriendly, preferSeasonal, balanceProtein, balanceVegetables]);

  // Fetch suggestions when description or filters change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuggestions();
    }, 800); // 800ms debounce

    return () => clearTimeout(timer);
  }, [fetchSuggestions]);

  const totalSuggestions = Object.values(suggestions).reduce((sum, arr) => sum + arr.length, 0);
  const activeFiltersCount = [
    ...(dietary ? Object.values(dietary) : []),
    preferBudgetFriendly,
    preferSeasonal,
    balanceProtein,
    balanceVegetables,
  ].filter(Boolean).length;

  if (!description.trim()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-jk-olive text-2xl flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-jk-tomato" />
            Smart Recipe Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-jk-charcoal/60 font-body text-center py-8">
            Add a description to get AI-powered recipe suggestions with dietary filtering, budget awareness, and
            nutritional balance
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="font-heading text-jk-olive text-2xl flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-jk-tomato" />
            Smart Recipe Suggestions
            {totalSuggestions > 0 && (
              <Badge variant="secondary" className="ml-2 font-ui">
                {totalSuggestions}
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            {/* Filters */}
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="font-ui min-h-[44px] touch-manipulation"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-heading text-jk-olive mb-3">Dietary Preferences</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="vegetarian"
                          checked={dietary?.vegetarian || false}
                          onCheckedChange={(checked) =>
                            setDietary({ ...dietary, vegetarian: checked as boolean })
                          }
                        />
                        <Label htmlFor="vegetarian" className="font-ui text-sm">
                          Vegetarian
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="vegan"
                          checked={dietary?.vegan || false}
                          onCheckedChange={(checked) =>
                            setDietary({ ...dietary, vegan: checked as boolean })
                          }
                        />
                        <Label htmlFor="vegan" className="font-ui text-sm">
                          Vegan
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="glutenFree"
                          checked={dietary?.glutenFree || false}
                          onCheckedChange={(checked) =>
                            setDietary({ ...dietary, glutenFree: checked as boolean })
                          }
                        />
                        <Label htmlFor="glutenFree" className="font-ui text-sm">
                          Gluten-Free
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="dairyFree"
                          checked={dietary?.dairyFree || false}
                          onCheckedChange={(checked) =>
                            setDietary({ ...dietary, dairyFree: checked as boolean })
                          }
                        />
                        <Label htmlFor="dairyFree" className="font-ui text-sm">
                          Dairy-Free
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="nutFree"
                          checked={dietary?.nutFree || false}
                          onCheckedChange={(checked) =>
                            setDietary({ ...dietary, nutFree: checked as boolean })
                          }
                        />
                        <Label htmlFor="nutFree" className="font-ui text-sm">
                          Nut-Free
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="keto"
                          checked={dietary?.keto || false}
                          onCheckedChange={(checked) =>
                            setDietary({ ...dietary, keto: checked as boolean })
                          }
                        />
                        <Label htmlFor="keto" className="font-ui text-sm">
                          Keto
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-heading text-jk-olive mb-3">Nutrition</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="balanceProtein"
                          checked={balanceProtein}
                          onCheckedChange={(checked) => setBalanceProtein(checked as boolean)}
                        />
                        <Label htmlFor="balanceProtein" className="font-ui text-sm">
                          High Protein
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="balanceVegetables"
                          checked={balanceVegetables}
                          onCheckedChange={(checked) => setBalanceVegetables(checked as boolean)}
                        />
                        <Label htmlFor="balanceVegetables" className="font-ui text-sm">
                          Vegetable-Rich
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-heading text-jk-olive mb-3">Other Preferences</h4>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="preferSeasonal"
                          checked={preferSeasonal}
                          onCheckedChange={(checked) => setPreferSeasonal(checked as boolean)}
                        />
                        <Label htmlFor="preferSeasonal" className="font-ui text-sm">
                          Prefer Seasonal ({getCurrentSeason()})
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="preferBudgetFriendly"
                          checked={preferBudgetFriendly}
                          onCheckedChange={(checked) => setPreferBudgetFriendly(checked as boolean)}
                        />
                        <Label htmlFor="preferBudgetFriendly" className="font-ui text-sm">
                          Budget-Friendly
                        </Label>
                      </div>
                      <div>
                        <Label htmlFor="maxBudget" className="font-ui text-sm">
                          Max Budget: ${maxBudget}
                        </Label>
                        <Slider
                          id="maxBudget"
                          value={[maxBudget]}
                          onValueChange={(values) => setMaxBudget(values[0])}
                          min={10}
                          max={100}
                          step={5}
                          className="mt-2"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSuggestions}
              disabled={isLoading}
              className="font-ui min-h-[44px] touch-manipulation"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && totalSuggestions === 0 ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-jk-sage" />
            <p className="font-body text-jk-charcoal/60">
              Finding perfect recipes for your meal...
            </p>
          </div>
        ) : totalSuggestions === 0 ? (
          <div className="text-center py-12">
            <p className="font-body text-jk-charcoal/60">
              No suggestions found. Try adjusting your filters or adding more details.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {(['appetizer', 'main', 'side', 'dessert'] as const).map((course) => {
              const courseRecipes = suggestions[course];
              if (courseRecipes.length === 0) return null;

              const isExpanded = expandedSections.has(course);
              const courseLabel = `${course.charAt(0).toUpperCase() + course.slice(1)}s`;

              return (
                <div key={course} className="border border-jk-sage/30 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection(course)}
                    className="w-full flex items-center justify-between p-4 bg-jk-sage/5 hover:bg-jk-sage/10 transition-colors"
                  >
                    <h3 className="font-heading text-lg text-jk-olive flex items-center gap-2">
                      {courseLabel}
                      <Badge variant="secondary" className="font-ui">
                        {courseRecipes.length}
                      </Badge>
                    </h3>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-jk-olive" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-jk-olive" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {courseRecipes.map((recipe) => (
                        <EnhancedRecipeSuggestionCard
                          key={recipe.id}
                          recipe={recipe}
                          courseCategory={course}
                          onAdd={onAddRecipe}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

interface EnhancedRecipeSuggestionCardProps {
  recipe: EnhancedRecipeSuggestion;
  courseCategory: string;
  onAdd: (recipe: Recipe, courseCategory: string) => void;
}

const EnhancedRecipeSuggestionCard = memo(function EnhancedRecipeSuggestionCard({
  recipe,
  courseCategory,
  onAdd,
}: EnhancedRecipeSuggestionCardProps) {
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = useCallback(async () => {
    setIsAdding(true);
    try {
      onAdd(recipe, courseCategory);
    } finally {
      setIsAdding(false);
    }
  }, [recipe, courseCategory, onAdd]);

  // Parse images
  const images = (() => {
    try {
      return typeof recipe.images === 'string' ? JSON.parse(recipe.images) : recipe.images;
    } catch {
      return [];
    }
  })();

  const imageUrl = images?.[0] || '/placeholder-recipe.jpg';

  return (
    <div className="border border-jk-sage/30 rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white">
      <div className="relative h-32 bg-jk-sage/10">
        <Image
          src={imageUrl}
          alt={recipe.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-heading text-jk-olive font-semibold line-clamp-2 flex-1">
            {recipe.name}
          </h4>
          {recipe.score !== undefined && (
            <div className="flex items-center gap-1 text-xs text-jk-clay">
              <TrendingUp className="w-3 h-3" />
              <span className="font-ui font-semibold">{Math.round(recipe.score * 100)}%</span>
            </div>
          )}
        </div>

        <p className="text-sm text-jk-charcoal/70 font-body line-clamp-2">{recipe.description}</p>

        {/* Badges */}
        {recipe.badges && recipe.badges.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {recipe.badges.slice(0, 3).map((badge) => {
              // Assign colors based on badge type
              let badgeColor = 'bg-jk-sage/20 text-jk-olive border-jk-sage';
              if (badge.toLowerCase().includes('seasonal')) {
                badgeColor = 'bg-green-100 text-green-800 border-green-300';
              } else if (badge.toLowerCase().includes('budget')) {
                badgeColor = 'bg-blue-100 text-blue-800 border-blue-300';
              } else if (badge.toLowerCase().includes('protein') || badge.toLowerCase().includes('vegetable')) {
                badgeColor = 'bg-purple-100 text-purple-800 border-purple-300';
              }

              return (
                <Badge
                  key={badge}
                  variant="outline"
                  className={`${badgeColor} text-xs font-ui`}
                >
                  {badge.toLowerCase().includes('seasonal') && <Leaf className="w-2.5 h-2.5 mr-1" />}
                  {badge.toLowerCase().includes('budget') && <DollarSign className="w-2.5 h-2.5 mr-1" />}
                  {badge}
                </Badge>
              );
            })}
          </div>
        )}

        {/* Warnings */}
        {recipe.warnings && recipe.warnings.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {recipe.warnings.map((warning) => (
              <Badge
                key={warning}
                variant="outline"
                className="bg-yellow-50 text-yellow-800 border-yellow-300 text-xs font-ui"
              >
                ⚠️ {warning}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-2 text-xs text-jk-charcoal/60">
            {recipe.prep_time && <span className="font-ui">{recipe.prep_time}m prep</span>}
            {recipe.cook_time && <span className="font-ui">{recipe.cook_time}m cook</span>}
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={isAdding}
            className="bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui min-h-[36px] text-xs"
          >
            {isAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
          </Button>
        </div>
      </div>
    </div>
  );
});
