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

async function analyzeRemainingNulls() {
  console.log('Analyzing remaining null image_url records...\n');

  const sql = neon(DATABASE_URL);

  try {
    // Get counts by images value pattern
    const patterns = await sql`
      SELECT
        CASE
          WHEN images IS NULL THEN 'images IS NULL'
          WHEN images = '[]' THEN 'images = []'
          WHEN images = '' THEN 'images = empty string'
          WHEN images::text LIKE '["%' THEN 'images = valid JSON array with URLs'
          WHEN images::text LIKE '[/' THEN 'images = JSON array with paths starting with /'
          ELSE 'images = other format'
        END AS pattern,
        COUNT(*) as count,
        ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM recipes WHERE image_url IS NULL), 2) as percentage
      FROM recipes
      WHERE image_url IS NULL
      GROUP BY pattern
      ORDER BY count DESC
    `;

    console.log('Breakdown of remaining null image_url records by images column pattern:');
    console.table(patterns);
    console.log('');

    // Sample records from each pattern
    const nullImages = await sql`
      SELECT id, name, images
      FROM recipes
      WHERE image_url IS NULL AND images IS NULL
      LIMIT 5
    `;

    console.log('Sample records with images IS NULL:');
    console.table(nullImages.map(r => ({
      id: r.id,
      name: r.name?.substring(0, 50),
      images: String(r.images)
    })));
    console.log('');

    const emptyArrays = await sql`
      SELECT id, name, images
      FROM recipes
      WHERE image_url IS NULL AND images = '[]'
      LIMIT 5
    `;

    console.log('Sample records with images = []:');
    console.table(emptyArrays.map(r => ({
      id: r.id,
      name: r.name?.substring(0, 50),
      images: String(r.images)
    })));
    console.log('');

    // Check for any other patterns we might have missed
    const otherPatterns = await sql`
      SELECT id, name, images, pg_typeof(images) as type
      FROM recipes
      WHERE image_url IS NULL
        AND images IS NOT NULL
        AND images != '[]'
        AND NOT (images::text LIKE '["%')
      LIMIT 10
    `;

    if (otherPatterns.length > 0) {
      console.log('Sample records with other/unexpected patterns:');
      console.table(otherPatterns.map(r => ({
        id: r.id,
        name: r.name?.substring(0, 50),
        type: r.type,
        images: String(r.images).substring(0, 100)
      })));
    } else {
      console.log('No unexpected patterns found.');
    }
    console.log('');

  } catch (error) {
    console.error('ERROR:', error);
    throw error;
  }
}

analyzeRemainingNulls()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
