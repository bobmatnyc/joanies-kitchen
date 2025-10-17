'use client';

import { ChevronDown, ChevronUp, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { memo, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { type RecipeWithSimilarity, semanticSearchRecipes } from '@/app/actions/semantic-search';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Recipe } from '@/lib/db/schema';
import { deduplicateAcrossCourses } from '@/lib/meals/recipe-classification';

interface CourseSuggestions {
  appetizer: RecipeWithSimilarity[];
  main: RecipeWithSimilarity[];
  side: RecipeWithSimilarity[];
  dessert: RecipeWithSimilarity[];
}

interface AiRecipeSuggestionsProps {
  description: string;
  tags: string[];
  onAddRecipe: (recipe: Recipe, courseCategory: string) => void;
}

// Course-specific limits for suggestions
const COURSE_LIMITS = {
  appetizer: 3,
  main: 3,
  side: 4,
  dessert: 3,
} as const;

export const AiRecipeSuggestions = memo(function AiRecipeSuggestions({
  description,
  tags,
  onAddRecipe,
}: AiRecipeSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<CourseSuggestions>({
    appetizer: [],
    main: [],
    side: [],
    dessert: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['main']));

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
      // Build search query from description and tags
      const tagsQuery = tags.length > 0 ? ` ${tags.join(' ')}` : '';
      const baseQuery = `${description}${tagsQuery}`;

      // Fetch suggestions for each course category
      const [appetizerResult, mainResult, sideResult, dessertResult] = await Promise.all([
        semanticSearchRecipes(`${baseQuery} appetizer starter`, {
          limit: COURSE_LIMITS.appetizer,
          minSimilarity: 0.4,
          includePrivate: true,
        }),
        semanticSearchRecipes(`${baseQuery} main dish entree`, {
          limit: COURSE_LIMITS.main,
          minSimilarity: 0.4,
          includePrivate: true,
        }),
        semanticSearchRecipes(`${baseQuery} side dish`, {
          limit: COURSE_LIMITS.side,
          minSimilarity: 0.4,
          includePrivate: true,
        }),
        semanticSearchRecipes(`${baseQuery} dessert sweet`, {
          limit: COURSE_LIMITS.dessert,
          minSimilarity: 0.4,
          includePrivate: true,
        }),
      ]);

      // Combine all results before deduplication
      const rawSuggestions = {
        appetizer: appetizerResult.success ? appetizerResult.recipes : [],
        main: mainResult.success ? mainResult.recipes : [],
        side: sideResult.success ? sideResult.recipes : [],
        dessert: dessertResult.success ? dessertResult.recipes : [],
        salad: [],
        soup: [],
        bread: [],
        drink: [],
        other: [],
      };

      // Deduplicate recipes across courses - each recipe appears only in its best-fit course
      const deduplicated = deduplicateAcrossCourses(rawSuggestions);

      setSuggestions({
        appetizer: deduplicated.appetizer,
        main: deduplicated.main,
        side: deduplicated.side,
        dessert: deduplicated.dessert,
      });
    } catch (error) {
      console.error('Failed to fetch AI suggestions:', error);
      toast.error('Failed to fetch recipe suggestions');
    } finally {
      setIsLoading(false);
    }
  }, [description, tags]);

  // Fetch suggestions when description or tags change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuggestions();
    }, 800); // 800ms debounce

    return () => clearTimeout(timer);
  }, [fetchSuggestions]);

  const totalSuggestions = Object.values(suggestions).reduce((sum, arr) => sum + arr.length, 0);

  if (!description.trim()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-jk-olive text-2xl flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-jk-tomato" />
            AI Recipe Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-jk-charcoal/60 font-body text-center py-8">
            Add a description to get AI-powered recipe suggestions
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
            AI Recipe Suggestions
            {totalSuggestions > 0 && (
              <Badge variant="secondary" className="ml-2 font-ui">
                {totalSuggestions}
              </Badge>
            )}
          </CardTitle>
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
              No suggestions found. Try adding more details to your description.
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
                        <RecipeSuggestionCard
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

interface RecipeSuggestionCardProps {
  recipe: RecipeWithSimilarity;
  courseCategory: string;
  onAdd: (recipe: Recipe, courseCategory: string) => void;
}

const RecipeSuggestionCard = memo(function RecipeSuggestionCard({
  recipe,
  courseCategory,
  onAdd,
}: RecipeSuggestionCardProps) {
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
        <h4 className="font-heading text-jk-olive font-semibold line-clamp-2">{recipe.name}</h4>
        <p className="text-sm text-jk-charcoal/70 font-body line-clamp-2">{recipe.description}</p>
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
