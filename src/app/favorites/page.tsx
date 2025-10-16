import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { getUserFavorites } from '@/app/actions/favorites';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'My Favorites - Joanie\'s Kitchen',
  description: 'Your favorite recipes',
};

export default async function FavoritesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in?redirect=/favorites');
  }

  // Fetch user's favorite recipes
  const favorites = await getUserFavorites();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Favorites</h1>
          <p className="text-gray-600">
            Recipes you've saved for quick access
          </p>
        </div>

        {favorites.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg shadow-sm">
            <div className="max-w-md mx-auto">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                No favorites yet
              </h2>
              <p className="text-gray-600 mb-6">
                Start favoriting recipes to build your personal collection of go-to dishes
              </p>
              <Link href="/">
                <Button>Discover Recipes</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
