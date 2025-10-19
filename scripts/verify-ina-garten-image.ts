#!/usr/bin/env tsx

/**
 * Verify Ina Garten's Chef Profile Image
 *
 * Checks that Ina Garten's profile image has been updated correctly.
 *
 * Usage:
 *   pnpm tsx scripts/verify-ina-garten-image.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';

async function verifyInaGartenImage() {
  console.log('🔍 Verifying Ina Garten\'s profile image...\n');

  const inaGartenSlug = 'ina-garten';
  const expectedImageUrl = '/chefs/avatars/ina-garten.png';
  const imagePath = path.join(process.cwd(), 'public', 'chefs', 'avatars', 'ina-garten.png');

  try {
    // Check database record
    const [chef] = await db
      .select()
      .from(chefs)
      .where(eq(chefs.slug, inaGartenSlug))
      .limit(1);

    if (!chef) {
      console.log('❌ Chef record not found in database');
      return false;
    }

    console.log('✅ Database Record:');
    console.log(`   Name: ${chef.display_name || chef.name}`);
    console.log(`   Slug: ${chef.slug}`);
    console.log(`   Profile Image: ${chef.profile_image_url}`);
    console.log(`   Last Updated: ${chef.updated_at}\n`);

    // Check if image path matches expected
    if (chef.profile_image_url === expectedImageUrl) {
      console.log('✅ Database image URL matches expected value');
    } else {
      console.log('❌ Database image URL does not match');
      console.log(`   Expected: ${expectedImageUrl}`);
      console.log(`   Actual: ${chef.profile_image_url}`);
      return false;
    }

    // Check if image file exists
    if (fs.existsSync(imagePath)) {
      const stats = fs.statSync(imagePath);
      console.log('✅ Image file exists on filesystem');
      console.log(`   Path: ${imagePath}`);
      console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`   Modified: ${stats.mtime}\n`);
    } else {
      console.log('❌ Image file not found on filesystem');
      console.log(`   Expected at: ${imagePath}`);
      return false;
    }

    console.log('═'.repeat(60));
    console.log('✅ All checks passed! Ina Garten\'s image is properly configured.');
    console.log(`🌐 View at: http://localhost:3002/discover/chefs/${inaGartenSlug}`);
    console.log('═'.repeat(60));

    return true;
  } catch (error) {
    console.error('❌ Error during verification:', error);
    return false;
  }
}

// Run the script
verifyInaGartenImage()
  .then((success) => {
    if (success) {
      console.log('\n✅ Verification completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Verification failed!');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Verification script failed:', error);
    process.exit(1);
  });
