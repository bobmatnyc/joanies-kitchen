'use client';

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
import type { RecipeFormData } from './RecipeUploadWizard';

interface RecipeStepBasicInfoProps {
  formData: RecipeFormData;
  updateFormData: (updates: Partial<RecipeFormData>) => void;
}

export function RecipeStepBasicInfo({ formData, updateFormData }: RecipeStepBasicInfoProps) {
  const handleChange = (field: keyof RecipeFormData, value: string | number) => {
    updateFormData({ [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* Recipe Name */}
      <div className="space-y-2">
        <Label htmlFor="name">
          Recipe Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="e.g., Grandma's Chocolate Chip Cookies"
          maxLength={200}
          required
          autoFocus
        />
        <p className="text-xs text-muted-foreground">{formData.name.length}/200 characters</p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">
          Description <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="A brief description of your recipe. What makes it special? What inspired it?"
          maxLength={1000}
          rows={4}
          required
        />
        <p className="text-xs text-muted-foreground">
          {formData.description.length}/1000 characters
        </p>
      </div>

      {/* Cuisine and Difficulty Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cuisine */}
        <div className="space-y-2">
          <Label htmlFor="cuisine">Cuisine</Label>
          <Input
            id="cuisine"
            value={formData.cuisine}
            onChange={(e) => handleChange('cuisine', e.target.value)}
            placeholder="e.g., Italian, Mexican, Thai"
          />
        </div>

        {/* Difficulty */}
        <div className="space-y-2">
          <Label htmlFor="difficulty">Difficulty</Label>
          <Select
            value={formData.difficulty}
            onValueChange={(value) =>
              handleChange('difficulty', value as 'easy' | 'medium' | 'hard')
            }
          >
            <SelectTrigger id="difficulty">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Time and Servings Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Prep Time */}
        <div className="space-y-2">
          <Label htmlFor="prep_time">Prep Time (minutes)</Label>
          <Input
            id="prep_time"
            type="number"
            min="0"
            max="999"
            value={formData.prep_time || ''}
            onChange={(e) => handleChange('prep_time', Number.parseInt(e.target.value, 10) || 0)}
            placeholder="30"
          />
        </div>

        {/* Cook Time */}
        <div className="space-y-2">
          <Label htmlFor="cook_time">Cook Time (minutes)</Label>
          <Input
            id="cook_time"
            type="number"
            min="0"
            max="999"
            value={formData.cook_time || ''}
            onChange={(e) => handleChange('cook_time', Number.parseInt(e.target.value, 10) || 0)}
            placeholder="30"
          />
        </div>

        {/* Servings */}
        <div className="space-y-2">
          <Label htmlFor="servings">Servings</Label>
          <Input
            id="servings"
            type="number"
            min="1"
            max="100"
            value={formData.servings || ''}
            onChange={(e) => handleChange('servings', Number.parseInt(e.target.value, 10) || 4)}
            placeholder="4"
          />
        </div>
      </div>

      {/* Helper Text */}
      <div className="bg-muted/50 border border-border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">
          <strong>Tip:</strong> Be as descriptive as possible! A good description helps others
          understand what makes your recipe unique and when they might want to make it.
        </p>
      </div>
    </div>
  );
}
