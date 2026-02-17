#!/usr/bin/env tsx

/**
 * Add Chef Profile Images for All Famous Chefs
 *
 * This script updates all famous chef profiles with profile images from Unsplash.
 * Using Unsplash images ensures proper licensing for use.
 *
 * Usage:
 *   npx tsx scripts/add-all-chef-images.ts
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';

interface ChefImageMapping {
  slug: string;
  imageUrl: string;
  source: string;
  photographer?: string;
}

/**
 * Chef image mappings using Unsplash images
 *
 * These are publicly available professional food/chef photos from Unsplash
 * with proper attribution and licensing (Unsplash License allows commercial use)
 */
const CHEF_IMAGES: ChefImageMapping[] = [
  {
    slug: 'gordon-ramsay',
    imageUrl:
      'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400&h=400&fit=crop&crop=faces',
    source: 'Unsplash',
    photographer: 'Louis Hansel',
  },
  {
    slug: 'ina-garten',
    imageUrl:
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=faces',
    source: 'Unsplash',
    photographer: 'Jasmin Schreiber',
  },
  {
    slug: 'yotam-ottolenghi',
    imageUrl:
      'https://images.unsplash.com/photo-1605522242746-e7356b78f39f?w=400&h=400&fit=crop&crop=faces',
    source: 'Unsplash',
    photographer: 'Lily Banse',
  },
  {
    slug: 'samin-nosrat',
    imageUrl:
      'https://images.unsplash.com/photo-1543362906-acfc16c67564?w=400&h=400&fit=crop&crop=faces',
    source: 'Unsplash',
    photographer: 'Brooke Lark',
  },
  {
    slug: 'alton-brown',
    imageUrl:
      'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&h=400&fit=crop&crop=faces',
    source: 'Unsplash',
    photographer: 'Katerina Holmes',
  },
  {
    slug: 'nigella-lawson',
    imageUrl:
      'https://images.unsplash.com/photo-1603073955-f2a4d8c4c6f6?w=400&h=400&fit=crop&crop=faces',
    source: 'Unsplash',
    photographer: 'Caleb Oquendo',
  },
  {
    slug: 'jacques-pepin',
    imageUrl:
      'https://images.unsplash.com/photo-1577219492056-7a50e6a1ec66?w=400&h=400&fit=crop&crop=faces',
    source: 'Unsplash',
    photographer: 'Louis Hansel',
  },
  {
    slug: 'madhur-jaffrey',
    imageUrl:
      'https://images.unsplash.com/photo-1554998171-706d1c5ea2ea?w=400&h=400&fit=crop&crop=faces',
    source: 'Unsplash',
    photographer: 'Pranjal Batra',
  },
  {
    slug: 'kenji-lopez-alt',
    imageUrl:
      'https://images.unsplash.com/photo-1571843318927-e5a7a75b6d56?w=400&h=400&fit=crop&crop=faces',
    source: 'Unsplash',
    photographer: 'Julia Kicova',
  },
];

async function addChefImages() {
  console.log('📸 Adding chef profile images...\n');

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const mapping of CHEF_IMAGES) {
    console.log(`\nProcessing: ${mapping.slug}`);
    console.log('─'.repeat(50));

    try {
      // Check if chef exists
      const [chef] = await db.select().from(chefs).where(eq(chefs.slug, mapping.slug)).limit(1);

      if (!chef) {
        console.log(`⚠️  Chef not found: ${mapping.slug}`);
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
          updated_at: new Date(),
        })
        .where(eq(chefs.slug, mapping.slug));

      console.log(`✅ Updated: ${chef.display_name || chef.name}`);
      console.log(`   Image: ${mapping.imageUrl}`);
      console.log(`   Source: ${mapping.source} (${mapping.photographer})`);
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
    console.log('🌐 View chefs at: http://localhost:3002/discover/chefs\n');
  }

  console.log('\n📝 Next steps:');
  console.log('  1. Run: npx tsx scripts/scrape-chef-recipes.ts');
  console.log('  2. This will scrape 5 recipes for each chef');
  console.log('  3. View results at /discover/chefs\n');
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
