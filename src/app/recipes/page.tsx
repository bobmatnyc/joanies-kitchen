import { ChefHat } from 'lucide-react';
import Link from 'next/link';
import { getRecipesPaginated, type RecipeFilters } from '@/app/actions/recipes';
import { RecipeFilters as RecipeFiltersComponent } from '@/components/recipe/RecipeFilters';
import { RecipeInfiniteList } from '@/components/recipe/RecipeInfiniteList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

export default async function RecipesPage({ searchParams }: PageProps) {
  // Check authentication
  const { userId } = await auth();
  const isLocalhost = process.env.NODE_ENV === 'development';
  const isAuthenticated = userId || isLocalhost;

  // If not authenticated, show sign-in prompt
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <ChefHat className="w-8 h-8 text-primary" />
              </div>
              <CardTitle>Welcome to Recipe Manager</CardTitle>
              <CardDescription>
                Sign in to create, manage, and organize your personal recipe collection.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link href="/sign-in" className="block">
                <Button className="w-full" size="lg">
                  Sign In to Manage Recipes
                </Button>
              </Link>
              <div className="text-center">
                <Link
                  href="/discover"
                  className="text-sm text-muted-foreground hover:text-primary underline"
                >
                  Browse public recipes instead
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Await searchParams as it's now a Promise in Next.js 15
  const params = await searchParams;

  // Build filters from URL parameters
  const filters: RecipeFilters = {
    userId: userId || undefined,
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

  // Fetch initial page of recipes
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
        <h1 className="text-4xl font-heading text-jk-olive mb-2">My Recipes</h1>
        <p className="text-jk-charcoal/70 font-ui">
          {pagination.total} recipe{pagination.total !== 1 ? 's' : ''} in your collection
        </p>
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
        emptyMessage="No recipes found in your collection"
      />
    </main>
  );
}
