#!/usr/bin/env tsx

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';

/**
 * Initialize J. Kenji López-Alt chef profile
 * Run with: pnpm tsx scripts/init-kenji-alt.ts
 */

async function initKenjiAlt() {
  console.log('🧑‍🍳 Initializing J. Kenji López-Alt chef profile...\n');

  try {
    // Check if already exists
    const existing = await db.query.chefs.findFirst({
      where: eq(chefs.slug, 'kenji-lopez-alt'),
    });

    if (existing) {
      console.log('⚠️  Kenji López-Alt profile already exists!');
      console.log('Chef ID:', existing.id);
      console.log('Slug:', existing.slug);
      console.log('Recipe Count:', existing.recipeCount);
      console.log('\nTo update, delete the existing profile first or use the admin interface.');
      return;
    }

    // Create chef profile
    const chef = await db
      .insert(chefs)
      .values({
        name: 'J. Kenji López-Alt',
        slug: 'kenji-lopez-alt',
        displayName: 'J. Kenji López-Alt',
        bio: `James Beard Award-winning author, chef, and food scientist. Managing Culinary Director at Serious Eats and author of "The Food Lab: Better Home Cooking Through Science." Known for his scientific approach to cooking, extensive recipe testing, and making complex techniques accessible to home cooks.`,
        website: 'https://www.seriouseats.com',
        socialLinks: {
          instagram: '@kenjilopezalt',
          youtube: '@JKenjiLopezAlt',
          twitter: '@kenjilopezalt',
        },
        specialties: ['asian', 'science', 'technique', 'american', 'testing'],
        isVerified: true,
        isActive: true,
        recipeCount: 0,
      })
      .returning();

    console.log('✅ Chef profile created successfully!\n');
    console.log('Details:');
    console.log('  ID:', chef[0].id);
    console.log('  Name:', chef[0].name);
    console.log('  Slug:', chef[0].slug);
    console.log('  Website:', chef[0].website);
    console.log('  Specialties:', chef[0].specialties?.join(', '));
    console.log('  Verified:', chef[0].isVerified);
    console.log('\n🎉 Kenji López-Alt is ready!');
    console.log('\nNext steps:');
    console.log('  1. Visit /chef/kenji-lopez-alt to view profile');
    console.log('  2. Use admin panel to start scraping recipes');
    console.log('  3. Or manually link existing recipes to this chef');

    return chef[0];
  } catch (error) {
    console.error('❌ Error creating chef profile:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  initKenjiAlt()
    .then(() => {
      console.log('\n✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Failed:', error);
      process.exit(1);
    });
}

export { initKenjiAlt };
