'use client';

import { Loader2, Search, X, ChefHat } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getIngredientSuggestions } from '@/app/actions/ingredient-search';
import type { IngredientSuggestion } from '@/types/ingredient-search';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface FridgeInputProps {
  onSearch: (ingredients: string[]) => Promise<void>;
  placeholder?: string;
  maxIngredients?: number;
  className?: string;
}

/**
 * FridgeInput Component - MVP Version
 *
 * Autocomplete ingredient selection with recipe matching
 * Extends IngredientSearchBar pattern for consistency
 *
 * Features:
 * - Debounced autocomplete (300ms)
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Selected ingredients displayed as badge chips
 * - Popular ingredients shown when empty
 * - Mobile-first responsive design
 *
 * Phase 1 (MVP): Simple ingredient name collection
 * Phase 2 (Future): Add quantity, expiry, storage location metadata
 */
export function FridgeInput({
  onSearch,
  placeholder = "What's in your fridge?",
  maxIngredients = 20,
  className,
}: FridgeInputProps) {
  // State management
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<IngredientSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Fetch suggestions with debounce (300ms)
  const fetchSuggestions = useCallback(
    async (searchQuery: string) => {
      setLoading(true);
      try {
        const result = await getIngredientSuggestions(searchQuery, { limit: 15 });
        if (result.success) {
          // Filter out already selected ingredients
          const filtered = result.suggestions.filter(
            (suggestion) => !selectedIngredients.includes(suggestion.name)
          );
          setSuggestions(filtered);
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [selectedIngredients]
  );

  // Debounced search effect
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (query.trim().length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        fetchSuggestions(query);
      }, 300);
    } else if (query.trim().length === 0) {
      // Show popular ingredients when empty
      fetchSuggestions('');
    } else {
      setSuggestions([]);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, fetchSuggestions]);

  // Handle ingredient selection
  const handleSelectIngredient = (suggestion: IngredientSuggestion) => {
    if (!selectedIngredients.includes(suggestion.name)) {
      if (selectedIngredients.length >= maxIngredients) {
        // Max ingredients reached
        return;
      }
      setSelectedIngredients([...selectedIngredients, suggestion.name]);
      setQuery('');
      setHighlightedIndex(-1);
    }
  };

  // Handle ingredient removal
  const handleRemoveIngredient = (ingredientName: string) => {
    setSelectedIngredients(selectedIngredients.filter((name) => name !== ingredientName));
  };

  // Clear all selected ingredients
  const handleClearAll = () => {
    setSelectedIngredients([]);
  };

  // Handle recipe search submission
  const handleSearch = async () => {
    if (selectedIngredients.length === 0) return;

    setSearching(true);
    try {
      await onSearch(selectedIngredients);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
          handleSelectIngredient(suggestions[highlightedIndex]);
        } else if (selectedIngredients.length > 0) {
          handleSearch();
          setOpen(false);
        }
        break;
      case 'Escape':
        setOpen(false);
        setQuery('');
        break;
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Search Input + Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-jk-clay/60 h-4 w-4 pointer-events-none z-10" />
              <input
                type="text"
                placeholder={placeholder}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => {
                  setOpen(true);
                  if (query.trim().length === 0) {
                    fetchSuggestions('');
                  }
                }}
                onKeyDown={handleKeyDown}
                className={cn(
                  'w-full pl-10 pr-10 h-12 rounded-md border border-input bg-background',
                  'text-sm font-ui placeholder:text-muted-foreground',
                  'focus:outline-none focus:border-ring focus:ring-ring/50 focus:ring-[3px]',
                  'transition-[color,box-shadow]',
                  'md:h-10'
                )}
                aria-label="Search for ingredients in your fridge"
                aria-autocomplete="list"
                aria-controls="fridge-ingredient-suggestions"
                aria-expanded={open}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setSuggestions([]);
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-jk-clay/60 hover:text-jk-clay z-10"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0"
            align="start"
            side="bottom"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Command>
              <CommandList id="fridge-ingredient-suggestions">
                {loading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-jk-clay" />
                  </div>
                ) : suggestions.length === 0 ? (
                  <CommandEmpty>
                    {query.trim().length === 0
                      ? 'Start typing to search ingredients...'
                      : 'No ingredients found.'}
                  </CommandEmpty>
                ) : (
                  <CommandGroup
                    heading={query.trim().length === 0 ? 'Popular Ingredients' : 'Suggestions'}
                  >
                    {suggestions.map((ingredient, index) => (
                      <CommandItem
                        key={ingredient.id}
                        value={ingredient.name}
                        onSelect={() => handleSelectIngredient(ingredient)}
                        className={cn(
                          'flex items-center justify-between cursor-pointer',
                          index === highlightedIndex && 'bg-accent'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-ui">{ingredient.displayName}</span>
                          {ingredient.category && (
                            <Badge
                              variant="outline"
                              className="text-xs border-jk-sage text-jk-olive"
                            >
                              {ingredient.category}
                            </Badge>
                          )}
                        </div>
                        {ingredient.isCommon && (
                          <Badge variant="secondary" className="text-xs">
                            Popular
                          </Badge>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {selectedIngredients.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={handleClearAll}
              className="border-jk-sage text-jk-clay hover:bg-jk-sage/20 min-h-[44px] sm:min-h-0"
              aria-label="Clear all selected ingredients"
            >
              <X className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSearch}
            disabled={selectedIngredients.length === 0 || searching}
            className="bg-jk-tomato hover:bg-jk-tomato/90 text-white min-w-[120px] min-h-[44px] sm:min-h-0"
            aria-label="Find recipes with selected ingredients"
          >
            {searching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                <span className="hidden sm:inline">Searching...</span>
              </>
            ) : (
              <>
                <ChefHat className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">
                  Find Recipes {selectedIngredients.length > 0 && `(${selectedIngredients.length})`}
                </span>
                <span className="sm:hidden">Find</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Selected Ingredients Display */}
      {selectedIngredients.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-jk-clay/70 font-ui">
              Selected: {selectedIngredients.length} / {maxIngredients}
            </p>
          </div>
          <div className="flex flex-wrap gap-2" role="list" aria-label="Selected ingredients">
            {selectedIngredients.map((ingredientName) => (
              <Badge
                key={ingredientName}
                variant="secondary"
                className="gap-2 pl-3 pr-2 py-1.5 bg-jk-sage/20 text-jk-olive border-jk-sage hover:bg-jk-sage/30"
                role="listitem"
              >
                <span className="font-ui capitalize">{ingredientName}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveIngredient(ingredientName)}
                  className="hover:text-destructive transition-colors min-w-[16px] min-h-[16px] flex items-center justify-center"
                  aria-label={`Remove ${ingredientName}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
