import * as path from 'node:path';
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;

async function checkSchema() {
  console.log('Checking slideshow_photos table schema...\n');

  const sql = neon(DATABASE_URL!);

  try {
    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'slideshow_photos'
      ORDER BY ordinal_position;
    `;

    console.log('Columns in slideshow_photos:');
    columns.forEach((col: any) => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const def = col.column_default || 'none';
      console.log(`${col.column_name} (${col.data_type}) - ${nullable} - Default: ${def}`);
    });
  } catch (error) {
    console.error('Check failed:', error);
    process.exit(1);
  }
}

checkSchema();
