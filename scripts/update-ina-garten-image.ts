#!/usr/bin/env tsx

/**
 * Update Ina Garten's Chef Profile Image
 *
 * Updates Ina Garten's profile with the new image located at:
 * /public/chefs/avatars/ina-garten.png
 *
 * Usage:
 *   pnpm tsx scripts/update-ina-garten-image.ts
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';

async function updateInaGartenImage() {
  console.log('📸 Updating Ina Garten\'s profile image...\n');

  const inaGartenSlug = 'ina-garten';
  const imageUrl = '/chefs/avatars/ina-garten.png';

  try {
    // Find Ina Garten's chef record
    const [chef] = await db
      .select()
      .from(chefs)
      .where(eq(chefs.slug, inaGartenSlug))
      .limit(1);

    if (!chef) {
      console.log(`❌ Chef not found with slug: ${inaGartenSlug}`);
      console.log('Available slugs to try:');
      const allChefs = await db.select({ slug: chefs.slug, name: chefs.name }).from(chefs);
      allChefs.forEach((c) => console.log(`  - ${c.slug} (${c.name})`));
      process.exit(1);
    }

    console.log(`Found chef: ${chef.display_name || chef.name}`);
    console.log(`Current image: ${chef.profile_image_url || '(none)'}`);
    console.log(`New image: ${imageUrl}\n`);

    // Update the profile image
    await db
      .update(chefs)
      .set({
        profile_image_url: imageUrl,
        updated_at: new Date(),
      })
      .where(eq(chefs.slug, inaGartenSlug));

    console.log('✅ Successfully updated Ina Garten\'s profile image!');
    console.log(`\n🌐 View profile at: http://localhost:3002/discover/chefs/${inaGartenSlug}`);
  } catch (error) {
    console.error('❌ Error updating chef profile:', error);
    process.exit(1);
  }
}

// Run the script
updateInaGartenImage()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
