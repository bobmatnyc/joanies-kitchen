/**
 * Migration Script: Add Image Flagging and Regeneration Fields
 *
 * Adds columns to the recipes table to support admin-only image flagging
 * and AI regeneration capability.
 *
 * New columns:
 * - image_flagged_for_regeneration: boolean (default false)
 * - image_regeneration_requested_at: timestamp
 * - image_regeneration_requested_by: text (admin user ID)
 */

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

async function applyMigration() {
  console.log('Starting image flagging migration...');

  try {
    // Add columns to recipes table
    await db.execute(sql`
      ALTER TABLE recipes
      ADD COLUMN IF NOT EXISTS image_flagged_for_regeneration boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS image_regeneration_requested_at timestamp,
      ADD COLUMN IF NOT EXISTS image_regeneration_requested_by text;
    `);

    console.log('✓ Added image flagging columns to recipes table');

    // Create index for flagged images
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_recipes_flagged_images
      ON recipes(image_flagged_for_regeneration)
      WHERE image_flagged_for_regeneration = true;
    `);

    console.log('✓ Created index for flagged images');

    // Verify columns were added
    const result = await db.execute(sql`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'recipes'
      AND column_name IN (
        'image_flagged_for_regeneration',
        'image_regeneration_requested_at',
        'image_regeneration_requested_by'
      )
      ORDER BY column_name;
    `);

    console.log('\nVerification - New columns:');
    console.table(result.rows);

    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Admins can now flag recipe images for regeneration');
    console.log('2. Visit /admin dashboard to see flagged images section');
    console.log('3. Use AI regeneration to create new images for flagged recipes');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
applyMigration()
  .then(() => {
    console.log('\nMigration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
