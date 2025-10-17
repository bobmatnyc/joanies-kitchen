'use client';

import { HelpCircle, Search as SearchIcon, Sparkles, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type SearchMode = 'semantic' | 'text' | 'hybrid';

interface SearchModeInfo {
  label: string;
  description: string;
  icon: React.ReactNode;
  examples: string[];
  badge?: string;
}

const SEARCH_MODES: Record<SearchMode, SearchModeInfo> = {
  semantic: {
    label: 'Semantic Search',
    description:
      "Find recipes by meaning and context using AI-powered understanding. Perfect for describing what you're craving.",
    icon: <Sparkles className="h-4 w-4" />,
    badge: 'AI-Powered',
    examples: ['Comfort food for a cold day', 'Quick healthy lunch', 'Romantic dinner ideas'],
  },
  text: {
    label: 'Text Search',
    description:
      'Find exact matches in recipe names, descriptions, tags, and cuisines. Best for searching specific recipe names.',
    icon: <SearchIcon className="h-4 w-4" />,
    examples: ['chocolate chip cookies', 'pad thai', 'vegetarian lasagna'],
  },
  hybrid: {
    label: 'Hybrid Search',
    description:
      'Combine AI understanding with keyword matching for the best of both worlds. Recommended for most searches.',
    icon: <Zap className="h-4 w-4" />,
    badge: 'Recommended',
    examples: ['spicy pasta dishes', 'easy chicken recipes', 'Italian comfort food'],
  },
};

interface SearchModeTooltipProps {
  mode: SearchMode;
  className?: string;
}

/**
 * Helper component explaining each search mode
 *
 * Provides context-aware help for users to understand the differences
 * between semantic, text, and hybrid search modes.
 *
 * @example
 * <SearchModeTooltip mode="hybrid" />
 */
export function SearchModeTooltip({ mode, className }: SearchModeTooltipProps) {
  const modeInfo = SEARCH_MODES[mode];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center text-jk-clay/60 hover:text-jk-clay transition-colors ${className}`}
          aria-label={`Learn about ${modeInfo.label}`}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" side="bottom" align="center">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start gap-2">
            <div className="flex items-center gap-2 text-jk-olive">
              {modeInfo.icon}
              <h4 className="text-sm font-semibold font-heading">{modeInfo.label}</h4>
            </div>
            {modeInfo.badge && (
              <Badge
                variant="secondary"
                className="text-xs bg-jk-sage/20 text-jk-olive border-jk-sage"
              >
                {modeInfo.badge}
              </Badge>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-jk-charcoal/70 font-ui">{modeInfo.description}</p>

          {/* Examples */}
          <div className="space-y-2 pt-2 border-t border-jk-sage/30">
            <p className="text-xs font-semibold text-jk-olive font-heading">Example Queries:</p>
            <ul className="space-y-1.5">
              {modeInfo.examples.map((example, index) => (
                <li
                  key={index}
                  className="text-xs text-jk-charcoal/70 font-ui flex items-start gap-2"
                >
                  <span className="text-jk-tomato mt-0.5">•</span>
                  <span className="flex-1">{example}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Mode-specific tips */}
          <div className="pt-2 border-t border-jk-sage/30">
            <p className="text-xs text-jk-charcoal/60 font-ui">
              {mode === 'semantic' && (
                <>
                  <strong className="text-jk-olive">Tip:</strong> Use natural language and describe
                  what you want. The AI will understand context and mood.
                </>
              )}
              {mode === 'text' && (
                <>
                  <strong className="text-jk-olive">Tip:</strong> Use specific keywords from recipe
                  names or ingredients for exact matches.
                </>
              )}
              {mode === 'hybrid' && (
                <>
                  <strong className="text-jk-olive">Tip:</strong> Best for combining specific
                  ingredients with cooking style or mood.
                </>
              )}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Comparison of all search modes
 */
export function SearchModeComparison() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Object.entries(SEARCH_MODES).map(([mode, info]) => (
        <div
          key={mode}
          className="p-4 border border-jk-sage rounded-lg space-y-2 hover:border-jk-clay transition-colors"
        >
          <div className="flex items-center gap-2 text-jk-olive">
            {info.icon}
            <h3 className="font-semibold font-heading text-sm">{info.label}</h3>
            {info.badge && (
              <Badge variant="secondary" className="text-xs">
                {info.badge}
              </Badge>
            )}
          </div>
          <p className="text-xs text-jk-charcoal/70 font-ui">{info.description}</p>
          <div className="pt-2 border-t border-jk-sage/30">
            <p className="text-xs font-semibold text-jk-olive mb-1">Examples:</p>
            <ul className="space-y-1">
              {info.examples.slice(0, 2).map((example, index) => (
                <li key={index} className="text-xs text-jk-charcoal/60 font-ui">
                  • {example}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
