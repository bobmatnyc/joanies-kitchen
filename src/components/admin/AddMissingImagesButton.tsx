'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface AddMissingImagesResult {
  processed: number;
  skipped: number;
  errors: string[];
}

/**
 * Admin button that triggers the add-recipe-images API endpoint.
 * Calls POST /api/admin/add-recipe-images?limit=<limit>
 * and surfaces the result as a toast notification.
 */
export function AddMissingImagesButton({ limit = 10 }: { limit?: number }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/add-recipe-images?limit=${limit}`, {
        method: 'POST',
      });

      const data = (await response.json()) as AddMissingImagesResult & { error?: string };

      if (!response.ok) {
        toast.error(data.error || 'Failed to add images');
        return;
      }

      if (data.errors && data.errors.length > 0) {
        toast.warning(
          `Processed ${data.processed} recipes, ${data.skipped} skipped. ${data.errors.length} error(s): ${data.errors[0]}`
        );
      } else if (data.processed === 0) {
        toast.info('No recipes without images found');
      } else {
        toast.success(`Added images to ${data.processed} recipe(s)`);
      }
    } catch (err) {
      toast.error('Network error while adding images');
      console.error('[AddMissingImages]', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      className="w-full bg-orange-600 hover:bg-orange-700"
    >
      {loading ? 'Adding Images...' : 'Add Missing Images'}
    </Button>
  );
}
