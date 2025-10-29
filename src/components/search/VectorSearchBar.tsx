'use client';

import { ChefHat, Loader2, Search, Utensils } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { searchChefs } from '@/app/actions/chefs';
import { getUserMeals } from '@/app/actions/meals';
import { getSearchSuggestions } from '@/app/actions/semantic-search';
import { Button } from '@/components/ui/button';
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  Command as CommandPrimitive,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type SearchType = 'recipes' | 'meals' | 'chefs';

interface VectorSearchBarProps {
  className?: string;
  autoFocus?: boolean;
}

/**
 * Vector-driven search component for homepage
 * Searches across recipes, meals, and chefs using embeddings
 */
export function VectorSearchBar({ className, autoFocus = false }: VectorSearchBarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const [searchType, setSearchType] = useState<SearchType>('recipes');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Fetch suggestions with debounce
  const fetchSuggestions = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        if (searchType === 'recipes') {
          const result = await getSearchSuggestions(searchQuery, 8);
          if (result.success) {
            setSuggestions(result.suggestions);
          }
        } else if (searchType === 'chefs') {
          const result = await searchChefs(searchQuery);
          if (result.success && result.chefs) {
            setSuggestions(result.chefs.slice(0, 8).map((chef) => chef.name));
          }
        } else if (searchType === 'meals') {
          const result = await getUserMeals();
          if (result.success && result.data) {
            const filtered = result.data
              .filter((meal) => meal.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .slice(0, 8)
              .map((meal) => meal.name);
            setSuggestions(filtered);
          }
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [searchType]
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
    } else {
      setSuggestions([]);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, fetchSuggestions]);

  const handleSearch = (searchQuery?: string) => {
    const finalQuery = searchQuery || query;
    if (!finalQuery.trim()) return;

    setOpen(false);

    // Navigate based on search type
    if (searchType === 'recipes') {
      router.push(`/search?q=${encodeURIComponent(finalQuery)}&mode=hybrid`);
    } else if (searchType === 'chefs') {
      router.push(`/discover/chefs?q=${encodeURIComponent(finalQuery)}`);
    } else if (searchType === 'meals') {
      router.push(`/meals?q=${encodeURIComponent(finalQuery)}`);
    }
  };

  const placeholders: Record<SearchType, string> = {
    recipes: 'Search recipes by name, cuisine, or ingredients...',
    meals: 'Find your saved meals...',
    chefs: 'Search for chefs...',
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search type tabs */}
      <div className="flex items-center justify-center">
        <Tabs value={searchType} onValueChange={(value) => setSearchType(value as SearchType)}>
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="recipes" className="gap-1.5 text-xs sm:text-sm">
              <Search className="h-3.5 w-3.5" />
              <span>Recipes</span>
            </TabsTrigger>
            <TabsTrigger value="meals" className="gap-1.5 text-xs sm:text-sm">
              <Utensils className="h-3.5 w-3.5" />
              <span>Meals</span>
            </TabsTrigger>
            <TabsTrigger value="chefs" className="gap-1.5 text-xs sm:text-sm">
              <ChefHat className="h-3.5 w-3.5" />
              <span>Chefs</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Search input */}
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-jk-clay/60 h-5 w-5 pointer-events-none z-10" />
              <input
                ref={inputRef}
                type="text"
                placeholder={placeholders[searchType]}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                  } else if (e.key === 'Escape') {
                    setOpen(false);
                  }
                }}
                className={cn(
                  'w-full pl-12 pr-4 h-14 rounded-lg border-2 border-jk-sage bg-white',
                  'text-lg font-ui placeholder:text-muted-foreground',
                  'focus:outline-none focus:border-jk-clay focus:ring-4 focus:ring-jk-clay/20',
                  'transition-all shadow-sm'
                )}
                aria-label={`Search ${searchType}`}
              />
            </div>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0"
            align="start"
            side="bottom"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <CommandPrimitive>
              <CommandList>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-jk-clay" />
                  </div>
                ) : (
                  <>
                    {suggestions.length > 0 && (
                      <CommandGroup heading="Suggestions">
                        {suggestions.map((suggestion, index) => (
                          <CommandItem
                            key={index}
                            value={suggestion}
                            onSelect={() => handleSearch(suggestion)}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Search className="h-4 w-4 text-jk-clay/60" />
                            <span className="font-ui">{suggestion}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}

                    {suggestions.length === 0 && query.trim().length === 0 && (
                      <CommandEmpty>
                        <div className="py-6 text-center text-sm text-jk-charcoal/70">
                          Start typing to search {searchType}...
                        </div>
                      </CommandEmpty>
                    )}

                    {suggestions.length === 0 && query.trim().length >= 2 && !loading && (
                      <CommandEmpty>
                        <div className="py-6 text-center text-sm text-jk-charcoal/70">
                          No suggestions found. Press Enter to search.
                        </div>
                      </CommandEmpty>
                    )}
                  </>
                )}
              </CommandList>
            </CommandPrimitive>
          </PopoverContent>
        </Popover>

        <Button
          onClick={() => handleSearch()}
          disabled={!query.trim() || loading}
          className="bg-jk-tomato hover:bg-jk-tomato/90 text-white px-8 h-14 text-lg"
          size="lg"
        >
          <Search className="h-5 w-5 sm:mr-2" />
          <span className="hidden sm:inline">Search</span>
        </Button>
      </div>
    </div>
  );
}
