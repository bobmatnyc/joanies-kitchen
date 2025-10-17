'use client';

import { Clock, Command, Loader2, Search, Sparkles, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSearchSuggestions } from '@/app/actions/semantic-search';
import { Badge } from '@/components/ui/badge';
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
import { type SearchMode, SearchModeTooltip } from './SearchModeTooltip';

interface SemanticSearchBarProps {
  defaultQuery?: string;
  defaultMode?: SearchMode;
  onSearch?: (query: string, mode: SearchMode) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  showExamples?: boolean;
}

/**
 * Main search interface with mode switching and intelligent suggestions
 *
 * Features:
 * - Three search modes: Semantic (AI), Text (exact), Hybrid (recommended)
 * - Debounced suggestions (300ms)
 * - Recent searches (localStorage)
 * - Keyboard shortcuts (Cmd+K to focus)
 * - Example queries for inspiration
 *
 * @example
 * <SemanticSearchBar
 *   defaultMode="hybrid"
 *   onSearch={(query, mode) => handleSearch(query, mode)}
 * />
 */
export function SemanticSearchBar({
  defaultQuery = '',
  defaultMode = 'hybrid',
  onSearch,
  placeholder,
  className,
  autoFocus = false,
  showExamples = true,
}: SemanticSearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Parse URL params
  const urlQuery = searchParams.get('q') || defaultQuery;
  const urlMode = (searchParams.get('mode') as SearchMode) || defaultMode;

  // State
  const [query, setQuery] = useState(urlQuery);
  const [mode, setMode] = useState<SearchMode>(urlMode);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('recentSearches');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setRecentSearches(Array.isArray(parsed) ? parsed.slice(0, 5) : []);
      } catch {
        setRecentSearches([]);
      }
    }
  }, []);

  // Keyboard shortcut: Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch suggestions with debounce
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const result = await getSearchSuggestions(searchQuery, 10);
      if (result.success) {
        setSuggestions(result.suggestions);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

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

  // Save to recent searches
  const saveToRecentSearches = (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    const updated = [trimmed, ...recentSearches.filter((s) => s !== trimmed)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  // Handle search submission
  const handleSearch = (searchQuery?: string) => {
    const finalQuery = searchQuery || query;
    if (!finalQuery.trim()) return;

    saveToRecentSearches(finalQuery);
    setOpen(false);

    if (onSearch) {
      onSearch(finalQuery, mode);
    } else {
      // Navigate to search results page
      const params = new URLSearchParams();
      params.set('q', finalQuery);
      params.set('mode', mode);
      router.push(`/search?${params.toString()}`);
    }
  };

  // Handle mode change
  const handleModeChange = (newMode: string) => {
    setMode(newMode as SearchMode);
  };

  // Clear search
  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    inputRef.current?.focus();
  };

  // Example queries based on mode
  const exampleQueries = {
    semantic: [
      'Comfort food for a cold day',
      'Quick healthy lunch under 30 minutes',
      'Romantic dinner for two',
      'Spicy Asian appetizers',
      'Vegetarian protein-rich dinners',
    ],
    text: [
      'chocolate chip cookies',
      'margherita pizza',
      'pad thai',
      'chicken tikka masala',
      'caesar salad',
    ],
    hybrid: [
      'Italian pasta with creamy sauce',
      'Easy weeknight chicken recipes',
      'Spicy Mexican street food',
      'Light summer salads',
      'Warming winter soups',
    ],
  };

  const placeholderText =
    placeholder ||
    {
      semantic: "Describe what you're craving...",
      text: 'Search by recipe name or ingredient...',
      hybrid: 'Search recipes naturally...',
    }[mode];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Mode selector */}
      <div className="flex items-center justify-center gap-2">
        <Tabs value={mode} onValueChange={handleModeChange}>
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="semantic" className="gap-1.5 text-xs sm:text-sm">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Semantic</span>
              <span className="sm:hidden">AI</span>
            </TabsTrigger>
            <TabsTrigger value="hybrid" className="gap-1.5 text-xs sm:text-sm">
              <span className="hidden sm:inline">Hybrid</span>
              <span className="sm:hidden">Mix</span>
              <Badge variant="secondary" className="ml-1 text-xs hidden md:inline-flex">
                Best
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="text" className="gap-1.5 text-xs sm:text-sm">
              <Search className="h-3.5 w-3.5" />
              <span>Text</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <SearchModeTooltip mode={mode} />
      </div>

      {/* Search input */}
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-jk-clay/60 h-4 w-4 pointer-events-none z-10" />
              <input
                ref={inputRef}
                type="text"
                placeholder={placeholderText}
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
                  'w-full pl-10 pr-10 h-12 rounded-lg border-2 border-jk-sage bg-background',
                  'text-base font-ui placeholder:text-muted-foreground',
                  'focus:outline-none focus:border-jk-clay focus:ring-4 focus:ring-jk-clay/20',
                  'transition-all'
                )}
                aria-label="Search recipes"
                aria-autocomplete="list"
                aria-controls="search-suggestions"
                aria-expanded={open}
              />
              {query && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-jk-clay/60 hover:text-jk-clay z-10"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {/* Keyboard hint */}
              <kbd className="hidden sm:flex absolute right-12 top-1/2 transform -translate-y-1/2 items-center gap-1 px-2 py-1 text-xs text-jk-clay/60 bg-jk-sage/20 rounded border border-jk-sage/40">
                <Command className="h-3 w-3" />K
              </kbd>
            </div>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0"
            align="start"
            side="bottom"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <CommandPrimitive>
              <CommandList id="search-suggestions">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-jk-clay" />
                  </div>
                ) : (
                  <>
                    {/* Suggestions */}
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

                    {/* Recent searches */}
                    {recentSearches.length > 0 && suggestions.length === 0 && (
                      <CommandGroup heading="Recent Searches">
                        {recentSearches.map((search, index) => (
                          <CommandItem
                            key={index}
                            value={search}
                            onSelect={() => handleSearch(search)}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Clock className="h-4 w-4 text-jk-clay/60" />
                            <span className="font-ui">{search}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}

                    {/* Empty state */}
                    {suggestions.length === 0 &&
                      recentSearches.length === 0 &&
                      query.trim().length === 0 && (
                        <CommandEmpty>
                          <div className="py-6 text-center text-sm text-jk-charcoal/70">
                            Start typing to search recipes...
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
          className="bg-jk-tomato hover:bg-jk-tomato/90 text-white px-6 h-12"
          size="lg"
          aria-label="Search recipes"
        >
          <Search className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Search</span>
        </Button>
      </div>

      {/* Example queries */}
      {showExamples && (
        <div className="flex flex-wrap gap-2 justify-center">
          <span className="text-xs text-jk-charcoal/60 font-ui self-center">Try:</span>
          {exampleQueries[mode].slice(0, 3).map((example, index) => (
            <button
              key={index}
              type="button"
              onClick={() => {
                setQuery(example);
                handleSearch(example);
              }}
              className="text-xs text-jk-clay hover:text-jk-olive underline underline-offset-2 transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
