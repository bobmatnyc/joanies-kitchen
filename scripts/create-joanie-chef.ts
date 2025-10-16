#!/usr/bin/env tsx
/**
 * Create Joanie Chef Profile
 *
 * Creates a database entry for Joanie from Joanie's Kitchen.
 * This is the primary chef profile for the application.
 *
 * Usage:
 *   pnpm tsx scripts/create-joanie-chef.ts
 */

import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';
import { eq } from 'drizzle-orm';

async function createJoanieChef() {
  console.log('🍳 Creating Joanie chef profile...\n');

  const joanieData = {
    slug: 'joanie',
    name: 'Joanie',
    display_name: 'Joanie from Joanie\'s Kitchen',
    bio: 'Trained chef, lifelong gardener, and volunteer firefighter. Former bond trader turned culinary professional. Known for transforming "nothing in the fridge" into extraordinary meals. Specializes in seasonal cooking from her terraced garden overlooking the Hudson River.',
    profile_image_url: '/joanie-portrait.png',
    website: null,
    social_links: {
      instagram: 'https://www.instagram.com/terracesonward/'
    },
    specialties: ['seasonal', 'garden-to-table', 'improvisation'],
    is_verified: true,
    is_active: true,
    recipe_count: 0
  };

  try {
    // Check if Joanie already exists
    const existingJoanie = await db
      .select()
      .from(chefs)
      .where(eq(chefs.slug, 'joanie'))
      .limit(1);

    if (existingJoanie.length > 0) {
      console.log('✅ Joanie chef profile already exists!');
      console.log(`   ID: ${existingJoanie[0].id}`);
      console.log(`   Slug: ${existingJoanie[0].slug}`);
      console.log(`   Name: ${existingJoanie[0].display_name || existingJoanie[0].name}`);
      console.log(`   Profile Image: ${existingJoanie[0].profile_image_url || 'None'}`);
      console.log(`   Recipes: ${existingJoanie[0].recipe_count}`);
      console.log('\n💡 To update the profile, delete it first and re-run this script.');
      return;
    }

    // Create Joanie's profile
    const [newJoanie] = await db
      .insert(chefs)
      .values(joanieData)
      .returning();

    console.log('✅ Joanie chef profile created successfully!\n');
    console.log('Profile Details:');
    console.log('═══════════════════════════════════════════════════');
    console.log(`ID:              ${newJoanie.id}`);
    console.log(`Slug:            ${newJoanie.slug}`);
    console.log(`Name:            ${newJoanie.name}`);
    console.log(`Display Name:    ${newJoanie.display_name}`);
    console.log(`Bio:             ${newJoanie.bio?.substring(0, 60)}...`);
    console.log(`Profile Image:   ${newJoanie.profile_image_url}`);
    console.log(`Specialties:     ${newJoanie.specialties?.join(', ')}`);
    console.log(`Verified:        ${newJoanie.is_verified ? '✓' : '✗'}`);
    console.log(`Active:          ${newJoanie.is_active ? '✓' : '✗'}`);
    console.log(`Instagram:       ${(newJoanie.social_links as any)?.instagram || 'None'}`);
    console.log('═══════════════════════════════════════════════════\n');

    console.log('🌐 View profile at: http://localhost:3004/chef/joanie');
    console.log('📸 Profile image located at: /public/joanie-portrait.png\n');

  } catch (error) {
    console.error('❌ Error creating Joanie chef profile:', error);
    throw error;
  }
}

// Run the script
createJoanieChef()
  .then(() => {
    console.log('✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
