import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const { Pool } = pg;

async function applySchema() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  try {
    console.log('Checking if is_public column exists...');

    // Check if column exists
    const result = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'recipes'
      AND column_name = 'is_public'
    `);

    if (result.rows.length > 0) {
      console.log('✓ is_public column already exists');
    } else {
      console.log('Adding is_public column...');
      await db.execute(sql`
        ALTER TABLE "recipes"
        ADD COLUMN "is_public" boolean DEFAULT false
      `);
      console.log('✓ is_public column added successfully');
    }

    // Verify the column
    const verification = await db.execute(sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'recipes'
      AND column_name = 'is_public'
    `);

    console.log('\nColumn details:', verification.rows[0]);

    console.log('\n✓ Migration completed successfully');
  } catch (error) {
    console.error('Error applying schema:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

applySchema();
