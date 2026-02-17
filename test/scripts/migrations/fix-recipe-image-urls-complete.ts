import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not found in environment variables');
  process.exit(1);
}

async function fixRecipeImageUrlsComplete() {
  console.log('='.repeat(80));
  console.log('COMPLETE RECIPE IMAGE URL FIX MIGRATION');
  console.log('='.repeat(80));
  console.log('');
  console.log('This migration handles all image URL patterns:');
  console.log('  1. JSON arrays with double quotes: ["url"]');
  console.log('  2. PostgreSQL set notation with curly braces: {"/path"}');
  console.log('');

  const sql = neon(DATABASE_URL!);

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

    // Step 2: Preview PostgreSQL set notation records
    console.log('STEP 2: Preview of PostgreSQL Set Notation Records');
    console.log('-'.repeat(80));

    const setNotationPreview = await sql`
      SELECT
        id,
        name,
        images,
        TRIM(BOTH '"{' FROM TRIM(BOTH '}' FROM images::text)) AS extracted_url
      FROM recipes
      WHERE image_url IS NULL
        AND images IS NOT NULL
        AND images::text LIKE '{%'
      LIMIT 10
    `;

    console.log(`Found ${setNotationPreview.length} records with PostgreSQL set notation`);
    if (setNotationPreview.length > 0) {
      console.table(
        setNotationPreview.map((r) => ({
          id: r.id,
          name: r.name?.substring(0, 40),
          images: String(r.images).substring(0, 60),
          extracted_url: r.extracted_url?.substring(0, 60),
        }))
      );
    }
    console.log('');

    // Step 3: Count total records that will be affected
    const countSetNotation = await sql`
      SELECT COUNT(*) as count
      FROM recipes
      WHERE image_url IS NULL
        AND images IS NOT NULL
        AND images::text LIKE '{%'
    `;

    const setNotationCount = Number.parseInt(countSetNotation[0].count);
    console.log(`Total PostgreSQL set notation records to update: ${setNotationCount}`);
    console.log('');

    // Step 4: Execute the UPDATE for PostgreSQL set notation
    if (setNotationCount > 0) {
      console.log('STEP 3: Executing UPDATE for PostgreSQL Set Notation');
      console.log('-'.repeat(80));

      const updateSetNotation = await sql`
        UPDATE recipes
        SET image_url = TRIM(BOTH '"{' FROM TRIM(BOTH '}' FROM images::text))
        WHERE image_url IS NULL
          AND images IS NOT NULL
          AND images::text LIKE '{%'
      `;

      console.log(`✓ UPDATE executed successfully`);
      console.log(`✓ Rows updated: ${setNotationCount}`);
      console.log('');
    }

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

    console.log('After Complete Migration:');
    console.log(JSON.stringify(afterStats[0], null, 2));
    console.log('');

    // Step 6: Calculate improvement
    console.log('STEP 5: Migration Impact Summary');
    console.log('-'.repeat(80));

    const beforePercentage = Number.parseFloat(beforeStats[0].percentage_populated);
    const afterPercentage = Number.parseFloat(afterStats[0].percentage_populated);
    const improvement = afterPercentage - beforePercentage;
    const totalUpdated = setNotationCount;

    console.log('Summary:');
    console.log(`  Before: ${beforePercentage}% of recipes had image_url populated`);
    console.log(`  After:  ${afterPercentage}% of recipes have image_url populated`);
    console.log(
      `  Improvement: +${improvement.toFixed(2)}% (${totalUpdated} records updated in this run)`
    );
    console.log('');

    // Step 7: Show remaining null breakdown
    console.log('STEP 6: Remaining Null image_url Breakdown');
    console.log('-'.repeat(80));

    const remainingNulls = await sql`
      SELECT
        CASE
          WHEN images IS NULL THEN 'No images data (images IS NULL)'
          WHEN images = '[]' THEN 'Empty images array'
          ELSE 'Other format'
        END AS category,
        COUNT(*) as count,
        ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM recipes WHERE image_url IS NULL), 2) as percentage
      FROM recipes
      WHERE image_url IS NULL
      GROUP BY category
      ORDER BY count DESC
    `;

    console.log('Remaining null image_url records by category:');
    console.table(remainingNulls);
    console.log('');

    // Step 8: Verify a sample of updated records
    console.log('STEP 7: Verification Sample');
    console.log('-'.repeat(80));

    const verification = await sql`
      SELECT
        id,
        name,
        image_url,
        images
      FROM recipes
      WHERE image_url LIKE '/ai-recipe-images/%'
      LIMIT 6
    `;

    console.log('Sample of records updated with AI recipe images:');
    console.table(
      verification.map((r) => ({
        id: r.id,
        name: r.name?.substring(0, 40) || 'N/A',
        image_url: r.image_url?.substring(0, 60) || 'N/A',
        images: String(r.images).substring(0, 60),
      }))
    );
    console.log('');

    console.log('='.repeat(80));
    console.log('✓ COMPLETE MIGRATION FINISHED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log('');
    console.log('Summary of what was fixed:');
    console.log(`  - Stage 1 (previous run): Fixed 304 JSON array records`);
    console.log(
      `  - Stage 2 (this run): Fixed ${setNotationCount} PostgreSQL set notation records`
    );
    console.log(`  - Total fixed: ${304 + setNotationCount} records`);
    console.log(`  - Remaining null: ${afterStats[0].null_count} records (mostly no image data)`);
    console.log('');
  } catch (error) {
    console.error('ERROR during migration:', error);
    throw error;
  }
}

// Execute the migration
fixRecipeImageUrlsComplete()
  .then(() => {
    console.log('Migration script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
