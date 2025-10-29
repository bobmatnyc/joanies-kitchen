'use client';

import { Image as ImageIcon, Upload, Wand2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { regenerateImage, uploadRecipeImage } from '@/app/actions/admin-edit';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ImageEditorProps {
  recipeId: string;
  recipeName: string;
  currentImageUrl?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

/**
 * Image Editor Overlay
 *
 * Inline editor for recipe images with AI regeneration and file upload.
 *
 * Features:
 * - Display current image with preview
 * - "Regenerate with AI" button (uses existing flag function)
 * - "Upload new image" button (file upload)
 * - Image preview before saving
 * - Mobile-friendly (44x44px touch targets)
 */
export function ImageEditor({
  recipeId,
  recipeName,
  currentImageUrl,
  open,
  onOpenChange,
  onSave,
}: ImageEditorProps) {
  const [regenerating, setRegenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRegenerateWithAI = async () => {
    setRegenerating(true);
    try {
      const result = await regenerateImage(recipeId);

      if (result.success) {
        toast.success('Image regenerated successfully!');
        onSave?.();
        onOpenChange(false);
      } else {
        toast.error(result.error || 'Failed to regenerate image');
      }
    } catch (error) {
      console.error('Regenerate error:', error);
      toast.error('Failed to regenerate image with AI');
    } finally {
      setRegenerating(false);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setUploading(true);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        setPreviewUrl(base64String);

        // Upload image
        const result = await uploadRecipeImage(recipeId, base64String);

        if (result.success) {
          toast.success('Image uploaded successfully!');
          onSave?.();
          onOpenChange(false);
        } else {
          toast.error(result.error || 'Failed to upload image');
          setPreviewUrl(null);
        }

        setUploading(false);
      };

      reader.onerror = () => {
        toast.error('Failed to read image file');
        setUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
      setUploading(false);
    }
  };

  const handleClose = () => {
    setPreviewUrl(null);
    onOpenChange(false);
  };

  const displayImageUrl = previewUrl || currentImageUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Recipe Image</DialogTitle>
          <DialogDescription>
            Managing image for <strong>{recipeName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current/Preview Image */}
          <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
            {displayImageUrl ? (
              <img src={displayImageUrl} alt={recipeName} className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                <ImageIcon className="w-16 h-16 mb-2 opacity-50" />
                <p className="text-sm">No image available</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={handleRegenerateWithAI}
              disabled={regenerating || uploading}
              className="min-h-[44px] w-full"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              {regenerating ? 'Regenerating...' : 'Regenerate with AI'}
            </Button>

            <Button
              variant="outline"
              onClick={handleFileSelect}
              disabled={regenerating || uploading}
              className="min-h-[44px] w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload New Image'}
            </Button>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload image file"
          />

          {/* Info Text */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Regenerate with AI: Uses DALL-E 3 to create a new image based on recipe name</p>
            <p>• Upload New Image: Select an image file from your device (max 5MB)</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={regenerating || uploading}
            className="min-h-[44px]"
          >
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
