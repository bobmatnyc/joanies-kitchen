import { Suspense } from 'react';
import { getAllRecipesForAdmin } from '@/app/actions/admin';
import { RecipeDataTable } from '@/components/admin/RecipeDataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Loading skeleton for recipe table
 */
function RecipeTableLoading() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Recipe Management</h1>
        <p className="text-gray-600 mt-2">Manage all recipes in the database</p>
      </div>

      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-4 text-gray-600">Loading recipes...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Server component that fetches recipes server-side
 */
async function RecipeManagementContent() {
  const result = await getAllRecipesForAdmin();

  if (!result.success || !result.data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recipe Management</h1>
          <p className="text-gray-600 mt-2">Manage all recipes in the database</p>
        </div>

        <Card>
          <CardContent className="py-12">
            <div className="text-center text-red-600">
              <p className="font-medium">Error loading recipes</p>
              <p className="text-sm mt-2">{result.error || 'Failed to load recipes'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const recipes = result.data;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Recipe Management</h1>
        <p className="text-gray-600 mt-2">
          Manage all recipes in the database - {recipes.length} total recipes
        </p>
      </div>

      {/* Recipe Data Table - Client component for interactivity */}
      <Card>
        <CardHeader>
          <CardTitle>All Recipes</CardTitle>
        </CardHeader>
        <CardContent>
          <RecipeDataTable recipes={recipes} />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Admin Recipes Page - Server Component
 * Fetches all recipes server-side for better performance and SEO
 */
export default function AdminRecipesPage() {
  return (
    <Suspense fallback={<RecipeTableLoading />}>
      <RecipeManagementContent />
    </Suspense>
  );
}
