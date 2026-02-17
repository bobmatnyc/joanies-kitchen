import * as path from 'node:path';
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;

async function checkDb() {
  console.log('Checking slideshow_photos table...\n');

  const sql = neon(DATABASE_URL!);

  try {
    const photos = await sql`
      SELECT id, image_url, display_order, is_active, created_at
      FROM slideshow_photos
      ORDER BY display_order;
    `;

    console.log(`Found ${photos.length} photos in database:\n`);

    photos.forEach((photo: any) => {
      console.log(`[${photo.display_order}] ${photo.id}`);
      console.log(`    ${photo.image_url.substring(0, 80)}...`);
      console.log(`    Active: ${photo.is_active}\n`);
    });
  } catch (error) {
    console.error('Database check failed:', error);
    process.exit(1);
  }
}

checkDb();
