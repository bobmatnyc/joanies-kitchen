'use client';

import { Info, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ScoreComponents } from '@/lib/search/ranking';
import { cn } from '@/lib/utils';

interface SimilarityBadgeProps {
  similarity: number;
  rankingScore?: number;
  scoreComponents?: ScoreComponents;
  className?: string;
  showTooltip?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
}

/**
 * Visual indicator of search relevance with similarity scoring
 *
 * Features:
 * - Color-coded by match quality (green: 80-100%, blue: 60-80%, gray: <60%)
 * - Optional tooltip with score breakdown
 * - Three display variants: default, compact, detailed
 *
 * @example
 * <SimilarityBadge similarity={0.87} showTooltip />
 */
export function SimilarityBadge({
  similarity,
  rankingScore,
  scoreComponents,
  className,
  showTooltip = true,
  variant = 'default',
}: SimilarityBadgeProps) {
  const percentage = Math.round(similarity * 100);

  // Determine badge color based on similarity percentage
  const getColorClasses = () => {
    if (percentage >= 80) {
      return {
        badge:
          'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300',
        icon: 'text-green-600',
        label: 'Excellent match',
      };
    }
    if (percentage >= 60) {
      return {
        badge: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300',
        icon: 'text-blue-600',
        label: 'Good match',
      };
    }
    return {
      badge: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300',
      icon: 'text-gray-600',
      label: 'Fair match',
    };
  };

  const colors = getColorClasses();

  // Compact variant for tight spaces
  if (variant === 'compact') {
    return (
      <Badge
        variant="outline"
        className={cn('gap-1 text-xs font-ui font-semibold', colors.badge, className)}
        aria-label={`${percentage}% match`}
      >
        <Sparkles className="h-3 w-3" />
        {percentage}%
      </Badge>
    );
  }

  // Detailed variant with more information
  if (variant === 'detailed') {
    return (
      <div className={cn('rounded-md border p-3', colors.badge, className)}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className={cn('h-4 w-4', colors.icon)} />
            <span className="text-sm font-semibold font-heading">{colors.label}</span>
          </div>
          <Badge className={cn('text-sm font-bold', colors.badge)}>{percentage}%</Badge>
        </div>
        {scoreComponents && (
          <div className="space-y-1 text-xs font-ui mt-2 pt-2 border-t border-current/20">
            <div className="flex justify-between">
              <span className="opacity-80">Similarity:</span>
              <span className="font-semibold">{Math.round(scoreComponents.similarity * 100)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-80">Quality:</span>
              <span className="font-semibold">{Math.round(scoreComponents.quality * 100)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-80">Engagement:</span>
              <span className="font-semibold">{Math.round(scoreComponents.engagement * 100)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-80">Recency:</span>
              <span className="font-semibold">{Math.round(scoreComponents.recency * 100)}%</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default variant with tooltip
  const badgeContent = (
    <Badge
      variant="outline"
      className={cn('gap-1.5 font-ui font-semibold', colors.badge, className)}
      aria-label={`${percentage}% match - ${colors.label}`}
    >
      <Sparkles className={cn('h-3.5 w-3.5', colors.icon)} />
      <span className="text-sm">{percentage}% match</span>
    </Badge>
  );

  // If no tooltip needed, return badge only
  if (!showTooltip) {
    return badgeContent;
  }

  // Return badge with detailed tooltip
  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="cursor-help inline-flex">{badgeContent}</div>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" side="top" align="center">
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-jk-clay mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-jk-olive font-heading">Relevance Score</h4>
              <p className="text-xs text-jk-charcoal/70 mt-1 font-ui">
                This recipe is a <strong>{colors.label.toLowerCase()}</strong> for your search
                query.
              </p>
            </div>
          </div>

          {/* Score breakdown */}
          <div className="space-y-2 pt-2 border-t border-jk-sage/30">
            <div className="flex items-center justify-between text-sm">
              <span className="text-jk-charcoal/70 font-ui">Similarity Score</span>
              <Badge variant="outline" className={cn('text-xs', colors.badge)}>
                {percentage}%
              </Badge>
            </div>

            {rankingScore !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-jk-charcoal/70 font-ui">Overall Ranking</span>
                <Badge variant="outline" className="text-xs">
                  {Math.round(rankingScore * 100)}%
                </Badge>
              </div>
            )}

            {scoreComponents && (
              <div className="space-y-1.5 mt-3 pt-3 border-t border-jk-sage/30">
                <p className="text-xs font-semibold text-jk-olive mb-2">Score Components:</p>
                <ScoreBar label="Semantic Match" value={scoreComponents.similarity} />
                <ScoreBar label="Recipe Quality" value={scoreComponents.quality} />
                <ScoreBar label="User Engagement" value={scoreComponents.engagement} />
                <ScoreBar label="Recency" value={scoreComponents.recency} />
              </div>
            )}
          </div>

          {/* Explanation */}
          <div className="pt-2 border-t border-jk-sage/30">
            <p className="text-xs text-jk-charcoal/60 font-ui">
              {percentage >= 80 &&
                'This recipe closely matches your search intent and preferences.'}
              {percentage >= 60 &&
                percentage < 80 &&
                'This recipe is relevant to your search with good alignment.'}
              {percentage < 60 &&
                'This recipe has some relevance but may differ from your exact search.'}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Visual progress bar for score components
 */
function ScoreBar({ label, value }: { label: string; value: number }) {
  const percentage = Math.round(value * 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-jk-charcoal/70 font-ui">{label}</span>
        <span className="text-jk-clay font-semibold">{percentage}%</span>
      </div>
      <div className="h-1.5 bg-jk-sage/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-jk-tomato rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Similarity badge variants for export
 */
export const CompactSimilarityBadge = (props: Omit<SimilarityBadgeProps, 'variant'>) => (
  <SimilarityBadge {...props} variant="compact" />
);

export const DetailedSimilarityBadge = (props: Omit<SimilarityBadgeProps, 'variant'>) => (
  <SimilarityBadge {...props} variant="detailed" />
);
