import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

async function verifyTable() {
  console.log('Checking chefs table structure...\n');

  try {
    const result = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'chefs'
      ORDER BY ordinal_position;
    `);

    console.log('Columns in chefs table:');
    console.log('------------------------');
    for (const row of result.rows) {
      console.log(
        `${row.column_name} (${row.data_type}) ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`
      );
    }
  } catch (error) {
    console.error('Error checking table:', error);
  }
}

verifyTable().then(() => process.exit(0));
