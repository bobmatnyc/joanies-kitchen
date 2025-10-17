import { auth } from '@clerk/nextjs/server';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { getPublicCollections, getUserCollections } from '@/app/actions/collections';
import { CollectionCard } from '@/components/collections/CollectionCard';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: "Collections - Joanie's Kitchen",
  description: 'Browse recipe collections from the community',
};

export default async function CollectionsPage() {
  const { userId } = await auth();

  // Fetch both public collections and user's collections if authenticated
  const [publicCollections, userCollections] = await Promise.all([
    getPublicCollections(20),
    userId ? getUserCollections() : Promise.resolve([]),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* User's Collections Section */}
        {userId && userCollections.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">My Collections</h2>
              <Link href="/profile/edit">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Collection
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userCollections.map((collection) => (
                <CollectionCard key={collection.id} collection={collection} showActions={true} />
              ))}
            </div>
          </div>
        )}

        {/* Public Collections Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {userId && userCollections.length > 0 ? 'Discover Collections' : 'Recipe Collections'}
            </h2>
          </div>

          {publicCollections.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                No public collections yet
              </h2>
              <p className="text-gray-600 mb-6">Be the first to create and share a collection!</p>
              {userId && (
                <Link href="/profile/edit">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Collection
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {publicCollections.map((collection) => (
                <CollectionCard key={collection.id} collection={collection} showAuthor={true} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
