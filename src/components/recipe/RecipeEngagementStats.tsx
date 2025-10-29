'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface RecipeEngagementStatsProps {
  likeCount: number;
  forkCount: number;
  collectionCount: number;
  recipeId: string;
  compact?: boolean;
  inline?: boolean;
}

export function RecipeEngagementStats({
  likeCount,
  forkCount,
  collectionCount,
  recipeId,
  compact = false,
  inline = false,
}: RecipeEngagementStatsProps) {
  const stats = [
    {
      label: 'Likes',
      singular: 'like',
      count: likeCount,
      icon: '❤️',
      color: 'text-red-600',
    },
    {
      label: 'Forks',
      singular: 'fork',
      count: forkCount,
      icon: '🍴',
      color: 'text-blue-600',
    },
    {
      label: 'Collections',
      singular: 'collection',
      count: collectionCount,
      icon: '📚',
      color: 'text-green-600',
    },
  ];

  // Only show stats with non-zero counts in compact mode
  const visibleStats = compact ? stats.filter((stat) => stat.count > 0) : stats;

  if (compact && visibleStats.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {visibleStats.map((stat) => (
          <Badge key={stat.label} variant="secondary" className="text-xs">
            <span className="mr-1">{stat.icon}</span>
            {stat.count} {stat.label.toLowerCase()}
          </Badge>
        ))}
      </div>
    );
  }

  // Inline display mode - single row with bullet separators
  if (inline) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        {stats.map((stat, index) => (
          <div key={stat.label} className="flex items-center gap-1.5">
            <span>{stat.icon}</span>
            <span>
              {stat.count} {stat.count === 1 ? stat.singular : stat.label.toLowerCase()}
            </span>
            {index < stats.length - 1 && <span className="ml-4 text-muted-foreground/50">•</span>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Community Engagement</h3>
      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.count}</div>
            <div className="text-xs text-muted-foreground">
              <span className="mr-1">{stat.icon}</span>
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

interface RecipeForkAttributionProps {
  originalRecipeName: string;
  originalRecipeId: string;
  originalRecipeSlug?: string | null;
}

export function RecipeForkAttribution({
  originalRecipeName,
  originalRecipeId,
  originalRecipeSlug,
}: RecipeForkAttributionProps) {
  const href = originalRecipeSlug
    ? `/recipes/${originalRecipeSlug}`
    : `/recipes/${originalRecipeId}`;

  return (
    <Card className="border-l-4 border-l-blue-500 bg-blue-50 p-4 dark:bg-blue-950">
      <div className="flex items-start gap-2">
        <span className="text-2xl">🍴</span>
        <div className="flex-1">
          <p className="text-sm font-medium">Forked Recipe</p>
          <p className="text-sm text-muted-foreground">
            This is your personal version of{' '}
            <Link
              href={href}
              className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              {originalRecipeName}
            </Link>
          </p>
        </div>
      </div>
    </Card>
  );
}
