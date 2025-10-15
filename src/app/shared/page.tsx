import { getRecipesPaginated, type RecipeFilters } from '@/app/actions/recipes';
import { RecipeInfiniteList } from '@/components/recipe/RecipeInfiniteList';
import { RecipeFilters as RecipeFiltersComponent } from '@/components/recipe/RecipeFilters';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    tags?: string;
    sort?: string;
    search?: string;
    minRating?: string;
    difficulty?: string;
    cuisine?: string;
    isSystemRecipe?: string;
  }>;
}

export default async function SharedRecipesPage({ searchParams }: PageProps) {
  // Await searchParams as it's now a Promise in Next.js 15
  const params = await searchParams;

  // Build filters for public recipes
  const filters: RecipeFilters = {
    isPublic: true,
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

  if (params.isSystemRecipe) {
    filters.isSystemRecipe = params.isSystemRecipe === 'true';
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
  const pagination = result.success && result.data ? result.data.pagination : {
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
        <h1 className="text-4xl font-heading text-jk-olive mb-2">
          Shared Recipes
        </h1>
        <p className="text-jk-charcoal/70 font-ui">
          Discover {pagination.total} recipe{pagination.total !== 1 ? 's' : ''} from the community
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8">
        <RecipeFiltersComponent
          showSearch={true}
          showSystemRecipeFilter={true}
        />
      </div>

      {/* Recipe List with Infinite Scroll */}
      <RecipeInfiniteList
        initialRecipes={recipes}
        initialPagination={pagination}
        filters={filters}
        sort={sort}
        emptyMessage="No shared recipes found"
      />
    </main>
  );
}