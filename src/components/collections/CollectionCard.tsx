'use client';

import { BookOpen, Lock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Collection } from '@/lib/db/user-discovery-schema';

interface CollectionCardProps {
  collection: Collection & {
    ownerUsername?: string;
    ownerDisplayName?: string;
    recipes?: Array<{
      images?: string | null;
      image_url?: string | null;
      name?: string;
    }>;
  };
  showAuthor?: boolean;
  showActions?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function CollectionCard({
  collection,
  showAuthor = false,
  showActions = false,
  onEdit,
  onDelete,
}: CollectionCardProps) {
  const collectionUrl = collection.ownerUsername
    ? `/collections/${collection.ownerUsername}/${collection.slug}`
    : `/collections/${collection.id}`;

  // Generate cover image from first 4 recipes
  const recipeImages: string[] = [];
  if (collection.recipes && collection.recipes.length > 0) {
    for (let i = 0; i < Math.min(4, collection.recipes.length); i++) {
      const recipe = collection.recipes[i];
      try {
        const images = recipe.images ? JSON.parse(recipe.images as string) : [];
        const imageUrl = images[0] || recipe.image_url;
        if (imageUrl) {
          recipeImages.push(imageUrl);
        }
      } catch (e) {
        console.warn('Failed to parse recipe images:', e);
      }
    }
  }

  const hasCoverImages = recipeImages.length > 0;
  const _showCoverImage = collection.cover_image_url || hasCoverImages;

  return (
    <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Cover Image or Placeholder */}
      <Link href={collectionUrl}>
        <div className="relative h-48 bg-gradient-to-br from-orange-200 via-pink-200 to-purple-200 flex items-center justify-center overflow-hidden">
          {collection.cover_image_url ? (
            <img
              src={collection.cover_image_url}
              alt={collection.name}
              className="w-full h-full object-cover"
            />
          ) : hasCoverImages ? (
            <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5 bg-gray-200">
              {recipeImages.map((imageUrl, index) => (
                <div key={index} className="relative bg-gray-100">
                  <img
                    src={imageUrl}
                    alt={`Recipe ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
              {/* Fill remaining spots with placeholder */}
              {Array.from({ length: 4 - recipeImages.length }).map((_, index) => (
                <div
                  key={`placeholder-${index}`}
                  className="bg-gradient-to-br from-jk-sage/20 to-jk-clay/20 flex items-center justify-center"
                >
                  <BookOpen className="w-8 h-8 text-gray-400" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center">
              <BookOpen className="w-16 h-16 text-white/80 mx-auto mb-2" />
              <p className="text-white/80 text-sm">{collection.recipe_count} recipes</p>
            </div>
          )}

          {/* Privacy Badge */}
          {!collection.is_public && (
            <div className="absolute top-2 right-2 bg-gray-900/75 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Private</span>
            </div>
          )}
        </div>
      </Link>

      {/* Collection Info */}
      <div className="p-4">
        <Link href={collectionUrl}>
          <h3 className="text-lg font-semibold text-gray-900 hover:text-orange-600 transition-colors line-clamp-1">
            {collection.name}
          </h3>
        </Link>

        {collection.description && (
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{collection.description}</p>
        )}

        {/* Author Info */}
        {showAuthor && collection.ownerUsername && (
          <Link
            href={`/chef/${collection.ownerUsername}`}
            className="text-sm text-gray-500 hover:text-orange-600 transition-colors mt-2 block"
          >
            by {collection.ownerDisplayName || collection.ownerUsername}
          </Link>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>{collection.recipe_count} recipes</span>
          <span>Updated {new Date(collection.updated_at).toLocaleDateString()}</span>
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={onEdit} className="flex-1">
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              Delete
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
