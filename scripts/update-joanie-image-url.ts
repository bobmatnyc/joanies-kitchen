#!/usr/bin/env tsx
/**
 * Update Joanie's image URL to Blob URL
 */

import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';
import { eq } from 'drizzle-orm';

async function updateJoanieImage() {
  const blobUrl = 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/chefs/joanie-portrait.png';

  const [updatedChef] = await db
    .update(chefs)
    .set({
      profile_image_url: blobUrl,
      updated_at: new Date(),
    })
    .where(eq(chefs.slug, 'joanie'))
    .returning();

  console.log('✅ Updated Joanie image URL to:', updatedChef.profile_image_url);
  process.exit(0);
}

updateJoanieImage();
