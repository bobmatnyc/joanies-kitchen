/**
 * Script to run the recipe rating migration
 */

import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('Starting recipe rating migration...');

  try {
    // Read the migration file
    const migrationPath = path.join(
      __dirname,
      '../src/lib/db/migrations/0007_add_recipe_ratings.sql'
    );
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Remove comments and split by semicolons
    const cleanedSQL = migrationSQL
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`Executing ${statements.length} SQL statements...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n[${i + 1}/${statements.length}] Executing...`);
      console.log(statement.substring(0, 100) + '...');

      try {
        await db.execute(sql.raw(statement));
        console.log('✓ Success');
      } catch (error: any) {
        // Ignore "already exists" errors
        if (
          error.message.includes('already exists') ||
          error.message.includes('duplicate')
        ) {
          console.log('⊘ Already exists (skipped)');
        } else {
          throw error;
        }
      }
    }

    console.log('\n✓ Migration completed successfully!');

    // Verify the changes
    console.log('\nVerifying schema changes...');

    // Check if columns exist
    const columnCheck = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'recipes'
        AND column_name IN ('system_rating', 'system_rating_reason', 'avg_user_rating', 'total_user_ratings')
      ORDER BY column_name;
    `);

    console.log('\nRecipes table new columns:');
    console.log(columnCheck.rows);

    // Check if recipe_ratings table exists
    const tableCheck = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'recipe_ratings';
    `);

    if (tableCheck.rows.length > 0) {
      console.log('\n✓ recipe_ratings table created successfully');

      // Check indexes
      const indexCheck = await db.execute(sql`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'recipe_ratings';
      `);

      console.log('\nIndexes on recipe_ratings table:');
      console.log(indexCheck.rows);
    } else {
      console.log('\n✗ recipe_ratings table NOT found');
    }

  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  }
}

runMigration()
  .then(() => {
    console.log('\nMigration script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
