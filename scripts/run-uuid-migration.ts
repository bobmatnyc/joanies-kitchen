import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

/**
 * Script to migrate recipe IDs from serial integers to UUIDs
 *
 * WARNING: This migration will:
 * 1. Convert all existing recipe IDs to UUIDs
 * 2. This is a one-way migration - backup your database first!
 */

async function runUUIDMigration() {
  console.log('🔄 Starting UUID migration for recipes table...\n');

  try {
    // Step 1: Add temporary UUID column
    console.log('1️⃣ Adding temporary UUID column...');
    await db.execute(sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS new_id TEXT`);

    // Step 2: Generate UUIDs for existing records
    console.log('2️⃣ Generating UUIDs for existing records...');
    await db.execute(sql`UPDATE recipes SET new_id = gen_random_uuid()::text WHERE new_id IS NULL`);

    // Step 3: Make new_id NOT NULL
    console.log('3️⃣ Making new_id column NOT NULL...');
    await db.execute(sql`ALTER TABLE recipes ALTER COLUMN new_id SET NOT NULL`);

    // Step 4: Drop primary key constraint on old id
    console.log('4️⃣ Dropping old primary key constraint...');
    await db.execute(sql`ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_pkey`);

    // Step 5: Drop the old id column
    console.log('5️⃣ Dropping old id column...');
    await db.execute(sql`ALTER TABLE recipes DROP COLUMN IF EXISTS id`);

    // Step 6: Rename new_id to id
    console.log('6️⃣ Renaming new_id to id...');
    await db.execute(sql`ALTER TABLE recipes RENAME COLUMN new_id TO id`);

    // Step 7: Add primary key constraint to new id
    console.log('7️⃣ Adding primary key constraint to new id column...');
    await db.execute(sql`ALTER TABLE recipes ADD PRIMARY KEY (id)`);

    console.log('\n✅ UUID migration completed successfully!');
    console.log('All recipe IDs have been converted from integers to UUIDs.');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\nPlease restore your database from backup and try again.');
    throw error;
  }
}

// Execute if run directly
if (require.main === module) {
  runUUIDMigration()
    .then(() => {
      console.log('\n✨ Migration complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration failed:', error);
      process.exit(1);
    });
}

export { runUUIDMigration };
