'use client';

import { useState } from 'react';
import { GripVertical, Plus, Trash2, Wand2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { parseIngredientsWithLLM, updateRecipeIngredients } from '@/app/actions/admin-edit';

interface IngredientEditorProps {
  recipeId: string;
  recipeName: string;
  initialIngredients: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

/**
 * Ingredient Editor Overlay
 *
 * Inline editor for recipe ingredients with drag-and-drop reordering,
 * LLM-powered parsing, and real-time editing capabilities.
 *
 * Features:
 * - Add/remove individual ingredients
 * - Reorder ingredients with up/down buttons
 * - Edit ingredient text inline
 * - "Parse with LLM" to fix formatting
 * - Mobile-friendly (44x44px touch targets)
 */
export function IngredientEditor({
  recipeId,
  recipeName,
  initialIngredients,
  open,
  onOpenChange,
  onSave,
}: IngredientEditorProps) {
  const [ingredients, setIngredients] = useState<string[]>(initialIngredients);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);

  const handleAddIngredient = () => {
    setIngredients([...ingredients, '']);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleUpdateIngredient = (index: number, value: string) => {
    const updated = [...ingredients];
    updated[index] = value;
    setIngredients(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...ingredients];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setIngredients(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === ingredients.length - 1) return;
    const updated = [...ingredients];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setIngredients(updated);
  };

  const handleParseWithLLM = async () => {
    setParsing(true);
    try {
      // First save current state
      const saveResult = await updateRecipeIngredients(recipeId, ingredients.filter(ing => ing.trim()));

      if (!saveResult.success) {
        toast.error(saveResult.error || 'Failed to save ingredients before parsing');
        return;
      }

      // Then parse with LLM
      const result = await parseIngredientsWithLLM(recipeId);

      if (result.success && result.data?.ingredients) {
        setIngredients(result.data.ingredients);
        toast.success('Ingredients parsed and formatted successfully!');
      } else {
        toast.error(result.error || 'Failed to parse ingredients');
      }
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('Failed to parse ingredients with AI');
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Filter out empty ingredients
      const validIngredients = ingredients.filter(ing => ing.trim());

      if (validIngredients.length === 0) {
        toast.error('Please add at least one ingredient');
        setSaving(false);
        return;
      }

      const result = await updateRecipeIngredients(recipeId, validIngredients);

      if (result.success) {
        toast.success('Ingredients updated successfully!');
        onSave?.();
        onOpenChange(false);
      } else {
        toast.error(result.error || 'Failed to update ingredients');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save ingredients');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIngredients(initialIngredients);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Ingredients</SheetTitle>
          <SheetDescription>
            Editing ingredients for <strong>{recipeName}</strong>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* LLM Parse Button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={handleParseWithLLM}
              disabled={parsing || saving}
              className="min-h-[44px]"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              {parsing ? 'Parsing...' : 'Parse with AI'}
            </Button>
          </div>

          {/* Ingredients List */}
          <div className="space-y-3">
            {ingredients.map((ingredient, index) => (
              <div key={index} className="flex items-start gap-2">
                {/* Reorder Buttons */}
                <div className="flex flex-col gap-1 pt-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0 || saving || parsing}
                    className="h-5 w-5 p-0"
                    aria-label="Move ingredient up"
                  >
                    <GripVertical className="h-3 w-3 rotate-90" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === ingredients.length - 1 || saving || parsing}
                    className="h-5 w-5 p-0"
                    aria-label="Move ingredient down"
                  >
                    <GripVertical className="h-3 w-3 -rotate-90" />
                  </Button>
                </div>

                {/* Ingredient Input */}
                <div className="flex-1">
                  <Input
                    value={ingredient}
                    onChange={(e) => handleUpdateIngredient(index, e.target.value)}
                    placeholder="e.g., 2 cups all-purpose flour"
                    disabled={saving || parsing}
                    className="min-h-[44px]"
                  />
                </div>

                {/* Remove Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveIngredient(index)}
                  disabled={saving || parsing}
                  className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                  aria-label="Remove ingredient"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Add Ingredient Button */}
          <Button
            variant="outline"
            onClick={handleAddIngredient}
            disabled={saving || parsing}
            className="w-full min-h-[44px]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Ingredient
          </Button>
        </div>

        <SheetFooter className="mt-6 flex gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={saving || parsing}
            className="flex-1 min-h-[44px]"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || parsing}
            className="flex-1 min-h-[44px]"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
