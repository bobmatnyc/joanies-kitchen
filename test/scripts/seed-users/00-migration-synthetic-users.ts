/**
 * Database Migration: Add Synthetic User Tracking Fields
 *
 * Adds fields to user_profiles table to track and manage synthetic/test users.
 * These fields allow gradual phase-out as real users join the platform.
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function addSyntheticUserFields() {
  console.log('🔧 Adding synthetic user tracking fields to user_profiles...\n');

  try {
    // Add is_synthetic_user field (marks users created by seeding scripts)
    await db.execute(sql`
      ALTER TABLE user_profiles
      ADD COLUMN IF NOT EXISTS is_synthetic_user BOOLEAN DEFAULT FALSE NOT NULL
    `);
    console.log('✅ Added is_synthetic_user field');

    // Add synthetic_user_active field (allows gradual deactivation)
    await db.execute(sql`
      ALTER TABLE user_profiles
      ADD COLUMN IF NOT EXISTS synthetic_user_active BOOLEAN DEFAULT TRUE
    `);
    console.log('✅ Added synthetic_user_active field');

    // Add deactivated_at timestamp (track when synthetic user was deactivated)
    await db.execute(sql`
      ALTER TABLE user_profiles
      ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE
    `);
    console.log('✅ Added deactivated_at field');

    // Add synthetic_activity_level field (categorize user engagement)
    await db.execute(sql`
      ALTER TABLE user_profiles
      ADD COLUMN IF NOT EXISTS synthetic_activity_level TEXT CHECK (synthetic_activity_level IN ('lurker', 'occasional', 'regular', 'power'))
    `);
    console.log('✅ Added synthetic_activity_level field');

    // Create index for efficient filtering of synthetic users
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_user_profiles_synthetic
      ON user_profiles (is_synthetic_user, synthetic_user_active)
    `);
    console.log('✅ Created index for synthetic user filtering');

    console.log('\n✨ Migration completed successfully!');
    console.log('\nNew fields added:');
    console.log('  • is_synthetic_user: BOOLEAN (identifies synthetic users)');
    console.log('  • synthetic_user_active: BOOLEAN (controls visibility)');
    console.log('  • deactivated_at: TIMESTAMP (tracks deactivation)');
    console.log('  • synthetic_activity_level: TEXT (lurker|occasional|regular|power)');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function rollbackSyntheticUserFields() {
  console.log('🔄 Rolling back synthetic user tracking fields...\n');

  try {
    // Drop index
    await db.execute(sql`
      DROP INDEX IF EXISTS idx_user_profiles_synthetic
    `);
    console.log('✅ Dropped synthetic user index');

    // Drop columns
    await db.execute(sql`
      ALTER TABLE user_profiles
      DROP COLUMN IF EXISTS is_synthetic_user,
      DROP COLUMN IF EXISTS synthetic_user_active,
      DROP COLUMN IF EXISTS deactivated_at,
      DROP COLUMN IF EXISTS synthetic_activity_level
    `);
    console.log('✅ Dropped synthetic user fields');

    console.log('\n✨ Rollback completed successfully!');

  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}

// Run migration or rollback based on command-line argument
const command = process.argv[2] || 'migrate';

if (command === 'rollback') {
  rollbackSyntheticUserFields()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else {
  addSyntheticUserFields()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
