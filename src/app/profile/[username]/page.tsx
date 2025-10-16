import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { ProfileDisplay } from '@/components/profile/ProfileDisplay';
import { CollectionCard } from '@/components/collections/CollectionCard';
import { getProfileByUsername, getProfileStats } from '@/app/actions/user-profiles';
import { getUserCollections } from '@/app/actions/collections';

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

  // Fetch stats and collections
  const [stats, collections] = await Promise.all([
    getProfileStats(username),
    getUserCollections(profile.user_id),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <ProfileDisplay
          profile={profile}
          stats={stats || undefined}
          isOwnProfile={isOwnProfile}
        />

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

        {/* Recipes Section - Placeholder for future implementation */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Recipes</h2>
          </div>

          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <p className="text-gray-500">Recipe listing coming soon...</p>
          </div>
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
