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

async function verifyFinalState() {
  console.log('='.repeat(80));
  console.log('FINAL STATE VERIFICATION - Recipe Image URLs');
  console.log('='.repeat(80));
  console.log('');

  const sql = neon(DATABASE_URL);

  try {
    // Overall statistics
    console.log('1. Overall Statistics');
    console.log('-'.repeat(80));

    const overallStats = await sql`
      SELECT
        COUNT(*) as total_recipes,
        COUNT(image_url) as recipes_with_image_url,
        COUNT(*) FILTER (WHERE image_url IS NOT NULL) as non_null_count,
        COUNT(*) FILTER (WHERE image_url IS NULL) as null_count,
        ROUND(100.0 * COUNT(image_url) / COUNT(*), 2) as percentage_populated
      FROM recipes
    `;

    console.table(overallStats);
    console.log('');

    // Breakdown by source
    console.log('2. Image URL Sources Breakdown');
    console.log('-'.repeat(80));

    const sourceBreakdown = await sql`
      SELECT
        source,
        COUNT(*) as count,
        ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM recipes), 2) as percentage_of_total
      FROM (
        SELECT
          CASE
            WHEN image_url LIKE 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com%' THEN 'Vercel Blob Storage'
            WHEN image_url LIKE 'https://food.fnr.sndimg.com%' THEN 'Food Network'
            WHEN image_url LIKE '/ai-recipe-images/%' THEN 'AI Generated Images'
            WHEN image_url LIKE '/recipes/%' THEN 'Static Recipe Images'
            WHEN image_url LIKE '/images/recipes/%' THEN 'Legacy Recipe Images'
            WHEN image_url LIKE 'https://%' THEN 'External URLs (Other)'
            WHEN image_url IS NULL THEN 'No Image URL'
            ELSE 'Other Format'
          END AS source
        FROM recipes
      ) AS categorized
      GROUP BY source
      ORDER BY count DESC
    `;

    console.table(sourceBreakdown);
    console.log('');

    // Quality check: consistency between image_url and images
    console.log('3. Data Consistency Check');
    console.log('-'.repeat(80));

    const consistencyCheck = await sql`
      SELECT
        consistency_status,
        COUNT(*) as count,
        ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM recipes), 2) as percentage
      FROM (
        SELECT
          CASE
            WHEN image_url IS NOT NULL AND images IS NOT NULL AND images != '[]' THEN 'Consistent (both populated)'
            WHEN image_url IS NULL AND (images IS NULL OR images = '[]') THEN 'Consistent (both empty)'
            WHEN image_url IS NOT NULL AND (images IS NULL OR images = '[]') THEN 'Inconsistent (URL without images array)'
            WHEN image_url IS NULL AND images IS NOT NULL AND images != '[]' THEN 'Inconsistent (images array without URL)'
            ELSE 'Unknown'
          END AS consistency_status
        FROM recipes
      ) AS categorized
      GROUP BY consistency_status
      ORDER BY count DESC
    `;

    console.table(consistencyCheck);
    console.log('');

    // Sample of records with different patterns
    console.log('4. Sample Records from Each Category');
    console.log('-'.repeat(80));

    // Vercel Blob Storage
    const vercelSample = await sql`
      SELECT id, name, image_url
      FROM recipes
      WHERE image_url LIKE 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com%'
      LIMIT 3
    `;

    console.log('Vercel Blob Storage (3 samples):');
    console.table(
      vercelSample.map((r) => ({
        id: r.id.substring(0, 8),
        name: r.name?.substring(0, 40),
        image_url: r.image_url?.substring(0, 60),
      }))
    );
    console.log('');

    // AI Generated
    const aiSample = await sql`
      SELECT id, name, image_url
      FROM recipes
      WHERE image_url LIKE '/ai-recipe-images/%'
      LIMIT 3
    `;

    console.log('AI Generated Images (3 samples):');
    console.table(
      aiSample.map((r) => ({
        id: r.id.substring(0, 8),
        name: r.name?.substring(0, 40),
        image_url: r.image_url,
      }))
    );
    console.log('');

    // No images
    const noImagesSample = await sql`
      SELECT id, name, images
      FROM recipes
      WHERE image_url IS NULL AND images IS NULL
      LIMIT 3
    `;

    console.log('No Images (3 samples):');
    console.table(
      noImagesSample.map((r) => ({
        id: r.id.substring(0, 8),
        name: r.name?.substring(0, 40),
        images: String(r.images),
      }))
    );
    console.log('');

    console.log('='.repeat(80));
    console.log('✓ VERIFICATION COMPLETE');
    console.log('='.repeat(80));
    console.log('');
    console.log('Key Findings:');
    console.log(`  - ${overallStats[0].percentage_populated}% of recipes have image URLs`);
    console.log(
      `  - ${sourceBreakdown.find((s) => s.source === 'Vercel Blob Storage')?.count || 0} recipes use Vercel Blob Storage`
    );
    console.log(
      `  - ${sourceBreakdown.find((s) => s.source === 'AI Generated Images')?.count || 0} recipes use AI-generated images`
    );
    console.log(
      `  - ${sourceBreakdown.find((s) => s.source === 'No Image URL')?.count || 0} recipes have no images`
    );
    console.log('');
  } catch (error) {
    console.error('ERROR during verification:', error);
    throw error;
  }
}

verifyFinalState()
  .then(() => {
    console.log('Verification script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Verification script failed:', error);
    process.exit(1);
  });
