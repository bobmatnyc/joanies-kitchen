'use client';

import { ArrowLeft, ArrowRight, Check, ChefHat, Loader2, Settings, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/lib/toast';
import type { MealPairingMode, MealPlan } from '@/types';
import { MealPlanDisplay } from './MealPlanDisplay';

interface MealPairingWizardProps {
  onComplete?: (mealPlan: MealPlan) => void;
  onCancel?: () => void;
}

type WizardStep = 'mode' | 'constraints' | 'generation' | 'results';

interface FormData {
  mode: MealPairingMode | null;
  cuisine?: string;
  theme?: string;
  mainDish?: string;
  dietaryRestrictions: string[];
  availableIngredients: string[];
  timeLimit: number;
  servings: number;
}

export function MealPairingWizard({ onComplete, onCancel }: MealPairingWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('mode');
  const [_isGenerating, setIsGenerating] = useState(false);
  const [generatedMeal, setGeneratedMeal] = useState<MealPlan | null>(null);

  const [formData, setFormData] = useState<FormData>({
    mode: null,
    dietaryRestrictions: [],
    availableIngredients: [],
    timeLimit: 120,
    servings: 4,
  });

  const [ingredientInput, setIngredientInput] = useState('');
  const [dietaryInput, setDietaryInput] = useState('');

  const stepProgress = {
    mode: 25,
    constraints: 50,
    generation: 75,
    results: 100,
  };

  // Mode selection
  const modes: Array<{
    id: MealPairingMode;
    title: string;
    description: string;
    icon: typeof ChefHat;
  }> = [
    {
      id: 'cuisine',
      title: 'By Cuisine',
      description: 'Generate a meal around a specific cuisine (e.g., Italian, Thai)',
      icon: ChefHat,
    },
    {
      id: 'theme',
      title: 'By Theme',
      description: 'Create a themed meal (e.g., Summer BBQ, Romantic Dinner)',
      icon: Sparkles,
    },
    {
      id: 'main-first',
      title: 'Main Dish First',
      description: 'Start with a main dish and build complementary courses',
      icon: Settings,
    },
    {
      id: 'freestyle',
      title: 'Freestyle',
      description: 'Let AI create a balanced meal from your constraints',
      icon: Sparkles,
    },
  ];

  const handleModeSelect = (mode: MealPairingMode) => {
    setFormData({ ...formData, mode });
    setCurrentStep('constraints');
  };

  const addDietaryRestriction = () => {
    if (dietaryInput.trim() && !formData.dietaryRestrictions.includes(dietaryInput.trim())) {
      setFormData({
        ...formData,
        dietaryRestrictions: [...formData.dietaryRestrictions, dietaryInput.trim()],
      });
      setDietaryInput('');
    }
  };

  const removeDietaryRestriction = (item: string) => {
    setFormData({
      ...formData,
      dietaryRestrictions: formData.dietaryRestrictions.filter((r) => r !== item),
    });
  };

  const addIngredient = () => {
    if (ingredientInput.trim() && !formData.availableIngredients.includes(ingredientInput.trim())) {
      setFormData({
        ...formData,
        availableIngredients: [...formData.availableIngredients, ingredientInput.trim()],
      });
      setIngredientInput('');
    }
  };

  const removeIngredient = (item: string) => {
    setFormData({
      ...formData,
      availableIngredients: formData.availableIngredients.filter((i) => i !== item),
    });
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setCurrentStep('generation');

    try {
      // Import server action dynamically to avoid client-side bundling
      const { generateMealPairing } = await import('@/app/actions/meal-pairing');

      const result = await generateMealPairing({
        cuisine: formData.cuisine,
        theme: formData.theme,
        mainDish: formData.mainDish,
        dietary: formData.dietaryRestrictions,
        ingredients: formData.availableIngredients,
        maxTime: formData.timeLimit,
        servings: formData.servings,
      });

      if (result.success && result.data) {
        setGeneratedMeal(result.data);
        setCurrentStep('results');
        toast.success('Meal plan generated successfully!');
      } else {
        toast.error(result.error || 'Failed to generate meal plan');
        setCurrentStep('constraints');
      }
    } catch (error) {
      console.error('Meal generation error:', error);
      toast.error('An unexpected error occurred');
      setCurrentStep('constraints');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = () => {
    setGeneratedMeal(null);
    setCurrentStep('constraints');
  };

  const handleSave = () => {
    if (generatedMeal && onComplete) {
      onComplete(generatedMeal);
    }
  };

  const canProceed = () => {
    if (!formData.mode) return false;

    switch (formData.mode) {
      case 'cuisine':
        return !!formData.cuisine;
      case 'theme':
        return !!formData.theme;
      case 'main-first':
        return !!formData.mainDish;
      case 'freestyle':
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Step {Object.keys(stepProgress).indexOf(currentStep) + 1} of 4</span>
          <span>{stepProgress[currentStep]}% Complete</span>
        </div>
        <Progress value={stepProgress[currentStep]} className="h-2" />
      </div>

      {/* Step 1: Mode Selection */}
      {currentStep === 'mode' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChefHat className="w-5 h-5" />
              Choose Your Approach
            </CardTitle>
            <CardDescription>
              How would you like to build your meal? Select a mode to get started.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {modes.map((mode) => {
                const Icon = mode.icon;
                const isSelected = formData.mode === mode.id;

                return (
                  <button
                    key={mode.id}
                    onClick={() => handleModeSelect(mode.id)}
                    className={`p-4 border-2 rounded-lg text-left transition-all hover:border-primary ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon
                        className={`w-6 h-6 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">{mode.title}</h3>
                        <p className="text-sm text-muted-foreground">{mode.description}</p>
                      </div>
                      {isSelected && <Check className="w-5 h-5 text-primary" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Constraints */}
      {currentStep === 'constraints' && (
        <div className="space-y-6">
          {/* Mode-Specific Input */}
          <Card>
            <CardHeader>
              <CardTitle>Primary Details</CardTitle>
              <CardDescription>
                {formData.mode === 'cuisine' && 'What cuisine would you like to explore?'}
                {formData.mode === 'theme' && 'What theme do you have in mind?'}
                {formData.mode === 'main-first' && 'What main dish do you want to build around?'}
                {formData.mode === 'freestyle' && 'Set your preferences below'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.mode === 'cuisine' && (
                <div>
                  <Label htmlFor="cuisine">Cuisine</Label>
                  <Input
                    id="cuisine"
                    value={formData.cuisine || ''}
                    onChange={(e) => setFormData({ ...formData, cuisine: e.target.value })}
                    placeholder="e.g., Italian, Thai, Mexican"
                  />
                </div>
              )}

              {formData.mode === 'theme' && (
                <div>
                  <Label htmlFor="theme">Theme</Label>
                  <Input
                    id="theme"
                    value={formData.theme || ''}
                    onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                    placeholder="e.g., Summer BBQ, Romantic Dinner, Holiday Feast"
                  />
                </div>
              )}

              {formData.mode === 'main-first' && (
                <div>
                  <Label htmlFor="mainDish">Main Dish</Label>
                  <Input
                    id="mainDish"
                    value={formData.mainDish || ''}
                    onChange={(e) => setFormData({ ...formData, mainDish: e.target.value })}
                    placeholder="e.g., Pan-seared salmon, Beef wellington"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Constraints */}
          <Card>
            <CardHeader>
              <CardTitle>Constraints & Preferences</CardTitle>
              <CardDescription>
                Customize your meal with dietary restrictions, ingredients, and timing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Dietary Restrictions */}
              <div>
                <Label htmlFor="dietary">Dietary Restrictions</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    id="dietary"
                    value={dietaryInput}
                    onChange={(e) => setDietaryInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && (e.preventDefault(), addDietaryRestriction())
                    }
                    placeholder="e.g., vegetarian, gluten-free"
                  />
                  <Button type="button" onClick={addDietaryRestriction} variant="outline">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.dietaryRestrictions.map((item) => (
                    <Badge
                      key={item}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeDietaryRestriction(item)}
                    >
                      {item} ×
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Available Ingredients */}
              <div>
                <Label htmlFor="ingredients">Available Ingredients (Optional)</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    id="ingredients"
                    value={ingredientInput}
                    onChange={(e) => setIngredientInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIngredient())}
                    placeholder="e.g., chicken, tomatoes, basil"
                  />
                  <Button type="button" onClick={addIngredient} variant="outline">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.availableIngredients.map((item) => (
                    <Badge
                      key={item}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeIngredient(item)}
                    >
                      {item} ×
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Time and Servings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="timeLimit">Max Time (minutes)</Label>
                  <Input
                    id="timeLimit"
                    type="number"
                    min="30"
                    max="300"
                    value={formData.timeLimit}
                    onChange={(e) =>
                      setFormData({ ...formData, timeLimit: parseInt(e.target.value, 10) || 120 })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="servings">Servings</Label>
                  <Input
                    id="servings"
                    type="number"
                    min="1"
                    max="12"
                    value={formData.servings}
                    onChange={(e) =>
                      setFormData({ ...formData, servings: parseInt(e.target.value, 10) || 4 })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setCurrentStep('mode')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleGenerate} disabled={!canProceed()}>
              Generate Meal
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Generation (Loading) */}
      {currentStep === 'generation' && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
              <div>
                <h3 className="text-lg font-semibold">Crafting Your Perfect Meal</h3>
                <p className="text-muted-foreground">
                  Our AI is analyzing flavors, textures, and balance...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Results */}
      {currentStep === 'results' && generatedMeal && (
        <div className="space-y-6">
          <MealPlanDisplay mealPlan={generatedMeal} />

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleRegenerate}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Regenerate
            </Button>
            <div className="flex gap-2">
              {onCancel && (
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              {onComplete && (
                <Button onClick={handleSave}>
                  <Check className="w-4 h-4 mr-2" />
                  Save Meal Plan
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
