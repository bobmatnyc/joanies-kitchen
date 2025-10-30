'use client';

import { Filter, Search, Sparkles, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import {
  hybridSearchRecipes,
  type RecipeWithSimilarity,
  type SearchOptions,
  semanticSearchRecipes,
} from '@/app/actions/semantic-search';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { RecipeCard } from './RecipeCard';

export interface SemanticSearchPanelProps {
  initialQuery?: string;
  onResultsChange?: (count: number) => void;
}

export function SemanticSearchPanel({
  initialQuery = '',
  onResultsChange,
}: SemanticSearchPanelProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<RecipeWithSimilarity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Search options
  const [minSimilarity, setMinSimilarity] = useState(0.5);
  const [searchMode, setSearchMode] = useState<'semantic' | 'hybrid'>('semantic');
  const [cuisine, setCuisine] = useState<string | undefined>(undefined);
  const [difficulty, setDifficulty] = useState<string | undefined>(undefined);
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const options: SearchOptions = {
        minSimilarity,
        limit: 20,
        cuisine,
        difficulty: difficulty as 'easy' | 'medium' | 'hard' | undefined,
        dietaryRestrictions: dietaryRestrictions.length > 0 ? dietaryRestrictions : undefined,
        includePrivate: true,
      };

      const result =
        searchMode === 'hybrid'
          ? await hybridSearchRecipes(query, options)
          : await semanticSearchRecipes(query, options);

      if (result.success) {
        setResults(result.recipes);
        onResultsChange?.(result.recipes.length);
      } else {
        setError(result.error || 'Search failed');
        setResults([]);
      }
    } catch (err: unknown) {
      setError(err.message || 'An error occurred during search');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, minSimilarity, searchMode, cuisine, difficulty, dietaryRestrictions, onResultsChange]);

  // Handle enter key
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Clear filters
  const clearFilters = () => {
    setCuisine(undefined);
    setDifficulty(undefined);
    setDietaryRestrictions([]);
    setMinSimilarity(0.5);
  };

  // Toggle dietary restriction
  const toggleDietaryRestriction = (restriction: string) => {
    setDietaryRestrictions((prev) =>
      prev.includes(restriction) ? prev.filter((r) => r !== restriction) : [...prev, restriction]
    );
  };

  const commonDietaryTags = [
    'vegetarian',
    'vegan',
    'gluten-free',
    'dairy-free',
    'nut-free',
    'low-carb',
    'keto',
    'paleo',
  ];

  const hasActiveFilters = cuisine || difficulty || dietaryRestrictions.length > 0;

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Semantic Recipe Search
          </CardTitle>
          <CardDescription>
            Search recipes using natural language. Try queries like "comfort food for cold weather"
            or "quick healthy dinner"
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Describe what you're craving... (e.g., 'spicy comfort food')"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-9"
                disabled={loading}
              />
            </div>
            <Button onClick={handleSearch} disabled={loading || !query.trim()}>
              {loading ? 'Searching...' : 'Search'}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className={hasActiveFilters ? 'border-primary' : ''}
            >
              <Filter className="w-4 h-4" />
            </Button>
          </div>

          {/* Search Mode Toggle */}
          <div className="flex items-center gap-4">
            <Label htmlFor="search-mode" className="text-sm font-medium">
              Search Mode:
            </Label>
            <Select value={searchMode} onValueChange={(value: unknown) => setSearchMode(value)}>
              <SelectTrigger id="search-mode" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semantic">Semantic Only</SelectItem>
                <SelectItem value="hybrid">Hybrid (Semantic + Text)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1 text-xs text-muted-foreground">
              {searchMode === 'semantic'
                ? 'Pure AI-powered semantic understanding'
                : 'Combines AI understanding with keyword matching'}
            </div>
          </div>

          {/* Similarity Threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="similarity-slider" className="text-sm font-medium">
                Similarity Threshold: {(minSimilarity * 100).toFixed(0)}%
              </Label>
              <span className="text-xs text-muted-foreground">
                Higher = more precise, Lower = more results
              </span>
            </div>
            <Slider
              id="similarity-slider"
              value={[minSimilarity]}
              onValueChange={([value]) => setMinSimilarity(value)}
              min={0.1}
              max={0.9}
              step={0.05}
              disabled={loading}
            />
          </div>

          {/* Filters Section */}
          {showFilters && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Filters</h3>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
                    <X className="w-3 h-3 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cuisine Filter */}
                <div className="space-y-2">
                  <Label htmlFor="cuisine-select" className="text-sm">
                    Cuisine
                  </Label>
                  <Select
                    value={cuisine || ''}
                    onValueChange={(value) => setCuisine(value || undefined)}
                  >
                    <SelectTrigger id="cuisine-select">
                      <SelectValue placeholder="Any cuisine" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any cuisine</SelectItem>
                      <SelectItem value="Italian">Italian</SelectItem>
                      <SelectItem value="Mexican">Mexican</SelectItem>
                      <SelectItem value="Chinese">Chinese</SelectItem>
                      <SelectItem value="Japanese">Japanese</SelectItem>
                      <SelectItem value="Indian">Indian</SelectItem>
                      <SelectItem value="Thai">Thai</SelectItem>
                      <SelectItem value="French">French</SelectItem>
                      <SelectItem value="American">American</SelectItem>
                      <SelectItem value="Mediterranean">Mediterranean</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Difficulty Filter */}
                <div className="space-y-2">
                  <Label htmlFor="difficulty-select" className="text-sm">
                    Difficulty
                  </Label>
                  <Select
                    value={difficulty || ''}
                    onValueChange={(value) => setDifficulty(value || undefined)}
                  >
                    <SelectTrigger id="difficulty-select">
                      <SelectValue placeholder="Any difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any difficulty</SelectItem>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dietary Restrictions */}
              <div className="space-y-2">
                <Label className="text-sm">Dietary Restrictions</Label>
                <div className="flex flex-wrap gap-2">
                  {commonDietaryTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant={dietaryRestrictions.includes(tag) ? 'default' : 'outline'}
                      className="cursor-pointer hover:bg-primary/80"
                      onClick={() => toggleDietaryRestriction(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Found {results.length} {results.length === 1 ? 'recipe' : 'recipes'}
            </h2>
            {searchMode === 'semantic' && (
              <span className="text-sm text-muted-foreground">Sorted by similarity</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((recipe) => (
              <div key={recipe.id} className="relative">
                <RecipeCard recipe={recipe} />
                {recipe.similarity > 0 && (
                  <Badge variant="secondary" className="absolute top-2 left-2 z-10">
                    {(recipe.similarity * 100).toFixed(0)}% match
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {!loading && results.length === 0 && query && !error && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No recipes found. Try adjusting your search query or lowering the similarity
              threshold.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
