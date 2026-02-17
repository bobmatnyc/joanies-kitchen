#!/usr/bin/env tsx
/**
 * Upload Joanie's Portrait to Vercel Blob
 *
 * Uploads the local joanie-portrait.png to Vercel Blob storage
 * and updates the chef profile to use the Blob URL.
 */

// Load environment variables
import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { put } from '@vercel/blob';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';

async function uploadJoanieImage() {
  console.log("📸 Uploading Joanie's portrait to Vercel Blob...\n");

  try {
    // Check for Blob token
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('❌ Error: BLOB_READ_WRITE_TOKEN environment variable not found!');
      console.error('   Add it to your .env.local file and try again.\n');
      process.exit(1);
    }

    // Get Joanie's chef profile
    const [joanie] = await db.select().from(chefs).where(eq(chefs.slug, 'joanie')).limit(1);

    if (!joanie) {
      console.log('❌ Joanie chef profile not found!');
      process.exit(1);
    }

    console.log(`Chef: ${joanie.display_name || joanie.name}`);
    console.log(`Current image: ${joanie.profile_image_url}\n`);

    // Read the local image file
    const imagePath = join(process.cwd(), 'public', 'joanie-portrait.png');
    console.log(`📂 Reading image from: ${imagePath}`);

    const imageBuffer = readFileSync(imagePath);
    console.log(`   Size: ${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB\n`);

    // Upload to Blob
    console.log('⬆️  Uploading to Vercel Blob...');
    const blob = await put('chefs/joanie-portrait.png', imageBuffer, {
      access: 'public',
      contentType: 'image/png',
    });

    console.log(`✅ Uploaded successfully!`);
    console.log(`   Blob URL: ${blob.url}\n`);

    // Update database
    console.log('💾 Updating chef profile in database...');
    const [updatedChef] = await db
      .update(chefs)
      .set({
        profile_image_url: blob.url,
        updated_at: new Date(),
      })
      .where(eq(chefs.id, joanie.id))
      .returning();

    console.log('✅ Database updated!\n');

    console.log('='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));
    console.log(`Chef: ${updatedChef.display_name || updatedChef.name}`);
    console.log(`Old image: /joanie-portrait.png (local)`);
    console.log(`New image: ${updatedChef.profile_image_url}`);
    console.log('='.repeat(70));

    console.log("\n🎉 Success! Joanie's portrait is now hosted on Vercel Blob.");
    console.log(`🌐 View profile: http://localhost:3002/chef/joanie`);
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
uploadJoanieImage()
  .then(() => {
    console.log('\n✅ Script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
