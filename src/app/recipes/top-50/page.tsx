import { sql } from 'drizzle-orm';
import { Award, Star, Trophy } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTopRatedRecipes, type RecipeCategory } from '@/app/actions/recipes';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

export const metadata: Metadata = {
  title: "Top 50 Recipes | Joanie's Kitchen",
  description:
    'The highest-rated recipes from our collection, hand-picked and AI-verified for quality',
};

// ISR: Revalidate top 50 page every hour
// Rankings change slowly, so hourly updates are sufficient
export const revalidate = 3600; // 1 hour

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

export default async function Top50Page() {
  // Fetch recipes for all categories
  const allRecipes = await getTopRatedRecipes({ limit: 50, category: 'all' });
  const mainsRecipes = await getTopRatedRecipes({ limit: 50, category: 'mains' });
  const sidesRecipes = await getTopRatedRecipes({ limit: 50, category: 'sides' });
  const dessertsRecipes = await getTopRatedRecipes({ limit: 50, category: 'desserts' });

  // Get total recipe count
  const [{ count: totalRecipes }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(recipes);

  // Calculate stats for all recipes
  const avgRating =
    allRecipes.length > 0
      ? allRecipes.reduce((acc, recipe) => {
          const rating =
            parseFloat(recipe.system_rating || '0') ||
            parseFloat(recipe.avg_user_rating || '0') ||
            0;
          return acc + rating;
        }, 0) / allRecipes.length
      : 0;

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
            <div key={recipe.id} className="relative">
              <div className="absolute -top-3 -left-3 z-10 bg-jk-tomato text-white rounded-full w-10 h-10 flex items-center justify-center font-bold shadow-lg">
                {index + 1}
              </div>
              <RecipeCard recipe={recipe} />
            </div>
          ))}
        </div>
      );
    }

    // For categorized views, organize by subcategory
    const subcategories = CATEGORIES[category].subcategories;

    return (
      <div className="space-y-12">
        {subcategories.map((subcat) => {
          // Get recipes matching this subcategory by refetching with subcategory filter
          // Note: In production, you'd want to optimize this to avoid multiple DB queries
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
                {subcatRecipes.slice(0, 12).map((recipe, index) => (
                  <div key={recipe.id} className="relative">
                    <RecipeCard recipe={recipe} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-jk-linen">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-jk-olive to-jk-clay py-20">
        <div className="container mx-auto px-4 text-center">
          <Trophy className="h-16 w-16 text-jk-linen mx-auto mb-6" />
          <h1 className="text-5xl font-heading text-jk-linen mb-4">Top 50 Recipes</h1>
          <p className="text-xl text-jk-sage max-w-2xl mx-auto font-body">
            The cream of the crop—our highest-rated recipes, organized by category
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-white border-b border-jk-sage/20 py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-8 text-center">
            <div>
              <div className="text-3xl font-heading text-jk-olive">{allRecipes.length}</div>
              <div className="text-sm text-jk-charcoal/60 font-ui">Top Recipes</div>
            </div>
            <div>
              <div className="text-3xl font-heading text-jk-olive">
                {avgRating > 0 ? avgRating.toFixed(1) : '—'}
              </div>
              <div className="text-sm text-jk-charcoal/60 font-ui">Average Rating</div>
            </div>
            <div>
              <div className="text-3xl font-heading text-jk-olive">
                {totalRecipes.toLocaleString()}+
              </div>
              <div className="text-sm text-jk-charcoal/60 font-ui">Total Recipes</div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="container mx-auto px-4 py-12">
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
      </div>

      {/* CTA Section */}
      <div className="bg-jk-olive/5 border-t border-jk-sage/20 py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-heading text-jk-olive mb-4">Don't see your favorite?</h2>
          <p className="text-jk-charcoal/70 mb-6 max-w-xl mx-auto font-body">
            We're constantly adding new recipes. Rate the ones you try to help them climb the
            rankings!
          </p>
          <Link href="/shared">
            <Button className="bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui font-medium gap-2">
              <Star className="h-5 w-5" />
              Browse All Recipes
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
