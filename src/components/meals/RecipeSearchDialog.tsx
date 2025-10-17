'use client';

import { Plus } from 'lucide-react';
import { memo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Recipe } from '@/lib/db/schema';

export interface RecipeSearchDialogProps {
  recipes: Recipe[];
  isLoadingRecipes: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddRecipe: (recipe: Recipe, courseCategory: string) => void;
}

export const RecipeSearchDialog = memo(function RecipeSearchDialog({
  recipes,
  isLoadingRecipes,
  open,
  onOpenChange,
  onAddRecipe,
}: RecipeSearchDialogProps) {
  const handleSelect = useCallback(
    (recipe: Recipe) => {
      // Default to 'main' course category
      onAddRecipe(recipe, 'main');
    },
    [onAddRecipe]
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="border-jk-sage text-jk-olive hover:bg-jk-sage/10 min-h-[44px] touch-manipulation"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Recipe
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[90vw] max-w-md p-0" align="end">
        <Command>
          <CommandInput placeholder="Search recipes..." className="font-body" />
          <CommandList>
            <CommandEmpty>
              {isLoadingRecipes ? 'Loading recipes...' : 'No recipes found.'}
            </CommandEmpty>
            <CommandGroup>
              {recipes.map((recipe) => (
                <CommandItem
                  key={recipe.id}
                  onSelect={() => handleSelect(recipe)}
                  className="font-body cursor-pointer"
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="flex-1 truncate">{recipe.name}</span>
                    {recipe.cuisine && (
                      <Badge variant="outline" className="text-xs">
                        {recipe.cuisine}
                      </Badge>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});
