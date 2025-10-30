'use client';

import { Edit2, Star, Trash2, User } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { getRecipeRatings, rateRecipe, deleteRating } from '@/app/actions/rate-recipe';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface Review {
  id: string;
  userId: string;
  rating: number;
  review: string | null;
  createdAt: Date;
  updatedAt: Date;
  userName: string;
  userAvatar?: string;
}

interface ReviewsListProps {
  recipeId: string;
  currentUserId?: string;
  initialReviews?: Review[];
}

/**
 * ReviewsList Component
 *
 * Display paginated list of recipe reviews
 * - Shows user name, avatar, rating, review text, date
 * - Load more pagination
 * - Edit/delete own reviews
 * - Skeleton loading states
 * - Empty state
 *
 * @example
 * <ReviewsList
 *   recipeId="recipe-123"
 *   currentUserId="user-456"
 *   initialReviews={reviews}
 * />
 */
export function ReviewsList({
  recipeId,
  currentUserId,
  initialReviews = [],
}: ReviewsListProps) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editReview, setEditReview] = useState('');
  const [isPending, startTransition] = useTransition();

  const REVIEWS_PER_PAGE = 10;

  // Load initial reviews on mount if not provided
  useEffect(() => {
    if (initialReviews.length === 0) {
      loadReviews(0);
    }
  }, [recipeId]);

  const loadReviews = async (offset: number) => {
    setIsLoading(true);
    try {
      const newReviews = await getRecipeRatings(recipeId, REVIEWS_PER_PAGE, offset);

      if (offset === 0) {
        setReviews(newReviews);
      } else {
        setReviews((prev) => [...prev, ...newReviews]);
      }

      // If we got fewer reviews than requested, there are no more
      setHasMore(newReviews.length === REVIEWS_PER_PAGE);
    } catch (error) {
      console.error('Error loading reviews:', error);
      toast.error('Failed to load reviews');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = () => {
    loadReviews(reviews.length);
  };

  const handleEdit = (review: Review) => {
    setEditingId(review.id);
    setEditRating(review.rating);
    setEditReview(review.review || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditRating(0);
    setEditReview('');
  };

  const handleSaveEdit = async (reviewId: string) => {
    if (editRating === 0) {
      toast.error('Please select a rating');
      return;
    }

    startTransition(async () => {
      try {
        const result = await rateRecipe(recipeId, editRating, editReview || undefined);

        if (result.success) {
          toast.success('Review updated!');
          // Reload reviews to show updated data
          await loadReviews(0);
          handleCancelEdit();
        } else {
          toast.error(result.error || 'Failed to update review');
        }
      } catch (error) {
        console.error('Error updating review:', error);
        toast.error('Failed to update review');
      }
    });
  };

  const handleDelete = async (reviewId: string) => {
    const confirmed = window.confirm('Are you sure you want to delete your review?');
    if (!confirmed) return;

    startTransition(async () => {
      try {
        const result = await deleteRating(recipeId);

        if (result.success) {
          toast.success('Review deleted');
          // Remove from list
          setReviews((prev) => prev.filter((r) => r.id !== reviewId));
        } else {
          toast.error(result.error || 'Failed to delete review');
        }
      } catch (error) {
        console.error('Error deleting review:', error);
        toast.error('Failed to delete review');
      }
    });
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months !== 1 ? 's' : ''} ago`;
    }
    const years = Math.floor(diffDays / 365);
    return `${years} year${years !== 1 ? 's' : ''} ago`;
  };

  // Empty state
  if (!isLoading && reviews.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No reviews yet. Be the first to review this recipe!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Reviews */}
      {reviews.map((review) => {
        const isEditing = editingId === review.id;
        const isOwner = currentUserId === review.userId;

        return (
          <Card key={review.id}>
            <CardContent className="pt-6">
              {isEditing ? (
                // Edit Mode
                <div className="space-y-4">
                  {/* Star Rating Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Rating</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setEditRating(value)}
                          className={cn(
                            'min-w-[36px] min-h-[36px] flex items-center justify-center',
                            'transition-all rounded-md',
                            'focus:outline-none focus:ring-2 focus:ring-ring',
                            'hover:scale-110'
                          )}
                          disabled={isPending}
                        >
                          <Star
                            className={cn(
                              'w-6 h-6 transition-colors',
                              value <= editRating
                                ? 'fill-[#FFD700] text-[#FFD700]'
                                : 'text-gray-300'
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Review Text */}
                  <div className="space-y-2">
                    <label htmlFor="edit-review-text" className="text-sm font-medium">
                      Review
                    </label>
                    <Textarea
                      id="edit-review-text"
                      value={editReview}
                      onChange={(e) => setEditReview(e.target.value.slice(0, 500))}
                      placeholder="Share your experience..."
                      className="min-h-[80px]"
                      disabled={isPending}
                      maxLength={500}
                    />
                    <p className="text-xs text-muted-foreground">{editReview.length}/500</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleSaveEdit(review.id)}
                      disabled={isPending}
                      size="sm"
                    >
                      {isPending ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      onClick={handleCancelEdit}
                      variant="outline"
                      disabled={isPending}
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                // Display Mode
                <div className="space-y-3">
                  {/* User Info & Actions */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Avatar */}
                      <div
                        className="w-10 h-10 rounded-full bg-jk-sage/20 flex items-center justify-center flex-shrink-0"
                        aria-hidden="true"
                      >
                        {review.userAvatar ? (
                          <img
                            src={review.userAvatar}
                            alt=""
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-jk-olive" />
                        )}
                      </div>

                      {/* User Name & Date */}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{review.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(review.createdAt)}
                        </p>
                      </div>
                    </div>

                    {/* Edit/Delete Buttons (Owner Only) */}
                    {isOwner && (
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          onClick={() => handleEdit(review)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={isPending}
                          aria-label="Edit review"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => handleDelete(review.id)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          disabled={isPending}
                          aria-label="Delete review"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Rating Stars */}
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Star
                        key={value}
                        className={cn(
                          'w-4 h-4',
                          value <= review.rating
                            ? 'fill-[#FFD700] text-[#FFD700]'
                            : 'text-gray-300'
                        )}
                        aria-hidden="true"
                      />
                    ))}
                  </div>

                  {/* Review Text */}
                  {review.review && (
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {review.review}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="animate-pulse space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-muted rounded w-1/4" />
                      <div className="h-3 bg-muted rounded w-1/6" />
                    </div>
                  </div>
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-16 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Load More Button */}
      {hasMore && !isLoading && (
        <div className="text-center pt-4">
          <Button onClick={handleLoadMore} variant="outline" disabled={isLoading}>
            Load More Reviews
          </Button>
        </div>
      )}
    </div>
  );
}
