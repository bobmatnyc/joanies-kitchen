'use client';

import { Star } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { deleteRating, rateRecipe } from '@/app/actions/rate-recipe';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface RatingInputProps {
  recipeId: string;
  currentRating?: number;
  currentReview?: string;
  onSuccess?: () => void;
}

/**
 * RatingInput Component
 *
 * Interactive 5-star rating input with optional review text
 * - Hover effects to preview rating
 * - Optimistic updates for better UX
 * - Expandable review text area
 * - Edit/delete existing ratings
 * - Loading states during submission
 * - Accessible keyboard navigation
 *
 * @example
 * <RatingInput
 *   recipeId="recipe-123"
 *   currentRating={4}
 *   currentReview="Great recipe!"
 *   onSuccess={() => console.log('Rating saved')}
 * />
 */
export function RatingInput({
  recipeId,
  currentRating = 0,
  currentReview = '',
  onSuccess,
}: RatingInputProps) {
  const [rating, setRating] = useState(currentRating);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState(currentReview);
  const [showReview, setShowReview] = useState(!!currentReview);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    startTransition(async () => {
      try {
        const result = await rateRecipe(recipeId, rating, review || undefined);

        if (result.success) {
          toast.success(currentRating ? 'Rating updated!' : 'Rating submitted!');
          onSuccess?.();
        } else {
          toast.error(result.error || 'Failed to save rating');
          // Revert on error
          setRating(currentRating);
          setReview(currentReview);
        }
      } catch (error) {
        console.error('Error submitting rating:', error);
        toast.error('Failed to save rating');
        // Revert on error
        setRating(currentRating);
        setReview(currentReview);
      }
    });
  };

  const handleDelete = async () => {
    if (!currentRating) return;

    const confirmed = window.confirm('Are you sure you want to delete your rating?');
    if (!confirmed) return;

    startTransition(async () => {
      try {
        const result = await deleteRating(recipeId);

        if (result.success) {
          toast.success('Rating deleted');
          setRating(0);
          setReview('');
          setShowReview(false);
          onSuccess?.();
        } else {
          toast.error(result.error || 'Failed to delete rating');
        }
      } catch (error) {
        console.error('Error deleting rating:', error);
        toast.error('Failed to delete rating');
      }
    });
  };

  const handleStarClick = (value: number) => {
    setRating(value);
  };

  const handleStarHover = (value: number) => {
    setHoverRating(value);
  };

  const displayRating = hoverRating || rating;
  const hasChanges = rating !== currentRating || review !== currentReview;
  const canSubmit = rating > 0 && hasChanges && !isPending;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold mb-1">
            {currentRating ? 'Your Rating' : 'Rate this Recipe'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {currentRating
              ? 'Update your rating or add a review'
              : 'Share your experience with this recipe'}
          </p>
        </div>

        {/* Star Rating Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="rating-stars">
            Rating {displayRating > 0 && `(${displayRating} star${displayRating !== 1 ? 's' : ''})`}
          </label>
          <div
            id="rating-stars"
            className="flex gap-1"
            role="radiogroup"
            aria-label="Star rating"
            onMouseLeave={() => setHoverRating(0)}
          >
            {[1, 2, 3, 4, 5].map((value) => {
              const isFilled = value <= displayRating;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleStarClick(value)}
                  onMouseEnter={() => handleStarHover(value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft' && value > 1) {
                      handleStarClick(value - 1);
                    } else if (e.key === 'ArrowRight' && value < 5) {
                      handleStarClick(value + 1);
                    }
                  }}
                  className={cn(
                    'min-w-[44px] min-h-[44px] flex items-center justify-center',
                    'transition-all rounded-md',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    'hover:scale-110',
                    isFilled ? 'opacity-100' : 'opacity-50 hover:opacity-75'
                  )}
                  disabled={isPending}
                  role="radio"
                  aria-checked={value === rating}
                  aria-label={`${value} star${value !== 1 ? 's' : ''}`}
                >
                  <Star
                    className={cn(
                      'w-8 h-8 transition-colors',
                      isFilled
                        ? 'fill-[#FFD700] text-[#FFD700]'
                        : 'text-gray-300 dark:text-gray-600'
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Review Text (Expandable) */}
        {!showReview && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowReview(true)}
            className="w-full"
            disabled={isPending}
          >
            Write a review (optional)
          </Button>
        )}

        {showReview && (
          <div className="space-y-2">
            <label htmlFor="review-text" className="text-sm font-medium">
              Review (optional)
            </label>
            <Textarea
              id="review-text"
              value={review}
              onChange={(e) => setReview(e.target.value.slice(0, 500))}
              placeholder="Share your experience with this recipe..."
              className="min-h-[100px] resize-none"
              disabled={isPending}
              maxLength={500}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{review.length}/500 characters</span>
              {review.length === 0 && (
                <button
                  type="button"
                  onClick={() => setShowReview(false)}
                  className="text-muted-foreground hover:text-foreground underline"
                  disabled={isPending}
                >
                  Hide review
                </button>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSubmit} disabled={!canSubmit} className="flex-1" type="button">
            {isPending ? 'Saving...' : currentRating ? 'Update Rating' : 'Submit Rating'}
          </Button>

          {currentRating > 0 && (
            <Button
              onClick={handleDelete}
              variant="outline"
              disabled={isPending}
              className="text-destructive hover:text-destructive"
              type="button"
            >
              Delete
            </Button>
          )}
        </div>

        {/* Success Feedback */}
        {!hasChanges && currentRating > 0 && (
          <p className="text-sm text-muted-foreground text-center">Your rating has been saved</p>
        )}
      </div>
    </Card>
  );
}
