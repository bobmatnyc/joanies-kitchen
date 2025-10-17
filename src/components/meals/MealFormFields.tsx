'use client';

import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { MEAL_TYPE_CONFIGS } from '@/lib/meals/type-guards';

const MEAL_TYPES = MEAL_TYPE_CONFIGS;

export interface MealFormFieldsProps {
  name: string;
  description: string;
  mealType: string;
  serves: number;
  occasion: string;
  tags: string[];
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onMealTypeChange: (value: string) => void;
  onServesChange: (value: number) => void;
  onOccasionChange: (value: string) => void;
  onTagsChange: (tags: string[]) => void;
}

export const MealFormFields = memo(function MealFormFields({
  name,
  description,
  mealType,
  serves,
  occasion,
  tags,
  onNameChange,
  onDescriptionChange,
  onMealTypeChange,
  onServesChange,
  onOccasionChange,
  onTagsChange,
}: MealFormFieldsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-jk-olive text-2xl">Meal Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="font-ui text-jk-charcoal">
              Meal Name *
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g., Sunday Family Dinner"
              required
              className="font-body"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mealType" className="font-ui text-jk-charcoal">
              Meal Type
            </Label>
            <Select value={mealType} onValueChange={onMealTypeChange}>
              <SelectTrigger id="mealType" className="font-body">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEAL_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="font-body">
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="serves" className="font-ui text-jk-charcoal">
              Serves
            </Label>
            <Input
              id="serves"
              type="number"
              min="1"
              value={serves}
              onChange={(e) => onServesChange(parseInt(e.target.value, 10))}
              className="font-body"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="occasion" className="font-ui text-jk-charcoal">
              Occasion (Optional)
            </Label>
            <Input
              id="occasion"
              value={occasion}
              onChange={(e) => onOccasionChange(e.target.value)}
              placeholder="e.g., Thanksgiving, Birthday"
              className="font-body"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="font-ui text-jk-charcoal">
            Description *
          </Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Describe this meal (e.g., 'A cozy family dinner with comfort food classics')..."
            rows={3}
            className="font-body"
            required
          />
        </div>

        {/* Tags are automatically inferred from selected recipes */}
        {tags.length > 0 && (
          <div className="space-y-2">
            <Label className="font-ui text-jk-charcoal">Tags (Auto-detected from recipes)</Label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-jk-sage/30 text-jk-olive border border-jk-olive/20 font-body"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
