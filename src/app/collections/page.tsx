import { getPublicCollections } from '@/app/actions/collections';
import { CollectionCard } from '@/components/collections/CollectionCard';

export const metadata = {
  title: "Collections - Joanie's Kitchen",
  description: 'Browse recipe collections from the community',
};

export default async function CollectionsPage() {
  // Fetch only public collections
  const publicCollections = await getPublicCollections(20);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Public Collections Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-heading text-jk-olive mb-2">
                Browse Collections
              </h1>
              <p className="text-jk-charcoal/70 font-body">
                Discover recipe collections shared by our community
              </p>
            </div>
          </div>

          {publicCollections.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                No public collections yet
              </h2>
              <p className="text-gray-600 mb-6">Check back soon for new collections!</p>
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
