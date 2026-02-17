#!/usr/bin/env tsx

/**
 * Fix Chef Image URLs - Migrate from local paths to Vercel Blob Storage
 *
 * This script updates chef profile_image_url values from local paths
 * (/images/chefs/*.jpg) to Vercel Blob URLs (https://...blob.vercel-storage.com/chefs/*.jpg)
 *
 * The images were previously uploaded to Vercel Blob but the database still
 * references the old local paths which no longer exist after git history cleanup.
 *
 * Run with:
 *   pnpm tsx scripts/fix-chef-image-urls.ts              # Dry run (preview only)
 *   APPLY_CHANGES=true pnpm tsx scripts/fix-chef-image-urls.ts  # Live mode
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Mapping of chef slugs to Blob URLs (from vercel blob list)
const CHEF_IMAGE_MAPPINGS: Record<string, string> = {
  'alice-waters': 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/chefs/alice-waters.jpg',
  'anne-marie-bonneau':
    'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/chefs/anne-marie-bonneau.jpg',
  'bren-smith': 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/chefs/bren-smith.jpg',
  'bryant-terry': 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/chefs/bryant-terry.jpg',
  'cristina-scarpaleggia':
    'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/chefs/cristina-scarpaleggia.jpg',
  'dan-barber': 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/chefs/dan-barber.jpg',
  'david-zilber': 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/chefs/david-zilber.jpg',
  'jeremy-fox': 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/chefs/jeremy-fox.jpg',
  'joshua-mcfadden':
    'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/chefs/joshua-mcfadden.jpg',
  'katrina-blair': 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/chefs/katrina-blair.jpg',
  'kirsten-christopher-shockey':
    'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/chefs/kirsten-christopher-shockey.jpg',
  'massimo-bottura':
    'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/chefs/massimo-bottura.jpg',
  'molly-katzen': 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/chefs/molly-katzen.jpg',
  'nik-sharma': 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/chefs/nik-sharma.jpg',
  'rene-redzepi': 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/chefs/rene-redzepi.jpg',
  'shannon-martinez':
    'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/chefs/shannon-martinez.jpg',
  'skye-gyngell': 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/chefs/skye-gyngell.jpg',
  'tamar-adler': 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/chefs/tamar-adler.jpg',
  'vivian-li': 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/chefs/vivian-li.jpg',
};

interface ChefImageUpdate {
  id: string;
  slug: string;
  displayName: string;
  currentUrl: string;
  newUrl: string;
}

async function main() {
  const dryRun = process.env.APPLY_CHANGES !== 'true';

  console.log('\n' + '='.repeat(70));
  console.log('🖼️  FIX CHEF IMAGE URLS - MIGRATE TO VERCEL BLOB');
  console.log('='.repeat(70) + '\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
    console.log('   Set APPLY_CHANGES=true to execute\n');
  } else {
    console.log('🚀 LIVE MODE - Database will be updated\n');
  }

  // Get all chefs with local image paths
  const chefsWithLocalPaths = await sql`
    SELECT
      id,
      slug,
      display_name,
      profile_image_url
    FROM chefs
    WHERE profile_image_url LIKE '/images/chefs/%'
    ORDER BY slug
  `;

  console.log(`📊 Found ${chefsWithLocalPaths.length} chefs with local image paths\n`);

  if (chefsWithLocalPaths.length === 0) {
    console.log('✅ No chefs need image URL updates!\n');
    process.exit(0);
  }

  // Prepare updates
  const updates: ChefImageUpdate[] = [];
  const notFound: Array<{ slug: string; displayName: string }> = [];

  for (const chef of chefsWithLocalPaths) {
    const slug = chef.slug as string;
    const newUrl = CHEF_IMAGE_MAPPINGS[slug];

    if (newUrl) {
      updates.push({
        id: chef.id as string,
        slug,
        displayName: chef.display_name as string,
        currentUrl: chef.profile_image_url as string,
        newUrl,
      });
    } else {
      notFound.push({
        slug,
        displayName: chef.display_name as string,
      });
    }
  }

  console.log('📝 Update Summary:');
  console.log(`   Will update: ${updates.length} chefs`);
  console.log(`   Not in Blob: ${notFound.length} chefs\n`);

  if (notFound.length > 0) {
    console.log('⚠️  Chefs without Blob URLs (will be skipped):');
    notFound.forEach((chef) => {
      console.log(`   - ${chef.displayName} (${chef.slug})`);
    });
    console.log('');
  }

  if (updates.length === 0) {
    console.log('✅ Nothing to update!\n');
    process.exit(0);
  }

  console.log('📋 Planned Updates:\n');
  updates.forEach((update, i) => {
    console.log(`${i + 1}. ${update.displayName} (${update.slug})`);
    console.log(`   FROM: ${update.currentUrl}`);
    console.log(`   TO:   ${update.newUrl}`);
    console.log('');
  });

  if (dryRun) {
    console.log('🔍 DRY RUN - No changes made');
    console.log('   Run with APPLY_CHANGES=true to apply these updates\n');
    process.exit(0);
  }

  // Apply updates
  console.log('🔄 Applying updates...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const update of updates) {
    try {
      await sql`
        UPDATE chefs
        SET
          profile_image_url = ${update.newUrl},
          updated_at = NOW()
        WHERE id = ${update.id}
      `;

      console.log(`✅ Updated: ${update.displayName}`);
      successCount++;
    } catch (error: any) {
      console.error(`❌ Failed to update ${update.displayName}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✨ UPDATE COMPLETE');
  console.log('='.repeat(70) + '\n');
  console.log(`📊 Results:`);
  console.log(`   ✅ Successfully updated: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log(`   ⏭️  Skipped (no Blob URL): ${notFound.length}\n`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
