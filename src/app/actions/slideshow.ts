'use server';

import { db } from '@/lib/db';
import { slideshowPhotos, type SlideshowPhoto, type NewSlideshowPhoto } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';

/**
 * Get all active slideshow photos ordered by display_order
 */
export async function getAllPhotos(): Promise<SlideshowPhoto[]> {
  const photos = await db
    .select()
    .from(slideshowPhotos)
    .where(eq(slideshowPhotos.is_active, true))
    .orderBy(slideshowPhotos.display_order);

  return photos;
}

/**
 * Get a single photo by ID
 */
export async function getPhoto(id: string): Promise<SlideshowPhoto | null> {
  const [photo] = await db
    .select()
    .from(slideshowPhotos)
    .where(eq(slideshowPhotos.id, id))
    .limit(1);

  return photo || null;
}

/**
 * Create a new slideshow photo (admin only)
 */
export async function createPhoto(data: Omit<NewSlideshowPhoto, 'id' | 'created_at' | 'updated_at'>): Promise<SlideshowPhoto> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized: Must be signed in');
  }

  // TODO: Add admin check when admin system is implemented
  // For now, any authenticated user can add photos

  const [photo] = await db
    .insert(slideshowPhotos)
    .values({
      ...data,
      is_active: data.is_active ?? true,
      display_order: data.display_order ?? 0,
    })
    .returning();

  return photo;
}

/**
 * Update an existing slideshow photo (admin only)
 */
export async function updatePhoto(
  id: string,
  data: Partial<Omit<NewSlideshowPhoto, 'id' | 'created_at'>>
): Promise<SlideshowPhoto> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized: Must be signed in');
  }

  // TODO: Add admin check when admin system is implemented

  const [photo] = await db
    .update(slideshowPhotos)
    .set({
      ...data,
      updated_at: new Date(),
    })
    .where(eq(slideshowPhotos.id, id))
    .returning();

  if (!photo) {
    throw new Error(`Photo not found: ${id}`);
  }

  return photo;
}

/**
 * Delete a slideshow photo (admin only)
 */
export async function deletePhoto(id: string): Promise<void> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized: Must be signed in');
  }

  // TODO: Add admin check when admin system is implemented

  await db
    .delete(slideshowPhotos)
    .where(eq(slideshowPhotos.id, id));
}

/**
 * Get all photos (including inactive) for admin management
 */
export async function getAllPhotosAdmin(): Promise<SlideshowPhoto[]> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized: Must be signed in');
  }

  // TODO: Add admin check when admin system is implemented

  const photos = await db
    .select()
    .from(slideshowPhotos)
    .orderBy(slideshowPhotos.display_order);

  return photos;
}

/**
 * Reorder photos by updating display_order
 */
export async function reorderPhotos(photoIds: string[]): Promise<void> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized: Must be signed in');
  }

  // TODO: Add admin check when admin system is implemented

  // Update each photo's display_order based on its position in the array
  await db.transaction(async (tx) => {
    for (let i = 0; i < photoIds.length; i++) {
      await tx
        .update(slideshowPhotos)
        .set({ display_order: i + 1, updated_at: new Date() })
        .where(eq(slideshowPhotos.id, photoIds[i]));
    }
  });
}
