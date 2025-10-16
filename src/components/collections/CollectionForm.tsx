'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { createCollection, updateCollection } from '@/app/actions/collections';
import type { Collection } from '@/lib/db/user-discovery-schema';

interface CollectionFormProps {
  collection?: Collection;
  onSuccess?: (collection: Collection) => void;
  onCancel?: () => void;
}

export function CollectionForm({
  collection,
  onSuccess,
  onCancel,
}: CollectionFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(collection?.name || '');
  const [description, setDescription] = useState(collection?.description || '');
  const [isPublic, setIsPublic] = useState(collection?.is_public ?? false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      let result;

      if (collection) {
        // Update existing collection
        result = await updateCollection(collection.id, {
          name,
          description: description || undefined,
          isPublic,
        });
      } else {
        // Create new collection
        result = await createCollection({
          name,
          description: description || undefined,
          isPublic,
        });
      }

      if (result.success && result.collection) {
        if (onSuccess) {
          onSuccess(result.collection);
        }
      } else {
        setError(result.error || 'Failed to save collection');
      }
    } catch (err) {
      console.error('Error saving collection:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit = name.trim().length >= 3 && !isLoading;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">
          Collection Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Favorite Recipes"
          required
          maxLength={100}
          disabled={isLoading}
        />
        <p className="text-sm text-gray-500">
          Choose a descriptive name for your collection
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What makes this collection special?"
          maxLength={500}
          rows={3}
          disabled={isLoading}
        />
        <p className="text-sm text-gray-500 text-right">
          {description.length}/500 characters
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="isPublic"
          checked={isPublic}
          onCheckedChange={setIsPublic}
          disabled={isLoading}
        />
        <Label htmlFor="isPublic" className="cursor-pointer">
          Make this collection public
        </Label>
      </div>
      <p className="text-sm text-gray-500">
        {isPublic
          ? 'Anyone can discover and view this collection'
          : 'Only you can see this collection'}
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={!canSubmit} className="flex-1">
          {isLoading
            ? 'Saving...'
            : collection
            ? 'Update Collection'
            : 'Create Collection'}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
