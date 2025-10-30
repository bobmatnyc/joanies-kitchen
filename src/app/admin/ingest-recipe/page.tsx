'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  getChefsList,
  ingestRecipeFromUrl,
  saveIngestedRecipe,
} from '@/app/actions/recipe-ingestion';
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
import { Textarea } from '@/components/ui/textarea';
import type { IngestedRecipe } from '@/lib/ai/recipe-ingestion-parser';

type IngestionStep = 'input' | 'fetching' | 'parsing' | 'preview' | 'saving' | 'complete';

export default function IngestRecipePage() {
  const router = useRouter();
  const [step, setStep] = useState<IngestionStep>('input');
  const [url, setUrl] = useState('');
  const [_fetchedContent, setFetchedContent] = useState<string>('');
  const [parsedRecipe, setParsedRecipe] = useState<IngestedRecipe | null>(null);
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
  const [isPublic, setIsPublic] = useState(true);
  const [isSystemRecipe, setIsSystemRecipe] = useState(true);

  // Load chefs list on component mount
  useState(() => {
    getChefsList().then((result) => {
      if (result.success && result.data) {
        setChefsList(result.data);
      }
    });
  });

  const handleFetchRecipe = async () => {
    if (!url.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    setStep('fetching');
    toast.loading('Fetching recipe from URL...');

    const result = await ingestRecipeFromUrl(url);
    toast.dismiss();

    if (!result.success || !result.data) {
      toast.error(result.error || 'Failed to fetch recipe');
      setStep('input');
      return;
    }

    setParsedRecipe(result.data.recipe);
    setFetchedContent(result.data.sourceUrl);

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
    toast.success('Recipe fetched and parsed successfully!');
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
        source: url,
        chef_id: selectedChefId || null,
        license: selectedLicense,
        is_public: isPublic,
        is_system_recipe: isSystemRecipe,
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
    setUrl('');
    setFetchedContent('');
    setParsedRecipe(null);
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
    setIsPublic(true);
    setIsSystemRecipe(true);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Recipe Ingestion</h1>
        <p className="text-gray-600 mt-2">
          Import recipes from URLs using Firecrawl and AI parsing
        </p>
      </div>

      {/* Step 1: URL Input */}
      {step === 'input' && (
        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <div>
            <Label htmlFor="recipe-url">Recipe URL</Label>
            <Input
              id="recipe-url"
              type="url"
              placeholder="https://www.example.com/recipe/chocolate-chip-cookies"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleFetchRecipe();
                }
              }}
              className="mt-1"
            />
            <p className="text-sm text-gray-500 mt-1">
              Enter a URL to a recipe page (e.g., AllRecipes, Food Network, Epicurious)
            </p>
          </div>
          <Button onClick={handleFetchRecipe} className="w-full">
            Fetch Recipe
          </Button>
        </div>
      )}

      {/* Step 2: Fetching/Parsing Loading State */}
      {(step === 'fetching' || step === 'parsing') && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4" />
          <p className="text-gray-700 font-medium">
            {step === 'fetching' ? 'Fetching recipe from URL...' : 'Parsing recipe with AI...'}
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
                onValueChange={(value) => setEditableDifficulty(value as '' | 'easy' | 'medium' | 'hard')}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Not specified</SelectItem>
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
                  <SelectItem value="">No chef</SelectItem>
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

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
                <span className="text-sm">Public</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isSystemRecipe}
                  onChange={(e) => setIsSystemRecipe(e.target.checked)}
                />
                <span className="text-sm">System Recipe</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button onClick={handleReset} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSaveRecipe} className="flex-1">
              Save Recipe
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
            <p className="text-gray-600 mt-2">Your recipe has been added to the database</p>
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
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
          <li>Enter a recipe URL from any website</li>
          <li>Firecrawl extracts clean content from the page</li>
          <li>AI (Claude Sonnet 4.5) parses the recipe into structured data</li>
          <li>Review and edit the parsed fields as needed</li>
          <li>Optionally associate the recipe with a chef</li>
          <li>Save to database with proper licensing and metadata</li>
        </ol>
      </div>

      {/* Example URLs */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Example URLs to Try</h3>
        <ul className="space-y-2 text-sm">
          <li>
            <button
              onClick={() =>
                setUrl(
                  'https://www.epicurious.com/recipes/food/views/kale-and-white-bean-stew-351254'
                )
              }
              className="text-red-600 hover:text-red-700 underline"
            >
              Epicurious: Kale and White Bean Stew
            </button>
          </li>
          <li>
            <button
              onClick={() =>
                setUrl('https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/')
              }
              className="text-red-600 hover:text-red-700 underline"
            >
              AllRecipes: Chocolate Chip Cookies
            </button>
          </li>
          <li>
            <button
              onClick={() =>
                setUrl(
                  'https://www.foodnetwork.com/recipes/alton-brown/baked-macaroni-and-cheese-recipe-1939524'
                )
              }
              className="text-red-600 hover:text-red-700 underline"
            >
              Food Network: Baked Mac and Cheese
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
