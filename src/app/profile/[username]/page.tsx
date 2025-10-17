import { auth } from '@clerk/nextjs/server';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getUserCollections } from '@/app/actions/collections';
import { getProfileByUsername, getProfileStats, getUserRecipes } from '@/app/actions/user-profiles';
import { CollectionCard } from '@/components/collections/CollectionCard';
import { ProfileDisplay } from '@/components/profile/ProfileDisplay';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { Button } from '@/components/ui/button';

interface ChefProfilePageProps {
  params: Promise<{
    username: string;
  }>;
}

export default async function ChefProfilePage({ params }: ChefProfilePageProps) {
  const resolvedParams = await params;
  const { username } = resolvedParams;
  const { userId } = await auth();

  // Fetch profile
  const profile = await getProfileByUsername(username);

  if (!profile) {
    notFound();
  }

  // Check if this is the user's own profile
  const isOwnProfile = userId === profile.user_id;

  // Fetch stats, collections, and recipes
  const [stats, collections, userRecipesData] = await Promise.all([
    getProfileStats(username),
    getUserCollections(profile.user_id),
    getUserRecipes(username, {
      visibility: isOwnProfile ? 'all' : 'public',
      limit: 12,
      sortBy: 'recent',
    }),
  ]);

  const userRecipes = userRecipesData.recipes;
  const totalRecipes = userRecipesData.total;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <ProfileDisplay profile={profile} stats={stats || undefined} isOwnProfile={isOwnProfile} />

        {/* Collections Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Collections</h2>
          </div>

          {collections.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm">
              <p className="text-gray-500">
                {isOwnProfile
                  ? "You haven't created any collections yet"
                  : 'No public collections yet'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {collections.map((collection) => (
                <CollectionCard
                  key={collection.id}
                  collection={{
                    ...collection,
                    ownerUsername: profile.username,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recipes Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Recipes</h2>
              {totalRecipes > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  {totalRecipes} {totalRecipes === 1 ? 'recipe' : 'recipes'}
                  {isOwnProfile && ' (showing all recipes)'}
                </p>
              )}
            </div>
            {isOwnProfile && (
              <Link href="/recipes/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Recipe
                </Button>
              </Link>
            )}
          </div>

          {userRecipes.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm">
              <p className="text-gray-500 mb-4">
                {isOwnProfile ? "You haven't created any recipes yet" : 'No public recipes yet'}
              </p>
              {isOwnProfile && (
                <Link href="/recipes/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Recipe
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userRecipes.map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} />
                ))}
              </div>

              {totalRecipes > 12 && (
                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-500">Showing 12 of {totalRecipes} recipes</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Generate metadata
export async function generateMetadata({ params }: ChefProfilePageProps) {
  const resolvedParams = await params;
  const { username } = resolvedParams;
  const profile = await getProfileByUsername(username);

  if (!profile) {
    return {
      title: 'Profile Not Found',
    };
  }

  return {
    title: `${profile.display_name} (@${profile.username}) - Joanie's Kitchen`,
    description: profile.bio || `Check out ${profile.display_name}'s recipes and collections`,
  };
}
