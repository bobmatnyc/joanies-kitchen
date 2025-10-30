'use client';

import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getRecipeRatings, getUserRating } from '@/app/actions/rate-recipe';
import { RatingDisplay } from '@/components/recipe/RatingDisplay';
import { RatingInput } from '@/components/recipe/RatingInput';
import { ReviewsList } from '@/components/recipe/ReviewsList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface RecipeRatingsProps {
  recipeId: string;
  averageRating: string | null;
  totalRatings: number;
  currentUserId?: string;
  isAuthenticated: boolean;
}

interface UserRating {
  rating: number;
  review?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

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

/**
 * RecipeRatings Container Component
 *
 * Client component that fetches and displays complete rating system:
 * - Average rating summary
 * - User's rating input (if authenticated)
 * - All reviews list with pagination
 *
 * Handles client-side data fetching and state management.
 *
 * @example
 * <RecipeRatings
 *   recipeId={recipe.id}
 *   averageRating={recipe.avg_user_rating}
 *   totalRatings={recipe.total_user_ratings}
 *   currentUserId={user?.id}
 *   isAuthenticated={!!user}
 * />
 */
export function RecipeRatings({
  recipeId,
  averageRating,
  totalRatings,
  currentUserId,
  isAuthenticated,
}: RecipeRatingsProps) {
  const [userRating, setUserRating] = useState<UserRating | null>(null);
  const [initialReviews, setInitialReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user's current rating and initial reviews
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        // Fetch in parallel
        const [userRatingData, reviewsData] = await Promise.all([
          isAuthenticated ? getUserRating(recipeId) : Promise.resolve(null),
          getRecipeRatings(recipeId, 10, 0),
        ]);

        setUserRating(userRatingData);
        setInitialReviews(reviewsData);
      } catch (error) {
        console.error('Error fetching rating data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [recipeId, isAuthenticated]);

  // Refetch data after user submits a rating
  const handleRatingSuccess = async () => {
    try {
      const [userRatingData, reviewsData] = await Promise.all([
        isAuthenticated ? getUserRating(recipeId) : Promise.resolve(null),
        getRecipeRatings(recipeId, 10, 0),
      ]);

      setUserRating(userRatingData);
      setInitialReviews(reviewsData);
    } catch (error) {
      console.error('Error refetching rating data:', error);
    }
  };

  return (
    <div className="space-y-8" id="ratings-and-reviews">
      {/* Section Header with Rating Summary */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Ratings & Reviews</h2>
        </div>

        {/* Average Rating Display */}
        <Card className="bg-gradient-to-br from-jk-cream/50 to-jk-sage/10 border-jk-sage/20">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <RatingDisplay
                  averageRating={averageRating}
                  totalRatings={totalRatings}
                  size="lg"
                  showCount
                />
                {totalRatings > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Based on {totalRatings.toLocaleString()}{' '}
                    {totalRatings === 1 ? 'rating' : 'ratings'}
                  </p>
                )}
              </div>

              {/* CTA for non-authenticated users */}
              {!isAuthenticated && (
                <div className="w-full sm:w-auto">
                  <Link href="/sign-in">
                    <Button className="w-full sm:w-auto">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Sign in to Rate
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Rating Input (Authenticated Users Only) */}
      {isAuthenticated && !isLoading && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Your Rating</h3>
          <RatingInput
            recipeId={recipeId}
            currentRating={userRating?.rating}
            currentReview={userRating?.review}
            onSuccess={handleRatingSuccess}
          />
        </div>
      )}

      {/* All Reviews Section */}
      {!isLoading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              All Reviews {totalRatings > 0 && `(${totalRatings.toLocaleString()})`}
            </h3>
          </div>

          <ReviewsList
            recipeId={recipeId}
            currentUserId={currentUserId}
            initialReviews={initialReviews}
          />
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-muted rounded w-1/4" />
            <div className="h-32 bg-muted rounded" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </div>
      )}

      {/* Empty State for Non-Authenticated Users */}
      {!isAuthenticated && totalRatings === 0 && (
        <Card className="border-dashed">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">No Reviews Yet</CardTitle>
            <CardDescription>
              Be the first to rate and review this recipe!
              <br />
              <Link href="/sign-in" className="text-primary hover:underline font-medium">
                Sign in to leave a review
              </Link>
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
