import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not found in environment variables');
  process.exit(1);
}

const BLOB_STORAGE_BASE_URL =
  'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/tools';

async function fixToolImageUrls() {
  console.log('='.repeat(80));
  console.log('TOOL IMAGE URL FIX MIGRATION');
  console.log('='.repeat(80));
  console.log('');
  console.log('This migration updates tool image URLs from local paths to Vercel Blob Storage');
  console.log(`  Pattern: /images/tools/{filename} → ${BLOB_STORAGE_BASE_URL}/{filename}`);
  console.log('');

  const sql = neon(DATABASE_URL);

  try {
    // Step 1: Get BEFORE statistics
    console.log('STEP 1: BEFORE Statistics');
    console.log('-'.repeat(80));

    const beforeStats = await sql`
      SELECT
        COUNT(*) as total_tools,
        COUNT(*) FILTER (WHERE image_url LIKE '/images/tools/%') as local_path_count,
        COUNT(*) FILTER (WHERE image_url LIKE 'https://%') as blob_url_count,
        COUNT(*) FILTER (WHERE image_url IS NULL) as null_count
      FROM tools
    `;

    console.log('Before Migration:');
    console.log(JSON.stringify(beforeStats[0], null, 2));
    console.log('');

    // Step 2: Preview records to be updated
    console.log('STEP 2: Preview of Records to Update');
    console.log('-'.repeat(80));

    const previewRecords = await sql`
      SELECT
        id,
        name,
        display_name,
        image_url
      FROM tools
      WHERE image_url LIKE '/images/tools/%'
      ORDER BY name
      LIMIT 10
    `;

    console.log(`Found ${previewRecords.length} records with local image paths (showing first 10)`);
    if (previewRecords.length > 0) {
      console.table(
        previewRecords.map((r) => ({
          name: r.name,
          display_name: r.display_name,
          current_url: r.image_url,
        }))
      );
    }
    console.log('');

    // Step 3: Count total records that will be affected
    const countResult = await sql`
      SELECT COUNT(*) as count
      FROM tools
      WHERE image_url LIKE '/images/tools/%'
    `;

    const totalToUpdate = Number.parseInt(countResult[0].count);
    console.log(`Total records to update: ${totalToUpdate}`);
    console.log('');

    if (totalToUpdate === 0) {
      console.log('✓ No records need updating. Migration complete.');
      return;
    }

    // Step 4: Execute the UPDATE
    console.log('STEP 3: Executing UPDATE');
    console.log('-'.repeat(80));

    // Get all records to update for detailed logging
    const recordsToUpdate = await sql`
      SELECT id, name, display_name, image_url
      FROM tools
      WHERE image_url LIKE '/images/tools/%'
      ORDER BY name
    `;

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ name: string; error: string }> = [];

    for (const record of recordsToUpdate) {
      try {
        // Extract filename from local path: /images/tools/spice_grinder.png → spice_grinder.png
        const filename = record.image_url.replace('/images/tools/', '');
        const newUrl = `${BLOB_STORAGE_BASE_URL}/${filename}`;

        // Update the record
        await sql`
          UPDATE tools
          SET image_url = ${newUrl}
          WHERE id = ${record.id}
        `;

        console.log(
          `✓ Updated: ${record.name} | ${record.image_url} → ${newUrl.substring(0, 60)}...`
        );
        successCount++;
      } catch (error) {
        console.error(`✗ Failed to update: ${record.name} - ${error}`);
        errors.push({
          name: record.name,
          error: error instanceof Error ? error.message : String(error),
        });
        errorCount++;
      }
    }

    console.log('');
    console.log(`✓ Successfully updated: ${successCount} records`);
    if (errorCount > 0) {
      console.log(`✗ Failed to update: ${errorCount} records`);
      console.log('Errors:');
      console.table(errors);
    }
    console.log('');

    // Step 5: Get AFTER statistics
    console.log('STEP 4: AFTER Statistics');
    console.log('-'.repeat(80));

    const afterStats = await sql`
      SELECT
        COUNT(*) as total_tools,
        COUNT(*) FILTER (WHERE image_url LIKE '/images/tools/%') as local_path_count,
        COUNT(*) FILTER (WHERE image_url LIKE 'https://%') as blob_url_count,
        COUNT(*) FILTER (WHERE image_url IS NULL) as null_count
      FROM tools
    `;

    console.log('After Migration:');
    console.log(JSON.stringify(afterStats[0], null, 2));
    console.log('');

    // Step 6: Migration Impact Summary
    console.log('STEP 5: Migration Impact Summary');
    console.log('-'.repeat(80));

    const beforeLocalCount = Number.parseInt(beforeStats[0].local_path_count);
    const afterLocalCount = Number.parseInt(afterStats[0].local_path_count);
    const beforeBlobCount = Number.parseInt(beforeStats[0].blob_url_count);
    const afterBlobCount = Number.parseInt(afterStats[0].blob_url_count);

    console.log('Summary:');
    console.log(`  Before: ${beforeLocalCount} tools with local paths`);
    console.log(`  After:  ${afterLocalCount} tools with local paths`);
    console.log(`  Before: ${beforeBlobCount} tools with Blob Storage URLs`);
    console.log(`  After:  ${afterBlobCount} tools with Blob Storage URLs`);
    console.log(`  Records migrated: ${successCount}`);
    if (errorCount > 0) {
      console.log(`  Errors encountered: ${errorCount}`);
    }
    console.log('');

    // Step 7: Show sample of updated records
    console.log('STEP 6: Verification Sample');
    console.log('-'.repeat(80));

    const verification = await sql`
      SELECT
        id,
        name,
        display_name,
        image_url
      FROM tools
      WHERE image_url LIKE 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/tools/%'
      ORDER BY name
      LIMIT 10
    `;

    console.log('Sample of updated records with Blob Storage URLs:');
    console.table(
      verification.map((r) => ({
        name: r.name,
        display_name: r.display_name,
        image_url: r.image_url?.substring(0, 70) || 'N/A',
      }))
    );
    console.log('');

    console.log('='.repeat(80));
    console.log('✓ MIGRATION FINISHED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log('');
    console.log('Migration Results:');
    console.log(`  ✓ Total tools processed: ${successCount}`);
    console.log(
      `  ✓ All tool image URLs now point to Vercel Blob Storage: ${afterBlobCount}`
    );
    console.log(`  ✓ Remaining local paths: ${afterLocalCount}`);
    if (errorCount > 0) {
      console.log(`  ✗ Errors: ${errorCount} (see details above)`);
    }
    console.log('');
  } catch (error) {
    console.error('ERROR during migration:', error);
    throw error;
  }
}

// Execute the migration
fixToolImageUrls()
  .then(() => {
    console.log('Migration script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
