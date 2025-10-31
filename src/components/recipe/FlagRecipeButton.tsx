/**
 * Flag Recipe Button Component
 *
 * Allows users to report inappropriate content:
 * - Displays a subtle flag button
 * - Opens dialog with reason selection
 * - Optional detailed description
 * - Shows confirmation after submission
 */

'use client';

import { Flag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { type FlagReason, flagRecipe } from '@/app/actions/flag-recipe';
import { toErrorMessage } from '@/lib/utils/error-handling';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface FlagRecipeButtonProps {
  recipeId: string;
  recipeName: string;
  isAuthenticated?: boolean;
  hasUserFlagged?: boolean;
}

const FLAG_REASONS: { value: FlagReason; label: string; description: string }[] = [
  {
    value: 'inappropriate',
    label: 'Inappropriate Content',
    description: 'Contains offensive or inappropriate material',
  },
  {
    value: 'spam',
    label: 'Spam',
    description: 'Promotional content or spam',
  },
  {
    value: 'copyright',
    label: 'Copyright Violation',
    description: 'Unauthorized use of copyrighted content',
  },
  {
    value: 'quality',
    label: 'Quality Issues',
    description: 'Recipe is incomplete, unclear, or inaccurate',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Other issues not covered above',
  },
];

export function FlagRecipeButton({
  recipeId,
  recipeName,
  isAuthenticated = false,
  hasUserFlagged = false,
}: FlagRecipeButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<FlagReason | ''>('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      setError('Please select a reason');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await flagRecipe(recipeId, selectedReason, description);

      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => {
          setOpen(false);
          setShowSuccess(false);
          setSelectedReason('');
          setDescription('');
          router.refresh();
        }, 2000);
      } else {
        setError(result.error || 'Failed to submit flag');
      }
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when dialog closes
      setSelectedReason('');
      setDescription('');
      setError(null);
      setShowSuccess(false);
    }
    setOpen(newOpen);
  };

  if (!isAuthenticated) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        className="text-gray-400 hover:text-gray-500"
        title="Sign in to report content"
      >
        <Flag className="w-4 h-4 mr-2" />
        Report
      </Button>
    );
  }

  if (hasUserFlagged) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        className="text-orange-500"
        title="You have already reported this recipe"
      >
        <Flag className="w-4 h-4 mr-2 fill-orange-500" />
        Reported
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-500 hover:text-red-600 transition-colors"
        >
          <Flag className="w-4 h-4 mr-2" />
          Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        {showSuccess ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <DialogTitle className="text-center mb-2">Report Submitted</DialogTitle>
            <DialogDescription className="text-center">
              Thank you for helping us maintain quality content. Our team will review this report.
            </DialogDescription>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Report Recipe</DialogTitle>
              <DialogDescription>
                Report "{recipeName}" for review. Please provide a reason for your report.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Reason *</Label>
                <Select
                  value={selectedReason}
                  onValueChange={(value) => setSelectedReason(value as FlagReason)}
                  disabled={loading}
                >
                  <SelectTrigger id="reason">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {FLAG_REASONS.map((reason) => (
                      <SelectItem key={reason.value} value={reason.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{reason.label}</span>
                          <span className="text-xs text-gray-500">{reason.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Additional Details (Optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please provide any additional context that might help us review this report..."
                  rows={4}
                  disabled={loading}
                  className="resize-none"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !selectedReason}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {loading ? 'Submitting...' : 'Submit Report'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
