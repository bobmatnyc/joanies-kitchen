'use client';

import { Calendar, Globe, MapPin } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { UserProfile } from '@/lib/db/user-discovery-schema';

interface ProfileDisplayProps {
  profile: UserProfile;
  stats?: {
    recipesCreated: number;
    publicRecipes: number;
    collectionsCreated: number;
    publicCollections: number;
  };
  isOwnProfile?: boolean;
}

export function ProfileDisplay({ profile, stats, isOwnProfile = false }: ProfileDisplayProps) {
  const joinDate = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Header Section */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          {profile.profile_image_url ? (
            <img
              src={profile.profile_image_url}
              alt={profile.display_name}
              className="w-24 h-24 rounded-full object-cover border-2 border-jk-sage/20"
            />
          ) : (
            <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-pink-500 rounded-full flex items-center justify-center text-white text-3xl font-bold">
              {profile.display_name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Profile Info */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{profile.display_name}</h1>
            <p className="text-gray-600">@{profile.username}</p>

            {/* Location & Website */}
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              {profile.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>{profile.location}</span>
                </div>
              )}
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-orange-600 transition-colors"
                >
                  <Globe className="w-4 h-4" />
                  <span>Website</span>
                </a>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>Joined {joinDate}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        {isOwnProfile ? (
          <Link href="/profile/edit">
            <Button variant="outline">Edit Profile</Button>
          </Link>
        ) : (
          <Button variant="outline" disabled title="Follow feature coming soon!">
            Follow
          </Button>
        )}
      </div>

      {/* Bio */}
      {profile.bio && (
        <div className="mb-6">
          <p className="text-gray-700 whitespace-pre-wrap">{profile.bio}</p>
        </div>
      )}

      {/* Specialties */}
      {profile.specialties && profile.specialties.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Specialties</h3>
          <div className="flex flex-wrap gap-2">
            {profile.specialties.map((specialty) => (
              <span
                key={specialty}
                className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm"
              >
                {specialty}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Statistics */}
      {stats && (
        <div className="border-t pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-jk-olive">{stats.publicRecipes}</div>
              <div className="text-sm text-gray-600">
                {stats.publicRecipes === 1 ? 'Recipe' : 'Recipes'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-jk-olive">{stats.publicCollections}</div>
              <div className="text-sm text-gray-600">
                {stats.publicCollections === 1 ? 'Collection' : 'Collections'}
              </div>
            </div>
            <div className="text-center" title="Follow system coming soon!">
              <div className="text-2xl font-bold text-gray-400">0</div>
              <div className="text-sm text-gray-400">Followers</div>
            </div>
            <div className="text-center" title="Follow system coming soon!">
              <div className="text-2xl font-bold text-gray-400">0</div>
              <div className="text-sm text-gray-400">Following</div>
            </div>
          </div>
          {isOwnProfile && stats.recipesCreated !== stats.publicRecipes && (
            <p className="text-xs text-gray-500 mt-4 text-center">
              You have {stats.recipesCreated - stats.publicRecipes} private{' '}
              {stats.recipesCreated - stats.publicRecipes === 1 ? 'recipe' : 'recipes'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
