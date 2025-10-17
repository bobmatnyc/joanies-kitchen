import { sql } from 'drizzle-orm';
import { db } from '../src/lib/db/index.js';

async function checkSchema() {
  try {
    console.log('Checking ingredients table schema...\n');

    const result = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'ingredients'
      ORDER BY ordinal_position;
    `);

    console.log('Current Ingredients Table Columns:');
    console.log('=====================================');
    result.rows.forEach((row: any) => {
      const name = String(row.column_name || '').padEnd(20);
      const type = String(row.data_type || '').padEnd(30);
      const nullable = row.is_nullable;
      const def = row.column_default || 'none';
      console.log(`${name} | ${type} | ${nullable} | ${def}`);
    });

    console.log('\n\nExpected Columns (from ingredients-schema.ts):');
    console.log('=====================================');
    console.log('id                   | uuid                           | NO  | gen_random_uuid()');
    console.log('name                 | text                           | NO  | none');
    console.log('display_name         | text                           | NO  | none');
    console.log('category             | character varying(50)          | NO  | none');
    console.log('common_units         | text                           | YES | none');
    console.log('aliases              | ARRAY                          | YES | none');
    console.log('is_common            | boolean                        | YES | false');
    console.log('is_allergen          | boolean                        | YES | false');
    console.log('typical_unit         | character varying(20)          | YES | none');
    console.log('created_at           | timestamp without time zone    | YES | now()');
    console.log('updated_at           | timestamp without time zone    | YES | now()');

    process.exit(0);
  } catch (error) {
    console.error('Error checking schema:', error);
    process.exit(1);
  }
}

checkSchema();
