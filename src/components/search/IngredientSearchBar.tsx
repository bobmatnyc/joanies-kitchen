'use client';

import { Loader2, Search, X } from 'lucide-react';
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
import type { Ingredient } from '@/lib/db/schema';
import { cn } from '@/lib/utils';

interface IngredientSearchBarProps {
  selectedIngredients: Ingredient[];
  onIngredientsChange: (ingredients: Ingredient[]) => void;
  onSearch: () => void;
  placeholder?: string;
  className?: string;
}

export function IngredientSearchBar({
  selectedIngredients,
  onIngredientsChange,
  onSearch,
  placeholder = 'Search ingredients...',
  className,
}: IngredientSearchBarProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<IngredientSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Fetch suggestions with debounce
  const fetchSuggestions = useCallback(
    async (searchQuery: string) => {
      setLoading(true);
      try {
        const result = await getIngredientSuggestions(searchQuery, { limit: 15 });
        if (result.success) {
          // Filter out already selected ingredients
          const filtered = result.suggestions.filter(
            (suggestion) => !selectedIngredients.some((selected) => selected.id === suggestion.id)
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

  // Debounced search
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
    if (!selectedIngredients.some((i) => i.id === suggestion.id)) {
      // Convert IngredientSuggestion to Ingredient type
      const ingredient: Ingredient = {
        id: suggestion.id,
        name: suggestion.name,
        display_name: suggestion.displayName,
        category: suggestion.category,
        is_common: suggestion.isCommon,
        // Fill in required fields with defaults
        created_at: new Date(),
        updated_at: new Date(),
        common_units: null,
        aliases: null,
        is_allergen: false,
        typical_unit: null,
      };
      onIngredientsChange([...selectedIngredients, ingredient]);
      setQuery('');
      setHighlightedIndex(-1);
    }
  };

  // Handle ingredient removal
  const handleRemoveIngredient = (ingredientId: string) => {
    onIngredientsChange(selectedIngredients.filter((i) => i.id !== ingredientId));
  };

  // Clear all selected ingredients
  const handleClearAll = () => {
    onIngredientsChange([]);
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
          onSearch();
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
                  'w-full pl-10 pr-10 h-10 rounded-md border border-input bg-background',
                  'text-sm font-ui placeholder:text-muted-foreground',
                  'focus:outline-none focus:border-ring focus:ring-ring/50 focus:ring-[3px]',
                  'transition-[color,box-shadow]'
                )}
                aria-label="Search for ingredients"
                aria-autocomplete="list"
                aria-controls="ingredient-suggestions"
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
              <CommandList id="ingredient-suggestions">
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

        <div className="flex gap-2">
          {selectedIngredients.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={handleClearAll}
              className="border-jk-sage text-jk-clay hover:bg-jk-sage/20"
              aria-label="Clear all selected ingredients"
            >
              <X className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}
          <Button
            type="button"
            onClick={onSearch}
            disabled={selectedIngredients.length === 0}
            className="bg-jk-tomato hover:bg-jk-tomato/90 text-white min-w-[100px]"
            aria-label="Search recipes with selected ingredients"
          >
            <Search className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">
              Search {selectedIngredients.length > 0 && `(${selectedIngredients.length})`}
            </span>
            <span className="sm:hidden">Go</span>
          </Button>
        </div>
      </div>

      {/* Selected ingredients tags */}
      {selectedIngredients.length > 0 && (
        <div className="flex flex-wrap gap-2" role="list" aria-label="Selected ingredients">
          {selectedIngredients.map((ingredient) => (
            <Badge
              key={ingredient.id}
              variant="secondary"
              className="gap-2 pl-3 pr-2 py-1.5 bg-jk-sage/20 text-jk-olive border-jk-sage hover:bg-jk-sage/30"
              role="listitem"
            >
              <span className="font-ui">{ingredient.display_name}</span>
              <button
                type="button"
                onClick={() => handleRemoveIngredient(ingredient.id)}
                className="hover:text-destructive transition-colors"
                aria-label={`Remove ${ingredient.display_name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
