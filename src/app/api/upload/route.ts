/**
 * Image Upload API Route
 *
 * POST /api/upload - Upload images to Vercel Blob Storage
 *
 * Accepts multipart/form-data with image files and returns CDN URLs.
 * Used by RecipeUploadWizard for client-side image uploads.
 *
 * Authentication: Requires Clerk session
 * File constraints:
 * - Max size: 5MB per image
 * - Allowed types: image/jpeg, image/png, image/webp
 */

import { put } from '@vercel/blob';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// Configuration
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const BLOB_FOLDER = 'recipe-images';

/**
 * Generate unique filename with timestamp and random string
 */
function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop() || 'png';
  return `${timestamp}-${randomString}.${extension}`;
}

/**
 * Validate file size and type
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds 5MB limit. File size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    };
  }

  // Check file type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.type}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * POST /api/upload
 *
 * Upload an image file to Vercel Blob Storage
 *
 * Request: multipart/form-data with 'file' field
 * Response: { success: true, url: string } or { success: false, error: string }
 *
 * Errors:
 * - 401: Not authenticated
 * - 400: No file provided
 * - 413: File too large (>5MB)
 * - 415: Unsupported file type
 * - 500: Upload failure
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Check authentication
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please sign in to upload images.' },
        { status: 401 }
      );
    }

    // Step 2: Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided. Please include a file in the request.' },
        { status: 400 }
      );
    }

    // Step 3: Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      const statusCode = file.size > MAX_FILE_SIZE ? 413 : 415;
      return NextResponse.json({ success: false, error: validation.error }, { status: statusCode });
    }

    // Step 4: Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Step 5: Generate unique filename
    const filename = generateUniqueFilename(file.name);
    const blobPath = `${BLOB_FOLDER}/${filename}`;

    // Step 6: Upload to Vercel Blob
    const blob = await put(blobPath, buffer, {
      access: 'public',
      contentType: file.type,
    });

    // Step 7: Return success response
    return NextResponse.json(
      {
        success: true,
        url: blob.url,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('Image upload error:', error);

    // Handle specific Vercel Blob errors
    if (error instanceof Error && error.message?.includes('blob')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to upload to storage. Please try again.',
        },
        { status: 500 }
      );
    }

    // Generic error response
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error. Please try again later.',
      },
      { status: 500 }
    );
  }
}
