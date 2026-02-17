import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const { Pool } = pg;

async function verifySchema() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  try {
    console.log('Fetching recipes table schema...\n');

    // Get all columns for recipes table
    const columns = await db.execute(sql`
      SELECT
        column_name,
        data_type,
        column_default,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'recipes'
      ORDER BY ordinal_position
    `);

    console.log('Recipes table columns:');
    console.log('='.repeat(80));
    for (const col of columns.rows) {
      console.log(`${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${col.column_default || 'NULL'}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('\nTesting query with is_public column...');

    // Try to query recipes with is_public filter
    const testQuery = await db.execute(sql`
      SELECT id, name, is_public
      FROM recipes
      WHERE deleted_at IS NULL
      AND is_public = false
      LIMIT 5
    `);

    console.log(`✓ Query successful! Found ${testQuery.rows.length} non-public recipes`);
    if (testQuery.rows.length > 0) {
      console.log('\nSample results:');
      testQuery.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. ${row.name} (is_public: ${row.is_public})`);
      });
    }

    // Get count of public vs non-public recipes
    const counts = await db.execute(sql`
      SELECT
        is_public,
        COUNT(*) as count
      FROM recipes
      WHERE deleted_at IS NULL
      GROUP BY is_public
    `);

    console.log('\nRecipe visibility breakdown:');
    for (const row of counts.rows) {
      console.log(`  ${row.is_public ? 'Public' : 'Private'}: ${row.count} recipes`);
    }

  } catch (error) {
    console.error('Error verifying schema:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

verifySchema();
