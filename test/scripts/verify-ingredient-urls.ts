#!/usr/bin/env tsx

/**
 * Verify Ingredient Image URL Updates
 *
 * Quick verification script to check that ingredient image URLs
 * were successfully updated to Vercel Blob Storage URLs.
 */

import { db } from '@/lib/db';
import { ingredients } from '@/lib/db/ingredients-schema';
import { sql } from 'drizzle-orm';

async function verifyUpdates() {
  console.log('🔍 Verifying Ingredient Image URL Updates\n');

  try {
    // Count total ingredients
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(ingredients);

    console.log(`📊 Total ingredients in database: ${totalCount[0].count}\n`);

    // Count ingredients with Blob URLs
    const blobCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(ingredients)
      .where(sql`${ingredients.image_url} LIKE '%blob.vercel-storage.com%'`);

    console.log(`✅ Ingredients with Blob URLs: ${blobCount[0].count}`);

    // Count ingredients with old URLs
    const oldUrlCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(ingredients)
      .where(sql`${ingredients.image_url} LIKE '/images/%' OR ${ingredients.image_url} LIKE 'public/images/%'`);

    console.log(`📁 Ingredients with old local URLs: ${oldUrlCount[0].count}`);

    // Count ingredients with no image
    const noImageCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(ingredients)
      .where(sql`${ingredients.image_url} IS NULL`);

    console.log(`❌ Ingredients with no image: ${noImageCount[0].count}\n`);

    // Show sample of updated ingredients
    console.log('📋 Sample of updated ingredients:\n');
    const samples = await db
      .select({
        name: ingredients.display_name,
        url: ingredients.image_url
      })
      .from(ingredients)
      .where(sql`${ingredients.image_url} LIKE '%blob.vercel-storage.com%'`)
      .limit(10);

    samples.forEach((sample, idx) => {
      console.log(`${idx + 1}. ${sample.name}`);
      console.log(`   ${sample.url}\n`);
    });

    // Calculate success rate
    const totalWithImages = Number(totalCount[0].count) - Number(noImageCount[0].count);
    const successRate = totalWithImages > 0
      ? ((Number(blobCount[0].count) / totalWithImages) * 100).toFixed(1)
      : 0;

    console.log('='.repeat(60));
    console.log(`✨ Migration Success Rate: ${successRate}%`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

verifyUpdates();
