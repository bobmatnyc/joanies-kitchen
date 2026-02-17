import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { list } from '@vercel/blob';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;

async function populateDb() {
  console.log('Populating slideshow_photos table...\n');

  if (!process.env.BLOB_READ_WRITE_TOKEN || !DATABASE_URL) {
    console.error('Error: Missing environment variables');
    process.exit(1);
  }

  try {
    // Get all slideshow images from Vercel Blob
    const blobs = await list({ prefix: 'slideshow/' });
    console.log(`Found ${blobs.blobs.length} images in Vercel Blob\n`);

    const sql = neon(DATABASE_URL!);

    // Clear existing records (optional - for clean start)
    await sql`DELETE FROM slideshow_photos`;
    console.log('Cleared existing records\n');

    // Insert each image
    let inserted = 0;
    for (const blob of blobs.blobs) {
      const displayOrder = parseInt(blob.pathname.split('/')[1].split('-')[0], 10);
      const id = randomUUID();

      await sql`
        INSERT INTO slideshow_photos (id, image_url, display_order, is_active)
        VALUES (${id}, ${blob.url}, ${displayOrder}, true)
      `;

      console.log(`[${displayOrder}] Inserted: ${blob.pathname}`);
      inserted++;
    }

    console.log(`\nInserted ${inserted} photos successfully!`);

    // Verify
    const count = await sql`SELECT COUNT(*) as count FROM slideshow_photos`;
    console.log(`Database now has ${count[0].count} photos\n`);
  } catch (error) {
    console.error('Population failed:', error);
    process.exit(1);
  }
}

populateDb();
