/**
 * Recipe Rating Component
 *
 * Displays and manages recipe ratings:
 * - System rating (AI-generated quality score)
 * - Community rating (average user ratings)
 * - User rating input (interactive star rating)
 * - Optional review text
 */

'use client';

import { Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { rateRecipe } from '@/app/actions/rate-recipe';

interface RecipeRatingProps {
  recipeId: string;
  systemRating?: number | string | null;
  systemRatingReason?: string | null;
  avgUserRating?: number | string | null;
  totalUserRatings?: number;
  userRating?: number | null;
  userReview?: string | null;
  isAuthenticated?: boolean;
}

/**
 * Converts rating to number, handling string decimals from database
 */
function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isNaN(num) ? null : num;
}

/**
 * Star Rating Display (read-only)
 */
function StarDisplay({
  rating,
  maxStars = 5,
  color = 'yellow',
}: {
  rating: number;
  maxStars?: number;
  color?: 'yellow' | 'blue' | 'green';
}) {
  const colorClasses = {
    yellow: 'fill-yellow-400 text-yellow-400',
    blue: 'fill-blue-500 text-blue-500',
    green: 'fill-green-500 text-green-500',
  };

  return (
    <div className="flex gap-1">
      {Array.from({ length: maxStars }).map((_, i) => {
        const starValue = i + 1;
        const isFilled = starValue <= Math.round(rating);

        return (
          <Star key={i} className={`w-4 h-4 ${isFilled ? colorClasses[color] : 'text-gray-300'}`} />
        );
      })}
    </div>
  );
}

/**
 * Interactive Star Rating Input
 */
function StarRatingInput({
  rating,
  onChange,
  disabled = false,
}: {
  rating: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="flex gap-2">
      {Array.from({ length: 5 }).map((_, i) => {
        const starValue = i + 1;
        const isFilled = starValue <= (hoverRating || rating);

        return (
          <button
            key={i}
            type="button"
            onClick={() => !disabled && onChange(starValue)}
            onMouseEnter={() => !disabled && setHoverRating(starValue)}
            onMouseLeave={() => !disabled && setHoverRating(0)}
            disabled={disabled}
            className="transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Rate ${starValue} stars`}
          >
            <Star
              className={`w-8 h-8 ${
                isFilled ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Main Recipe Rating Component
 */
export function RecipeRating({
  recipeId,
  systemRating: systemRatingProp,
  systemRatingReason,
  avgUserRating: avgUserRatingProp,
  totalUserRatings = 0,
  userRating: initialUserRating,
  userReview: initialUserReview,
  isAuthenticated = false,
}: RecipeRatingProps) {
  const router = useRouter();

  // Convert props to numbers
  const systemRating = toNumber(systemRatingProp);
  const avgUserRating = toNumber(avgUserRatingProp);

  // Local state for user rating
  const [selectedRating, setSelectedRating] = useState(initialUserRating || 0);
  const [review, setReview] = useState(initialUserReview || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmitRating = async () => {
    if (selectedRating === 0) {
      setError('Please select a rating');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await rateRecipe(recipeId, selectedRating, review);

      if (result.success) {
        setSuccessMessage(
          initialUserRating ? 'Rating updated successfully!' : 'Rating submitted successfully!'
        );

        // Refresh the page to show updated ratings
        setTimeout(() => {
          router.refresh();
        }, 1000);
      } else {
        setError(result.error || 'Failed to save rating');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* System Rating (AI Quality Score) */}
      {systemRating !== null && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-medium text-blue-900">AI Quality Score</span>
            <StarDisplay rating={systemRating} color="blue" />
            <span className="text-sm font-semibold text-blue-900">
              {systemRating.toFixed(1)}/5.0
            </span>
          </div>
          {systemRatingReason && <p className="text-sm text-blue-700 mt-2">{systemRatingReason}</p>}
        </div>
      )}

      {/* Community Rating (Average User Ratings) */}
      {avgUserRating !== null && totalUserRatings > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-green-900">Community Rating</span>
            <StarDisplay rating={avgUserRating} color="green" />
            <span className="text-sm font-semibold text-green-900">
              {avgUserRating.toFixed(1)}/5.0
            </span>
            <span className="text-xs text-green-700">
              ({totalUserRatings} {totalUserRatings === 1 ? 'rating' : 'ratings'})
            </span>
          </div>
        </div>
      )}

      {/* User Rating Input */}
      {isAuthenticated ? (
        <div className="border rounded-lg p-4 bg-white">
          <h3 className="font-medium mb-3">
            {initialUserRating ? 'Update Your Rating' : 'Rate This Recipe'}
          </h3>

          <div className="mb-4">
            <StarRatingInput
              rating={selectedRating}
              onChange={setSelectedRating}
              disabled={loading}
            />
            {selectedRating > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                You selected: {selectedRating} star{selectedRating !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="mb-4">
            <label htmlFor="review" className="block text-sm font-medium text-gray-700 mb-2">
              Review (optional)
            </label>
            <textarea
              id="review"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Share your thoughts about this recipe..."
              className="w-full p-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={4}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-700">{successMessage}</p>
            </div>
          )}

          <button
            onClick={handleSubmitRating}
            disabled={loading || selectedRating === 0}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Saving...' : initialUserRating ? 'Update Rating' : 'Submit Rating'}
          </button>
        </div>
      ) : (
        <div className="border rounded-lg p-4 bg-gray-50">
          <p className="text-sm text-gray-600 text-center">Please sign in to rate this recipe</p>
        </div>
      )}
    </div>
  );
}
