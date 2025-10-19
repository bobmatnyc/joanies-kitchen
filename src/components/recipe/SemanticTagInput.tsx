'use client';

import { Check, Plus, Tag, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { categorizeTags, getCategoryColor, getCategoryIcon } from '@/lib/tag-ontology';
import {
  getPopularTags,
  getRelatedTags,
  normalizeTag,
  searchSemanticTags,
  type SemanticTag,
} from '@/lib/tags/semantic-tags';
import {
  normalizeTagToId,
  getTagLabel,
  type Locale,
  type TagId,
} from '@/lib/tags';

interface SemanticTagInputProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  showPopular?: boolean;
  className?: string;
  locale?: Locale; // Localization support
}

export function SemanticTagInput({
  selectedTags,
  onChange,
  placeholder = 'Type to add tags...',
  maxTags = 20,
  showPopular = true,
  className,
  locale = 'en',
}: SemanticTagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SemanticTag[]>([]);
  const [popularTags] = useState(() => getPopularTags(15));
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalize all selected tags to ID format for consistency
  const normalizedSelectedTags = selectedTags.map(tag => normalizeTagToId(tag));

  // Update suggestions when input changes
  useEffect(() => {
    if (inputValue.trim()) {
      const results = searchSemanticTags(inputValue, 8);
      // Filter out already selected tags (compare normalized IDs)
      const filteredResults = results.filter(
        (tag) => !normalizedSelectedTags.includes(normalizeTagToId(tag.id))
      );
      setSuggestions(filteredResults);
    } else {
      // Show popular tags when no input
      const filtered = popularTags.filter(
        (tag) => !normalizedSelectedTags.includes(normalizeTagToId(tag.id))
      );
      setSuggestions(filtered.slice(0, 8));
    }
  }, [inputValue, normalizedSelectedTags, popularTags]);

  const addTag = (tagId: string) => {
    if (selectedTags.length >= maxTags) {
      return;
    }

    // Normalize to ID format
    const normalized = normalizeTagToId(tagId);
    if (!normalizedSelectedTags.includes(normalized)) {
      // Add as ID format
      onChange([...selectedTags, normalized]);
    }

    setInputValue('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const removeTag = (tagId: string) => {
    onChange(selectedTags.filter((t) => t !== tagId));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      addTag(inputValue.trim());
    } else if (e.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
      // Remove last tag on backspace when input is empty
      removeTag(selectedTags[selectedTags.length - 1]);
    }
  };

  // Group selected tags by category for display (use normalized tags)
  const categorizedSelectedTags = categorizeTags(normalizedSelectedTags);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Selected Tags Display (Grouped by Category) */}
      {normalizedSelectedTags.length > 0 && (
        <div className="space-y-2">
          {Object.entries(categorizedSelectedTags).map(([category, tagIds]) => (
            <div key={category} className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                {getCategoryIcon(category as any)}
                <span>{category}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tagIds.map((tagId, index) => {
                  // Get localized label
                  const label = getTagLabel(tagId as TagId, locale);

                  return (
                    <Badge
                      key={`${tagId}-${index}`}
                      variant="secondary"
                      className={cn(
                        'py-1 px-2 text-xs',
                        getCategoryColor(category as any)
                      )}
                    >
                      <span className="capitalize">{label}</span>
                      <button
                        type="button"
                        onClick={() => removeTag(tagId)}
                        className="ml-1 hover:text-destructive transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tag Limit Warning */}
      {selectedTags.length >= maxTags && (
        <div className="text-xs text-muted-foreground">
          Maximum {maxTags} tags reached
        </div>
      )}

      {/* Tag Input with Smart Autocomplete */}
      {selectedTags.length < maxTags && (
        <Popover open={showSuggestions} onOpenChange={setShowSuggestions}>
          <PopoverTrigger asChild>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  className="pr-8"
                />
                {inputValue && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputValue('');
                      inputRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (inputValue.trim()) {
                    addTag(inputValue.trim());
                  }
                }}
                disabled={!inputValue.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
            <Command>
              <CommandInput placeholder="Search tags..." className="hidden" />
              {suggestions.length === 0 ? (
                <CommandEmpty>
                  <div className="py-6 text-center text-sm">
                    {inputValue ? (
                      <>
                        <div className="text-muted-foreground mb-2">
                          No matching tags found
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addTag(inputValue.trim())}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add "{inputValue}"
                        </Button>
                      </>
                    ) : (
                      <div className="text-muted-foreground">
                        Start typing to search tags
                      </div>
                    )}
                  </div>
                </CommandEmpty>
              ) : (
                <>
                  {inputValue ? (
                    <CommandGroup heading="Matching Tags">
                      {suggestions.map((tag) => (
                        <TagSuggestionItem
                          key={tag.id}
                          tag={tag}
                          onSelect={() => addTag(tag.id)}
                        />
                      ))}
                    </CommandGroup>
                  ) : (
                    showPopular && (
                      <CommandGroup heading="Popular Tags">
                        {suggestions.map((tag) => (
                          <TagSuggestionItem
                            key={tag.id}
                            tag={tag}
                            onSelect={() => addTag(tag.id)}
                          />
                        ))}
                      </CommandGroup>
                    )
                  )}
                </>
              )}
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {/* Related Tag Suggestions */}
      {selectedTags.length > 0 && selectedTags.length < maxTags && (
        <RelatedTagSuggestions
          selectedTags={selectedTags}
          onAddTag={addTag}
          maxSuggestions={5}
        />
      )}
    </div>
  );
}

/**
 * Individual tag suggestion item
 */
interface TagSuggestionItemProps {
  tag: SemanticTag;
  onSelect: () => void;
}

function TagSuggestionItem({ tag, onSelect }: TagSuggestionItemProps) {
  return (
    <CommandItem onSelect={onSelect} className="cursor-pointer">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 flex-1">
          <div className={cn('w-2 h-2 rounded-full', getCategoryColor(tag.category))} />
          <div className="flex-1">
            <div className="font-medium capitalize">{tag.name}</div>
            {tag.description && (
              <div className="text-xs text-muted-foreground truncate">
                {tag.description}
              </div>
            )}
          </div>
        </div>
        <Badge variant="outline" className="ml-2 text-xs">
          {tag.category}
        </Badge>
      </div>
    </CommandItem>
  );
}

/**
 * Related tag suggestions based on currently selected tags
 */
interface RelatedTagSuggestionsProps {
  selectedTags: string[];
  onAddTag: (tagId: string) => void;
  maxSuggestions?: number;
}

function RelatedTagSuggestions({
  selectedTags,
  onAddTag,
  maxSuggestions = 5,
}: RelatedTagSuggestionsProps) {
  const [relatedTags, setRelatedTags] = useState<SemanticTag[]>([]);

  useEffect(() => {
    // Get related tags for all selected tags
    const allRelated = new Map<string, SemanticTag>();

    for (const tagId of selectedTags) {
      const related = getRelatedTags(tagId);
      for (const relTag of related) {
        if (!selectedTags.includes(relTag.id)) {
          allRelated.set(relTag.id, relTag);
        }
      }
    }

    // Convert to array and limit
    const relatedArray = Array.from(allRelated.values()).slice(0, maxSuggestions);
    setRelatedTags(relatedArray);
  }, [selectedTags, maxSuggestions]);

  if (relatedTags.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Tag className="w-3 h-3" />
        <span>Related Tags</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {relatedTags.map((tag) => (
          <Button
            key={tag.id}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onAddTag(tag.id)}
            className="h-7 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            <span className="capitalize">{tag.name}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
