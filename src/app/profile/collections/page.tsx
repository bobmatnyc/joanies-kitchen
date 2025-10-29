import { Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUserCollections } from '@/app/actions/collections';
import { CollectionCard } from '@/components/collections/CollectionCard';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth';

// Force dynamic rendering since we use authentication
export const dynamic = 'force-dynamic';

export default async function MyCollectionsPage() {
  // Check authentication - redirect if not authenticated
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in?redirect=/profile/collections');
  }

  // Fetch user's collections (both public and private)
  const userCollections = await getUserCollections();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-heading text-jk-olive mb-2">My Collections</h1>
            <p className="text-jk-charcoal/70 font-body">
              {userCollections.length} collection{userCollections.length !== 1 ? 's' : ''} in your
              library
            </p>
          </div>
          <Link href="/profile/edit">
            <Button className="bg-jk-tomato hover:bg-jk-tomato/90 text-white min-h-[44px] touch-manipulation font-ui">
              <Plus className="w-4 h-4 mr-2" />
              New Collection
            </Button>
          </Link>
        </div>

        {/* Collections Grid */}
        {userCollections.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No collections yet</h2>
            <p className="text-gray-600 mb-6">
              Create your first collection to organize your recipes!
            </p>
            <Link href="/profile/edit">
              <Button className="bg-jk-tomato hover:bg-jk-tomato/90 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Create Collection
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userCollections.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} showActions={true} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const metadata = {
  title: "My Collections | Joanie's Kitchen",
  description: 'Manage your recipe collections',
};
