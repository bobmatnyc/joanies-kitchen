#!/usr/bin/env tsx
/**
 * Add Chef Profile Images
 *
 * Updates existing chef profiles with profile images.
 * Images should be placed in /public/chef-images/ directory.
 *
 * Usage:
 *   pnpm tsx scripts/add-chef-images.ts
 */

import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

interface ChefImageMapping {
  slug: string;
  imageUrl: string;
  source?: string;
  license?: string;
}

/**
 * Chef image mappings
 *
 * Add chef profile images here. Images should be:
 * - Square (1:1 aspect ratio)
 * - Minimum 200x200px, ideal 400x400px
 * - PNG or WebP format
 * - Located in /public/chef-images/
 *
 * For publicly available images:
 * - Always verify usage rights and licenses
 * - Include source and license information
 * - Prefer Creative Commons or explicitly public domain images
 */
const CHEF_IMAGES: ChefImageMapping[] = [
  {
    slug: 'kenji-lopez-alt',
    imageUrl: '/chef-images/kenji-lopez-alt.png',
    source: 'Serious Eats / Public profile photo',
    license: 'Fair use - publicly available profile photo'
  },
  // Add more chefs here as images become available
  // {
  //   slug: 'chef-slug',
  //   imageUrl: '/chef-images/chef-slug.png',
  //   source: 'URL or source',
  //   license: 'License type'
  // }
];

async function addChefImages() {
  console.log('📸 Adding chef profile images...\n');

  const publicDir = path.join(process.cwd(), 'public');
  const chefImagesDir = path.join(publicDir, 'chef-images');

  // Create chef-images directory if it doesn't exist
  if (!fs.existsSync(chefImagesDir)) {
    fs.mkdirSync(chefImagesDir, { recursive: true });
    console.log('📁 Created /public/chef-images/ directory\n');
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const mapping of CHEF_IMAGES) {
    console.log(`\nProcessing: ${mapping.slug}`);
    console.log('─'.repeat(50));

    try {
      // Check if chef exists
      const [chef] = await db
        .select()
        .from(chefs)
        .where(eq(chefs.slug, mapping.slug))
        .limit(1);

      if (!chef) {
        console.log(`⚠️  Chef not found: ${mapping.slug}`);
        failed++;
        continue;
      }

      // Check if image file exists
      const imagePath = path.join(publicDir, mapping.imageUrl.replace(/^\//, ''));
      if (!fs.existsSync(imagePath)) {
        console.log(`⚠️  Image file not found: ${mapping.imageUrl}`);
        console.log(`   Expected at: ${imagePath}`);
        console.log(`   Please add the image file and re-run this script.`);
        failed++;
        continue;
      }

      // Check if chef already has this image
      if (chef.profile_image_url === mapping.imageUrl) {
        console.log(`✓  Image already set: ${mapping.imageUrl}`);
        skipped++;
        continue;
      }

      // Update chef with image URL
      await db
        .update(chefs)
        .set({
          profile_image_url: mapping.imageUrl,
          updated_at: new Date()
        })
        .where(eq(chefs.slug, mapping.slug));

      console.log(`✅ Updated: ${chef.display_name || chef.name}`);
      console.log(`   Image: ${mapping.imageUrl}`);
      if (mapping.source) {
        console.log(`   Source: ${mapping.source}`);
      }
      if (mapping.license) {
        console.log(`   License: ${mapping.license}`);
      }
      updated++;

    } catch (error) {
      console.error(`❌ Error updating ${mapping.slug}:`, error);
      failed++;
    }
  }

  console.log('\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('Summary:');
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Total:   ${CHEF_IMAGES.length}`);
  console.log('═══════════════════════════════════════════════════\n');

  if (failed > 0) {
    console.log('⚠️  Some updates failed. See errors above for details.\n');
  }

  if (updated > 0) {
    console.log('✅ Chef profiles updated successfully!');
    console.log('🌐 View chefs at: http://localhost:3004/discover/chefs\n');
  }
}

// Run the script
addChefImages()
  .then(() => {
    console.log('✅ Script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
