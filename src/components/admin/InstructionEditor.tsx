'use client';

import { GripVertical, Plus, Trash2, Wand2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { formatInstructionsWithLLM, updateRecipeInstructions } from '@/app/actions/admin-edit';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';

interface InstructionEditorProps {
  recipeId: string;
  recipeName: string;
  initialInstructions: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

/**
 * Instruction Editor Overlay
 *
 * Inline editor for recipe cooking instructions with drag-and-drop reordering,
 * LLM-powered formatting, and real-time editing capabilities.
 *
 * Features:
 * - Add/remove steps
 * - Reorder steps with up/down buttons (numbered automatically)
 * - Edit step text inline (textarea for each step)
 * - "Format with LLM" to clean up instructions
 * - Mobile-friendly (44x44px touch targets)
 */
export function InstructionEditor({
  recipeId,
  recipeName,
  initialInstructions,
  open,
  onOpenChange,
  onSave,
}: InstructionEditorProps) {
  const [instructions, setInstructions] = useState<string[]>(initialInstructions);
  const [saving, setSaving] = useState(false);
  const [formatting, setFormatting] = useState(false);

  const handleAddInstruction = () => {
    setInstructions([...instructions, '']);
  };

  const handleRemoveInstruction = (index: number) => {
    setInstructions(instructions.filter((_, i) => i !== index));
  };

  const handleUpdateInstruction = (index: number, value: string) => {
    const updated = [...instructions];
    updated[index] = value;
    setInstructions(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...instructions];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setInstructions(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === instructions.length - 1) return;
    const updated = [...instructions];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setInstructions(updated);
  };

  const handleFormatWithLLM = async () => {
    setFormatting(true);
    try {
      // First save current state
      const saveResult = await updateRecipeInstructions(
        recipeId,
        instructions.filter((inst) => inst.trim())
      );

      if (!saveResult.success) {
        toast.error(saveResult.error || 'Failed to save instructions before formatting');
        return;
      }

      // Then format with LLM
      const result = await formatInstructionsWithLLM(recipeId);

      if (result.success && result.data?.instructions) {
        setInstructions(result.data.instructions);
        toast.success('Instructions formatted successfully!');
      } else {
        toast.error(result.error || 'Failed to format instructions');
      }
    } catch (error) {
      console.error('Format error:', error);
      toast.error('Failed to format instructions with AI');
    } finally {
      setFormatting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Filter out empty instructions
      const validInstructions = instructions.filter((inst) => inst.trim());

      if (validInstructions.length === 0) {
        toast.error('Please add at least one instruction step');
        setSaving(false);
        return;
      }

      const result = await updateRecipeInstructions(recipeId, validInstructions);

      if (result.success) {
        toast.success('Instructions updated successfully!');
        onSave?.();
        onOpenChange(false);
      } else {
        toast.error(result.error || 'Failed to update instructions');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save instructions');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setInstructions(initialInstructions);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Instructions</SheetTitle>
          <SheetDescription>
            Editing cooking steps for <strong>{recipeName}</strong>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* LLM Format Button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={handleFormatWithLLM}
              disabled={formatting || saving}
              className="min-h-[44px]"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              {formatting ? 'Formatting...' : 'Format with AI'}
            </Button>
          </div>

          {/* Instructions List */}
          <div className="space-y-4">
            {instructions.map((instruction, index) => (
              <div key={index} className="flex items-start gap-2">
                {/* Step Number and Reorder Buttons */}
                <div className="flex flex-col items-center gap-1 pt-2">
                  <div className="font-semibold text-primary text-sm min-w-[2rem] text-center">
                    Step {index + 1}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0 || saving || formatting}
                    className="h-5 w-5 p-0"
                    aria-label="Move step up"
                  >
                    <GripVertical className="h-3 w-3 rotate-90" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === instructions.length - 1 || saving || formatting}
                    className="h-5 w-5 p-0"
                    aria-label="Move step down"
                  >
                    <GripVertical className="h-3 w-3 -rotate-90" />
                  </Button>
                </div>

                {/* Instruction Textarea */}
                <div className="flex-1">
                  <Textarea
                    value={instruction}
                    onChange={(e) => handleUpdateInstruction(index, e.target.value)}
                    placeholder="Describe this cooking step..."
                    disabled={saving || formatting}
                    className="min-h-[100px] resize-y"
                    rows={3}
                  />
                </div>

                {/* Remove Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveInstruction(index)}
                  disabled={saving || formatting}
                  className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                  aria-label="Remove step"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Add Instruction Button */}
          <Button
            variant="outline"
            onClick={handleAddInstruction}
            disabled={saving || formatting}
            className="w-full min-h-[44px]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Step
          </Button>
        </div>

        <SheetFooter className="mt-6 flex gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={saving || formatting}
            className="flex-1 min-h-[44px]"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || formatting}
            className="flex-1 min-h-[44px]"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
