'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link, Loader2, Move, Upload, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/lib/toast';

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

interface UploadingImage {
  id: string;
  file: File;
  progress: 'uploading' | 'success' | 'error';
  url?: string;
  error?: string;
}

function SortableImage({
  url,
  index,
  onRemove,
  isUploading,
}: {
  url: string;
  index: number;
  onRemove: () => void;
  isUploading?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: url,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group rounded-lg overflow-hidden bg-muted aspect-square"
    >
      {/* biome-ignore lint/performance/noImgElement: User-uploaded images need dynamic src */}
      <img
        src={url}
        alt={`Recipe ${index + 1}`}
        className="w-full h-full object-cover"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.src = '/api/placeholder/400/400';
        }}
      />
      {isUploading && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-white animate-spin" />
        </div>
      )}
      <div
        className={`absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 ${isUploading ? 'pointer-events-none' : ''}`}
      >
        <button
          {...attributes}
          {...listeners}
          className="p-2 bg-white/10 backdrop-blur rounded-full cursor-move hover:bg-white/20 transition-colors"
          aria-label="Drag to reorder"
          disabled={isUploading}
        >
          <Move className="h-4 w-4 text-white" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="p-2 bg-white/10 backdrop-blur rounded-full hover:bg-red-500/50 transition-colors"
          aria-label="Remove image"
          disabled={isUploading}
        >
          <X className="h-4 w-4 text-white" />
        </button>
      </div>
      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
        {index + 1}
      </div>
    </div>
  );
}

export function ImageUploader({ images = [], onChange, maxImages = 6 }: ImageUploaderProps) {
  const [urlInput, setUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingImages, setUploadingImages] = useState<Map<string, UploadingImage>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = images.indexOf(active.id as string);
      const newIndex = images.indexOf(over.id as string);
      onChange(arrayMove(images, oldIndex, newIndex));
    }
  };

  const addImageUrl = () => {
    if (urlInput && images.length < maxImages) {
      // Basic URL validation
      try {
        new URL(urlInput);
        onChange([...images, urlInput]);
        setUrlInput('');
      } catch {
        toast.error('Please enter a valid URL');
      }
    }
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  /**
   * Upload a single image file to the API
   */
  const uploadImage = useCallback(async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.url;
  }, []);

  /**
   * Process and upload multiple files
   */
  const processFiles = useCallback(
    async (files: File[]) => {
      // Limit to available slots
      const availableSlots = maxImages - images.length;
      const filesToUpload = files.slice(0, availableSlots);

      if (files.length > availableSlots) {
        toast.warning(
          `Only uploading ${availableSlots} of ${files.length} images (limit: ${maxImages})`
        );
      }

      // Create temporary IDs and preview URLs for each file
      const newUploadingImages = new Map(uploadingImages);

      for (const file of filesToUpload) {
        const tempId = `temp-${Date.now()}-${Math.random()}`;
        const previewUrl = URL.createObjectURL(file);

        newUploadingImages.set(tempId, {
          id: tempId,
          file,
          progress: 'uploading',
          url: previewUrl,
        });

        // Add preview URL to images array immediately
        onChange([...images, previewUrl]);
      }

      setUploadingImages(newUploadingImages);

      // Upload files sequentially to avoid overwhelming the API
      for (const file of filesToUpload) {
        const tempId = Array.from(newUploadingImages.entries()).find(
          ([, value]) => value.file === file
        )?.[0];

        if (!tempId) continue;

        try {
          // Validate file before upload
          if (file.size > 5 * 1024 * 1024) {
            throw new Error(`File "${file.name}" is too large. Maximum size is 5MB.`);
          }

          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            throw new Error(
              `File "${file.name}" has an unsupported format. Use JPEG, PNG, or WebP.`
            );
          }

          // Upload to API
          const cdnUrl = await uploadImage(file);

          // Replace preview URL with CDN URL
          const previewUrl = newUploadingImages.get(tempId)?.url;
          if (previewUrl) {
            const updatedImages = images.map((url) => (url === previewUrl ? cdnUrl : url));
            onChange(updatedImages);

            // Clean up object URL
            URL.revokeObjectURL(previewUrl);
          }

          // Update upload status
          const uploadingImage = newUploadingImages.get(tempId);
          if (uploadingImage) {
            newUploadingImages.set(tempId, {
              ...uploadingImage,
              progress: 'success',
              url: cdnUrl,
            });
          }

          toast.success(`Uploaded ${file.name}`);
        } catch (error) {
          // Handle upload error
          const errorMessage = error instanceof Error ? error.message : 'Upload failed';

          // Remove failed preview from images
          const previewUrl = newUploadingImages.get(tempId)?.url;
          if (previewUrl) {
            onChange(images.filter((url) => url !== previewUrl));
            URL.revokeObjectURL(previewUrl);
          }

          // Update upload status
          const uploadingImage = newUploadingImages.get(tempId);
          if (uploadingImage) {
            newUploadingImages.set(tempId, {
              ...uploadingImage,
              progress: 'error',
              error: errorMessage,
            });
          }

          toast.error(errorMessage);
        }
      }

      // Clean up uploading images state after a delay
      setTimeout(() => {
        setUploadingImages(new Map());
      }, 1000);
    },
    [images, maxImages, onChange, uploadingImages, uploadImage]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith('image/')
      );

      if (files.length > 0) {
        processFiles(files);
      }
    },
    [processFiles]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((file) => file.type.startsWith('image/'));

    if (files.length > 0) {
      processFiles(files);
    }

    // Reset file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isUploading = uploadingImages.size > 0;
  const isUploadingUrl = (url: string) => {
    return Array.from(uploadingImages.values()).some(
      (img) => img.url === url && img.progress === 'uploading'
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Recipe Images</Label>
        <span className="text-sm text-muted-foreground">
          {images.length} / {maxImages} images
          {isUploading && ' (uploading...)'}
        </span>
      </div>

      {/* Image Grid with Drag and Drop Reordering */}
      {images.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={images} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {images.map((url, index) => (
                <SortableImage
                  key={url}
                  url={url}
                  index={index}
                  onRemove={() => removeImage(index)}
                  isUploading={isUploadingUrl(url)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Upload Area */}
      {images.length < maxImages && (
        <>
          {/* Drag and Drop Zone */}
          {/* biome-ignore lint/a11y/useSemanticElements: Div needed for drag-and-drop functionality */}
          <div
            role="button"
            tabIndex={0}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${isUploading ? 'opacity-50 pointer-events-none' : ''}
              ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />
            {isUploading ? (
              <>
                <Loader2 className="h-10 w-10 mx-auto mb-4 text-muted-foreground animate-spin" />
                <p className="text-sm text-muted-foreground">Uploading images...</p>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag and drop images here, or{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-primary hover:underline"
                  >
                    browse
                  </button>
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports JPG, PNG, WebP (max 5MB per image, {maxImages} images total)
                </p>
              </>
            )}
          </div>

          {/* URL Input */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="url"
                placeholder="Or paste an image URL..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addImageUrl();
                  }
                }}
                disabled={isUploading}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={addImageUrl}
              disabled={!urlInput || images.length >= maxImages || isUploading}
            >
              <Link className="h-4 w-4 mr-2" />
              Add URL
            </Button>
          </div>
        </>
      )}

      {/* Tips */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>• First image will be used as the main thumbnail</p>
        <p>• Drag images to reorder them</p>
        <p>• Click the X to remove an image</p>
      </div>
    </div>
  );
}
