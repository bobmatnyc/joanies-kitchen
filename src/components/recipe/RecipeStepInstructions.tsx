'use client';

import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { RecipeFormData } from './RecipeUploadWizard';

interface RecipeStepInstructionsProps {
  formData: RecipeFormData;
  updateFormData: (updates: Partial<RecipeFormData>) => void;
}

export function RecipeStepInstructions({ formData, updateFormData }: RecipeStepInstructionsProps) {
  const handleInstructionChange = (index: number, value: string) => {
    const newInstructions = [...formData.instructions];
    newInstructions[index] = value;
    updateFormData({ instructions: newInstructions });
  };

  const addInstruction = () => {
    updateFormData({ instructions: [...formData.instructions, ''] });
    // Auto-focus the new textarea
    setTimeout(() => {
      const textareas = document.querySelectorAll<HTMLTextAreaElement>(
        'textarea[data-instruction-input]'
      );
      const lastTextarea = textareas[textareas.length - 1];
      lastTextarea?.focus();
    }, 100);
  };

  const removeInstruction = (index: number) => {
    if (formData.instructions.length <= 1) return;
    const newInstructions = formData.instructions.filter((_, i) => i !== index);
    updateFormData({ instructions: newInstructions });
  };

  const moveInstruction = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === formData.instructions.length - 1)
    ) {
      return;
    }

    const newInstructions = [...formData.instructions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newInstructions[index], newInstructions[targetIndex]] = [
      newInstructions[targetIndex],
      newInstructions[index],
    ];
    updateFormData({ instructions: newInstructions });
  };

  const nonEmptyCount = formData.instructions.filter((i) => i.trim().length > 0).length;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>
          Instructions <span className="text-destructive">*</span>
        </Label>
        <p className="text-sm text-muted-foreground">
          Provide step-by-step instructions. Each step should be clear and actionable.
        </p>
      </div>

      {/* Instruction List */}
      <div className="space-y-4">
        {formData.instructions.map((instruction, index) => (
          <div key={index} className="flex gap-2 items-start">
            <div className="flex-shrink-0 w-8 pt-3 flex items-start justify-center text-sm text-muted-foreground font-medium">
              {index + 1}.
            </div>
            <div className="flex-1">
              <Textarea
                data-instruction-input
                value={instruction}
                onChange={(e) => handleInstructionChange(index, e.target.value)}
                placeholder="e.g., Preheat oven to 350°F (175°C). Line baking sheets with parchment paper."
                rows={3}
                autoFocus={index === 0}
              />
            </div>
            <div className="flex flex-col gap-1">
              {/* Reorder Buttons */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => moveInstruction(index, 'up')}
                disabled={index === 0}
                aria-label="Move step up"
                className="h-8 w-8"
              >
                <ArrowUp className="w-3 h-3" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => moveInstruction(index, 'down')}
                disabled={index === formData.instructions.length - 1}
                aria-label="Move step down"
                className="h-8 w-8"
              >
                <ArrowDown className="w-3 h-3" />
              </Button>
              {/* Remove Button */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => removeInstruction(index)}
                disabled={formData.instructions.length === 1}
                aria-label="Remove step"
                className="h-8 w-8"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Instruction Button */}
      <Button type="button" variant="outline" onClick={addInstruction} className="w-full">
        <Plus className="w-4 h-4 mr-2" />
        Add Step
      </Button>

      {/* Status Message */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {nonEmptyCount} step{nonEmptyCount !== 1 ? 's' : ''} added
        </span>
        {nonEmptyCount === 0 && (
          <span className="text-destructive">At least 1 instruction required</span>
        )}
        {nonEmptyCount > 0 && <span className="text-green-600">✓ Ready to continue</span>}
      </div>

      {/* Helper Text */}
      <div className="bg-muted/50 border border-border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">
          <strong>Tip:</strong> Write instructions as if you're guiding a friend in the kitchen.
          Include temperatures, times, and visual cues (e.g., "until golden brown" or "mixture
          should be thick"). Use the arrow buttons to reorder steps if needed.
        </p>
      </div>
    </div>
  );
}
