'use client';

/**
 * Recipe Discovery Panel - Enhanced UI Component
 *
 * Integrates with the complete discovery pipeline:
 * - Brave Search for finding recipes
 * - LLM validation and extraction
 * - Automatic tagging and metadata generation
 * - Embedding generation
 * - Full provenance tracking
 */

import {
  AlertCircle,
  CheckCircle2,
  ChefHat,
  Clock,
  Database,
  ExternalLink,
  Globe,
  Info,
  Loader2,
  Search,
  Sparkles,
  Tag,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  type DiscoveryResult,
  discoverRecipeFromUrl,
  discoverRecipes,
} from '@/app/actions/recipe-discovery';
import { RequireAuthAI } from '@/components/auth/RequireAuth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import type { Recipe } from '@/lib/db/schema';
import { toast } from '@/lib/toast';

interface PipelineProgress {
  step: 'searching' | 'validating' | 'tagging' | 'embedding' | 'saving' | 'complete';
  currentIndex: number;
  totalItems: number;
  message: string;
}

export function RecipeDiscoveryPanel() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [_urlInput, _setUrlInput] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryResult | null>(null);
  const [discoveredRecipes, setDiscoveredRecipes] = useState<Recipe[]>([]);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [showRecipe, setShowRecipe] = useState<Recipe | null>(null);

  // Advanced search options
  const [cuisine, setCuisine] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [dietaryRestrictions, setDietaryRestrictions] = useState('');
  const [maxResults, setMaxResults] = useState(5);
  const [minConfidence, setMinConfidence] = useState(0.6);

  // Example searches
  const exampleSearches = [
    'authentic Italian carbonara',
    'healthy Thai curry',
    'quick weeknight pasta',
    'vegan chocolate dessert',
    'gluten-free breakfast',
    'comfort food casseroles',
  ];

  // Check if input is a URL
  const isValidUrl = (string: string) => {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Handle discovery
  const handleDiscover = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    // Check if it's a URL
    if (isValidUrl(searchQuery)) {
      await handleDiscoverFromUrl(searchQuery);
      return;
    }

    setIsDiscovering(true);
    setDiscoveryResults(null);
    setDiscoveredRecipes([]);
    setProgress({
      step: 'searching',
      currentIndex: 0,
      totalItems: 0,
      message: 'Searching for recipes...',
    });

    try {
      const result = await discoverRecipes(searchQuery, {
        cuisine: cuisine || undefined,
        ingredients: ingredients ? ingredients.split(',').map((i) => i.trim()) : undefined,
        dietaryRestrictions: dietaryRestrictions
          ? dietaryRestrictions.split(',').map((d) => d.trim())
          : undefined,
        maxResults,
        minConfidence,
      });

      setDiscoveryResults(result);
      setDiscoveredRecipes(result.recipes);
      setProgress({
        step: 'complete',
        currentIndex: result.stats.saved,
        totalItems: result.stats.searched,
        message: 'Discovery complete!',
      });

      if (result.success) {
        if (result.recipes.length === 0) {
          toast.info('No recipes found. Try different search terms.');
        } else {
          toast.success(`Discovered ${result.recipes.length} recipes!`);
        }
      } else {
        toast.error('Discovery failed. Check the errors below.');
      }
    } catch (error) {
      console.error('Discovery error:', error);
      toast.error('Failed to discover recipes');
      setProgress(null);
    } finally {
      setIsDiscovering(false);
    }
  };

  // Handle single URL discovery
  const handleDiscoverFromUrl = async (url: string) => {
    setIsDiscovering(true);
    setDiscoveryResults(null);
    setDiscoveredRecipes([]);
    setProgress({
      step: 'validating',
      currentIndex: 1,
      totalItems: 1,
      message: 'Extracting recipe from URL...',
    });

    try {
      const result = await discoverRecipeFromUrl(url);

      if (result.success && result.recipe) {
        setDiscoveredRecipes([result.recipe]);
        setDiscoveryResults({
          success: true,
          recipes: [result.recipe],
          stats: {
            searched: 1,
            validated: 1,
            saved: 1,
            failed: 0,
            skipped: 0,
          },
        });
        setProgress({
          step: 'complete',
          currentIndex: 1,
          totalItems: 1,
          message: 'Recipe extracted successfully!',
        });
        toast.success('Recipe discovered and saved!');
      } else {
        toast.error(result.error || 'Failed to extract recipe from URL');
        setProgress(null);
      }
    } catch (error) {
      console.error('URL discovery error:', error);
      toast.error('Failed to extract recipe from URL');
      setProgress(null);
    } finally {
      setIsDiscovering(false);
    }
  };

  // Parse ingredients/instructions JSON
  const parseJsonField = (field: string | null): string[] => {
    if (!field) return [];
    try {
      return JSON.parse(field);
    } catch {
      return [];
    }
  };

  const parseTags = (tags: string | null): string[] => {
    if (!tags) return [];
    try {
      return JSON.parse(tags);
    } catch {
      return [];
    }
  };

  return (
    <RequireAuthAI
      featureName="Recipe Discovery Pipeline"
      description="Discover, validate, and import recipes from the web using our AI-powered pipeline. Search recipe sites, extract data with LLMs, and build your collection automatically."
    >
      <div className="space-y-6">
        {/* Search Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI-Powered Recipe Discovery
            </CardTitle>
            <CardDescription>
              Intelligent recipe discovery with automatic validation, tagging, and semantic search
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Main Search */}
            <div>
              <Label htmlFor="search">Search Query or Recipe URL</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="search"
                  placeholder="Search recipes or paste URL..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isDiscovering && handleDiscover()}
                  className="flex-1"
                />
                <Button onClick={handleDiscover} disabled={isDiscovering}>
                  {isDiscovering ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {/* Example searches */}
              {!isDiscovering && discoveredRecipes.length === 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-2">Try searching for:</p>
                  <div className="flex flex-wrap gap-2">
                    {exampleSearches.map((example, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearchQuery(example);
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

            {/* Advanced Options */}
            <details className="space-y-3">
              <summary className="cursor-pointer text-sm font-medium hover:text-primary">
                Advanced Options
              </summary>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
                <div>
                  <Label htmlFor="cuisine">Cuisine Type</Label>
                  <Input
                    id="cuisine"
                    placeholder="Italian, Thai, Mexican..."
                    value={cuisine}
                    onChange={(e) => setCuisine(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="ingredients">Ingredients (comma-separated)</Label>
                  <Input
                    id="ingredients"
                    placeholder="chicken, rice, garlic"
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
                <div>
                  <Label htmlFor="maxResults">Max Results ({maxResults})</Label>
                  <Input
                    id="maxResults"
                    type="number"
                    min="1"
                    max="10"
                    value={maxResults}
                    onChange={(e) => setMaxResults(parseInt(e.target.value, 10) || 5)}
                  />
                </div>
                <div>
                  <Label htmlFor="minConfidence">
                    Min Confidence ({(minConfidence * 100).toFixed(0)}%)
                  </Label>
                  <Input
                    id="minConfidence"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </details>
          </CardContent>
        </Card>

        {/* Pipeline Progress */}
        {isDiscovering && progress && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="font-medium">{progress.message}</span>
                  </div>
                  {progress.totalItems > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {progress.currentIndex} / {progress.totalItems}
                    </span>
                  )}
                </div>

                {/* Progress Steps */}
                <div className="flex items-center gap-2 text-sm">
                  <div
                    className={`flex items-center gap-1 ${progress.step === 'searching' ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    <Search className="w-4 h-4" />
                    <span>Search</span>
                  </div>
                  <div className="flex-1 h-px bg-border" />
                  <div
                    className={`flex items-center gap-1 ${progress.step === 'validating' ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Validate</span>
                  </div>
                  <div className="flex-1 h-px bg-border" />
                  <div
                    className={`flex items-center gap-1 ${progress.step === 'tagging' ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    <Tag className="w-4 h-4" />
                    <span>Tag</span>
                  </div>
                  <div className="flex-1 h-px bg-border" />
                  <div
                    className={`flex items-center gap-1 ${progress.step === 'embedding' ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span>Embed</span>
                  </div>
                  <div className="flex-1 h-px bg-border" />
                  <div
                    className={`flex items-center gap-1 ${progress.step === 'saving' ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    <Database className="w-4 h-4" />
                    <span>Save</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Discovery Stats */}
        {discoveryResults && !isDiscovering && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Discovery Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {discoveryResults.stats.searched}
                  </div>
                  <div className="text-xs text-muted-foreground">Searched</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {discoveryResults.stats.validated}
                  </div>
                  <div className="text-xs text-muted-foreground">Validated</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {discoveryResults.stats.saved}
                  </div>
                  <div className="text-xs text-muted-foreground">Saved</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {discoveryResults.stats.skipped}
                  </div>
                  <div className="text-xs text-muted-foreground">Skipped</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {discoveryResults.stats.failed}
                  </div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
              </div>

              {/* Errors */}
              {discoveryResults.errors && discoveryResults.errors.length > 0 && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Some recipes could not be processed</AlertTitle>
                  <AlertDescription>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium">
                        View {discoveryResults.errors.length} error(s)
                      </summary>
                      <ul className="mt-2 space-y-1 text-xs">
                        {discoveryResults.errors.slice(0, 5).map((error, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span>
                              <strong>{error.step}:</strong> {error.error}
                              {error.url !== 'pipeline' && (
                                <a
                                  href={error.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-1 underline"
                                >
                                  (link)
                                </a>
                              )}
                            </span>
                          </li>
                        ))}
                        {discoveryResults.errors.length > 5 && (
                          <li className="text-muted-foreground">
                            ...and {discoveryResults.errors.length - 5} more
                          </li>
                        )}
                      </ul>
                    </details>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Discovered Recipes */}
        {discoveredRecipes.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Discovered Recipes</h3>
              <Badge variant="outline">{discoveredRecipes.length} found</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {discoveredRecipes.map((recipe) => (
                <Card key={recipe.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{recipe.name}</CardTitle>
                        <CardDescription className="line-clamp-2 mt-2">
                          {recipe.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Recipe Info */}
                    <div className="flex flex-wrap gap-2">
                      {recipe.cuisine && (
                        <Badge variant="outline">
                          <ChefHat className="w-3 h-3 mr-1" />
                          {recipe.cuisine}
                        </Badge>
                      )}
                      {recipe.difficulty && <Badge variant="outline">{recipe.difficulty}</Badge>}
                      {(recipe.prep_time || recipe.cook_time) && (
                        <Badge variant="outline">
                          <Clock className="w-3 h-3 mr-1" />
                          {(recipe.prep_time || 0) + (recipe.cook_time || 0)} min
                        </Badge>
                      )}
                      {recipe.servings && (
                        <Badge variant="outline">
                          <Users className="w-3 h-3 mr-1" />
                          {recipe.servings}
                        </Badge>
                      )}
                    </div>

                    {/* Tags */}
                    {parseTags(recipe.tags).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {parseTags(recipe.tags)
                          .slice(0, 4)
                          .map((tag, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        {parseTags(recipe.tags).length > 4 && (
                          <Badge variant="secondary" className="text-xs">
                            +{parseTags(recipe.tags).length - 4}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Provenance Info */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
                      {recipe.confidence_score && (
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          <span>
                            {(parseFloat(recipe.confidence_score) * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                      )}
                      {recipe.embedding_model && (
                        <div className="flex items-center gap-1">
                          <Database className="w-3 h-3" />
                          <span>Vector indexed</span>
                        </div>
                      )}
                    </div>

                    {/* Source Link */}
                    {recipe.source && (
                      <div className="flex items-center gap-1 text-xs">
                        <Globe className="w-3 h-3 text-muted-foreground" />
                        <a
                          href={recipe.source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline truncate"
                        >
                          View source
                          <ExternalLink className="w-3 h-3 inline ml-1" />
                        </a>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="gap-2">
                    <Button
                      onClick={() => setShowRecipe(recipe)}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Info className="w-4 h-4 mr-1" />
                      Preview
                    </Button>
                    <Button
                      onClick={() => router.push(`/recipes/${recipe.id}`)}
                      size="sm"
                      className="flex-1"
                    >
                      View Recipe
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Recipe Preview Dialog */}
        <Dialog open={!!showRecipe} onOpenChange={() => setShowRecipe(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{showRecipe?.name}</DialogTitle>
              <DialogDescription>{showRecipe?.description}</DialogDescription>
            </DialogHeader>

            {showRecipe && (
              <div className="space-y-4 py-4">
                {/* Recipe Info */}
                <div className="flex flex-wrap gap-2">
                  {showRecipe.cuisine && (
                    <Badge variant="outline">
                      <ChefHat className="w-3 h-3 mr-1" />
                      {showRecipe.cuisine}
                    </Badge>
                  )}
                  {showRecipe.difficulty && (
                    <Badge variant="outline">{showRecipe.difficulty}</Badge>
                  )}
                  {(showRecipe.prep_time || showRecipe.cook_time) && (
                    <Badge variant="outline">
                      <Clock className="w-3 h-3 mr-1" />
                      Total: {(showRecipe.prep_time || 0) + (showRecipe.cook_time || 0)} min
                    </Badge>
                  )}
                  {showRecipe.servings && (
                    <Badge variant="outline">
                      <Users className="w-3 h-3 mr-1" />
                      {showRecipe.servings} servings
                    </Badge>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Ingredients */}
                  <div>
                    <h4 className="font-semibold mb-2">Ingredients</h4>
                    <ul className="space-y-1">
                      {parseJsonField(showRecipe.ingredients).map((ingredient, index) => (
                        <li key={index} className="flex items-start">
                          <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 mr-2 flex-shrink-0" />
                          <span className="text-sm">{ingredient}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Instructions */}
                  <div>
                    <h4 className="font-semibold mb-2">Instructions</h4>
                    <ol className="space-y-2">
                      {parseJsonField(showRecipe.instructions).map((instruction, index) => (
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

                {/* Provenance Information */}
                <div className="border-t pt-4 space-y-2">
                  <h4 className="font-semibold text-sm">Discovery Information</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    {showRecipe.confidence_score && (
                      <div>
                        <strong>Confidence Score:</strong>{' '}
                        {(parseFloat(showRecipe.confidence_score) * 100).toFixed(0)}%
                      </div>
                    )}
                    {showRecipe.validation_model && (
                      <div>
                        <strong>Validation Model:</strong>{' '}
                        {showRecipe.validation_model.split('/').pop()}
                      </div>
                    )}
                    {showRecipe.embedding_model && (
                      <div>
                        <strong>Embedding Model:</strong>{' '}
                        {showRecipe.embedding_model.split('/').pop()}
                      </div>
                    )}
                    {showRecipe.discovery_date && (
                      <div>
                        <strong>Discovered:</strong>{' '}
                        {new Date(showRecipe.discovery_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRecipe(null)}>
                Close
              </Button>
              {showRecipe && (
                <Button onClick={() => router.push(`/recipes/${showRecipe.id}`)}>
                  View Full Recipe
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RequireAuthAI>
  );
}
