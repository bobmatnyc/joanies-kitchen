#!/usr/bin/env tsx
/**
 * Update Joanie's chef profile image with new photo
 */

import 'dotenv/config';
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';
import { eq } from 'drizzle-orm';
import { put } from '@vercel/blob';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

async function updateJoanieImage() {
  console.log('📸 Updating Joanie\'s chef profile image...\n');

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('❌ Error: BLOB_READ_WRITE_TOKEN not found');
    process.exit(1);
  }

  const imagePath = join(homedir(), 'Downloads', '504041340_10057695487601842_5079363680862032781_n.jpg');

  try {
    // Step 1: Upload to Vercel Blob
    console.log('📤 Uploading new image to Vercel Blob...');
    const buffer = readFileSync(imagePath);
    console.log(`   Size: ${(buffer.length / 1024).toFixed(2)} KB`);

    const blob = await put('chefs/joanie-portrait.jpg', buffer, {
      access: 'public',
      contentType: 'image/jpeg',
      addRandomSuffix: true, // Generate unique filename to avoid conflicts
    });

    console.log(`   ✅ Uploaded: ${blob.url}\n`);

    // Step 2: Update Joanie's chef record
    console.log('💾 Updating chef record...');

    const [updatedChef] = await db
      .update(chefs)
      .set({
        profile_image_url: blob.url,
        updated_at: new Date(),
      })
      .where(eq(chefs.slug, 'joanie'))
      .returning();

    if (!updatedChef) {
      throw new Error('Joanie chef record not found');
    }

    console.log(`   ✅ Updated: ${updatedChef.name}`);
    console.log(`   Image URL: ${updatedChef.profile_image_url}\n`);

    console.log('═'.repeat(70));
    console.log('SUCCESS');
    console.log('═'.repeat(70));
    console.log(`\n🎉 Joanie's profile image updated successfully!`);
    console.log(`\n🌐 View at: http://localhost:3002/discover/chefs`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

updateJoanieImage()
  .then(() => {
    console.log('\n✅ Script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
