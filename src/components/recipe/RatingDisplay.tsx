'use client';

import { Star, StarHalf } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingDisplayProps {
  averageRating: number | string | null;
  totalRatings: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * RatingDisplay Component
 *
 * Displays average rating as stars with optional count
 * - Shows filled stars, half stars, and empty stars
 * - Supports multiple sizes
 * - Optionally clickable to scroll to reviews
 * - Accessible with ARIA labels
 *
 * @example
 * <RatingDisplay
 *   averageRating={4.5}
 *   totalRatings={127}
 *   size="md"
 *   showCount
 *   onClick={() => scrollToReviews()}
 * />
 */
export function RatingDisplay({
  averageRating,
  totalRatings,
  size = 'md',
  showCount = true,
  onClick,
  className,
}: RatingDisplayProps) {
  // Parse rating to number
  const rating = averageRating
    ? typeof averageRating === 'string'
      ? parseFloat(averageRating)
      : averageRating
    : 0;

  // Size variants
  const sizeClasses = {
    sm: 'text-xs gap-1',
    md: 'text-sm gap-1.5',
    lg: 'text-base gap-2',
  };

  const starSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  // Render stars based on rating
  const renderStars = () => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.25 && rating % 1 < 0.75;
    const hasThreeQuarterStar = rating % 1 >= 0.75;

    // Add full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <Star
          key={`full-${i}`}
          className={cn(starSizeClasses[size], 'fill-[#FFD700] text-[#FFD700]')}
          aria-hidden="true"
        />
      );
    }

    // Add half or three-quarter star (render as full if >= 0.75)
    if (hasThreeQuarterStar && fullStars < 5) {
      stars.push(
        <Star
          key="three-quarter"
          className={cn(starSizeClasses[size], 'fill-[#FFD700] text-[#FFD700]')}
          aria-hidden="true"
        />
      );
    } else if (hasHalfStar && fullStars < 5) {
      stars.push(
        <StarHalf
          key="half"
          className={cn(starSizeClasses[size], 'fill-[#FFD700] text-[#FFD700]')}
          aria-hidden="true"
        />
      );
    }

    // Calculate empty stars
    const filledStarsCount = hasHalfStar || hasThreeQuarterStar ? fullStars + 1 : fullStars;
    const emptyStars = 5 - filledStarsCount;

    // Add empty stars
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <Star
          key={`empty-${i}`}
          className={cn(starSizeClasses[size], 'text-gray-300 dark:text-gray-600')}
          aria-hidden="true"
        />
      );
    }

    return stars;
  };

  // No ratings state
  if (totalRatings === 0 || !averageRating) {
    return (
      <div
        className={cn('flex items-center', sizeClasses[size], className)}
        role="img"
        aria-label="No ratings yet"
      >
        <div className="flex items-center gap-0.5">{renderStars()}</div>
        <span className="text-muted-foreground ml-1.5">No ratings yet</span>
      </div>
    );
  }

  // With ratings
  const Component = onClick ? 'button' : 'div';
  const interactiveClasses = onClick
    ? 'cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md px-1 -mx-1'
    : '';

  return (
    <Component
      className={cn('flex items-center', sizeClasses[size], interactiveClasses, className)}
      onClick={onClick}
      role="img"
      aria-label={`Average rating: ${rating.toFixed(1)} out of 5 stars${showCount ? ` from ${totalRatings.toLocaleString()} ${totalRatings === 1 ? 'rating' : 'ratings'}` : ''}`}
      {...(onClick && { type: 'button' as const })}
    >
      <div className="flex items-center gap-0.5">{renderStars()}</div>
      <span className="font-medium ml-1.5 text-foreground">{rating.toFixed(1)}</span>
      {showCount && (
        <span className="text-muted-foreground ml-0.5">({totalRatings.toLocaleString()})</span>
      )}
    </Component>
  );
}
