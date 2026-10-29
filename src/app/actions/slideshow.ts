'use server';

import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { type NewSlideshowPhoto, type SlideshowPhoto, slideshowPhotos } from '@/lib/db/schema';

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
export async function createPhoto(
  data: Omit<NewSlideshowPhoto, 'id' | 'created_at' | 'updated_at'>
): Promise<SlideshowPhoto> {
  await requireAdmin(); // See #13: site-wide slideshow, admin only

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
  await requireAdmin(); // See #13: site-wide slideshow, admin only

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
  await requireAdmin(); // See #13: site-wide slideshow, admin only

  await db.delete(slideshowPhotos).where(eq(slideshowPhotos.id, id));
}

/**
 * Get all photos (including inactive) for admin management
 */
export async function getAllPhotosAdmin(): Promise<SlideshowPhoto[]> {
  await requireAdmin(); // See #13: site-wide slideshow, admin only

  const photos = await db.select().from(slideshowPhotos).orderBy(slideshowPhotos.display_order);

  return photos;
}

/**
 * Reorder photos by updating display_order (admin only).
 * Writes all positions in one atomic db.batch; rejects if the batch fails.
 * Test: `reorder-photos-neon-http.test.ts`
 */
export async function reorderPhotos(photoIds: string[]): Promise<void> {
  await requireAdmin(); // See #13: site-wide slideshow, admin only

  if (photoIds.length === 0) return;

  // #34: neon-http has no db.transaction; db.batch runs as one HTTP transaction.
  const now = new Date();
  const [first, ...rest] = photoIds.map((id, i) =>
    db
      .update(slideshowPhotos)
      .set({ display_order: i + 1, updated_at: now })
      .where(eq(slideshowPhotos.id, id))
  );
  await db.batch([first, ...rest]);
}
