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

async function investigateImagesFormat() {
  console.log('Investigating images column format...\n');

  const sql = neon(DATABASE_URL!);

  try {
    // Get a sample of records with non-null images
    const samples = await sql`
      SELECT
        id,
        name,
        image_url,
        images,
        pg_typeof(images) as images_type
      FROM recipes
      WHERE images IS NOT NULL
        AND images != '[]'
        AND image_url IS NULL
      LIMIT 5
    `;

    console.log('Sample records:');
    for (const record of samples) {
      console.log('\n' + '='.repeat(80));
      console.log(`ID: ${record.id}`);
      console.log(`Name: ${record.name}`);
      console.log(`Image URL: ${record.image_url}`);
      console.log(`Images Type: ${record.images_type}`);
      console.log(`Images Value: ${JSON.stringify(record.images)}`);
      console.log(`Images Raw: ${record.images}`);

      // Try to parse if it's a string
      if (typeof record.images === 'string') {
        try {
          const parsed = JSON.parse(record.images);
          console.log(`Parsed as JSON: ${JSON.stringify(parsed)}`);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log(`First element: ${parsed[0]}`);
          }
        } catch (e) {
          console.log('Could not parse as JSON');
        }
      }
    }
  } catch (error) {
    console.error('ERROR:', error);
    throw error;
  }
}

investigateImagesFormat()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
