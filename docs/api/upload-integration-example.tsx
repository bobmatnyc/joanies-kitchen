/**
 * Image Upload Integration Example
 *
 * This file demonstrates how to integrate the /api/upload endpoint
 * with the RecipeUploadWizard component.
 */

import { useState } from 'react';
import { toast } from 'sonner';

// Type definitions for the upload API response
interface UploadSuccessResponse {
  success: true;
  url: string;
}

interface UploadErrorResponse {
  success: false;
  error: string;
}

type UploadResponse = UploadSuccessResponse | UploadErrorResponse;

/**
 * Upload an image file to Vercel Blob Storage
 *
 * @param file - Image file to upload
 * @returns Promise resolving to the CDN URL
 * @throws Error if upload fails
 */
export async function uploadImage(file: File): Promise<string> {
  // Create form data
  const formData = new FormData();
  formData.append('file', file);

  // Make upload request
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  // Parse response
  const result: UploadResponse = await response.json();

  // Handle errors
  if (!result.success) {
    throw new Error(result.error);
  }

  // Return CDN URL
  return result.url;
}

/**
 * Example: Image Upload Hook for Recipe Wizard
 *
 * This hook manages image upload state and provides upload functionality
 * that can be used in the RecipeUploadWizard component.
 */
export function useImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);

  /**
   * Upload a single image and track its URL
   */
  const uploadSingleImage = async (file: File): Promise<string> => {
    setIsUploading(true);

    try {
      const url = await uploadImage(file);
      setUploadedUrls((prev) => [...prev, url]);
      toast.success('Image uploaded successfully');
      return url;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      toast.error(message);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Upload multiple images in parallel
   */
  const uploadMultipleImages = async (files: File[]): Promise<string[]> => {
    setIsUploading(true);

    try {
      const uploadPromises = files.map(uploadImage);
      const urls = await Promise.all(uploadPromises);
      setUploadedUrls((prev) => [...prev, ...urls]);
      toast.success(`${urls.length} images uploaded successfully`);
      return urls;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      toast.error(message);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Clear all uploaded URLs
   */
  const clearUrls = () => {
    setUploadedUrls([]);
  };

  return {
    isUploading,
    uploadedUrls,
    uploadSingleImage,
    uploadMultipleImages,
    clearUrls,
  };
}

/**
 * Example: Image Upload Component
 *
 * This component demonstrates a simple file input that uploads
 * to Vercel Blob and displays the result.
 */
export function ImageUploadExample() {
  const { isUploading, uploadedUrls, uploadSingleImage } = useImageUpload();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File size must be less than 5MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPEG, PNG, and WebP images are allowed');
      return;
    }

    // Upload the file
    await uploadSingleImage(file);
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="image-upload" className="block text-sm font-medium mb-2">
          Upload Recipe Image
        </label>
        <input
          id="image-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={isUploading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
        />
      </div>

      {isUploading && <p className="text-sm text-muted-foreground">Uploading...</p>}

      {uploadedUrls.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Uploaded Images:</p>
          <div className="grid grid-cols-2 gap-4">
            {uploadedUrls.map((url, index) => (
              <div key={url} className="relative aspect-square rounded-lg overflow-hidden">
                <img
                  src={url}
                  alt={`Uploaded ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Example: Drag and Drop Upload
 *
 * Advanced example with drag and drop support
 */
export function DragDropImageUpload() {
  const { isUploading, uploadSingleImage } = useImageUpload();
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please drop an image file');
      return;
    }

    await uploadSingleImage(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        isDragging ? 'border-primary bg-primary/5' : 'border-gray-300'
      }`}
    >
      {isUploading ? (
        <p className="text-muted-foreground">Uploading...</p>
      ) : (
        <>
          <p className="text-lg font-medium mb-2">Drop image here</p>
          <p className="text-sm text-muted-foreground">or click to select</p>
          <input type="file" accept="image/*" className="hidden" />
        </>
      )}
    </div>
  );
}

/**
 * Example: Integration with RecipeUploadWizard
 *
 * This shows how to modify the RecipeUploadWizard to use the upload API
 */
export function RecipeImageUploadStep() {
  const { uploadSingleImage, isUploading } = useImageUpload();
  const [recipeImages, setRecipeImages] = useState<string[]>([]);

  const handleAddImage = async (file: File) => {
    try {
      // Upload to Vercel Blob
      const url = await uploadSingleImage(file);

      // Add to recipe images
      setRecipeImages((prev) => [...prev, url]);
    } catch (error) {
      console.error('Failed to upload image:', error);
    }
  };

  const handleRemoveImage = (index: number) => {
    setRecipeImages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Recipe Images</h3>

      {/* Image upload input */}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleAddImage(file);
        }}
        disabled={isUploading}
      />

      {/* Display uploaded images */}
      {recipeImages.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {recipeImages.map((url, index) => (
            <div key={url} className="relative group">
              <img
                src={url}
                alt={`Recipe ${index + 1}`}
                className="w-full aspect-square object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => handleRemoveImage(index)}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Store URLs in form data */}
      <input type="hidden" name="images" value={JSON.stringify(recipeImages)} />
    </div>
  );
}
