'use client';

import { Clock, Edit2, Globe, Lock, Users } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import type { RecipeFormData } from './RecipeUploadWizard';

interface RecipeStepReviewProps {
  formData: RecipeFormData;
  updateFormData: (updates: Partial<RecipeFormData>) => void;
  onEditStep: (step: 'basic' | 'ingredients' | 'instructions' | 'images') => void;
}

const COMMON_TAGS = [
  'quick-meal',
  'budget-friendly',
  'family-friendly',
  'comfort-food',
  'healthy',
  'vegetarian',
  'vegan',
  'gluten-free',
  'dairy-free',
  'one-pot',
  'make-ahead',
  'freezer-friendly',
  'seasonal',
  'waste-reduction',
];

export function RecipeStepReview({ formData, updateFormData, onEditStep }: RecipeStepReviewProps) {
  const [customTag, setCustomTag] = useState('');

  const totalTime = formData.prep_time + formData.cook_time;
  const validIngredients = formData.ingredients.filter((i) => i.trim().length > 0);
  const validInstructions = formData.instructions.filter((i) => i.trim().length > 0);

  const handleTagToggle = (tag: string) => {
    if (formData.tags.includes(tag)) {
      updateFormData({ tags: formData.tags.filter((t) => t !== tag) });
    } else {
      updateFormData({ tags: [...formData.tags, tag] });
    }
  };

  const handleAddCustomTag = () => {
    const tag = customTag.trim().toLowerCase();
    if (tag && !formData.tags.includes(tag)) {
      updateFormData({ tags: [...formData.tags, tag] });
      setCustomTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    updateFormData({ tags: formData.tags.filter((t) => t !== tag) });
  };

  return (
    <div className="space-y-8">
      {/* Recipe Summary */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{formData.name || 'Untitled Recipe'}</h3>
          <Button variant="ghost" size="sm" onClick={() => onEditStep('basic')}>
            <Edit2 className="w-4 h-4 mr-1" />
            Edit
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          {formData.description || 'No description provided'}
        </p>

        {/* Quick Stats */}
        <div className="flex flex-wrap gap-4 text-sm">
          {formData.cuisine && (
            <div className="flex items-center gap-1">
              <span className="font-medium">Cuisine:</span>
              <span className="text-muted-foreground">{formData.cuisine}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <span className="font-medium">Difficulty:</span>
            <span className="text-muted-foreground capitalize">{formData.difficulty}</span>
          </div>
          {totalTime > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span className="text-muted-foreground">{totalTime} min</span>
            </div>
          )}
          {formData.servings > 0 && (
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span className="text-muted-foreground">{formData.servings} servings</span>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Ingredients Summary */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Ingredients ({validIngredients.length})</h4>
          <Button variant="ghost" size="sm" onClick={() => onEditStep('ingredients')}>
            <Edit2 className="w-4 h-4 mr-1" />
            Edit
          </Button>
        </div>
        <ul className="space-y-1 text-sm">
          {validIngredients.slice(0, 5).map((ingredient, index) => (
            <li key={index} className="text-muted-foreground">
              • {ingredient}
            </li>
          ))}
          {validIngredients.length > 5 && (
            <li className="text-muted-foreground italic">
              ... and {validIngredients.length - 5} more
            </li>
          )}
        </ul>
      </div>

      <Separator />

      {/* Instructions Summary */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Instructions ({validInstructions.length} steps)</h4>
          <Button variant="ghost" size="sm" onClick={() => onEditStep('instructions')}>
            <Edit2 className="w-4 h-4 mr-1" />
            Edit
          </Button>
        </div>
        <ol className="space-y-2 text-sm">
          {validInstructions.slice(0, 3).map((instruction, index) => (
            <li key={index} className="text-muted-foreground">
              <span className="font-medium">{index + 1}.</span> {instruction.slice(0, 100)}
              {instruction.length > 100 && '...'}
            </li>
          ))}
          {validInstructions.length > 3 && (
            <li className="text-muted-foreground italic">
              ... and {validInstructions.length - 3} more steps
            </li>
          )}
        </ol>
      </div>

      <Separator />

      {/* Images Summary */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Photos ({formData.images.length})</h4>
          <Button variant="ghost" size="sm" onClick={() => onEditStep('images')}>
            <Edit2 className="w-4 h-4 mr-1" />
            Edit
          </Button>
        </div>
        {formData.images.length > 0 ? (
          <div className="grid grid-cols-4 gap-2">
            {formData.images.map((image, index) => (
              <div key={index} className="aspect-square rounded-lg overflow-hidden border bg-muted">
                <img
                  src={image}
                  alt={`Recipe photo ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/api/placeholder/200/200';
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No photos added</p>
        )}
      </div>

      <Separator />

      {/* Tags Selection */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Tags (Optional)</Label>
          <p className="text-sm text-muted-foreground">
            Select tags that describe your recipe. This helps others discover it.
          </p>
        </div>

        {/* Common Tags */}
        <div className="flex flex-wrap gap-2">
          {COMMON_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleTagToggle(tag)}
              className={`px-3 py-1 rounded-full text-sm border-2 transition-colors ${
                formData.tags.includes(tag)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Custom Tag Input */}
        <div className="flex gap-2">
          <Input
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustomTag();
              }
            }}
            placeholder="Add custom tag..."
          />
          <Button type="button" variant="outline" onClick={handleAddCustomTag}>
            Add
          </Button>
        </div>

        {/* Selected Tags */}
        {formData.tags.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Selected Tags:</p>
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="cursor-pointer">
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-2 hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Visibility Settings */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Visibility</Label>
          <p className="text-sm text-muted-foreground">Control who can see your recipe</p>
        </div>

        <div className="flex items-center justify-between space-x-4 rounded-lg border p-4">
          <div className="flex items-center space-x-3">
            {formData.isPublic ? (
              <Globe className="w-5 h-5 text-primary" />
            ) : (
              <Lock className="w-5 h-5 text-muted-foreground" />
            )}
            <div className="space-y-0.5">
              <Label htmlFor="public-toggle" className="text-base cursor-pointer">
                {formData.isPublic ? 'Public Recipe' : 'Private Recipe'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {formData.isPublic
                  ? 'Visible to everyone immediately'
                  : 'Only visible to you (recommended for first submission)'}
              </p>
            </div>
          </div>
          <Switch
            id="public-toggle"
            checked={formData.isPublic}
            onCheckedChange={(checked) => updateFormData({ isPublic: checked })}
          />
        </div>

        {/* Moderation Notice */}
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>Note:</strong> While you can make your recipe public immediately, we recommend
            starting with private visibility. This allows you to review and refine your recipe
            before sharing it with the community.
          </p>
        </div>
      </div>

      {/* Final Check */}
      <div className="bg-muted/50 border border-border rounded-lg p-4">
        <p className="text-sm font-medium mb-2">Before you submit:</p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Review all ingredients and quantities for accuracy</li>
          <li>Check that instructions are clear and in the right order</li>
          <li>Verify prep time, cook time, and serving size</li>
          <li>Add relevant tags to help others find your recipe</li>
        </ul>
      </div>
    </div>
  );
}
