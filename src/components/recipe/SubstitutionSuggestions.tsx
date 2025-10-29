'use client';

/**
 * SubstitutionSuggestions Component
 *
 * Displays smart ingredient substitution suggestions for missing ingredients.
 * Features:
 * - Fetches substitutions for missing ingredients
 * - Shows confidence indicators (star ratings)
 * - Expandable/collapsible per ingredient
 * - Highlights substitutions user has in inventory
 * - Mobile-first responsive design
 * - Loading states and error handling
 */

import { CheckCircle2, ChevronDown, ChevronUp, Info, Lightbulb, Loader2, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getMultipleIngredientSubstitutions } from '@/app/actions/substitutions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { SubstitutionConfidence, SubstitutionResult } from '@/lib/substitutions/types';

interface SubstitutionSuggestionsProps {
  /** Missing ingredients to find substitutions for */
  missingIngredients: string[];

  /** Recipe name for context */
  recipeName?: string;

  /** User's available ingredients for highlighting */
  userIngredients?: string[];

  /** Optional CSS class */
  className?: string;
}

/**
 * Get star count based on confidence level
 */
function getConfidenceStars(confidence: SubstitutionConfidence): number {
  switch (confidence) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 1;
  }
}

/**
 * Get color classes for confidence badge
 */
function getConfidenceBadgeColor(confidence: SubstitutionConfidence): string {
  switch (confidence) {
    case 'high':
      return 'bg-green-600 hover:bg-green-600/90';
    case 'medium':
      return 'bg-yellow-600 hover:bg-yellow-600/90';
    case 'low':
      return 'bg-orange-600 hover:bg-orange-600/90';
    default:
      return 'bg-gray-600';
  }
}

/**
 * Individual substitution card for one ingredient
 */
function SubstitutionCard({
  result,
  isExpanded,
  onToggle,
}: {
  result: SubstitutionResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasSubstitutions = result.substitutions.length > 0;
  const userAvailableCount = result.substitutions.filter((s) => s.is_user_available).length;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Lightbulb className="h-5 w-5 text-jk-sage shrink-0" />
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{result.ingredient}</h4>
            {hasSubstitutions && (
              <p className="text-xs text-muted-foreground">
                {result.substitutions.length} option{result.substitutions.length !== 1 ? 's' : ''}
                {userAvailableCount > 0 && (
                  <span className="text-green-700 font-medium ml-1">
                    ({userAvailableCount} you have)
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasSubstitutions ? (
            <Badge variant="secondary" className="bg-jk-sage/10 text-jk-sage">
              {result.substitutions.length}
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-gray-100 text-gray-600">
              None
            </Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && hasSubstitutions && (
        <div className="border-t bg-gray-50 p-4 space-y-3">
          {result.substitutions.map((sub, idx) => (
            <div
              key={idx}
              className={`bg-white rounded-lg p-3 border-2 ${
                sub.is_user_available ? 'border-green-200 bg-green-50' : 'border-gray-200'
              }`}
            >
              {/* Substitute name and confidence */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h5 className="font-semibold text-sm truncate">{sub.substitute_ingredient}</h5>
                    {sub.is_user_available && (
                      <Badge className="bg-green-600 hover:bg-green-600 shrink-0">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        You Have
                      </Badge>
                    )}
                  </div>

                  {/* Ratio */}
                  {sub.ratio && (
                    <p className="text-xs text-gray-600">
                      Ratio: <span className="font-mono font-medium">{sub.ratio}</span>
                    </p>
                  )}
                  {sub.substitute_amount && (
                    <p className="text-xs text-gray-600 italic">{sub.substitute_amount}</p>
                  )}
                </div>

                {/* Confidence badge and stars */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge className={getConfidenceBadgeColor(sub.confidence)}>
                    {sub.confidence}
                  </Badge>
                  <div className="flex gap-0.5">
                    {Array.from({ length: getConfidenceStars(sub.confidence) }).map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div className="mb-2">
                <div className="flex items-start gap-1.5 text-xs">
                  <Info className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-gray-700 leading-relaxed">{sub.reason}</p>
                </div>
              </div>

              {/* Impact indicators */}
              <div className="flex flex-wrap gap-2 text-xs mb-2">
                {sub.flavor_impact && sub.flavor_impact !== 'none' && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                    Flavor: {sub.flavor_impact}
                  </span>
                )}
                {sub.texture_impact && sub.texture_impact !== 'none' && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                    Texture: {sub.texture_impact}
                  </span>
                )}
              </div>

              {/* Cooking adjustment */}
              {sub.cooking_adjustment && (
                <div className="text-xs bg-yellow-50 border border-yellow-200 rounded p-2 mb-2">
                  <p className="font-medium text-yellow-800 mb-0.5">Cooking Note:</p>
                  <p className="text-yellow-700">{sub.cooking_adjustment}</p>
                </div>
              )}

              {/* Best for / Avoid for */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {sub.best_for && sub.best_for.length > 0 && (
                  <div>
                    <p className="font-medium text-green-700 mb-1">Best for:</p>
                    <ul className="list-disc list-inside text-gray-600 space-y-0.5">
                      {sub.best_for.slice(0, 3).map((item, i) => (
                        <li key={i} className="truncate">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {sub.avoid_for && sub.avoid_for.length > 0 && (
                  <div>
                    <p className="font-medium text-red-700 mb-1">Avoid for:</p>
                    <ul className="list-disc list-inside text-gray-600 space-y-0.5">
                      {sub.avoid_for.slice(0, 3).map((item, i) => (
                        <li key={i} className="truncate">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Source indicator */}
          <div className="text-xs text-gray-500 text-center pt-2 border-t">
            Source:{' '}
            {result.source === 'static'
              ? 'Curated Library'
              : result.source === 'cached'
                ? 'Cached AI'
                : 'AI Generated'}
          </div>
        </div>
      )}

      {/* No substitutions found */}
      {isExpanded && !hasSubstitutions && (
        <div className="border-t bg-gray-50 p-4 text-center">
          <p className="text-sm text-gray-600">
            {result.notes || 'No substitutions available for this ingredient.'}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Main SubstitutionSuggestions component
 */
export function SubstitutionSuggestions({
  missingIngredients,
  recipeName,
  userIngredients,
  className = '',
}: SubstitutionSuggestionsProps) {
  const [results, setResults] = useState<SubstitutionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set([0])); // First item expanded by default
  const [isSectionOpen, setIsSectionOpen] = useState(false); // Section collapsed by default

  useEffect(() => {
    async function fetchSubstitutions() {
      if (!missingIngredients || missingIngredients.length === 0) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const result = await getMultipleIngredientSubstitutions(missingIngredients, {
          recipeName,
          userIngredients,
        });

        if (result.success && result.data) {
          setResults(result.data);
        } else {
          setError(result.error || 'Failed to load substitutions');
        }
      } catch (err) {
        console.error('Error fetching substitutions:', err);
        setError('Failed to load substitutions. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchSubstitutions();
  }, [missingIngredients, recipeName, userIngredients]);

  // Toggle expanded state for an ingredient
  const toggleExpanded = (index: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Expand all
  const expandAll = () => {
    setExpandedItems(new Set(results.map((_, idx) => idx)));
  };

  // Collapse all
  const collapseAll = () => {
    setExpandedItems(new Set());
  };

  // Don't render if no missing ingredients
  if (!missingIngredients || missingIngredients.length === 0) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <Card className={`border-2 border-jk-sage ${className}`}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-jk-sage" />
            Smart Substitutions
          </CardTitle>
        </CardHeader>
        <CardContent className="py-12 flex items-center justify-center">
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-jk-sage mx-auto" />
            <p className="text-sm text-muted-foreground">Finding substitutions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={`border-2 border-red-200 ${className}`}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-red-700">
            <Lightbulb className="h-5 w-5" />
            Smart Substitutions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600 text-center">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (results.length === 0) {
    return null;
  }

  const totalSubstitutions = results.reduce((sum, r) => sum + r.substitutions.length, 0);
  const allExpanded = expandedItems.size === results.length;

  return (
    <Collapsible open={isSectionOpen} onOpenChange={setIsSectionOpen}>
      <Card className={`border-2 border-jk-sage ${className}`}>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left hover:opacity-80 transition-opacity">
              <div className="flex-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-jk-sage" />
                  Smart Substitutions
                  {totalSubstitutions > 0 && (
                    <Badge variant="secondary" className="bg-jk-sage/20 text-jk-sage ml-2">
                      {totalSubstitutions} options
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-1">
                  Can&apos;t find an ingredient? Try these alternatives
                </CardDescription>
              </div>
              {isSectionOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0 ml-2" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0 ml-2" />
              )}
            </button>
          </CollapsibleTrigger>

          {/* Summary stats - shown when expanded */}
          {isSectionOpen && totalSubstitutions > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm flex-wrap">
              {results.some((r) => r.substitutions.some((s) => s.is_user_available)) && (
                <Badge variant="secondary" className="bg-green-600 text-white">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Some you have!
                </Badge>
              )}
              {/* Expand/Collapse all button */}
              {results.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent triggering CollapsibleTrigger
                    allExpanded ? collapseAll() : expandAll();
                  }}
                  className="ml-auto"
                >
                  {allExpanded ? 'Collapse All Items' : 'Expand All Items'}
                </Button>
              )}
            </div>
          )}
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-2">
            {results.map((result, idx) => (
              <SubstitutionCard
                key={idx}
                result={result}
                isExpanded={expandedItems.has(idx)}
                onToggle={() => toggleExpanded(idx)}
              />
            ))}

            {/* Helper tip */}
            <div className="text-xs text-center text-muted-foreground pt-4 border-t">
              💡 Tip: Substitutions marked &quot;You Have&quot; are in your fridge inventory
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
