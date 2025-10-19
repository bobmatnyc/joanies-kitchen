'use client';

import {
  ChefHat,
  Clock,
  Cpu,
  Globe,
  Loader2,
  Plus,
  Save,
  Search,
  Sparkles,
  Tag,
  TrendingUp,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { discoverRecipe, saveDiscoveredRecipe } from '@/app/actions/ai-recipes';
import { getAllTags } from '@/app/actions/recipes';
import { RequireAuthAI } from '@/components/auth/RequireAuth';
import { WebSearchPanel } from '@/components/recipe/WebSearchPanel';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MODEL_CATEGORIES, MODELS } from '@/lib/ai/openrouter';
import { toast } from '@/lib/toast';

export default function DiscoverPage() {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [popularTags, setPopularTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Form state
  const [query, setQuery] = useState('');
  const [ingredients, setIngredients] = useState<string[]>(['']);
  const [cuisine, setCuisine] = useState('');
  const [mealType, setMealType] = useState('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [servings, setServings] = useState<string>('');
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>(['']);
  const [selectedModel, setSelectedModel] = useState<string>(MODELS.PERPLEXITY_SONAR);
  const [useWebSearch, setUseWebSearch] = useState(true);

  // Load popular tags on mount
  useEffect(() => {
    const loadTags = async () => {
      try {
        const result = await getAllTags();
        if (result.success && result.data) {
          // Get top 20 most popular tags
          const topTags = result.data.tags.slice(0, 20);
          setPopularTags(topTags);
        }
      } catch (error) {
        console.error('Failed to load tags:', error);
      }
    };
    loadTags();
  }, []);

  const handleTagClick = (tag: string) => {
    const normalizedTag = tag.toLowerCase();
    if (selectedTags.includes(normalizedTag)) {
      setSelectedTags(selectedTags.filter((t) => t !== normalizedTag));
    } else {
      setSelectedTags([...selectedTags, normalizedTag]);
    }
  };

  const handleAddIngredient = () => {
    setIngredients([...ingredients, '']);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleIngredientChange = (index: number, value: string) => {
    const updated = [...ingredients];
    updated[index] = value;
    setIngredients(updated);
  };

  const handleAddRestriction = () => {
    setDietaryRestrictions([...dietaryRestrictions, '']);
  };

  const handleRemoveRestriction = (index: number) => {
    setDietaryRestrictions(dietaryRestrictions.filter((_, i) => i !== index));
  };

  const handleRestrictionChange = (index: number, value: string) => {
    const updated = [...dietaryRestrictions];
    updated[index] = value;
    setDietaryRestrictions(updated);
  };

  const handleDiscover = async () => {
    setIsGenerating(true);
    try {
      // Build query including selected tags
      let enhancedQuery = query;
      if (selectedTags.length > 0) {
        const tagString = selectedTags.join(', ');
        enhancedQuery = query ? `${query} (tags: ${tagString})` : `Recipe with tags: ${tagString}`;
      }

      const result = await discoverRecipe({
        query: enhancedQuery || undefined,
        ingredients: ingredients.filter((i) => i.trim()),
        cuisine: cuisine || undefined,
        mealType: mealType || undefined,
        difficulty: (difficulty as any) || undefined,
        servings: servings ? parseInt(servings, 10) : undefined,
        dietaryRestrictions: [...dietaryRestrictions.filter((r) => r.trim()), ...selectedTags],
        model: selectedModel,
        useWebSearch: useWebSearch,
      });

      if (result.success && result.data) {
        setGeneratedRecipe(result.data);
        setShowPreview(true);
      } else {
        toast.error(result.error || 'Failed to generate recipe');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
      console.error('Discover error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveRecipe = async () => {
    if (!generatedRecipe) return;

    setIsSaving(true);
    try {
      const result = await saveDiscoveredRecipe(generatedRecipe);
      if (result.success && result.data) {
        toast.success('Recipe saved successfully!');
        router.push(`/recipes/${result.data.id}`);
      } else {
        toast.error(result.error || 'Failed to save recipe');
      }
    } catch (error) {
      toast.error('Failed to save recipe');
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <RequireAuthAI
      featureName="AI Recipe Discovery"
      description="Generate custom recipes with AI based on your preferences, or search the web for authentic recipes from top food blogs and chefs. Sign in to start discovering!"
    >
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Discover Recipes</h1>
          <p className="text-muted-foreground">
            Generate AI recipes or search the web for authentic recipes from food blogs and chef
            resources
          </p>
        </div>

        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate" className="flex items-center gap-2">
              <Wand2 className="w-4 h-4" />
              Generate Recipe
            </TabsTrigger>
            <TabsTrigger value="search" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Search Web
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-6 mt-6">
            {/* Quick Search */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Search</CardTitle>
                <CardDescription>
                  Describe what you're looking for or leave blank for suggestions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="e.g., 'healthy breakfast with eggs' or 'Italian pasta dinner'"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Popular Tags */}
            {popularTags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Popular Tags
                  </CardTitle>
                  <CardDescription>Click tags to filter your recipe generation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {popularTags.map((tag) => {
                      const isSelected = selectedTags.includes(tag.toLowerCase());
                      return (
                        <Badge
                          key={tag}
                          variant={isSelected ? 'default' : 'outline'}
                          className="cursor-pointer transition-all hover:scale-105 capitalize"
                          onClick={() => handleTagClick(tag)}
                        >
                          {isSelected && <X className="w-3 h-3 mr-1" />}
                          {tag}
                        </Badge>
                      );
                    })}
                  </div>
                  {selectedTags.length > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Selected: {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedTags([])}
                        className="ml-auto"
                      >
                        Clear all
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Advanced Options */}
            <Card>
              <CardHeader>
                <CardTitle>Advanced Options</CardTitle>
                <CardDescription>Refine your recipe discovery</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Ingredients */}
                <div>
                  <Label>Available Ingredients</Label>
                  <div className="space-y-2 mt-2">
                    {ingredients.map((ingredient, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={ingredient}
                          onChange={(e) => handleIngredientChange(index, e.target.value)}
                          placeholder="e.g., chicken, rice, tomatoes"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleRemoveIngredient(index)}
                          disabled={ingredients.length === 1}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddIngredient}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Ingredient
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Cuisine */}
                  <div>
                    <Label htmlFor="cuisine">Cuisine Type</Label>
                    <Input
                      id="cuisine"
                      value={cuisine}
                      onChange={(e) => setCuisine(e.target.value)}
                      placeholder="e.g., Italian, Mexican, Asian"
                    />
                  </div>

                  {/* Meal Type */}
                  <div>
                    <Label htmlFor="mealType">Meal Type</Label>
                    <Select value={mealType} onValueChange={setMealType}>
                      <SelectTrigger id="mealType">
                        <SelectValue placeholder="Select meal type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="breakfast">Breakfast</SelectItem>
                        <SelectItem value="lunch">Lunch</SelectItem>
                        <SelectItem value="dinner">Dinner</SelectItem>
                        <SelectItem value="snack">Snack</SelectItem>
                        <SelectItem value="dessert">Dessert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Difficulty */}
                  <div>
                    <Label htmlFor="difficulty">Difficulty Level</Label>
                    <Select value={difficulty} onValueChange={setDifficulty}>
                      <SelectTrigger id="difficulty">
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Servings */}
                  <div>
                    <Label htmlFor="servings">Number of Servings</Label>
                    <Input
                      id="servings"
                      type="number"
                      min="1"
                      max="12"
                      value={servings}
                      onChange={(e) => setServings(e.target.value)}
                      placeholder="e.g., 4"
                    />
                  </div>
                </div>

                {/* Dietary Restrictions */}
                <div>
                  <Label>Dietary Restrictions</Label>
                  <div className="space-y-2 mt-2">
                    {dietaryRestrictions.map((restriction, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={restriction}
                          onChange={(e) => handleRestrictionChange(index, e.target.value)}
                          placeholder="e.g., vegetarian, gluten-free, nut-free"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleRemoveRestriction(index)}
                          disabled={dietaryRestrictions.length === 1}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddRestriction}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Restriction
                    </Button>
                  </div>
                </div>

                {/* Model Selection */}
                <div>
                  <Label htmlFor="model">AI Model</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger id="model">
                      <SelectValue placeholder="Select AI model" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MODEL_CATEGORIES).map(([category, models]) => (
                        <div key={category}>
                          <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                            {category}
                          </div>
                          {models.map((model) => (
                            <SelectItem key={model.value} value={model.value}>
                              <div className="flex items-center gap-2">
                                {category === 'Web Search Enabled' && <Globe className="w-3 h-3" />}
                                {category === 'Vision & Multimodal' && <Cpu className="w-3 h-3" />}
                                {model.label}
                              </div>
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Web Search Option (only for compatible models) */}
                  {selectedModel.includes('sonar') && (
                    <div className="flex items-center space-x-2 mt-2">
                      <Checkbox
                        id="webSearch"
                        checked={useWebSearch}
                        onCheckedChange={(checked) => setUseWebSearch(checked as boolean)}
                      />
                      <Label htmlFor="webSearch" className="text-sm font-normal cursor-pointer">
                        Enable web search for authentic and trending recipes
                      </Label>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handleDiscover}
                  disabled={isGenerating}
                  className="w-full"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Recipe...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Discover Recipe
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="search" className="mt-6">
            <WebSearchPanel />
          </TabsContent>
        </Tabs>

        {/* Recipe Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Recipe Preview</DialogTitle>
              <DialogDescription>
                Review the generated recipe before saving it to your collection
              </DialogDescription>
            </DialogHeader>

            {generatedRecipe && (
              <div className="space-y-4 py-4">
                <div>
                  <h3 className="text-2xl font-semibold">{generatedRecipe.name}</h3>
                  {generatedRecipe.description && (
                    <p className="text-muted-foreground mt-1">{generatedRecipe.description}</p>
                  )}
                  {generatedRecipe.modelUsed && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Generated with: {generatedRecipe.modelUsed}
                    </p>
                  )}
                  {generatedRecipe.source && (
                    <p className="text-xs text-muted-foreground">
                      Source: {generatedRecipe.source}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {generatedRecipe.cuisine && (
                    <Badge variant="outline">
                      <ChefHat className="w-3 h-3 mr-1" />
                      {generatedRecipe.cuisine}
                    </Badge>
                  )}
                  {generatedRecipe.difficulty && (
                    <Badge variant="outline">{generatedRecipe.difficulty}</Badge>
                  )}
                  {(generatedRecipe.prepTime || generatedRecipe.cookTime) && (
                    <Badge variant="outline">
                      <Clock className="w-3 h-3 mr-1" />
                      {generatedRecipe.prepTime + generatedRecipe.cookTime} min
                    </Badge>
                  )}
                  {generatedRecipe.servings && (
                    <Badge variant="outline">
                      <Users className="w-3 h-3 mr-1" />
                      {generatedRecipe.servings} servings
                    </Badge>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Ingredients</h4>
                    <ul className="space-y-1">
                      {generatedRecipe.ingredients?.map((ingredient: string, index: number) => (
                        <li key={index} className="flex items-start">
                          <span className="inline-block w-2 h-2 bg-primary rounded-full mt-1.5 mr-2 flex-shrink-0" />
                          <span className="text-sm">{ingredient}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Instructions</h4>
                    <ol className="space-y-2">
                      {generatedRecipe.instructions?.map((instruction: string, index: number) => (
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

                {generatedRecipe.nutritionInfo &&
                  Object.keys(generatedRecipe.nutritionInfo).length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Nutrition Information</h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {generatedRecipe.nutritionInfo.calories && (
                          <div className="text-center p-2 bg-secondary/50 rounded">
                            <div className="text-sm font-medium">
                              {generatedRecipe.nutritionInfo.calories}
                            </div>
                            <div className="text-xs text-muted-foreground">Calories</div>
                          </div>
                        )}
                        {generatedRecipe.nutritionInfo.protein && (
                          <div className="text-center p-2 bg-secondary/50 rounded">
                            <div className="text-sm font-medium">
                              {generatedRecipe.nutritionInfo.protein}g
                            </div>
                            <div className="text-xs text-muted-foreground">Protein</div>
                          </div>
                        )}
                        {generatedRecipe.nutritionInfo.carbs && (
                          <div className="text-center p-2 bg-secondary/50 rounded">
                            <div className="text-sm font-medium">
                              {generatedRecipe.nutritionInfo.carbs}g
                            </div>
                            <div className="text-xs text-muted-foreground">Carbs</div>
                          </div>
                        )}
                        {generatedRecipe.nutritionInfo.fat && (
                          <div className="text-center p-2 bg-secondary/50 rounded">
                            <div className="text-sm font-medium">
                              {generatedRecipe.nutritionInfo.fat}g
                            </div>
                            <div className="text-xs text-muted-foreground">Fat</div>
                          </div>
                        )}
                        {generatedRecipe.nutritionInfo.fiber && (
                          <div className="text-center p-2 bg-secondary/50 rounded">
                            <div className="text-sm font-medium">
                              {generatedRecipe.nutritionInfo.fiber}g
                            </div>
                            <div className="text-xs text-muted-foreground">Fiber</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                {generatedRecipe.tags && generatedRecipe.tags.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {generatedRecipe.tags.map((tag: string, index: number) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRecipe} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Recipe
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RequireAuthAI>
  );
}
