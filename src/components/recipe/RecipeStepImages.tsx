'use client';

import { Camera } from 'lucide-react';
import { ImageUploader } from './ImageUploader';
import type { RecipeFormData } from './RecipeUploadWizard';

interface RecipeStepImagesProps {
  formData: RecipeFormData;
  updateFormData: (updates: Partial<RecipeFormData>) => void;
}

export function RecipeStepImages({ formData, updateFormData }: RecipeStepImagesProps) {
  const handleImagesChange = (images: string[]) => {
    updateFormData({ images });
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-medium">Upload Recipe Photos (Optional)</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Add up to 6 photos of your recipe. Photos help others see what the finished dish should
          look like and make your recipe more appealing!
        </p>
      </div>

      {/* Image Uploader */}
      <ImageUploader images={formData.images} onChange={handleImagesChange} maxImages={6} />

      {/* Tips */}
      <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium">Photography Tips:</p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Use natural light when possible for the best colors</li>
          <li>Show the finished dish from different angles</li>
          <li>Include close-ups of texture and details</li>
          <li>The first image will be used as the main thumbnail</li>
          <li>You can drag and drop to reorder images</li>
        </ul>
      </div>

      {/* Skip Message */}
      {formData.images.length === 0 && (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            Photos are optional, but highly recommended. You can skip this step and add photos later
            by editing your recipe.
          </p>
        </div>
      )}
    </div>
  );
}
