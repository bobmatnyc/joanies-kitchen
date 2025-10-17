'use client';

import { Filter, Globe, Search, Sparkles } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SharedRecipeCard } from '@/components/recipe/SharedRecipeCard';
import { TagFilter } from '@/components/recipe/TagFilter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface SharedRecipesContentProps {
  sharedRecipes: any[];
  availableTags: string[];
  tagCounts: Record<string, number>;
  initialSelectedTags: string[];
}

export function SharedRecipesContent({
  sharedRecipes,
  availableTags,
  tagCounts,
  initialSelectedTags,
}: SharedRecipesContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedTags, setSelectedTags] = useState<string[]>(initialSelectedTags);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  // Update URL when tags change
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedTags.length > 0) {
      params.set('tags', selectedTags.join(','));
    } else {
      params.delete('tags');
    }
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.push(newUrl, { scroll: false });
  }, [selectedTags, pathname, router, searchParams]);

  const handleTagToggle = useCallback((tag: string) => {
    const normalizedTag = tag.toLowerCase();
    setSelectedTags((prev) => {
      const normalizedPrev = prev.map((t) => t.toLowerCase());
      if (normalizedPrev.includes(normalizedTag)) {
        return prev.filter((t) => t.toLowerCase() !== normalizedTag);
      } else {
        return [...prev, tag];
      }
    });
  }, []);

  const handleClearTags = useCallback(() => {
    setSelectedTags([]);
  }, []);

  // Filter recipes by search query
  const filteredRecipes = useMemo(() => {
    if (!searchQuery) return sharedRecipes;

    const query = searchQuery.toLowerCase();
    return sharedRecipes.filter((recipe) => {
      const nameMatch = recipe.name?.toLowerCase().includes(query);
      const descMatch = recipe.description?.toLowerCase().includes(query);
      const cuisineMatch = recipe.cuisine?.toLowerCase().includes(query);

      // Check tags
      let tagMatch = false;
      if (recipe.tags) {
        try {
          const tags = JSON.parse(recipe.tags);
          if (Array.isArray(tags)) {
            tagMatch = tags.some((tag: string) => tag.toLowerCase().includes(query));
          }
        } catch (_e) {
          tagMatch = recipe.tags.toLowerCase().includes(query);
        }
      }

      return nameMatch || descMatch || cuisineMatch || tagMatch;
    });
  }, [sharedRecipes, searchQuery]);

  // Separate system recipes from user-shared recipes
  const systemRecipes = filteredRecipes.filter((recipe) => recipe.isSystemRecipe);
  const userSharedRecipes = filteredRecipes.filter((recipe) => !recipe.isSystemRecipe);

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-3 flex items-center justify-center gap-3">
          <Globe className="w-10 h-10 text-primary" />
          Shared Recipes
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Discover amazing recipes shared by our community and curated system recipes. Copy any
          recipe to your personal collection with a single click.
          {selectedTags.length > 0 && (
            <span className="block mt-2 text-sm">
              Filtered by {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>

      {/* Search and Filter Bar */}
      <div className="max-w-xl mx-auto mb-8 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search shared recipes..."
              className="pl-10 pr-4 py-2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {availableTags.length > 0 && (
            <Button variant="outline" onClick={() => setShowFilterSheet(true)} className="relative">
              <Filter className="w-4 h-4 mr-2" />
              Filter
              {selectedTags.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">
                  {selectedTags.length}
                </span>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Desktop: Inline filter */}
      {availableTags.length > 0 && selectedTags.length > 0 && (
        <div className="hidden lg:block mb-8 p-4 border rounded-lg bg-muted/30 max-w-6xl mx-auto">
          <TagFilter
            availableTags={availableTags}
            selectedTags={selectedTags}
            onTagToggle={handleTagToggle}
            onClearAll={handleClearTags}
            tagCounts={tagCounts}
            showCounts={true}
          />
        </div>
      )}

      {/* System Recipes Section */}
      {systemRecipes.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-6 h-6 text-yellow-500" />
            <h2 className="text-2xl font-semibold">Featured Recipes</h2>
            <Badge variant="secondary" className="ml-2">
              Curated
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {systemRecipes.map((recipe) => (
              <SharedRecipeCard key={recipe.id} recipe={recipe} isSystemRecipe={true} />
            ))}
          </div>
        </div>
      )}

      {/* User Shared Recipes Section */}
      {userSharedRecipes.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-6">
            <Globe className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-semibold">Community Recipes</h2>
            <Badge variant="outline" className="ml-2">
              {userSharedRecipes.length} recipes
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {userSharedRecipes.map((recipe) => (
              <SharedRecipeCard key={recipe.id} recipe={recipe} isSystemRecipe={false} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredRecipes.length === 0 && (
        <div className="text-center py-12">
          <Globe className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">
            {searchQuery || selectedTags.length > 0 ? 'No Recipes Found' : 'No Shared Recipes Yet'}
          </h3>
          <p className="text-muted-foreground">
            {searchQuery || selectedTags.length > 0
              ? 'Try adjusting your filters or search terms'
              : 'Be the first to share your amazing recipes with the community!'}
          </p>
        </div>
      )}

      {/* Filter Sheet (Mobile/Tablet) */}
      <Sheet open={showFilterSheet} onOpenChange={setShowFilterSheet}>
        <SheetContent side="right" className="w-[85%] sm:w-[400px]">
          <SheetHeader>
            <SheetTitle>Filter Recipes</SheetTitle>
            <SheetDescription>
              Select tags to filter shared recipes. Choose multiple tags to find recipes that match
              all selections.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <TagFilter
              availableTags={availableTags}
              selectedTags={selectedTags}
              onTagToggle={handleTagToggle}
              onClearAll={handleClearTags}
              tagCounts={tagCounts}
              showCounts={true}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
