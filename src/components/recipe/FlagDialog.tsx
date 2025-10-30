'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { type FlagReason, flagRecipe } from '@/app/actions/flag-recipe';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';

interface FlagDialogProps {
  recipeId: string;
  recipeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FlagOption {
  value: FlagReason;
  label: string;
  description: string;
}

const FLAG_OPTIONS: FlagOption[] = [
  {
    value: 'inappropriate',
    label: 'Inappropriate Content',
    description: 'Offensive or inappropriate material',
  },
  {
    value: 'spam',
    label: 'Spam or Advertising',
    description: 'Promotional content or spam',
  },
  {
    value: 'copyright',
    label: 'Copyright Violation',
    description: 'Unauthorized use of copyrighted material',
  },
  {
    value: 'quality',
    label: 'Poor Quality',
    description: 'Inaccurate or low-quality recipe',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Another issue not listed above',
  },
];

export function FlagDialog({ recipeId, recipeName, open, onOpenChange }: FlagDialogProps) {
  const [reason, setReason] = useState<FlagReason | ''>('');
  const [description, setDescription] = useState('');
  const [isPending, startTransition] = useTransition();

  const MAX_DESCRIPTION_LENGTH = 500;
  const isDescriptionRequired = reason === 'other';
  const isSubmitDisabled = !reason || isPending || (isDescriptionRequired && !description.trim());

  const handleSubmit = () => {
    if (!reason || isSubmitDisabled) return;

    startTransition(async () => {
      try {
        const result = await flagRecipe(
          recipeId,
          reason as FlagReason,
          description.trim() || undefined
        );

        if (result.success) {
          toast.success("Thank you for your report. We'll review it shortly.");
          // Reset form and close dialog
          setReason('');
          setDescription('');
          onOpenChange(false);
        } else {
          toast.error(result.error || 'Failed to submit report. Please try again.');
        }
      } catch (error) {
        console.error('Error submitting flag:', error);
        toast.error('Failed to submit report. Please try again.');
      }
    });
  };

  const handleCancel = () => {
    // Reset form when canceling
    setReason('');
    setDescription('');
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      handleCancel();
    } else {
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Report Recipe</DialogTitle>
          <DialogDescription>
            Help us maintain quality by reporting issues with &quot;{recipeName}&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Reason Selection */}
          <div className="space-y-3">
            <Label htmlFor="reason" className="text-base font-semibold">
              Reason for Report
            </Label>
            <RadioGroup
              id="reason"
              value={reason}
              onValueChange={(value) => setReason(value as FlagReason)}
            >
              {FLAG_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-start space-x-3 space-y-0 py-2">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor={option.value}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {option.label}
                    </Label>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Optional Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Additional Details {isDescriptionRequired && <span className="text-red-500">*</span>}
            </Label>
            <Textarea
              id="description"
              placeholder={
                isDescriptionRequired
                  ? 'Please provide details about the issue...'
                  : 'Provide additional details (optional)...'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
              maxLength={MAX_DESCRIPTION_LENGTH}
              className="min-h-[100px] resize-none"
              aria-required={isDescriptionRequired}
            />
            {/* Character Counter - show when approaching limit */}
            {description.length > 400 && (
              <p className="text-xs text-muted-foreground text-right">
                {MAX_DESCRIPTION_LENGTH - description.length} characters remaining
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitDisabled}>
            {isPending ? 'Submitting...' : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
