'use client';

import {
  CheckCircle2,
  ChefHat,
  Clock,
  Download,
  ExternalLink,
  Globe,
  Link,
  Loader2,
  Package,
  Search,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  bulkImportRecipes,
  importWebRecipe,
  parseRecipeFromUrl,
  searchWebRecipes,
  type WebRecipe,
} from '@/app/actions/recipe-search';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/client-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/lib/toast';

export function WebSearchPanel() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [searchResults, setSearchResults] = useState<WebRecipe[]>([]);
  const [selectedRecipes, setSelectedRecipes] = useState<Set<number>>(new Set());
  const [importingIds, setImportingIds] = useState<Set<number>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [previewRecipe, setPreviewRecipe] = useState<WebRecipe | null>(null);

  // Advanced search options
  const [cuisine, setCuisine] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [dietaryRestrictions, setDietaryRestrictions] = useState('');

  // Example searches for user inspiration
  const exampleSearches = [
    'Gordon Ramsay beef wellington',
    'authentic Thai pad thai',
    'vegan chocolate cake',
    'Jamie Oliver pasta',
    'easy weeknight dinners',
    'gluten-free breakfast ideas',
  ];

  // Helper function to detect if input is a URL
  const isValidUrl = (string: string) => {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    // Check if the search query is a URL
    if (isValidUrl(searchQuery)) {
      setIsParsing(true);
      setSearchResults([]);
      setSelectedRecipes(new Set());

      try {
        const result = await parseRecipeFromUrl(searchQuery);

        if (result.success && result.data) {
          setSearchResults([result.data]);
          toast.success('Recipe extracted from URL successfully');
        } else {
          toast.error(result.error || 'Failed to parse recipe from URL');
        }
      } catch (error) {
        toast.error('Failed to parse recipe from URL');
        console.error('Parse error:', error);
      } finally {
        setIsParsing(false);
      }
      return;
    }

    setIsSearching(true);
    setSearchResults([]);
    setSelectedRecipes(new Set());

    try {
      const result = await searchWebRecipes({
        query: searchQuery,
        cuisine: cuisine || undefined,
        ingredients: ingredients ? ingredients.split(',').map((i) => i.trim()) : undefined,
        dietaryRestrictions: dietaryRestrictions
          ? dietaryRestrictions.split(',').map((d) => d.trim())
          : undefined,
        maxResults: 8,
      });

      if (result.success && result.data) {
        setSearchResults(result.data);
        if (result.data.length === 0) {
          toast.info('No recipes found. Try different search terms.');
        } else {
          toast.success(`Found ${result.data.length} recipes`);
        }
      } else {
        toast.error(result.error || 'Search failed');
      }
    } catch (error) {
      toast.error('Failed to search recipes');
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleParseUrl = async () => {
    if (!urlInput.trim()) {
      toast.error('Please enter a recipe URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(urlInput);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    setIsParsing(true);
    try {
      const result = await parseRecipeFromUrl(urlInput);

      if (result.success && result.data) {
        setSearchResults([result.data]);
        toast.success('Recipe extracted successfully');
      } else {
        toast.error(result.error || 'Failed to parse recipe');
      }
    } catch (error) {
      toast.error('Failed to parse recipe from URL');
      console.error('Parse error:', error);
    } finally {
      setIsParsing(false);
    }
  };

  const handleImportSingle = async (recipe: WebRecipe, index: number) => {
    setImportingIds(new Set([...importingIds, index]));

    try {
      const result = await importWebRecipe(recipe);

      if (result.success && result.data) {
        toast.success(`Imported "${recipe.name}"`);
        // Navigate to the imported recipe
        router.push(`/recipes/${result.data.id}`);
      } else {
        toast.error(result.error || 'Failed to import recipe');
      }
    } catch (error) {
      toast.error('Failed to import recipe');
      console.error('Import error:', error);
    } finally {
      setImportingIds((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  const handleBulkImport = async () => {
    if (selectedRecipes.size === 0) {
      toast.error('Please select recipes to import');
      return;
    }

    const recipesToImport = Array.from(selectedRecipes).map((idx) => searchResults[idx]);

    setImportingIds(new Set(selectedRecipes));

    try {
      const result = await bulkImportRecipes(recipesToImport);

      if (result.success) {
        toast.success(result.message);
        setSelectedRecipes(new Set());
        // Optionally refresh or redirect
        router.push('/recipes');
      } else {
        toast.warning(result.message);
      }
    } catch (error) {
      toast.error('Failed to import recipes');
      console.error('Bulk import error:', error);
    } finally {
      setImportingIds(new Set());
    }
  };

  const toggleRecipeSelection = (index: number) => {
    const newSelection = new Set(selectedRecipes);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedRecipes(newSelection);
  };

  const handlePreview = (recipe: WebRecipe) => {
    setPreviewRecipe(recipe);
    setShowPreview(true);
  };

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Search Web for Recipes
          </CardTitle>
          <CardDescription>
            Find authentic recipes from food blogs, cooking sites, and chef resources
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main Search */}
          <div>
            <Label htmlFor="search">Recipe Search</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="search"
                placeholder="Search for recipes or paste a recipe URL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={isSearching || isParsing}>
                {isSearching || isParsing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Example searches */}
            {searchResults.length === 0 && !isSearching && !isParsing && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-2">Try searching for:</p>
                <div className="flex flex-wrap gap-2">
                  {exampleSearches.map((example, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setSearchQuery(example);
                        // Wait for state update then search
                        await new Promise((resolve) => setTimeout(resolve, 100));
                        if (!isSearching && !isParsing) {
                          setIsSearching(true);
                          setSearchResults([]);
                          setSelectedRecipes(new Set());

                          try {
                            const result = await searchWebRecipes({
                              query: example,
                              cuisine: cuisine || undefined,
                              ingredients: ingredients
                                ? ingredients.split(',').map((i) => i.trim())
                                : undefined,
                              dietaryRestrictions: dietaryRestrictions
                                ? dietaryRestrictions.split(',').map((d) => d.trim())
                                : undefined,
                              maxResults: 8,
                            });

                            if (result.success && result.data) {
                              setSearchResults(result.data);
                              if (result.data.length === 0) {
                                toast.info('No recipes found. Try different search terms.');
                              } else {
                                toast.success(`Found ${result.data.length} recipes`);
                              }
                            } else {
                              toast.error(result.error || 'Search failed');
                            }
                          } catch (error) {
                            toast.error('Failed to search recipes');
                            console.error('Search error:', error);
                          } finally {
                            setIsSearching(false);
                          }
                        }
                      }}
                      className="text-xs"
                    >
                      {example}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Advanced Options (collapsible) */}
          <details className="space-y-3">
            <summary className="cursor-pointer text-sm font-medium">Advanced Options</summary>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
              <div>
                <Label htmlFor="cuisine">Cuisine Type</Label>
                <Input
                  id="cuisine"
                  placeholder="Italian, Mexican, etc."
                  value={cuisine}
                  onChange={(e) => setCuisine(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ingredients">Ingredients</Label>
                <Input
                  id="ingredients"
                  placeholder="chicken, rice, tomatoes"
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dietary">Dietary Restrictions</Label>
                <Input
                  id="dietary"
                  placeholder="vegetarian, gluten-free"
                  value={dietaryRestrictions}
                  onChange={(e) => setDietaryRestrictions(e.target.value)}
                />
              </div>
            </div>
          </details>

          {/* URL Import */}
          <div className="border-t pt-4">
            <Label htmlFor="url">Or Import from Recipe URL</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="url"
                type="url"
                placeholder="https://example.com/recipe"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleParseUrl()}
                className="flex-1"
              />
              <Button onClick={handleParseUrl} disabled={isParsing} variant="outline">
                {isParsing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <>
          {/* Bulk Actions */}
          {searchResults.length > 1 && (
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {selectedRecipes.size} of {searchResults.length} selected
              </div>
              <Button
                onClick={handleBulkImport}
                disabled={selectedRecipes.size === 0 || importingIds.size > 0}
                variant="outline"
              >
                {importingIds.size > 0 ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4 mr-2" />
                    Import Selected ({selectedRecipes.size})
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Results Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {searchResults.map((recipe, index) => (
              <Card key={index} className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{recipe.name}</CardTitle>
                      {recipe.sourceName && (
                        <div className="flex items-center gap-1 mt-1">
                          <Globe className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{recipe.sourceName}</span>
                          {recipe.sourceUrl && (
                            <a
                              href={recipe.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-1"
                            >
                              <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-primary" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    {searchResults.length > 1 && (
                      <Checkbox
                        checked={selectedRecipes.has(index)}
                        onCheckedChange={() => toggleRecipeSelection(index)}
                      />
                    )}
                  </div>
                  <CardDescription className="line-clamp-2 mt-2">
                    {recipe.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {recipe.cuisine && (
                      <Badge variant="outline">
                        <ChefHat className="w-3 h-3 mr-1" />
                        {recipe.cuisine}
                      </Badge>
                    )}
                    {recipe.difficulty && <Badge variant="outline">{recipe.difficulty}</Badge>}
                    {(recipe.prepTime || recipe.cookTime) && (
                      <Badge variant="outline">
                        <Clock className="w-3 h-3 mr-1" />
                        {(recipe.prepTime || 0) + (recipe.cookTime || 0)} min
                      </Badge>
                    )}
                    {recipe.servings && (
                      <Badge variant="outline">
                        <Users className="w-3 h-3 mr-1" />
                        {recipe.servings}
                      </Badge>
                    )}
                  </div>

                  {recipe.tags && recipe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {recipe.tags.slice(0, 3).map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {recipe.tags.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{recipe.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="text-sm text-muted-foreground">
                    {recipe.ingredients.length} ingredients • {recipe.instructions.length} steps
                  </div>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button
                    onClick={() => handlePreview(recipe)}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    Preview
                  </Button>
                  <Button
                    onClick={() => handleImportSingle(recipe, index)}
                    disabled={importingIds.has(index)}
                    size="sm"
                    className="flex-1"
                  >
                    {importingIds.has(index) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-1" />
                        Import
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Loading State */}
      {(isSearching || isParsing) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {isSearching ? 'Searching the web for recipes...' : 'Extracting recipe from URL...'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recipe Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recipe Preview</DialogTitle>
            <DialogDescription>
              Review this recipe before importing it to your collection
            </DialogDescription>
          </DialogHeader>

          {previewRecipe && (
            <div className="space-y-4 py-4">
              <div>
                <h3 className="text-2xl font-semibold">{previewRecipe.name}</h3>
                {previewRecipe.description && (
                  <p className="text-muted-foreground mt-1">{previewRecipe.description}</p>
                )}
                {previewRecipe.sourceName && (
                  <div className="flex items-center gap-2 mt-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Source: {previewRecipe.sourceName}
                    </span>
                    {previewRecipe.sourceUrl && (
                      <a
                        href={previewRecipe.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        View Original
                        <ExternalLink className="w-3 h-3 inline ml-1" />
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {previewRecipe.cuisine && (
                  <Badge variant="outline">
                    <ChefHat className="w-3 h-3 mr-1" />
                    {previewRecipe.cuisine}
                  </Badge>
                )}
                {previewRecipe.difficulty && (
                  <Badge variant="outline">{previewRecipe.difficulty}</Badge>
                )}
                {(previewRecipe.prepTime || previewRecipe.cookTime) && (
                  <Badge variant="outline">
                    <Clock className="w-3 h-3 mr-1" />
                    Total: {(previewRecipe.prepTime || 0) + (previewRecipe.cookTime || 0)} min
                  </Badge>
                )}
                {previewRecipe.servings && (
                  <Badge variant="outline">
                    <Users className="w-3 h-3 mr-1" />
                    {previewRecipe.servings} servings
                  </Badge>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Ingredients</h4>
                  <ul className="space-y-1">
                    {previewRecipe.ingredients?.map((ingredient, index) => (
                      <li key={index} className="flex items-start">
                        <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 mr-2 flex-shrink-0" />
                        <span className="text-sm">{ingredient}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Instructions</h4>
                  <ol className="space-y-2">
                    {previewRecipe.instructions?.map((instruction, index) => (
                      <li key={index} className="flex">
                        <span className="font-semibold text-primary mr-2 flex-shrink-0">
                          {index + 1}.
                        </span>
                        <span className="text-sm">{instruction}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {previewRecipe.nutritionInfo &&
                Object.keys(previewRecipe.nutritionInfo).length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Nutrition Information</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {previewRecipe.nutritionInfo.calories && (
                        <div className="text-center p-2 bg-secondary/50 rounded">
                          <div className="text-sm font-medium">
                            {previewRecipe.nutritionInfo.calories}
                          </div>
                          <div className="text-xs text-muted-foreground">Calories</div>
                        </div>
                      )}
                      {previewRecipe.nutritionInfo.protein && (
                        <div className="text-center p-2 bg-secondary/50 rounded">
                          <div className="text-sm font-medium">
                            {previewRecipe.nutritionInfo.protein}g
                          </div>
                          <div className="text-xs text-muted-foreground">Protein</div>
                        </div>
                      )}
                      {previewRecipe.nutritionInfo.carbs && (
                        <div className="text-center p-2 bg-secondary/50 rounded">
                          <div className="text-sm font-medium">
                            {previewRecipe.nutritionInfo.carbs}g
                          </div>
                          <div className="text-xs text-muted-foreground">Carbs</div>
                        </div>
                      )}
                      {previewRecipe.nutritionInfo.fat && (
                        <div className="text-center p-2 bg-secondary/50 rounded">
                          <div className="text-sm font-medium">
                            {previewRecipe.nutritionInfo.fat}g
                          </div>
                          <div className="text-xs text-muted-foreground">Fat</div>
                        </div>
                      )}
                      {previewRecipe.nutritionInfo.fiber && (
                        <div className="text-center p-2 bg-secondary/50 rounded">
                          <div className="text-sm font-medium">
                            {previewRecipe.nutritionInfo.fiber}g
                          </div>
                          <div className="text-xs text-muted-foreground">Fiber</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {previewRecipe.tags && previewRecipe.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {previewRecipe.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
            {previewRecipe && (
              <Button
                onClick={() => {
                  const index = searchResults.indexOf(previewRecipe);
                  if (index !== -1) {
                    handleImportSingle(previewRecipe, index);
                    setShowPreview(false);
                  }
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Import Recipe
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
