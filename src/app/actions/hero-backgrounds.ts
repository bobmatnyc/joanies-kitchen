'use server';

import { del } from '@vercel/blob';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { checkAdminAccess } from '@/lib/admin';
import { db } from '@/lib/db';
import { heroBackgrounds, type NewHeroBackground } from '@/lib/db/schema';

/**
 * Get all active hero backgrounds (for homepage)
 */
export async function getActiveBackgrounds() {
  try {
    const backgrounds = await db
      .select()
      .from(heroBackgrounds)
      .where(eq(heroBackgrounds.is_active, true))
      .orderBy(asc(heroBackgrounds.display_order));

    return { success: true, data: backgrounds };
  } catch (error) {
    console.error('[getActiveBackgrounds] Error:', error);
    return { success: false, error: 'Failed to fetch active backgrounds' };
  }
}

/**
 * Get all hero backgrounds (for admin)
 */
export async function getAllBackgrounds() {
  try {
    const { isAdmin } = await checkAdminAccess(); // See #13: site-wide hero images, admin only
    if (!isAdmin) {
      return { success: false, error: 'Admin access required' };
    }

    const backgrounds = await db
      .select()
      .from(heroBackgrounds)
      .orderBy(asc(heroBackgrounds.display_order), desc(heroBackgrounds.created_at));

    return { success: true, data: backgrounds };
  } catch (error) {
    console.error('[getAllBackgrounds] Error:', error);
    return { success: false, error: 'Failed to fetch backgrounds' };
  }
}

/**
 * Create a new hero background
 */
export async function createBackground(imageUrl: string, displayOrder?: number) {
  try {
    const { isAdmin } = await checkAdminAccess(); // See #13: site-wide hero images, admin only
    if (!isAdmin) {
      return { success: false, error: 'Admin access required' };
    }

    // If no display order provided, get the next highest order
    let order = displayOrder;
    if (order === undefined) {
      const maxOrder = await db
        .select({ max: sql<number>`COALESCE(MAX(${heroBackgrounds.display_order}), 0)` })
        .from(heroBackgrounds);
      order = (maxOrder[0]?.max ?? 0) + 1;
    }

    const newBackground: NewHeroBackground = {
      image_url: imageUrl,
      display_order: order,
      is_active: true,
    };

    const [background] = await db.insert(heroBackgrounds).values(newBackground).returning();

    return { success: true, data: background };
  } catch (error) {
    console.error('[createBackground] Error:', error);
    return { success: false, error: 'Failed to create background' };
  }
}

/**
 * Update a hero background
 */
export async function updateBackground(
  id: string,
  data: { is_active?: boolean; display_order?: number }
) {
  try {
    const { isAdmin } = await checkAdminAccess(); // See #13: site-wide hero images, admin only
    if (!isAdmin) {
      return { success: false, error: 'Admin access required' };
    }

    const [updated] = await db
      .update(heroBackgrounds)
      .set({
        ...data,
        updated_at: new Date(),
      })
      .where(eq(heroBackgrounds.id, id))
      .returning();

    if (!updated) {
      return { success: false, error: 'Background not found' };
    }

    return { success: true, data: updated };
  } catch (error) {
    console.error('[updateBackground] Error:', error);
    return { success: false, error: 'Failed to update background' };
  }
}

/**
 * Delete a hero background
 */
export async function deleteBackground(id: string) {
  try {
    const { isAdmin } = await checkAdminAccess(); // See #13: site-wide hero images, admin only
    if (!isAdmin) {
      return { success: false, error: 'Admin access required' };
    }

    // Get the background to delete the blob
    const [background] = await db
      .select()
      .from(heroBackgrounds)
      .where(eq(heroBackgrounds.id, id))
      .limit(1);

    if (!background) {
      return { success: false, error: 'Background not found' };
    }

    // Delete from database
    await db.delete(heroBackgrounds).where(eq(heroBackgrounds.id, id));

    // Delete from Vercel Blob (only if it's a blob URL)
    if (background.image_url.includes('blob.vercel-storage.com')) {
      try {
        await del(background.image_url);
      } catch (blobError) {
        console.error('[deleteBackground] Failed to delete blob:', blobError);
        // Continue anyway - database record is already deleted
      }
    }

    return { success: true };
  } catch (error) {
    console.error('[deleteBackground] Error:', error);
    return { success: false, error: 'Failed to delete background' };
  }
}

/**
 * Reorder a hero background (move up or down)
 */
export async function reorderBackground(id: string, direction: 'up' | 'down') {
  try {
    const { isAdmin } = await checkAdminAccess(); // See #13: site-wide hero images, admin only
    if (!isAdmin) {
      return { success: false, error: 'Admin access required' };
    }

    // Get the current background
    const [current] = await db
      .select()
      .from(heroBackgrounds)
      .where(eq(heroBackgrounds.id, id))
      .limit(1);

    if (!current) {
      return { success: false, error: 'Background not found' };
    }

    // Find the adjacent background to swap with
    const adjacentQuery =
      direction === 'up'
        ? db
            .select()
            .from(heroBackgrounds)
            .where(sql`${heroBackgrounds.display_order} < ${current.display_order}`)
            .orderBy(desc(heroBackgrounds.display_order))
            .limit(1)
        : db
            .select()
            .from(heroBackgrounds)
            .where(sql`${heroBackgrounds.display_order} > ${current.display_order}`)
            .orderBy(asc(heroBackgrounds.display_order))
            .limit(1);

    const [adjacent] = await adjacentQuery;

    if (!adjacent) {
      return { success: false, error: 'Cannot move in that direction' };
    }

    // Swap display orders
    await db
      .update(heroBackgrounds)
      .set({ display_order: adjacent.display_order, updated_at: new Date() })
      .where(eq(heroBackgrounds.id, current.id));

    await db
      .update(heroBackgrounds)
      .set({ display_order: current.display_order, updated_at: new Date() })
      .where(eq(heroBackgrounds.id, adjacent.id));

    return { success: true };
  } catch (error) {
    console.error('[reorderBackground] Error:', error);
    return { success: false, error: 'Failed to reorder background' };
  }
}
