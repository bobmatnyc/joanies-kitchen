'use client';

import { useState, useEffect } from 'react';
import { type Recipe } from '@/lib/db/schema';
import { RecipeCard } from './RecipeCard';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';

interface RecipeListProps {
  recipes: Recipe[];
  onRecipeDeleted?: () => void;
}

export function RecipeList({ recipes, onRecipeDeleted }: RecipeListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [filterCuisine, setFilterCuisine] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [filteredRecipes, setFilteredRecipes] = useState(recipes);

  // Extract unique cuisines from recipes
  const uniqueCuisines = Array.from(
    new Set(recipes.filter(r => r.cuisine).map(r => r.cuisine))
  ).sort();

  useEffect(() => {
    let filtered = [...recipes];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(recipe => {
        const name = recipe.name.toLowerCase();
        const description = (recipe.description || '').toLowerCase();
        const cuisine = (recipe.cuisine || '').toLowerCase();
        const tags = recipe.tags ? JSON.parse(recipe.tags as string).join(' ').toLowerCase() : '';

        return (
          name.includes(query) ||
          description.includes(query) ||
          cuisine.includes(query) ||
          tags.includes(query)
        );
      });
    }

    // Apply difficulty filter
    if (filterDifficulty !== 'all') {
      filtered = filtered.filter(recipe => recipe.difficulty === filterDifficulty);
    }

    // Apply cuisine filter
    if (filterCuisine !== 'all') {
      filtered = filtered.filter(recipe => recipe.cuisine === filterCuisine);
    }

    // Apply sorting
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });
        break;
      case 'oldest':
        filtered.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateA - dateB;
        });
        break;
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'cookTime':
        filtered.sort((a, b) => {
          const timeA = (a.prepTime || 0) + (a.cookTime || 0);
          const timeB = (b.prepTime || 0) + (b.cookTime || 0);
          return timeA - timeB;
        });
        break;
    }

    setFilteredRecipes(filtered);
  }, [recipes, searchQuery, filterDifficulty, filterCuisine, sortBy]);

  return (
    <div>
      {/* Filters and Search */}
      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Difficulties</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>

          {uniqueCuisines.length > 0 && (
            <Select value={filterCuisine} onValueChange={setFilterCuisine}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Cuisine" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cuisines</SelectItem>
                {uniqueCuisines.map((cuisine) => (
                  <SelectItem key={cuisine} value={cuisine!}>
                    {cuisine}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="name">Name (A-Z)</SelectItem>
              <SelectItem value="cookTime">Cook Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p className="text-sm text-muted-foreground">
          Found {filteredRecipes.length} {filteredRecipes.length === 1 ? 'recipe' : 'recipes'}
        </p>
      </div>

      {/* Recipe Grid */}
      {filteredRecipes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No recipes found</p>
          {searchQuery && (
            <p className="text-sm text-muted-foreground mt-2">
              Try adjusting your search or filters
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
            />
          ))}
        </div>
      )}
    </div>
  );
}