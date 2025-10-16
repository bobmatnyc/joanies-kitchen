'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  getAllPhotosAdmin,
  updatePhoto,
  deletePhoto,
  reorderPhotos,
} from '@/app/actions/slideshow';
import type { SlideshowPhoto } from '@/lib/db/schema';
import { ChevronUp, ChevronDown, Eye, EyeOff, Trash2, Edit, Plus } from 'lucide-react';

export function SlideshowManager() {
  const [photos, setPhotos] = useState<SlideshowPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPhoto, setEditingPhoto] = useState<SlideshowPhoto | null>(null);
  const [editCaption, setEditCaption] = useState('');

  useEffect(() => {
    loadPhotos();
  }, []);

  async function loadPhotos() {
    try {
      const data = await getAllPhotosAdmin();
      setPhotos(data);
    } catch (error) {
      console.error('Failed to load photos:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleActive(photo: SlideshowPhoto) {
    try {
      await updatePhoto(photo.id, { is_active: !photo.is_active });
      await loadPhotos();
    } catch (error) {
      console.error('Failed to toggle photo:', error);
      alert('Failed to update photo');
    }
  }

  async function handleUpdateCaption() {
    if (!editingPhoto) return;

    try {
      await updatePhoto(editingPhoto.id, { caption: editCaption });
      await loadPhotos();
      setEditingPhoto(null);
      setEditCaption('');
    } catch (error) {
      console.error('Failed to update caption:', error);
      alert('Failed to update caption');
    }
  }

  async function handleDelete(photoId: string) {
    if (!confirm('Are you sure you want to delete this photo?')) return;

    try {
      await deletePhoto(photoId);
      await loadPhotos();
    } catch (error) {
      console.error('Failed to delete photo:', error);
      alert('Failed to delete photo');
    }
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return;

    const newPhotos = [...photos];
    [newPhotos[index - 1], newPhotos[index]] = [newPhotos[index], newPhotos[index - 1]];

    try {
      await reorderPhotos(newPhotos.map((p) => p.id));
      await loadPhotos();
    } catch (error) {
      console.error('Failed to reorder photos:', error);
      alert('Failed to reorder photos');
    }
  }

  async function handleMoveDown(index: number) {
    if (index === photos.length - 1) return;

    const newPhotos = [...photos];
    [newPhotos[index], newPhotos[index + 1]] = [newPhotos[index + 1], newPhotos[index]];

    try {
      await reorderPhotos(newPhotos.map((p) => p.id));
      await loadPhotos();
    } catch (error) {
      console.error('Failed to reorder photos:', error);
      alert('Failed to reorder photos');
    }
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading photos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Slideshow Photos</h2>
          <p className="text-gray-600 mt-1">
            Manage photos displayed in the photo gallery ({photos.length} total,{' '}
            {photos.filter((p) => p.is_active).length} active)
          </p>
        </div>
        <Button asChild>
          <a href="/about/photos" target="_blank" rel="noopener noreferrer">
            View Gallery
          </a>
        </Button>
      </div>

      {photos.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
          <p className="text-gray-600 mb-4">No photos uploaded yet</p>
          <p className="text-sm text-gray-500">
            Run the seed script to populate photos:
            <br />
            <code className="bg-gray-200 px-2 py-1 rounded mt-2 inline-block">
              pnpm tsx scripts/seed-slideshow-photos.ts
            </code>
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Order</TableHead>
                <TableHead className="w-32">Preview</TableHead>
                <TableHead>Caption</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-48">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {photos.map((photo, index) => (
                <TableRow key={photo.id}>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === photos.length - 1}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="relative w-20 h-20 rounded overflow-hidden">
                      <Image
                        src={photo.image_url}
                        alt={photo.caption || 'Gallery photo'}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-md">
                      {photo.caption || (
                        <span className="text-gray-400 italic">No caption</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {photo.is_active ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Hidden
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingPhoto(photo);
                              setEditCaption(photo.caption || '');
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Caption</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="relative w-full h-64 rounded overflow-hidden">
                              <Image
                                src={photo.image_url}
                                alt="Preview"
                                fill
                                className="object-contain"
                                sizes="100vw"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="caption">Caption</Label>
                              <Input
                                id="caption"
                                value={editCaption}
                                onChange={(e) => setEditCaption(e.target.value)}
                                placeholder="Enter a caption for this photo..."
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setEditingPhoto(null);
                                setEditCaption('');
                              }}
                            >
                              Cancel
                            </Button>
                            <Button onClick={handleUpdateCaption}>Save</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(photo)}
                        title={photo.is_active ? 'Hide photo' : 'Show photo'}
                      >
                        {photo.is_active ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(photo.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
