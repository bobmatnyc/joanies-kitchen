#!/usr/bin/env tsx
/**
 * Database Migration: Add Recipe Moderation Fields
 *
 * Purpose:
 * - Add moderation_status, moderation_notes, moderated_by, moderated_at, submission_notes to recipes table
 * - Support admin recipe moderation queue workflow
 * - Mark existing recipes as 'approved' (they're already live)
 * - Enable tracking of moderation actions and submission context
 *
 * Schema Changes:
 * - moderation_status: TEXT NOT NULL DEFAULT 'pending' ('pending' | 'approved' | 'rejected' | 'flagged')
 * - moderation_notes: TEXT (admin notes about rejection/flagging)
 * - moderated_by: TEXT (Clerk user ID of moderator)
 * - moderated_at: TIMESTAMP (when moderation action was taken)
 * - submission_notes: TEXT (user's notes when submitting recipe)
 *
 * Indexes:
 * - idx_recipes_moderation_status (moderation_status)
 * - idx_recipes_moderation_pending (moderation_status, created_at DESC)
 *
 * Usage:
 *   pnpm tsx scripts/migrations/add-moderation-fields.ts
 *
 * Rollback:
 *   pnpm tsx scripts/migrations/add-moderation-fields.ts --rollback
 */

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

async function addModerationFields() {
  console.log('Adding moderation fields to recipes table...');

  try {
    // Add moderation_status column with default 'pending'
    console.log('Adding moderation_status column...');
    await db.execute(sql`
      ALTER TABLE recipes
      ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'pending'
      CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'flagged'));
    `);
    console.log('✓ moderation_status column added');

    // Add moderation_notes column
    console.log('Adding moderation_notes column...');
    await db.execute(sql`
      ALTER TABLE recipes
      ADD COLUMN IF NOT EXISTS moderation_notes TEXT;
    `);
    console.log('✓ moderation_notes column added');

    // Add moderated_by column
    console.log('Adding moderated_by column...');
    await db.execute(sql`
      ALTER TABLE recipes
      ADD COLUMN IF NOT EXISTS moderated_by TEXT;
    `);
    console.log('✓ moderated_by column added');

    // Add moderated_at column
    console.log('Adding moderated_at column...');
    await db.execute(sql`
      ALTER TABLE recipes
      ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP;
    `);
    console.log('✓ moderated_at column added');

    // Add submission_notes column
    console.log('Adding submission_notes column...');
    await db.execute(sql`
      ALTER TABLE recipes
      ADD COLUMN IF NOT EXISTS submission_notes TEXT;
    `);
    console.log('✓ submission_notes column added');

    // Create moderation_status index
    console.log('Creating moderation status index...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_recipes_moderation_status
        ON recipes(moderation_status);
    `);
    console.log('✓ Moderation status index created');

    // Create composite index for pending queue (status + created_at)
    console.log('Creating moderation pending queue index...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_recipes_moderation_pending
        ON recipes(moderation_status, created_at DESC);
    `);
    console.log('✓ Moderation pending queue index created');

    // Mark all existing recipes as 'approved' (they're already live)
    console.log('\nUpdating existing recipes to approved status...');
    const result = await db.execute(sql`
      UPDATE recipes
      SET moderation_status = 'approved',
          moderated_at = NOW()
      WHERE moderation_status = 'pending';
    `);
    console.log(`✓ Updated ${result.rowCount || 0} existing recipes to 'approved' status`);

    console.log('\n✓ Migration completed successfully!');
    console.log('\nWhat was done:');
    console.log('1. Added 5 new moderation fields to recipes table');
    console.log('2. Created 2 indexes for efficient moderation queue queries');
    console.log('3. Marked all existing recipes as approved');
    console.log('\nNext steps:');
    console.log('1. Update recipe creation logic to set moderation_status based on user role');
    console.log('2. Implement admin moderation queue UI');
    console.log(
      '3. Update recipe visibility logic to check both is_public AND moderation_status = approved'
    );
    console.log('4. Add server actions for approve/reject/flag moderation actions');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function rollbackModerationFields() {
  console.log('Rolling back moderation fields migration...');

  try {
    // Drop indexes first
    console.log('Dropping moderation indexes...');
    await db.execute(sql`
      DROP INDEX IF EXISTS idx_recipes_moderation_pending;
    `);
    console.log('✓ Dropped idx_recipes_moderation_pending');

    await db.execute(sql`
      DROP INDEX IF EXISTS idx_recipes_moderation_status;
    `);
    console.log('✓ Dropped idx_recipes_moderation_status');

    // Drop columns
    console.log('Dropping moderation columns...');
    await db.execute(sql`
      ALTER TABLE recipes
      DROP COLUMN IF EXISTS submission_notes,
      DROP COLUMN IF EXISTS moderated_at,
      DROP COLUMN IF EXISTS moderated_by,
      DROP COLUMN IF EXISTS moderation_notes,
      DROP COLUMN IF EXISTS moderation_status;
    `);
    console.log('✓ All moderation columns dropped');

    console.log('\n✓ Rollback completed successfully!');
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const isRollback = args.includes('--rollback');

// Run migration or rollback
const migrationFunction = isRollback ? rollbackModerationFields : addModerationFields;

migrationFunction()
  .then(() => {
    console.log('\nMigration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMigration script failed:', error);
    process.exit(1);
  });
