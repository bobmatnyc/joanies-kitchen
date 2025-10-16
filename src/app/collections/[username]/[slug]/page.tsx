import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { Button } from '@/components/ui/button';
import { getCollectionBySlug } from '@/app/actions/collections';
import Link from 'next/link';
import { Lock, Edit } from 'lucide-react';

interface CollectionDetailPageProps {
  params: Promise<{
    username: string;
    slug: string;
  }>;
}

export default async function CollectionDetailPage({
  params,
}: CollectionDetailPageProps) {
  const resolvedParams = await params;
  const { username, slug } = resolvedParams;
  const { userId } = await auth();

  // Fetch collection with recipes
  const collection = await getCollectionBySlug(username, slug);

  if (!collection) {
    notFound();
  }

  const isOwner = userId === collection.user_id;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Collection Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">
                  {collection.name}
                </h1>
                {!collection.is_public && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm">
                    <Lock className="w-3 h-3" />
                    Private
                  </span>
                )}
              </div>

              {collection.description && (
                <p className="text-gray-600 mb-4">{collection.description}</p>
              )}

              <div className="flex items-center gap-4 text-sm text-gray-500">
                <Link
                  href={`/chef/${collection.ownerUsername}`}
                  className="hover:text-orange-600 transition-colors"
                >
                  by {collection.ownerUsername}
                </Link>
                <span>•</span>
                <span>{collection.recipe_count} recipes</span>
                <span>•</span>
                <span>
                  Updated {new Date(collection.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {isOwner && (
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-2" />
                Edit Collection
              </Button>
            )}
          </div>
        </div>

        {/* Recipes Grid */}
        {collection.recipes && collection.recipes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collection.recipes.map((recipe) => (
              <div key={recipe.id} className="relative">
                <RecipeCard recipe={recipe} />
                {recipe.personalNote && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded text-sm">
                    <span className="font-medium text-amber-900">Note:</span>{' '}
                    <span className="text-amber-700">{recipe.personalNote}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No recipes in this collection yet
            </h2>
            {isOwner && (
              <p className="text-gray-600">
                Browse recipes and add them to this collection
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Generate metadata
export async function generateMetadata({ params }: CollectionDetailPageProps) {
  const resolvedParams = await params;
  const { username, slug } = resolvedParams;
  const collection = await getCollectionBySlug(username, slug);

  if (!collection) {
    return {
      title: 'Collection Not Found',
    };
  }

  return {
    title: `${collection.name} by ${username} - Joanie's Kitchen`,
    description:
      collection.description ||
      `A recipe collection by ${username} with ${collection.recipe_count} recipes`,
  };
}
