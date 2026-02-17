import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);

async function checkSchema() {
  console.log('Checking production schema for rating columns...\n');

  try {
    // Get column information
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'recipes'
        AND column_name IN ('system_rating', 'system_rating_reason', 'avg_user_rating', 'total_user_ratings')
      ORDER BY column_name;
    `;

    console.log('Rating columns found:');
    console.log(JSON.stringify(columns, null, 2));

    // Also check all columns
    const allColumns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'recipes'
      ORDER BY ordinal_position;
    `;

    console.log('\nAll columns in recipes table:');
    allColumns.forEach((col: any) => console.log(`  - ${col.column_name}`));
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSchema();
