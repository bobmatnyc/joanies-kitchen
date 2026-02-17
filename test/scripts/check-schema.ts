import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';

dotenv.config({ path: '.env.local' });

async function checkSchema() {
  const sql = neon(process.env.DATABASE_URL!);
  const _db = drizzle(sql);

  // Query column information
  const result = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'recipes'
    ORDER BY ordinal_position;
  `;

  console.log('\n=== Current recipes table columns ===\n');
  result.forEach((col) => {
    console.log(
      `${col.column_name} (${col.data_type}) - nullable: ${col.is_nullable}, default: ${col.column_default || 'none'}`
    );
  });

  // Check for required columns
  const columnNames = result.map((c) => c.column_name);
  const requiredColumns = ['user_id', 'is_public', 'is_system_recipe'];

  console.log('\n=== Required columns check ===\n');
  requiredColumns.forEach((col) => {
    const exists = columnNames.includes(col);
    console.log(`${col}: ${exists ? '✓ EXISTS' : '✗ MISSING'}`);
  });
}

checkSchema().catch(console.error);
