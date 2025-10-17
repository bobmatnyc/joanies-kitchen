#!/usr/bin/env tsx
/**
 * Upload hero background images to Vercel Blob
 */

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { put } from '@vercel/blob';

async function uploadHeroBackgrounds() {
  console.log('🎨 Uploading hero background images to Vercel Blob...\n');

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('❌ Error: BLOB_READ_WRITE_TOKEN not found');
    process.exit(1);
  }

  const images = [
    {
      localPath: join(
        homedir(),
        'Downloads',
        'A_textured_digital_illustration_depicts_an_ascendi.png'
      ),
      blobPath: 'hero/background-textured.png',
      name: 'Textured illustration',
    },
    {
      localPath: join(
        homedir(),
        'Downloads',
        'A_traditional_watercolor-style_illustration_on_tex.png'
      ),
      blobPath: 'hero/background-watercolor.png',
      name: 'Watercolor illustration',
    },
  ];

  const results: { name: string; url: string }[] = [];

  for (const image of images) {
    try {
      console.log(`📤 Uploading: ${image.name}`);

      // Read the file
      const buffer = readFileSync(image.localPath);
      console.log(`   Size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

      // Upload to Vercel Blob
      const blob = await put(image.blobPath, buffer, {
        access: 'public',
        contentType: 'image/png',
      });

      console.log(`   ✅ Uploaded: ${blob.url}\n`);
      results.push({ name: image.name, url: blob.url });
    } catch (error) {
      console.error(`   ❌ Failed to upload ${image.name}:`, error);
      throw error;
    }
  }

  console.log('\n═'.repeat(70));
  console.log('UPLOAD COMPLETE');
  console.log('═'.repeat(70));

  console.log('\nBackground Image URLs:');
  results.forEach(({ name, url }) => {
    console.log(`\n${name}:`);
    console.log(`  ${url}`);
  });

  console.log('\n\n🎉 Hero backgrounds uploaded successfully!');
  console.log('\nNext: Add these URLs to the hero section with fade/rotate animations');
}

uploadHeroBackgrounds()
  .then(() => {
    console.log('\n✅ Script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
