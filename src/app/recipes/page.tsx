import { getRecipesPaginated, type RecipeFilters } from '@/app/actions/recipes';
import { RecipeFilters as RecipeFiltersComponent } from '@/components/recipe/RecipeFilters';
import { RecipeInfiniteList } from '@/components/recipe/RecipeInfiniteList';

// Force dynamic rendering since we show public recipes
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
  // Await searchParams as it's now a Promise in Next.js 15
  const params = await searchParams;

  // Build filters from URL parameters - ONLY public recipes
  const filters: RecipeFilters = {
    isPublic: true, // Only show public recipes
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

  // Fetch initial page of public recipes
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
        <h1 className="text-4xl font-heading text-jk-olive mb-2">Browse Recipes</h1>
        <p className="text-jk-charcoal/70 font-ui">
          {pagination.total} public recipe{pagination.total !== 1 ? 's' : ''} shared by our
          community
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
        emptyMessage="No public recipes found"
      />
    </main>
  );
}
