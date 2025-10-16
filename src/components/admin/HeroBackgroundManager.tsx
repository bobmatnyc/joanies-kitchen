'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Trash2, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { upload } from '@vercel/blob/client';
import {
  getAllBackgrounds,
  createBackground,
  updateBackground,
  deleteBackground,
  reorderBackground,
} from '@/app/actions/hero-backgrounds';
import type { HeroBackground } from '@/lib/db/schema';
import Image from 'next/image';

export function HeroBackgroundManager() {
  const [backgrounds, setBackgrounds] = useState<HeroBackground[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadBackgrounds();
  }, []);

  async function loadBackgrounds() {
    setIsLoading(true);
    const result = await getAllBackgrounds();
    if (result.success && result.data) {
      setBackgrounds(result.data);
    }
    setIsLoading(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be smaller than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      // Upload to Vercel Blob
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      });

      // Create database record
      const result = await createBackground(blob.url);
      if (result.success) {
        await loadBackgrounds();
      } else {
        alert('Failed to create background: ' + result.error);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image');
    } finally {
      setIsUploading(false);
      // Reset file input
      e.target.value = '';
    }
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    const result = await updateBackground(id, { is_active: !currentActive });
    if (result.success) {
      await loadBackgrounds();
    } else {
      alert('Failed to toggle active: ' + result.error);
    }
  }

  async function handleReorder(id: string, direction: 'up' | 'down') {
    const result = await reorderBackground(id, direction);
    if (result.success) {
      await loadBackgrounds();
    } else {
      alert(result.error || 'Failed to reorder');
    }
  }

  async function handleDelete(id: string, imageUrl: string) {
    if (!confirm('Are you sure you want to delete this background image?')) {
      return;
    }

    const result = await deleteBackground(id);
    if (result.success) {
      await loadBackgrounds();
    } else {
      alert('Failed to delete: ' + result.error);
    }
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading backgrounds...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="flex items-center gap-4">
        <label
          htmlFor="hero-upload"
          className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {isUploading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Upload New Background
            </>
          )}
        </label>
        <input
          id="hero-upload"
          type="file"
          accept="image/*"
          onChange={handleUpload}
          disabled={isUploading}
          className="hidden"
        />
        <span className="text-sm text-gray-500">Max 5MB, any image format</span>
      </div>

      {/* Backgrounds List */}
      <div className="space-y-4">
        {backgrounds.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No backgrounds yet. Upload your first one!
          </div>
        ) : (
          backgrounds.map((bg, index) => (
            <div
              key={bg.id}
              className="flex items-center gap-4 p-4 border rounded-lg bg-white"
            >
              {/* Preview Thumbnail */}
              <div className="relative w-32 h-20 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                <Image
                  src={bg.image_url}
                  alt="Hero background preview"
                  fill
                  className="object-cover"
                  sizes="128px"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  Order: {bg.display_order}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {bg.image_url}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      bg.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {bg.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* Reorder buttons */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReorder(bg.id, 'up')}
                  disabled={index === 0}
                  title="Move up"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReorder(bg.id, 'down')}
                  disabled={index === backgrounds.length - 1}
                  title="Move down"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>

                {/* Toggle active */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleActive(bg.id, bg.is_active)}
                  title={bg.is_active ? 'Deactivate' : 'Activate'}
                >
                  {bg.is_active ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </Button>

                {/* Delete */}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(bg.id, bg.image_url)}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Instructions */}
      <div className="text-sm text-gray-600 bg-blue-50 p-4 rounded-lg">
        <p className="font-medium mb-2">Instructions:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Upload background images to display on the hero section</li>
          <li>Use the eye icon to activate/deactivate backgrounds</li>
          <li>Use arrows to reorder backgrounds (lower order = shown first)</li>
          <li>Only active backgrounds will be displayed on the homepage</li>
          <li>Recommended: Use high-resolution images (1920x1080 or larger)</li>
        </ul>
      </div>
    </div>
  );
}
