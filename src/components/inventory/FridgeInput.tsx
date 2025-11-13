'use client';

import { Loader2, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getIngredientSuggestions } from '@/app/actions/ingredient-search';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { IngredientSuggestion } from '@/types/ingredient-search';

interface FridgeInputProps {
  onSearch: (ingredients: string[]) => Promise<void>;
  placeholder?: string;
  className?: string;
}

/**
 * FridgeInput Component - Enhanced Version with Autocomplete
 *
 * Ingredient entry with autocomplete suggestions
 * Features:
 * - Autocomplete dropdown with debouncing (300ms)
 * - Selected ingredients displayed as badge chips
 * - Remove individual ingredients
 * - Keyboard navigation (Enter to search, Escape to close dropdown)
 * - Loading state during search
 * - Falls back to manual entry
 *
 * Example workflow:
 * 1. User types "chic" → sees ["chicken", "chicken breast", "chicken thighs"]
 * 2. User clicks "chicken" → added as badge chip
 * 3. User types "rice" → sees ["rice", "brown rice", "jasmine rice"]
 * 4. User clicks "Find Recipes" → search with ["chicken", "rice"]
 */
export function FridgeInput({
  onSearch,
  placeholder = "What's in your fridge? Start typing...",
  className,
}: FridgeInputProps) {
  const [input, setInput] = useState('');
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<IngredientSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Debounced autocomplete
  useEffect(() => {
    if (input.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer for debounced search
    debounceTimerRef.current = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const result = await getIngredientSuggestions(input, { limit: 8 });
        if (result.success) {
          setSuggestions(result.suggestions);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error('Autocomplete failed:', error);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300); // 300ms debounce

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [input]);

  // Add ingredient from suggestions
  const handleAddIngredient = (suggestion: IngredientSuggestion) => {
    if (!selectedIngredients.includes(suggestion.name)) {
      setSelectedIngredients([...selectedIngredients, suggestion.name]);
    }
    setInput('');
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  // Remove ingredient
  const handleRemoveIngredient = (ingredient: string) => {
    setSelectedIngredients(selectedIngredients.filter((i) => i !== ingredient));
  };

  // Handle search
  const handleSearch = async () => {
    if (selectedIngredients.length === 0 && !input.trim()) return;

    setSearching(true);
    try {
      // Include any typed input if not in suggestions
      const ingredients = [...selectedIngredients];
      if (input.trim() && !selectedIngredients.includes(input.trim())) {
        ingredients.push(input.trim());
      }

      if (ingredients.length > 0) {
        await onSearch(ingredients);
      }
    } finally {
      setSearching(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !showSuggestions) {
      handleSearch();
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className={cn('w-full max-w-3xl mx-auto space-y-3', className)}>
      {/* Selected Ingredients Chips */}
      {selectedIngredients.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedIngredients.map((ingredient) => (
            <Badge
              key={ingredient}
              variant="secondary"
              className="bg-jk-sage/20 text-jk-olive border-jk-sage capitalize text-sm py-1.5 pl-3 pr-2 gap-1"
            >
              {ingredient}
              <button
                type="button"
                onClick={() => handleRemoveIngredient(ingredient)}
                className="hover:bg-jk-sage/30 rounded-full p-0.5 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input with Autocomplete */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder={placeholder}
              disabled={searching}
              className="h-12 text-base px-4"
            />

            {/* Autocomplete Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-jk-sage/20 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {loadingSuggestions && (
                  <div className="p-3 text-center text-sm text-jk-charcoal/60">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  </div>
                )}
                {!loadingSuggestions &&
                  suggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => handleAddIngredient(suggestion)}
                      className="w-full text-left px-4 py-3 hover:bg-jk-sage/10 border-b border-jk-sage/10 last:border-b-0 transition-colors"
                    >
                      <div className="font-medium text-sm text-jk-olive">
                        {suggestion.displayName}
                      </div>
                      {suggestion.category && (
                        <div className="text-xs text-jk-charcoal/60 capitalize mt-0.5">
                          {suggestion.category}
                        </div>
                      )}
                    </button>
                  ))}
              </div>
            )}
          </div>

          <Button
            onClick={handleSearch}
            disabled={searching || (selectedIngredients.length === 0 && !input.trim())}
            size="lg"
            className="h-12 px-6 gap-2 bg-jk-tomato hover:bg-jk-tomato/90"
          >
            {searching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Find Recipes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
