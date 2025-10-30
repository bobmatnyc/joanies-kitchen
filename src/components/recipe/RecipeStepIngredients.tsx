'use client';

import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RecipeFormData } from './RecipeUploadWizard';

interface RecipeStepIngredientsProps {
  formData: RecipeFormData;
  updateFormData: (updates: Partial<RecipeFormData>) => void;
}

export function RecipeStepIngredients({ formData, updateFormData }: RecipeStepIngredientsProps) {
  const handleIngredientChange = (index: number, value: string) => {
    const newIngredients = [...formData.ingredients];
    newIngredients[index] = value;
    updateFormData({ ingredients: newIngredients });
  };

  const addIngredient = () => {
    updateFormData({ ingredients: [...formData.ingredients, ''] });
    // Auto-focus the new input
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('input[data-ingredient-input]');
      const lastInput = inputs[inputs.length - 1];
      lastInput?.focus();
    }, 100);
  };

  const removeIngredient = (index: number) => {
    if (formData.ingredients.length <= 1) return;
    const newIngredients = formData.ingredients.filter((_, i) => i !== index);
    updateFormData({ ingredients: newIngredients });
  };

  const nonEmptyCount = formData.ingredients.filter((i) => i.trim().length > 0).length;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>
          Ingredients <span className="text-destructive">*</span>
        </Label>
        <p className="text-sm text-muted-foreground">
          List each ingredient with its quantity. For example: "2 cups all-purpose flour" or "1 tsp
          salt"
        </p>
      </div>

      {/* Ingredient List */}
      <div className="space-y-3">
        {formData.ingredients.map((ingredient, index) => (
          <div key={index} className="flex gap-2 items-start">
            <div className="flex-shrink-0 w-8 h-10 flex items-center justify-center text-sm text-muted-foreground font-medium">
              {index + 1}.
            </div>
            <div className="flex-1">
              <Input
                data-ingredient-input
                value={ingredient}
                onChange={(e) => handleIngredientChange(index, e.target.value)}
                placeholder="e.g., 2 cups flour, 1 tsp salt, 3 eggs"
                autoFocus={index === 0}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => removeIngredient(index)}
              disabled={formData.ingredients.length === 1}
              aria-label="Remove ingredient"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add Ingredient Button */}
      <Button type="button" variant="outline" onClick={addIngredient} className="w-full">
        <Plus className="w-4 h-4 mr-2" />
        Add Ingredient
      </Button>

      {/* Status Message */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {nonEmptyCount} ingredient{nonEmptyCount !== 1 ? 's' : ''} added
        </span>
        {nonEmptyCount === 0 && (
          <span className="text-destructive">At least 1 ingredient required</span>
        )}
        {nonEmptyCount > 0 && <span className="text-green-600">✓ Ready to continue</span>}
      </div>

      {/* Helper Text */}
      <div className="bg-muted/50 border border-border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">
          <strong>Tip:</strong> Include measurements for all ingredients. Be specific about
          quantities, preparation (chopped, diced), and brands if they matter. This helps others
          recreate your recipe successfully.
        </p>
      </div>
    </div>
  );
}
