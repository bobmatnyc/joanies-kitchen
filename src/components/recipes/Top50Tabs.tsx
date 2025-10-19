'use client';

import { Award } from 'lucide-react';
import type { getTopRatedRecipes, RecipeCategory } from '@/app/actions/recipes';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Top50TabsProps {
  allRecipes: Awaited<ReturnType<typeof getTopRatedRecipes>>;
  mainsRecipes: Awaited<ReturnType<typeof getTopRatedRecipes>>;
  sidesRecipes: Awaited<ReturnType<typeof getTopRatedRecipes>>;
  dessertsRecipes: Awaited<ReturnType<typeof getTopRatedRecipes>>;
}

// Category configuration
const CATEGORIES = {
  all: { label: 'All Recipes', subcategories: [] },
  mains: {
    label: 'Main Dishes',
    subcategories: [
      { value: 'beef', label: 'Beef Dishes' },
      { value: 'chicken', label: 'Chicken Dishes' },
      { value: 'lamb', label: 'Lamb Dishes' },
      { value: 'pasta', label: 'Pasta' },
      { value: 'seafood', label: 'Seafood' },
      { value: 'pork', label: 'Pork Dishes' },
      { value: 'other-proteins', label: 'Other Proteins' },
    ],
  },
  sides: {
    label: 'Side Dishes',
    subcategories: [
      { value: 'vegetables', label: 'Vegetables' },
      { value: 'salads', label: 'Salads' },
      { value: 'grains', label: 'Grains & Rice' },
      { value: 'potatoes', label: 'Potatoes' },
      { value: 'bread', label: 'Bread & Rolls' },
    ],
  },
  desserts: {
    label: 'Desserts',
    subcategories: [
      { value: 'cakes', label: 'Cakes' },
      { value: 'cookies', label: 'Cookies' },
      { value: 'pies', label: 'Pies & Tarts' },
      { value: 'puddings', label: 'Puddings & Custards' },
      { value: 'frozen', label: 'Frozen Desserts' },
    ],
  },
} as const;

/**
 * Client component for tabbed recipe display with category filtering
 */
export function Top50Tabs({ allRecipes, mainsRecipes, sidesRecipes, dessertsRecipes }: Top50TabsProps) {
  // Helper function to render recipe grid with subcategories
  const renderRecipeGrid = (
    categoryRecipes: Awaited<ReturnType<typeof getTopRatedRecipes>>,
    category: RecipeCategory
  ) => {
    if (categoryRecipes.length === 0) {
      return (
        <div className="text-center py-20">
          <Award className="h-16 w-16 text-jk-clay/40 mx-auto mb-4" />
          <p className="text-xl text-jk-charcoal/60 font-body">
            No recipes in this category yet. Check back soon!
          </p>
        </div>
      );
    }

    // For 'all' category, just show the grid
    if (category === 'all') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {categoryRecipes.map((recipe, index) => (
            <RecipeCard key={recipe.id} recipe={recipe} showRank={index + 1} />
          ))}
        </div>
      );
    }

    // For categorized views, organize by subcategory
    const subcategories = CATEGORIES[category].subcategories;

    return (
      <div className="space-y-12">
        {subcategories.map((subcat) => {
          // Filter recipes matching this subcategory
          const subcatRecipes = categoryRecipes.filter((recipe) => {
            try {
              const tags = recipe.tags ? JSON.parse(recipe.tags) : [];
              const normalizedTags = tags.map((t: string) => t.toLowerCase());

              // Get subcategory tags from mapping
              const categoryMapping = {
                mains: {
                  beef: ['beef', 'steak', 'ground beef', 'roast'],
                  chicken: ['chicken', 'poultry', 'roasted chicken'],
                  lamb: ['lamb'],
                  pasta: ['pasta', 'noodles', 'spaghetti', 'lasagna', 'ravioli'],
                  seafood: ['seafood', 'fish', 'salmon', 'shrimp', 'tuna', 'cod'],
                  pork: ['pork', 'bacon', 'ham', 'sausage'],
                  'other-proteins': ['turkey', 'duck', 'venison', 'tofu', 'tempeh'],
                },
                sides: {
                  vegetables: ['vegetables', 'vegetable', 'broccoli', 'carrots', 'green beans'],
                  salads: ['salad', 'coleslaw', 'greens'],
                  grains: ['rice', 'quinoa', 'grains', 'pilaf', 'risotto'],
                  potatoes: ['potatoes', 'potato', 'mashed potatoes', 'fries'],
                  bread: ['bread', 'rolls', 'biscuits'],
                },
                desserts: {
                  cakes: ['cake', 'cakes', 'cupcakes', 'cheesecake'],
                  cookies: ['cookies', 'cookie', 'biscotti'],
                  pies: ['pie', 'pies', 'tart', 'tarts'],
                  puddings: ['pudding', 'custard', 'mousse'],
                  frozen: ['ice cream', 'sorbet', 'frozen dessert'],
                },
              };

              const subcatTags = categoryMapping[category]?.[subcat.value as keyof typeof categoryMapping[typeof category]] as string[] | undefined;
              return (Array.isArray(subcatTags) && subcatTags.some((tag: string) => normalizedTags.some((t: string) => t.includes(tag)))) || false;
            } catch {
              return false;
            }
          });

          if (subcatRecipes.length === 0) return null;

          return (
            <div key={subcat.value}>
              <h3 className="text-2xl font-heading text-jk-olive mb-6 border-b border-jk-sage/30 pb-2">
                {subcat.label}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {subcatRecipes.slice(0, 12).map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Tabs defaultValue="all" className="w-full">
      <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-4 mb-8">
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="mains">Mains</TabsTrigger>
        <TabsTrigger value="sides">Sides</TabsTrigger>
        <TabsTrigger value="desserts">Desserts</TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="mt-0">
        {renderRecipeGrid(allRecipes, 'all')}
      </TabsContent>

      <TabsContent value="mains" className="mt-0">
        {renderRecipeGrid(mainsRecipes, 'mains')}
      </TabsContent>

      <TabsContent value="sides" className="mt-0">
        {renderRecipeGrid(sidesRecipes, 'sides')}
      </TabsContent>

      <TabsContent value="desserts" className="mt-0">
        {renderRecipeGrid(dessertsRecipes, 'desserts')}
      </TabsContent>
    </Tabs>
  );
}
