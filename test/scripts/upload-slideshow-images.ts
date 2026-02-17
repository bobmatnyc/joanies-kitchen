#!/usr/bin/env tsx
/**
 * Upload slideshow images to Vercel Blob
 */

import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { put } from '@vercel/blob';

async function uploadSlideshowImages() {
  console.log('📸 Uploading slideshow images to Vercel Blob...\n');

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('❌ Error: BLOB_READ_WRITE_TOKEN not found');
    process.exit(1);
  }

  const slideshowDir = join(homedir(), 'Downloads', 'slideshow');
  const files = readdirSync(slideshowDir).filter((f) => f.endsWith('.jpg'));

  console.log(`Found ${files.length} images to upload\n`);

  const results: Array<{ filename: string; url: string; size: number }> = [];
  let totalSize = 0;

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filepath = join(slideshowDir, filename);

    try {
      console.log(`[${i + 1}/${files.length}] ${filename}`);

      const buffer = readFileSync(filepath);
      const sizeKB = buffer.length / 1024;
      totalSize += sizeKB;

      console.log(`   Size: ${sizeKB.toFixed(2)} KB`);

      // Upload to Vercel Blob with sequential numbering
      const blobPath = `slideshow/${String(i + 1).padStart(2, '0')}-${filename}`;
      const blob = await put(blobPath, buffer, {
        access: 'public',
        contentType: 'image/jpeg',
        addRandomSuffix: false,
      });

      console.log(`   ✅ Uploaded: ${blob.url.substring(0, 70)}...\n`);

      results.push({
        filename,
        url: blob.url,
        size: sizeKB,
      });

      // Rate limiting: small delay between uploads
      if (i < files.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`   ❌ Failed:`, error);
      throw error;
    }
  }

  console.log('\n═'.repeat(70));
  console.log('UPLOAD COMPLETE');
  console.log('═'.repeat(70));
  console.log(`Total images: ${results.length}`);
  console.log(`Total size: ${(totalSize / 1024).toFixed(2)} MB\n`);

  console.log('Image URLs:');
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.filename}`);
    console.log(`     ${r.url}`);
  });

  console.log('\n🎉 All slideshow images uploaded successfully!');
  console.log('\nNext: Add database schema and create photos page');
}

uploadSlideshowImages()
  .then(() => {
    console.log('\n✅ Script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
