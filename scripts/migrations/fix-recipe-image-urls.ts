import { drizzle } from 'drizzle-orm/neon-http';
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

async function fixRecipeImageUrls() {
  console.log('='.repeat(80));
  console.log('RECIPE IMAGE URL FIX MIGRATION');
  console.log('='.repeat(80));
  console.log('');
  console.log('This migration will populate null image_url fields from the images JSON array');
  console.log('');

  const sql = neon(DATABASE_URL);
  const db = drizzle(sql);

  try {
    // Step 1: Get BEFORE statistics
    console.log('STEP 1: BEFORE Statistics');
    console.log('-'.repeat(80));

    const beforeStats = await sql`
      SELECT
        COUNT(*) as total_recipes,
        COUNT(image_url) as recipes_with_image_url,
        COUNT(*) FILTER (WHERE image_url IS NOT NULL) as non_null_count,
        COUNT(*) FILTER (WHERE image_url IS NULL) as null_count,
        ROUND(100.0 * COUNT(image_url) / COUNT(*), 2) as percentage_populated
      FROM recipes
    `;

    console.log('Before Migration:');
    console.log(JSON.stringify(beforeStats[0], null, 2));
    console.log('');

    // Step 2: Preview what will be updated (dry run)
    console.log('STEP 2: Preview of Data to be Updated (First 10 records)');
    console.log('-'.repeat(80));

    const preview = await sql`
      SELECT
        id,
        name,
        image_url AS old_image_url,
        images::text AS images_raw,
        CASE
          WHEN images::text LIKE '["%' THEN
            TRIM(BOTH '"' FROM (images::text)::json->>0)
          ELSE
            NULL
        END AS new_image_url
      FROM recipes
      WHERE image_url IS NULL
        AND images IS NOT NULL
        AND images != '[]'
      LIMIT 10
    `;

    console.log('Sample records that will be updated:');
    console.table(preview);
    console.log('');

    // Step 3: Count how many records will be affected
    const countResult = await sql`
      SELECT COUNT(*) as affected_count
      FROM recipes
      WHERE image_url IS NULL
        AND images IS NOT NULL
        AND images != '[]'
    `;

    const affectedCount = countResult[0].affected_count;
    console.log(`Total records that will be updated: ${affectedCount}`);
    console.log('');

    // Step 4: Execute the UPDATE
    console.log('STEP 3: Executing UPDATE Statement');
    console.log('-'.repeat(80));

    const updateResult = await sql`
      UPDATE recipes
      SET image_url = CASE
        WHEN images::text LIKE '["%' THEN
          TRIM(BOTH '"' FROM (images::text)::json->>0)
        ELSE
          NULL
      END
      WHERE image_url IS NULL
        AND images IS NOT NULL
        AND images != '[]'
    `;

    console.log(`✓ UPDATE executed successfully`);
    console.log(`✓ Rows updated: ${updateResult.length > 0 ? updateResult.length : affectedCount}`);
    console.log('');

    // Step 5: Get AFTER statistics
    console.log('STEP 4: AFTER Statistics');
    console.log('-'.repeat(80));

    const afterStats = await sql`
      SELECT
        COUNT(*) as total_recipes,
        COUNT(image_url) as recipes_with_image_url,
        COUNT(*) FILTER (WHERE image_url IS NOT NULL) as non_null_count,
        COUNT(*) FILTER (WHERE image_url IS NULL) as null_count,
        ROUND(100.0 * COUNT(image_url) / COUNT(*), 2) as percentage_populated
      FROM recipes
    `;

    console.log('After Migration:');
    console.log(JSON.stringify(afterStats[0], null, 2));
    console.log('');

    // Step 6: Calculate improvement
    console.log('STEP 5: Migration Impact Summary');
    console.log('-'.repeat(80));

    const beforePercentage = Number.parseFloat(beforeStats[0].percentage_populated);
    const afterPercentage = Number.parseFloat(afterStats[0].percentage_populated);
    const improvement = afterPercentage - beforePercentage;

    console.log('Summary:');
    console.log(`  Before: ${beforePercentage}% of recipes had image_url populated`);
    console.log(`  After:  ${afterPercentage}% of recipes have image_url populated`);
    console.log(`  Improvement: +${improvement.toFixed(2)}% (${affectedCount} records updated)`);
    console.log('');

    // Step 7: Verify a sample of updated records
    console.log('STEP 6: Verification Sample (10 recently updated records)');
    console.log('-'.repeat(80));

    const verification = await sql`
      SELECT
        id,
        name,
        image_url,
        images
      FROM recipes
      WHERE image_url IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 10
    `;

    console.table(verification.map(r => ({
      id: r.id,
      name: r.name?.substring(0, 40) || 'N/A',
      image_url: r.image_url?.substring(0, 50) || 'N/A',
      has_images_array: r.images ? 'Yes' : 'No'
    })));
    console.log('');

    console.log('='.repeat(80));
    console.log('✓ MIGRATION COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('ERROR during migration:', error);
    throw error;
  }
}

// Execute the migration
fixRecipeImageUrls()
  .then(() => {
    console.log('Migration script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
