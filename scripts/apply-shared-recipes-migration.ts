#!/usr/bin/env tsx

import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Load environment variables
config({ path: '.env.local' });

async function applyMigration() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  console.log('🔄 Connecting to database...');
  const client = postgres(connectionString);
  const db = drizzle(client);

  try {
    console.log('🔄 Adding isSystemRecipe column to recipes table...');

    // Check if column already exists
    const columnCheck = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'recipes'
      AND column_name = 'is_system_recipe'
    `);

    if (columnCheck.length > 0) {
      console.log('✅ Column is_system_recipe already exists');
    } else {
      // Add the new column
      await db.execute(sql`
        ALTER TABLE recipes
        ADD COLUMN is_system_recipe BOOLEAN DEFAULT false
      `);
      console.log('✅ Successfully added is_system_recipe column');
    }

    console.log('🎉 Migration completed successfully!');

    // Optional: Mark a sample recipe as a system recipe for testing
    console.log('\n📝 You can now mark recipes as system recipes using:');
    console.log('   - The markAsSystemRecipe server action');
    console.log('   - Direct database updates');
    console.log('\nExample SQL to mark a recipe as system recipe:');
    console.log(
      'UPDATE recipes SET is_system_recipe = true, is_public = true WHERE id = <recipe_id>;'
    );
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('👋 Database connection closed');
  }
}

// Run the migration
applyMigration().catch(console.error);
