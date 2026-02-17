'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ingestSystemRecipe } from '@/app/actions/system-recipe-ingestion';
import { getChefsList, saveIngestedRecipe } from '@/app/actions/recipe-ingestion';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import type { IngestedRecipe } from '@/lib/ai/recipe-ingestion-parser';

type IngestionStep = 'input' | 'processing' | 'preview' | 'saving' | 'complete';
type InputType = 'url' | 'text';

export default function SystemRecipeIngestPage() {
  const router = useRouter();
  const [step, setStep] = useState<IngestionStep>('input');
  const [inputType, setInputType] = useState<InputType>('url');
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [parsedRecipe, setParsedRecipe] = useState<IngestedRecipe | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [chefsList, setChefsList] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [savedRecipeId, setSavedRecipeId] = useState<string>('');

  // Editable form fields
  const [editableName, setEditableName] = useState('');
  const [editableDescription, setEditableDescription] = useState('');
  const [editableIngredients, setEditableIngredients] = useState('');
  const [editableInstructions, setEditableInstructions] = useState('');
  const [editablePrepTime, setEditablePrepTime] = useState('');
  const [editableCookTime, setEditableCookTime] = useState('');
  const [editableServings, setEditableServings] = useState('');
  const [editableDifficulty, setEditableDifficulty] = useState<'easy' | 'medium' | 'hard' | ''>('');
  const [editableCuisine, setEditableCuisine] = useState('');
  const [editableTags, setEditableTags] = useState('');
  const [editableImageUrl, setEditableImageUrl] = useState('');
  const [editableVideoUrl, setEditableVideoUrl] = useState('');
  const [selectedChefId, setSelectedChefId] = useState<string>('');
  const [selectedLicense, setSelectedLicense] = useState('ALL_RIGHTS_RESERVED');

  // Load chefs list on component mount
  useEffect(() => {
    getChefsList().then((result) => {
      if (result.success && result.data) {
        setChefsList(result.data);
      }
    });
  }, []);

  const handleIngestRecipe = async () => {
    const input = inputType === 'url' ? urlInput : textInput;

    if (!input.trim()) {
      toast.error(`Please enter a ${inputType === 'url' ? 'URL' : 'recipe text'}`);
      return;
    }

    setStep('processing');
    toast.loading('Processing recipe...');

    const result = await ingestSystemRecipe(input, inputType);
    toast.dismiss();

    if (!result.success || !result.data?.recipe) {
      toast.error(result.error || 'Failed to process recipe');
      setStep('input');
      return;
    }

    setParsedRecipe(result.data.recipe);
    setSourceUrl(result.data.sourceUrl || '');

    // Populate editable fields
    setEditableName(result.data.recipe.name);
    setEditableDescription(result.data.recipe.description || '');
    setEditableIngredients(JSON.stringify(result.data.recipe.ingredients, null, 2));
    setEditableInstructions(JSON.stringify(result.data.recipe.instructions, null, 2));
    setEditablePrepTime(result.data.recipe.prep_time?.toString() || '');
    setEditableCookTime(result.data.recipe.cook_time?.toString() || '');
    setEditableServings(result.data.recipe.servings?.toString() || '');
    setEditableDifficulty(result.data.recipe.difficulty || '');
    setEditableCuisine(result.data.recipe.cuisine || '');
    setEditableTags(result.data.recipe.tags.join(', '));
    setEditableImageUrl(result.data.recipe.image_url || '');
    setEditableVideoUrl(result.data.recipe.video_url || '');

    setStep('preview');
    toast.success('Recipe processed successfully!');

    // Show confidence score if available
    if (result.data.metadata?.confidence) {
      const confidencePercent = Math.round(result.data.metadata.confidence * 100);
      toast.info(`Detection confidence: ${confidencePercent}%`);
    }
  };

  const handleSaveRecipe = async () => {
    if (!editableName.trim()) {
      toast.error('Recipe name is required');
      return;
    }

    setStep('saving');
    toast.loading('Saving recipe to database...');

    try {
      // Parse ingredients and instructions from JSON strings
      const ingredients = JSON.parse(editableIngredients);
      const instructions = JSON.parse(editableInstructions);

      const saveResult = await saveIngestedRecipe({
        name: editableName,
        description: editableDescription || null,
        ingredients,
        instructions,
        prep_time: editablePrepTime ? parseInt(editablePrepTime, 10) : null,
        cook_time: editableCookTime ? parseInt(editableCookTime, 10) : null,
        servings: editableServings ? parseInt(editableServings, 10) : null,
        difficulty: editableDifficulty || null,
        cuisine: editableCuisine || null,
        tags: editableTags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        image_url: editableImageUrl || null,
        video_url: editableVideoUrl || null,
        source: sourceUrl || 'System Recipe Ingestion',
        chef_id: selectedChefId && selectedChefId !== 'no_chef' ? selectedChefId : null,
        license: selectedLicense,
        is_public: true,
        is_system_recipe: true, // Always true for system recipes
      });

      toast.dismiss();

      if (!saveResult.success || !saveResult.data) {
        toast.error(saveResult.error || 'Failed to save recipe');
        setStep('preview');
        return;
      }

      setSavedRecipeId(saveResult.data.slug || saveResult.data.id);
      setStep('complete');
      toast.success('Recipe saved successfully!');
    } catch (error) {
      toast.dismiss();
      toast.error(error instanceof Error ? error.message : 'Failed to save recipe');
      setStep('preview');
    }
  };

  const handleReset = () => {
    setStep('input');
    setUrlInput('');
    setTextInput('');
    setParsedRecipe(null);
    setSourceUrl('');
    setSavedRecipeId('');
    setEditableName('');
    setEditableDescription('');
    setEditableIngredients('');
    setEditableInstructions('');
    setEditablePrepTime('');
    setEditableCookTime('');
    setEditableServings('');
    setEditableDifficulty('');
    setEditableCuisine('');
    setEditableTags('');
    setEditableImageUrl('');
    setEditableVideoUrl('');
    setSelectedChefId('');
    setSelectedLicense('ALL_RIGHTS_RESERVED');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">System Recipe Ingestion</h1>
        <p className="text-gray-600 mt-2">
          Import recipes from URLs or text using Jina.ai and AI parsing
        </p>
      </div>

      {/* Step 1: Input */}
      {step === 'input' && (
        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <Tabs value={inputType} onValueChange={(value) => setInputType(value as InputType)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="url">URL Input</TabsTrigger>
              <TabsTrigger value="text">Text Input</TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="recipe-url">Recipe URL</Label>
                <Input
                  id="recipe-url"
                  type="url"
                  placeholder="https://www.example.com/recipe/chocolate-chip-cookies"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleIngestRecipe();
                    }
                  }}
                  className="mt-1"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Enter a URL to a recipe page. Jina.ai will scrape and clean the content.
                </p>
              </div>
              <Button onClick={handleIngestRecipe} className="w-full">
                Scrape and Parse Recipe
              </Button>
            </TabsContent>

            <TabsContent value="text" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="recipe-text">Recipe Text</Label>
                <Textarea
                  id="recipe-text"
                  placeholder="Paste your recipe here...&#10;&#10;Example:&#10;Chocolate Chip Cookies&#10;&#10;Ingredients:&#10;- 2 cups flour&#10;- 1 cup sugar&#10;- 1/2 cup butter&#10;&#10;Instructions:&#10;1. Mix dry ingredients...&#10;2. Add wet ingredients..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  rows={12}
                  className="mt-1 font-mono text-sm"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Paste recipe text directly. AI will detect and extract the recipe.
                </p>
              </div>
              <Button onClick={handleIngestRecipe} className="w-full">
                Parse Recipe
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Step 2: Processing Loading State */}
      {step === 'processing' && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4" />
          <p className="text-gray-700 font-medium">
            {inputType === 'url' ? 'Scraping and parsing recipe...' : 'Parsing recipe...'}
          </p>
          <p className="text-gray-500 text-sm mt-2">This may take a few moments</p>
        </div>
      )}

      {/* Step 3: Preview and Edit */}
      {step === 'preview' && parsedRecipe && (
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <div className="border-b pb-4">
            <h2 className="text-xl font-bold text-gray-900">Preview and Edit Recipe</h2>
            <p className="text-gray-600 text-sm mt-1">
              Review the parsed data and make any necessary adjustments
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="name">Recipe Name *</Label>
              <Input
                id="name"
                value={editableName}
                onChange={(e) => setEditableName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editableDescription}
                onChange={(e) => setEditableDescription(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="ingredients">Ingredients (JSON) *</Label>
              <Textarea
                id="ingredients"
                value={editableIngredients}
                onChange={(e) => setEditableIngredients(e.target.value)}
                rows={10}
                className="mt-1 font-mono text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="instructions">Instructions (JSON) *</Label>
              <Textarea
                id="instructions"
                value={editableInstructions}
                onChange={(e) => setEditableInstructions(e.target.value)}
                rows={10}
                className="mt-1 font-mono text-sm"
              />
            </div>

            <div>
              <Label htmlFor="prep-time">Prep Time (minutes)</Label>
              <Input
                id="prep-time"
                type="number"
                value={editablePrepTime}
                onChange={(e) => setEditablePrepTime(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="cook-time">Cook Time (minutes)</Label>
              <Input
                id="cook-time"
                type="number"
                value={editableCookTime}
                onChange={(e) => setEditableCookTime(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="servings">Servings</Label>
              <Input
                id="servings"
                type="number"
                value={editableServings}
                onChange={(e) => setEditableServings(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select
                value={editableDifficulty}
                onValueChange={(value) =>
                  setEditableDifficulty(value as '' | 'easy' | 'medium' | 'hard')
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_specified">Not specified</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="cuisine">Cuisine</Label>
              <Input
                id="cuisine"
                value={editableCuisine}
                onChange={(e) => setEditableCuisine(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={editableTags}
                onChange={(e) => setEditableTags(e.target.value)}
                placeholder="vegetarian, pasta, dinner"
                className="mt-1"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="image-url">Image URL</Label>
              <Input
                id="image-url"
                type="url"
                value={editableImageUrl}
                onChange={(e) => setEditableImageUrl(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="video-url">Video URL</Label>
              <Input
                id="video-url"
                type="url"
                value={editableVideoUrl}
                onChange={(e) => setEditableVideoUrl(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="chef">Associate with Chef (Optional)</Label>
              <Select value={selectedChefId} onValueChange={setSelectedChefId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a chef" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_chef">No chef</SelectItem>
                  {chefsList.map((chef) => (
                    <SelectItem key={chef.id} value={chef.id}>
                      {chef.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="license">License</Label>
              <Select value={selectedLicense} onValueChange={setSelectedLicense}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_RIGHTS_RESERVED">All Rights Reserved</SelectItem>
                  <SelectItem value="PUBLIC_DOMAIN">Public Domain</SelectItem>
                  <SelectItem value="CC_BY">CC BY (Attribution)</SelectItem>
                  <SelectItem value="CC_BY_SA">CC BY-SA (Attribution-ShareAlike)</SelectItem>
                  <SelectItem value="CC_BY_NC">CC BY-NC (Attribution-NonCommercial)</SelectItem>
                  <SelectItem value="CC_BY_NC_SA">CC BY-NC-SA</SelectItem>
                  <SelectItem value="EDUCATIONAL_USE">Educational Use</SelectItem>
                  <SelectItem value="PERSONAL_USE">Personal Use Only</SelectItem>
                  <SelectItem value="FAIR_USE">Fair Use</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button onClick={handleReset} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSaveRecipe} className="flex-1">
              Save System Recipe
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Saving Loading State */}
      {step === 'saving' && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4" />
          <p className="text-gray-700 font-medium">Saving recipe to database...</p>
        </div>
      )}

      {/* Step 5: Complete */}
      {step === 'complete' && savedRecipeId && (
        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Recipe Saved Successfully!</h2>
            <p className="text-gray-600 mt-2">Your system recipe has been added to the database</p>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => router.push(`/recipes/${savedRecipeId}`)} className="flex-1">
              View Recipe
            </Button>
            <Button onClick={handleReset} variant="outline" className="flex-1">
              Ingest Another Recipe
            </Button>
          </div>
        </div>
      )}

      {/* Info Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">How It Works</h3>
        <div className="space-y-4">
          <div>
            <p className="font-medium text-blue-800 mb-1">URL Input:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
              <li>Enter a recipe URL from any website</li>
              <li>Jina.ai Reader API scrapes and cleans the content</li>
              <li>AI (Claude Sonnet 4.5) detects and parses the recipe</li>
              <li>Review and edit the extracted fields</li>
              <li>Save as system recipe with proper licensing</li>
            </ol>
          </div>
          <div>
            <p className="font-medium text-blue-800 mb-1">Text Input:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
              <li>Paste recipe text directly into the text area</li>
              <li>AI detects if the text contains a valid recipe</li>
              <li>If valid, recipe data is extracted automatically</li>
              <li>Review and edit the extracted fields</li>
              <li>Save as system recipe with proper licensing</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Example Content */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Examples to Try</h3>
        <div className="space-y-4">
          <div>
            <p className="font-medium text-gray-700 mb-2">Example URLs:</p>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={() => {
                    setInputType('url');
                    setUrlInput(
                      'https://www.epicurious.com/recipes/food/views/kale-and-white-bean-stew-351254'
                    );
                  }}
                  className="text-red-600 hover:text-red-700 underline"
                >
                  Epicurious: Kale and White Bean Stew
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setInputType('url');
                    setUrlInput('https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/');
                  }}
                  className="text-red-600 hover:text-red-700 underline"
                >
                  AllRecipes: Chocolate Chip Cookies
                </button>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-2">Example Text:</p>
            <button
              onClick={() => {
                setInputType('text');
                setTextInput(`Chocolate Chip Cookies

A classic American cookie recipe that is perfect for any occasion.

Ingredients:
- 2 cups all-purpose flour
- 1 teaspoon baking soda
- 1/2 teaspoon salt
- 1 cup butter, softened
- 3/4 cup granulated sugar
- 3/4 cup packed brown sugar
- 2 large eggs
- 2 teaspoons vanilla extract
- 2 cups chocolate chips

Instructions:
1. Preheat oven to 375 degrees F (190 degrees C).
2. In a small bowl, mix together flour, baking soda, and salt. Set aside.
3. In a large bowl, cream together butter and sugars until light and fluffy.
4. Beat in eggs one at a time, then stir in vanilla.
5. Gradually blend in the flour mixture.
6. Stir in chocolate chips.
7. Drop rounded tablespoons of dough onto ungreased cookie sheets.
8. Bake for 9 to 11 minutes or until golden brown.
9. Cool on baking sheet for 2 minutes before removing to a wire rack.

Prep Time: 15 minutes
Cook Time: 11 minutes
Servings: 48 cookies
Difficulty: Easy`);
              }}
              className="text-red-600 hover:text-red-700 underline text-sm"
            >
              Load example recipe text
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
