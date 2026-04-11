/**
 * POST /api/admin/add-recipe-images
 *
 * Finds recipes with no images and generates them using:
 * - Local Ollama (gemma3:4b) to create a food photography prompt
 * - DALL-E 3 (if OPENAI_API_KEY is set) or Pollinations.ai (free fallback)
 * - Vercel Blob for permanent storage
 *
 * Query params:
 *   limit  - Number of recipes to process (default: 10, max: 50)
 *
 * Returns:
 *   { processed: number, skipped: number, errors: string[] }
 *
 * Authentication:
 *   Requires admin session (Clerk) OR API key with admin scope
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { addMissingRecipeImages } from '@/lib/services/image-generation.service';

export async function POST(request: NextRequest) {
  // Enforce admin-only access
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const rawLimit = searchParams.get('limit');
  const limit = Math.min(50, Math.max(1, parseInt(rawLimit ?? '10', 10) || 10));

  try {
    const result = await addMissingRecipeImages(limit);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] add-recipe-images error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
