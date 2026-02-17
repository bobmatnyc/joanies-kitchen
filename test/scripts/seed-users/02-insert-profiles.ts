/**
 * Insert Generated User Profiles into Database
 *
 * Reads generated profiles from JSON and inserts them into the database.
 * Handles errors gracefully and provides detailed progress reporting.
 */

import { readFileSync } from 'node:fs';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/user-discovery-schema';
import type { SyntheticUserProfile } from './01-generate-profiles';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PROFILES_FILE = 'scripts/seed-users/generated-profiles.json';
const BATCH_SIZE = 100; // Insert in batches to avoid overwhelming the database

// ============================================================================
// INSERTION LOGIC
// ============================================================================

async function insertProfiles() {
  console.log('📥 Reading generated profiles...\n');

  // Read profiles from JSON file
  let profiles: SyntheticUserProfile[];
  try {
    const fileContent = readFileSync(PROFILES_FILE, 'utf-8');
    profiles = JSON.parse(fileContent);
    console.log(`✅ Loaded ${profiles.length} profiles from ${PROFILES_FILE}\n`);
  } catch (error) {
    console.error('❌ Failed to read profiles file:', error);
    console.log('\nMake sure to run: pnpm tsx scripts/seed-users/01-generate-profiles.ts first');
    process.exit(1);
  }

  // Prepare profiles for insertion (remove metadata field)
  const profilesForDb = profiles.map(({ _metadata, ...profile }) => ({
    ...profile,
    // Convert Date objects to proper format
    created_at: new Date(profile.created_at),
    updated_at: new Date(profile.created_at),
    // Ensure specialties is properly formatted as JSON
    specialties: profile.specialties,
  }));

  console.log(`🚀 Starting insertion of ${profilesForDb.length} profiles...\n`);

  let insertedCount = 0;
  let errorCount = 0;
  const errors: Array<{ profile: any; error: string }> = [];

  // Insert in batches
  for (let i = 0; i < profilesForDb.length; i += BATCH_SIZE) {
    const batch = profilesForDb.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(profilesForDb.length / BATCH_SIZE);

    console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} profiles)...`);

    try {
      await db.insert(userProfiles).values(batch);
      insertedCount += batch.length;
      console.log(`   ✅ Batch ${batchNumber} inserted successfully`);
    } catch (error) {
      console.error(`   ❌ Batch ${batchNumber} failed:`, error);

      // Try inserting one by one to identify problematic profiles
      console.log(`   🔄 Retrying batch ${batchNumber} one by one...`);

      for (const profile of batch) {
        try {
          await db.insert(userProfiles).values(profile);
          insertedCount++;
        } catch (singleError) {
          errorCount++;
          const errorMessage = singleError instanceof Error ? singleError.message : String(singleError);
          errors.push({
            profile: {
              username: profile.username,
              user_id: profile.user_id,
            },
            error: errorMessage,
          });
        }
      }
    }

    // Progress update
    console.log(`   Progress: ${insertedCount}/${profilesForDb.length} inserted, ${errorCount} errors\n`);
  }

  // Final summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 INSERTION SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ Successfully inserted: ${insertedCount} profiles`);
  console.log(`❌ Failed insertions: ${errorCount} profiles`);
  console.log(`📈 Success rate: ${((insertedCount / profilesForDb.length) * 100).toFixed(2)}%`);

  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.slice(0, 10).forEach(({ profile, error }) => {
      console.log(`   • ${profile.username} (${profile.user_id}): ${error}`);
    });
    if (errors.length > 10) {
      console.log(`   ... and ${errors.length - 10} more errors`);
    }
  }

  console.log('\n✨ Profile insertion complete!');
  console.log('\nNext steps:');
  console.log('  1. Verify profiles: SELECT COUNT(*) FROM user_profiles WHERE is_synthetic_user = true;');
  console.log('  2. Generate activity: pnpm tsx scripts/seed-users/03-generate-activity.ts');
}

// ============================================================================
// VERIFICATION
// ============================================================================

async function verifyInsertion() {
  console.log('\n🔍 Verifying insertion...\n');

  try {
    const { eq, sql } = await import('drizzle-orm');

    // Count synthetic users
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userProfiles)
      .where(eq(userProfiles.is_synthetic_user, true));

    console.log(`✅ Found ${result.count} synthetic users in database`);

    // Count by activity level
    const activityLevels = ['lurker', 'occasional', 'regular', 'power'];
    console.log('\n📊 Activity level distribution:');

    for (const level of activityLevels) {
      const [levelResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(userProfiles)
        .where(
          sql`${userProfiles.is_synthetic_user} = true AND ${userProfiles.synthetic_activity_level} = ${level}`
        );

      console.log(`   ${level.padEnd(10)}: ${levelResult.count.toString().padStart(5)} users`);
    }

    // Sample 5 random profiles
    console.log('\n👥 Sample profiles:');
    const sampleProfiles = await db
      .select({
        username: userProfiles.username,
        display_name: userProfiles.display_name,
        location: userProfiles.location,
        activity_level: userProfiles.synthetic_activity_level,
      })
      .from(userProfiles)
      .where(eq(userProfiles.is_synthetic_user, true))
      .limit(5);

    sampleProfiles.forEach((profile) => {
      console.log(
        `   • ${profile.display_name} (@${profile.username}) - ${profile.location} [${profile.activity_level}]`
      );
    });
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    await insertProfiles();
    await verifyInsertion();
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
