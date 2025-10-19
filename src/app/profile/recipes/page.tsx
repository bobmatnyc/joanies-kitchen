import { Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getRecipesPaginated, type RecipeFilters } from '@/app/actions/recipes';
import { RecipeFilters as RecipeFiltersComponent } from '@/components/recipe/RecipeFilters';
import { RecipeInfiniteList } from '@/components/recipe/RecipeInfiniteList';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth';

// Force dynamic rendering since we use authentication
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    tags?: string;
    sort?: string;
    search?: string;
    minRating?: string;
    difficulty?: string;
    cuisine?: string;
  }>;
}

export default async function MyRecipesPage({ searchParams }: PageProps) {
  // Check authentication - redirect if not authenticated
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in?redirect=/profile/recipes');
  }

  // Await searchParams as it's now a Promise in Next.js 15
  const params = await searchParams;

  // Build filters from URL parameters - user's recipes
  const filters: RecipeFilters = {
    userId: userId, // Only show user's recipes
  };

  if (params.tags) {
    filters.tags = params.tags.split(',').filter(Boolean);
  }

  if (params.search) {
    filters.searchQuery = params.search;
  }

  if (params.minRating) {
    filters.minRating = parseFloat(params.minRating);
  }

  if (params.difficulty) {
    filters.difficulty = params.difficulty as 'easy' | 'medium' | 'hard';
  }

  if (params.cuisine) {
    filters.cuisine = params.cuisine;
  }

  const sort = (params.sort || 'rating') as 'rating' | 'recent' | 'name';

  // Fetch initial page of user's recipes
  const result = await getRecipesPaginated({
    page: 1,
    limit: 24,
    filters,
    sort,
  });

  const recipes = result.success && result.data ? result.data.recipes : [];
  const pagination =
    result.success && result.data
      ? result.data.pagination
      : {
          page: 1,
          limit: 24,
          total: 0,
          totalPages: 0,
          hasMore: false,
        };

  return (
    <main className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-heading text-jk-olive mb-2">My Recipes</h1>
            <p className="text-jk-charcoal/70 font-ui">
              {pagination.total} recipe{pagination.total !== 1 ? 's' : ''} in your collection
            </p>
          </div>
          <Link href="/recipes/new">
            <Button className="bg-jk-tomato hover:bg-jk-tomato/90 text-white min-h-[44px] touch-manipulation font-ui">
              <Plus className="w-4 h-4 mr-2" />
              Add Recipe
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-8">
        <RecipeFiltersComponent showSearch={true} />
      </div>

      {/* Recipe List with Infinite Scroll */}
      <RecipeInfiniteList
        initialRecipes={recipes}
        initialPagination={pagination}
        filters={filters}
        sort={sort}
        emptyMessage="No recipes in your collection yet. Start by adding your first recipe!"
      />
    </main>
  );
}

export const metadata = {
  title: "My Recipes | Joanie's Kitchen",
  description: 'Manage your personal recipe collection',
};
