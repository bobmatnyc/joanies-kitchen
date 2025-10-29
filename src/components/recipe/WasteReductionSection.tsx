'use client';

import { ChefHat, Clock, Leaf, Recycle, RefreshCw, Sun } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface WasteReductionSectionProps {
  resourcefulnessScore?: number | null;
  wasteReductionTags?: string | null; // JSON string
  scrapUtilizationNotes?: string | null;
  environmentalNotes?: string | null;
  className?: string;
}

// Tag type mapping with icons and colors
const WASTE_REDUCTION_TAGS: Record<string, { label: string; icon: typeof Recycle; color: string }> =
  {
    'uses-scraps': {
      label: 'Uses Scraps',
      icon: Recycle,
      color: 'bg-green-100 text-green-700 border-green-200',
    },
    'one-pot': {
      label: 'One Pot',
      icon: ChefHat,
      color: 'bg-blue-100 text-blue-700 border-blue-200',
    },
    'flexible-ingredients': {
      label: 'Flexible Ingredients',
      icon: RefreshCw,
      color: 'bg-purple-100 text-purple-700 border-purple-200',
    },
    'minimal-waste': {
      label: 'Minimal Waste',
      icon: Leaf,
      color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    },
    'uses-aging': {
      label: 'Uses Aging Produce',
      icon: Clock,
      color: 'bg-orange-100 text-orange-700 border-orange-200',
    },
    seasonal: {
      label: 'Seasonal',
      icon: Sun,
      color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    },
  };

export function WasteReductionSection({
  resourcefulnessScore,
  wasteReductionTags,
  scrapUtilizationNotes,
  environmentalNotes,
  className = '',
}: WasteReductionSectionProps) {
  // Parse tags from JSON string
  let parsedTags: string[] = [];
  if (wasteReductionTags) {
    try {
      parsedTags = JSON.parse(wasteReductionTags);
      if (!Array.isArray(parsedTags)) {
        parsedTags = [];
      }
    } catch (error) {
      console.error('Failed to parse waste reduction tags:', error);
      parsedTags = [];
    }
  }

  // If no data at all, don't render
  if (
    !resourcefulnessScore &&
    parsedTags.length === 0 &&
    !scrapUtilizationNotes &&
    !environmentalNotes
  ) {
    return null;
  }

  return (
    <Card
      className={cn(
        'p-6 border-2 border-jk-sage/20 bg-gradient-to-br from-green-50/50 to-emerald-50/50',
        className
      )}
    >
      {/* Section Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Leaf className="h-6 w-6 text-jk-sage" aria-hidden="true" />
          <h2 className="text-2xl font-display font-semibold text-jk-charcoal">
            Resourcefulness & Waste Reduction
          </h2>
        </div>
        <p className="text-sm text-jk-charcoal/70">
          How this recipe supports sustainable, zero-waste cooking
        </p>
      </div>

      <div className="space-y-6">
        {/* Resourcefulness Score */}
        {resourcefulnessScore && resourcefulnessScore > 0 && (
          <div>
            <h3 className="text-sm font-medium text-jk-charcoal/80 mb-2">Resourcefulness Score</h3>
            <div
              className="flex items-center gap-1"
              role="img"
              aria-label={`Resourcefulness score ${resourcefulnessScore} out of 5`}
            >
              {[1, 2, 3, 4, 5].map((leaf) => (
                <Leaf
                  key={leaf}
                  className={cn(
                    'h-6 w-6 transition-colors',
                    leaf <= resourcefulnessScore ? 'fill-jk-sage text-jk-sage' : 'text-jk-sage/20'
                  )}
                  aria-hidden="true"
                />
              ))}
              <span className="ml-2 text-sm font-medium text-jk-charcoal">
                {resourcefulnessScore}/5
              </span>
            </div>
          </div>
        )}

        {/* Waste-Reduction Tags */}
        {parsedTags.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-jk-charcoal/80 mb-2">
              Sustainability Features
            </h3>
            <div className="flex flex-wrap gap-2">
              {parsedTags.map((tag) => {
                const tagConfig = WASTE_REDUCTION_TAGS[tag];
                if (!tagConfig) return null;

                const Icon = tagConfig.icon;
                return (
                  <Badge
                    key={tag}
                    variant="outline"
                    className={cn(
                      'px-3 py-1.5 text-sm font-medium border flex items-center gap-1.5 min-h-[44px] sm:min-h-0',
                      tagConfig.color
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>{tagConfig.label}</span>
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Scrap Utilization Notes */}
        {scrapUtilizationNotes && (
          <div className="bg-white/80 border-2 border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <Recycle className="h-5 w-5 text-green-600" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-green-900 mb-1">
                  Scrap Utilization Tips
                </h3>
                <p className="text-sm text-jk-charcoal/80 whitespace-pre-wrap">
                  {scrapUtilizationNotes}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Environmental Notes */}
        {environmentalNotes && (
          <div className="bg-white/80 border-2 border-emerald-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <Leaf className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-emerald-900 mb-1">
                  Environmental Impact
                </h3>
                <p className="text-sm text-jk-charcoal/80 whitespace-pre-wrap">
                  {environmentalNotes}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
