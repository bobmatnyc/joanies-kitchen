'use client';

import { CheckCircle, Flag, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { approveRecipe, flagRecipe, rejectRecipe } from '@/app/actions/moderation';
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
import { Textarea } from '@/components/ui/textarea';

interface ModerationActionDialogProps {
  recipeId: string;
  recipeName: string;
  action: 'approve' | 'reject' | 'flag' | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ModerationActionDialog({
  recipeId,
  recipeName,
  action,
  open,
  onOpenChange,
  onSuccess,
}: ModerationActionDialogProps) {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!action) return;

    // Validation
    if ((action === 'reject' || action === 'flag') && !notes.trim()) {
      toast.error(`${action === 'reject' ? 'Rejection' : 'Flag'} reason is required`);
      return;
    }

    setIsSubmitting(true);

    try {
      let result;

      switch (action) {
        case 'approve':
          result = await approveRecipe(recipeId, notes || undefined);
          break;
        case 'reject':
          result = await rejectRecipe(recipeId, notes);
          break;
        case 'flag':
          result = await flagRecipe(recipeId, notes);
          break;
      }

      if (result.success) {
        toast.success(`Recipe ${action}d successfully`);
        setNotes('');
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(result.error || `Failed to ${action} recipe`);
      }
    } catch (error) {
      toast.error(`Failed to ${action} recipe`);
      console.error(`Failed to ${action} recipe:`, error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDialogConfig = () => {
    switch (action) {
      case 'approve':
        return {
          title: 'Approve Recipe',
          description: `Are you sure you want to approve "${recipeName}"? This will make it visible to users if marked as public.`,
          icon: <CheckCircle className="h-5 w-5 text-green-500" />,
          buttonText: 'Confirm Approval',
          buttonVariant: 'default' as const,
          required: false,
          label: 'Optional notes',
          placeholder: 'Add any notes about this approval...',
        };
      case 'reject':
        return {
          title: 'Reject Recipe',
          description: `Please provide a reason for rejecting "${recipeName}". The user will be notified.`,
          icon: <XCircle className="h-5 w-5 text-red-500" />,
          buttonText: 'Confirm Rejection',
          buttonVariant: 'destructive' as const,
          required: true,
          label: 'Rejection reason (required)',
          placeholder: 'Explain why this recipe is being rejected...',
        };
      case 'flag':
        return {
          title: 'Flag for Review',
          description: `Please provide a reason for flagging "${recipeName}" for additional review.`,
          icon: <Flag className="h-5 w-5 text-blue-500" />,
          buttonText: 'Flag for Review',
          buttonVariant: 'secondary' as const,
          required: true,
          label: 'Flag reason (required)',
          placeholder: 'Describe the issue that needs review...',
        };
      default:
        return null;
    }
  };

  const config = getDialogConfig();
  if (!config) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {config.icon}
            <DialogTitle>{config.title}</DialogTitle>
          </div>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="notes">{config.label}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={config.placeholder}
              rows={4}
              required={config.required}
              className="resize-none"
            />
            {config.required && <p className="text-xs text-gray-500">This field is required</p>}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={config.buttonVariant}
            onClick={handleSubmit}
            disabled={isSubmitting || (config.required && !notes.trim())}
          >
            {isSubmitting ? 'Processing...' : config.buttonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
