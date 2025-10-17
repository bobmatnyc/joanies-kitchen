'use client';

import { Check, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  addRecipeToCollection,
  getUserCollections,
  removeRecipeFromCollection,
} from '@/app/actions/collections';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { Collection } from '@/lib/db/user-discovery-schema';
import { CollectionForm } from './CollectionForm';

interface AddToCollectionButtonProps {
  recipeId: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function AddToCollectionButton({
  recipeId,
  variant = 'outline',
  size = 'default',
}: AddToCollectionButtonProps) {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionIds, setCollectionIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const loadCollections = useCallback(async () => {
    setLoading(true);
    try {
      const userCollections = await getUserCollections();
      setCollections(userCollections);

      // TODO: Load which collections already contain this recipe
      // This would require a new server action to check recipe membership
      setCollectionIds(new Set());
    } catch (error) {
      console.error('Error loading collections:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadCollections();
    }
  }, [open, loadCollections]);

  const handleToggleCollection = async (collectionId: string) => {
    const isInCollection = collectionIds.has(collectionId);

    try {
      if (isInCollection) {
        const result = await removeRecipeFromCollection(collectionId, recipeId);
        if (result.success) {
          setCollectionIds((prev) => {
            const newSet = new Set(prev);
            newSet.delete(collectionId);
            return newSet;
          });
        }
      } else {
        const result = await addRecipeToCollection(collectionId, recipeId);
        if (result.success) {
          setCollectionIds((prev) => new Set(prev).add(collectionId));
          // Update recipe count
          setCollections((prev) =>
            prev.map((c) =>
              c.id === collectionId ? { ...c, recipe_count: c.recipe_count + 1 } : c
            )
          );
        }
      }
    } catch (error) {
      console.error('Error toggling collection:', error);
    }
  };

  const handleCreateSuccess = (newCollection: Collection) => {
    setCollections((prev) => [newCollection, ...prev]);
    setShowCreateForm(false);
    // Automatically add recipe to new collection
    handleToggleCollection(newCollection.id);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Plus className="w-4 h-4 mr-2" />
          Add to Collection
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Collection</DialogTitle>
          <DialogDescription>
            Save this recipe to your collections for easy access later
          </DialogDescription>
        </DialogHeader>

        {showCreateForm ? (
          <div className="mt-4">
            <CollectionForm
              onSuccess={handleCreateSuccess}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Create New Collection Button */}
            <Button variant="outline" className="w-full" onClick={() => setShowCreateForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create New Collection
            </Button>

            {/* Existing Collections */}
            {loading ? (
              <p className="text-center text-gray-500">Loading collections...</p>
            ) : collections.length === 0 ? (
              <p className="text-center text-gray-500">
                You don't have any collections yet. Create one to get started!
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {collections.map((collection) => {
                  const isInCollection = collectionIds.has(collection.id);

                  return (
                    <button
                      key={collection.id}
                      onClick={() => handleToggleCollection(collection.id)}
                      className={`w-full text-left p-3 rounded border transition-colors ${
                        isInCollection
                          ? 'bg-orange-50 border-orange-300'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{collection.name}</div>
                          <div className="text-sm text-gray-500">
                            {collection.recipe_count} recipes
                          </div>
                        </div>
                        {isInCollection && <Check className="w-5 h-5 text-orange-600" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
