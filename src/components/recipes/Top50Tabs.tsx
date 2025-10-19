'use client';

import { useState } from 'react';
import { Award } from 'lucide-react';
import type { getTopRatedRecipes, RecipeCategory } from '@/app/actions/recipes';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

interface Top50TabsProps {
  allRecipes: Awaited<ReturnType<typeof getTopRatedRecipes>>;
  mainsRecipes: Awaited<ReturnType<typeof getTopRatedRecipes>>;
  sidesRecipes: Awaited<ReturnType<typeof getTopRatedRecipes>>;
  dessertsRecipes: Awaited<ReturnType<typeof getTopRatedRecipes>>;
  appetizersRecipes: Awaited<ReturnType<typeof getTopRatedRecipes>>;
}

// Category configuration
const CATEGORIES = {
  all: { label: 'All Recipes', subcategories: [] },
  appetizers: {
    label: 'Appetizers',
    subcategories: [
      { value: 'dips', label: 'Dips & Spreads' },
      { value: 'finger-foods', label: 'Finger Foods' },
      { value: 'cheese', label: 'Cheese & Charcuterie' },
      { value: 'meat', label: 'Meat Apps' },
      { value: 'vegetable', label: 'Veggie Apps' },
    ],
  },
  mains: {
    label: 'Main Dishes',
    subcategories: [
      { value: 'beef', label: 'Beef' },
      { value: 'chicken', label: 'Chicken' },
      { value: 'pork', label: 'Pork' },
      { value: 'lamb', label: 'Lamb/Goat' },
      { value: 'seafood', label: 'Seafood' },
      { value: 'pasta', label: 'Pasta' },
      { value: 'vegetarian', label: 'Vegetarian' },
      { value: 'vegan', label: 'Vegan' },
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
export function Top50Tabs({ allRecipes, mainsRecipes, sidesRecipes, dessertsRecipes, appetizersRecipes }: Top50TabsProps) {
  const [activeCategory, setActiveCategory] = useState<RecipeCategory>('all');
  const [selectedProtein, setSelectedProtein] = useState<string | null>(null);
  // Helper function to render recipe grid with subcategories
  const renderRecipeGrid = (
    categoryRecipes: Awaited<ReturnType<typeof getTopRatedRecipes>>,
    category: RecipeCategory
  ) => {
    // Apply protein filter if active
    let filteredRecipes = categoryRecipes;
    if (category === 'mains' && selectedProtein) {
      filteredRecipes = categoryRecipes.filter((recipe) => {
        try {
          const tags = recipe.tags ? JSON.parse(recipe.tags) : [];
          const normalizedTags = tags.map((t: string) => t.toLowerCase());

          const categoryMapping = {
            beef: ['beef', 'steak', 'ground beef', 'roast'],
            chicken: ['chicken', 'poultry', 'roasted chicken'],
            lamb: ['lamb', 'goat'],
            pasta: ['pasta', 'noodles', 'spaghetti', 'lasagna', 'ravioli'],
            seafood: ['seafood', 'fish', 'salmon', 'shrimp', 'tuna', 'cod'],
            pork: ['pork', 'bacon', 'ham', 'sausage'],
            vegetarian: ['vegetarian', 'veggie', 'meatless'],
            vegan: ['vegan', 'plant-based'],
          };

          const proteinTags = categoryMapping[selectedProtein as keyof typeof categoryMapping] as string[] | undefined;
          return (Array.isArray(proteinTags) && proteinTags.some((tag: string) => normalizedTags.some((t: string) => t.includes(tag)))) || false;
        } catch {
          return false;
        }
      });
    }

    if (filteredRecipes.length === 0) {
      return (
        <div className="text-center py-20">
          <Award className="h-16 w-16 text-jk-clay/40 mx-auto mb-4" />
          <p className="text-xl text-jk-charcoal/60 font-body">
            No recipes in this category yet. Check back soon!
          </p>
        </div>
      );
    }

    // For 'all' category or when protein filter is active, just show the grid
    if (category === 'all' || (category === 'mains' && selectedProtein)) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredRecipes.map((recipe, index) => (
            <RecipeCard key={recipe.id} recipe={recipe} showRank={category === 'all' ? index + 1 : undefined} />
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
                appetizers: {
                  dips: ['dip', 'dips', 'hummus', 'guacamole', 'salsa'],
                  'finger-foods': ['finger food', 'appetizer', 'hors d\'oeuvre', 'canape'],
                  cheese: ['cheese board', 'cheese platter', 'brie', 'charcuterie'],
                  meat: ['meatball', 'wing', 'wings', 'skewer'],
                  vegetable: ['crudite', 'veggie platter', 'stuffed mushroom'],
                },
                mains: {
                  beef: ['beef', 'steak', 'ground beef', 'roast'],
                  chicken: ['chicken', 'poultry', 'roasted chicken'],
                  lamb: ['lamb', 'goat'],
                  pasta: ['pasta', 'noodles', 'spaghetti', 'lasagna', 'ravioli'],
                  seafood: ['seafood', 'fish', 'salmon', 'shrimp', 'tuna', 'cod'],
                  pork: ['pork', 'bacon', 'ham', 'sausage'],
                  vegetarian: ['vegetarian', 'veggie', 'meatless'],
                  vegan: ['vegan', 'plant-based'],
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
    <div className="w-full space-y-6">
      {/* Row 1: Main Category Tabs */}
      <Tabs
        defaultValue="all"
        className="w-full"
        onValueChange={(value) => {
          setActiveCategory(value as RecipeCategory);
          // Reset protein filter when changing categories
          if (value !== 'mains') {
            setSelectedProtein(null);
          }
        }}
      >
        <TabsList className="grid w-full max-w-3xl mx-auto grid-cols-5 mb-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="appetizers">Appetizers</TabsTrigger>
          <TabsTrigger value="mains">Mains</TabsTrigger>
          <TabsTrigger value="sides">Sides</TabsTrigger>
          <TabsTrigger value="desserts">Desserts</TabsTrigger>
        </TabsList>

        {/* Row 2: Protein Filter (only visible when Mains is selected) */}
        {activeCategory === 'mains' && (
          <div className="mb-6 animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 justify-center max-w-4xl mx-auto p-4 bg-jk-olive/5 rounded-lg border border-jk-sage/20">
              <span className="text-sm font-ui font-medium text-jk-charcoal/70 self-center sm:mr-2 text-center sm:text-left">
                Filter by protein:
              </span>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button
                  variant={selectedProtein === null ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedProtein(null)}
                  className={`min-w-[80px] ${selectedProtein === null ? 'bg-jk-olive text-white hover:bg-jk-olive/90' : ''}`}
                >
                  All
                </Button>
                {CATEGORIES.mains.subcategories.map((subcat) => (
                  <Button
                    key={subcat.value}
                    variant={selectedProtein === subcat.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedProtein(subcat.value)}
                    className={`min-w-[80px] ${selectedProtein === subcat.value ? 'bg-jk-olive text-white hover:bg-jk-olive/90' : ''}`}
                  >
                    {subcat.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        <TabsContent value="all" className="mt-0">
          {renderRecipeGrid(allRecipes, 'all')}
        </TabsContent>

        <TabsContent value="appetizers" className="mt-0">
          {renderRecipeGrid(appetizersRecipes, 'appetizers')}
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
    </div>
  );
}
