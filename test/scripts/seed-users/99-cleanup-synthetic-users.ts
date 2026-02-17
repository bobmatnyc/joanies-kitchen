/**
 * Cleanup Script: Remove Synthetic Users and Their Data
 *
 * This script manages the lifecycle of synthetic users:
 * 1. Gradual deactivation (simulates users leaving platform)
 * 2. Complete removal of synthetic users and all associated data
 * 3. Verification of cleanup
 *
 * Use this script as real users join the platform to phase out synthetic activity.
 */

import { db } from '@/lib/db';
import { eq, and, sql, isNotNull } from 'drizzle-orm';
import {
  userProfiles,
  favorites,
  collections,
  collectionRecipes,
  recipeViews,
} from '@/lib/db/user-discovery-schema';
import {
  recipeRatings,
  recipeComments,
  recipeLikes,
} from '@/lib/db/schema';
import { meals, mealRecipes } from '@/lib/db/meals-schema';

// ============================================================================
// CONFIGURATION
// ============================================================================

interface CleanupOptions {
  mode: 'deactivate' | 'delete' | 'status';
  count?: number; // Number of users to deactivate/delete
  activityLevel?: string; // Target specific activity level
  force?: boolean; // Skip confirmation prompts
}

// ============================================================================
// STATUS & REPORTING
// ============================================================================

async function getSyntheticUserStats() {
  console.log('📊 Fetching synthetic user statistics...\n');

  // Total synthetic users
  const [totalResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userProfiles)
    .where(eq(userProfiles.is_synthetic_user, true));

  // Active synthetic users
  const [activeResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userProfiles)
    .where(
      and(
        eq(userProfiles.is_synthetic_user, true),
        eq(userProfiles.synthetic_user_active, true)
      )
    );

  // Deactivated synthetic users
  const [deactivatedResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userProfiles)
    .where(
      and(
        eq(userProfiles.is_synthetic_user, true),
        eq(userProfiles.synthetic_user_active, false)
      )
    );

  // By activity level
  const activityLevels = ['lurker', 'occasional', 'regular', 'power'];
  const activityStats: Record<string, number> = {};

  for (const level of activityLevels) {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userProfiles)
      .where(
        and(
          eq(userProfiles.is_synthetic_user, true),
          eq(userProfiles.synthetic_user_active, true),
          sql`${userProfiles.synthetic_activity_level} = ${level}`
        )
      );
    activityStats[level] = result.count;
  }

  // Count associated data
  const [ratingsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(recipeRatings)
    .innerJoin(userProfiles, eq(recipeRatings.user_id, userProfiles.user_id))
    .where(eq(userProfiles.is_synthetic_user, true));

  const [commentsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(recipeComments)
    .innerJoin(userProfiles, eq(recipeComments.user_id, userProfiles.user_id))
    .where(eq(userProfiles.is_synthetic_user, true));

  const [likesResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(recipeLikes)
    .innerJoin(userProfiles, eq(recipeLikes.user_id, userProfiles.user_id))
    .where(eq(userProfiles.is_synthetic_user, true));

  const [favoritesResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(favorites)
    .innerJoin(userProfiles, eq(favorites.user_id, userProfiles.user_id))
    .where(eq(userProfiles.is_synthetic_user, true));

  const [collectionsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(collections)
    .innerJoin(userProfiles, eq(collections.user_id, userProfiles.user_id))
    .where(eq(userProfiles.is_synthetic_user, true));

  const [mealsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(meals)
    .innerJoin(userProfiles, eq(meals.user_id, userProfiles.user_id))
    .where(eq(userProfiles.is_synthetic_user, true));

  return {
    total: totalResult.count,
    active: activeResult.count,
    deactivated: deactivatedResult.count,
    activityLevels: activityStats,
    data: {
      ratings: ratingsResult.count,
      comments: commentsResult.count,
      likes: likesResult.count,
      favorites: favoritesResult.count,
      collections: collectionsResult.count,
      meals: mealsResult.count,
    },
  };
}

function displayStats(stats: any) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 SYNTHETIC USER STATISTICS');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total synthetic users:     ${stats.total}`);
  console.log(`  └─ Active:               ${stats.active}`);
  console.log(`  └─ Deactivated:          ${stats.deactivated}`);
  console.log('\nActivity Level Distribution:');
  console.log(`  └─ Lurkers:              ${stats.activityLevels.lurker || 0}`);
  console.log(`  └─ Occasional:           ${stats.activityLevels.occasional || 0}`);
  console.log(`  └─ Regular:              ${stats.activityLevels.regular || 0}`);
  console.log(`  └─ Power Users:          ${stats.activityLevels.power || 0}`);
  console.log('\nAssociated Data:');
  console.log(`  └─ Ratings:              ${stats.data.ratings}`);
  console.log(`  └─ Comments:             ${stats.data.comments}`);
  console.log(`  └─ Likes:                ${stats.data.likes}`);
  console.log(`  └─ Favorites:            ${stats.data.favorites}`);
  console.log(`  └─ Collections:          ${stats.data.collections}`);
  console.log(`  └─ Meals:                ${stats.data.meals}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

// ============================================================================
// GRADUAL DEACTIVATION
// ============================================================================

async function deactivateSyntheticUsers(count: number, activityLevel?: string) {
  console.log(`🔄 Deactivating ${count} synthetic users...${activityLevel ? ` (${activityLevel} users)` : ''}\n`);

  // Build query conditions
  const conditions = [
    eq(userProfiles.is_synthetic_user, true),
    eq(userProfiles.synthetic_user_active, true),
  ];

  if (activityLevel) {
    conditions.push(sql`${userProfiles.synthetic_activity_level} = ${activityLevel}`);
  }

  // Get users to deactivate
  const usersToDeactivate = await db
    .select()
    .from(userProfiles)
    .where(and(...conditions))
    .limit(count);

  if (usersToDeactivate.length === 0) {
    console.log('⚠️  No active synthetic users found to deactivate.');
    return;
  }

  console.log(`Found ${usersToDeactivate.length} users to deactivate:`);
  usersToDeactivate.slice(0, 5).forEach((user) => {
    console.log(`  • ${user.display_name} (@${user.username}) [${user.synthetic_activity_level}]`);
  });
  if (usersToDeactivate.length > 5) {
    console.log(`  ... and ${usersToDeactivate.length - 5} more`);
  }

  // Deactivate users
  const userIds = usersToDeactivate.map((u) => u.user_id);

  await db
    .update(userProfiles)
    .set({
      synthetic_user_active: false,
      deactivated_at: new Date(),
    })
    .where(sql`${userProfiles.user_id} = ANY(${userIds})`);

  console.log(`\n✅ Deactivated ${usersToDeactivate.length} users`);
  console.log('   Note: User data is preserved but marked as inactive\n');
}

// ============================================================================
// COMPLETE DELETION
// ============================================================================

async function deleteSyntheticUsers(deleteActive: boolean = false) {
  console.log('🗑️  Deleting synthetic users and all associated data...\n');

  // Build conditions
  const conditions = [eq(userProfiles.is_synthetic_user, true)];

  if (!deleteActive) {
    // Only delete deactivated users
    conditions.push(eq(userProfiles.synthetic_user_active, false));
    console.log('   Mode: Deleting DEACTIVATED users only');
  } else {
    console.log('   Mode: Deleting ALL synthetic users (active + deactivated)');
  }

  // Get users to delete
  const usersToDelete = await db
    .select({ user_id: userProfiles.user_id, username: userProfiles.username })
    .from(userProfiles)
    .where(and(...conditions));

  if (usersToDelete.length === 0) {
    console.log('⚠️  No synthetic users found to delete.');
    return;
  }

  console.log(`\n⚠️  WARNING: About to delete ${usersToDelete.length} users and all their data!`);
  console.log('   This action CANNOT be undone!\n');

  const userIds = usersToDelete.map((u) => u.user_id);

  // Delete associated data (in order of dependencies)
  console.log('🗑️  Deleting associated data...');

  // 1. Collection recipes (references collections)
  await db.delete(collectionRecipes).where(
    sql`${collectionRecipes.collection_id} IN (
      SELECT id FROM ${collections} WHERE ${collections.user_id} = ANY(${userIds})
    )`
  );
  console.log('   ✅ Deleted collection recipes');

  // 2. Meal recipes (references meals)
  await db.delete(mealRecipes).where(
    sql`${mealRecipes.meal_id} IN (
      SELECT id FROM ${meals} WHERE ${meals.user_id} = ANY(${userIds})
    )`
  );
  console.log('   ✅ Deleted meal recipes');

  // 3. Collections
  await db.delete(collections).where(sql`${collections.user_id} = ANY(${userIds})`);
  console.log('   ✅ Deleted collections');

  // 4. Meals
  await db.delete(meals).where(sql`${meals.user_id} = ANY(${userIds})`);
  console.log('   ✅ Deleted meals');

  // 5. Favorites
  await db.delete(favorites).where(sql`${favorites.user_id} = ANY(${userIds})`);
  console.log('   ✅ Deleted favorites');

  // 6. Recipe views
  await db.delete(recipeViews).where(sql`${recipeViews.user_id} = ANY(${userIds})`);
  console.log('   ✅ Deleted recipe views');

  // 7. Recipe likes
  await db.delete(recipeLikes).where(sql`${recipeLikes.user_id} = ANY(${userIds})`);
  console.log('   ✅ Deleted recipe likes');

  // 8. Recipe comments
  await db.delete(recipeComments).where(sql`${recipeComments.user_id} = ANY(${userIds})`);
  console.log('   ✅ Deleted recipe comments');

  // 9. Recipe ratings
  await db.delete(recipeRatings).where(sql`${recipeRatings.user_id} = ANY(${userIds})`);
  console.log('   ✅ Deleted recipe ratings');

  // 10. User profiles (last)
  await db.delete(userProfiles).where(and(...conditions));
  console.log('   ✅ Deleted user profiles');

  console.log(`\n✨ Successfully deleted ${usersToDelete.length} synthetic users and all associated data\n`);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const mode = (args[0] || 'status') as CleanupOptions['mode'];

  console.log('🧹 Synthetic User Cleanup Tool\n');

  // Get current stats
  const stats = await getSyntheticUserStats();
  displayStats(stats);

  switch (mode) {
    case 'status':
      // Just display stats (already done above)
      console.log('💡 Usage:');
      console.log('   Status:      pnpm tsx scripts/seed-users/99-cleanup-synthetic-users.ts status');
      console.log('   Deactivate:  pnpm tsx scripts/seed-users/99-cleanup-synthetic-users.ts deactivate [count] [level]');
      console.log('   Delete:      pnpm tsx scripts/seed-users/99-cleanup-synthetic-users.ts delete [all]');
      console.log('\nExamples:');
      console.log('   pnpm tsx scripts/seed-users/99-cleanup-synthetic-users.ts deactivate 20');
      console.log('   pnpm tsx scripts/seed-users/99-cleanup-synthetic-users.ts deactivate 10 lurker');
      console.log('   pnpm tsx scripts/seed-users/99-cleanup-synthetic-users.ts delete');
      console.log('   pnpm tsx scripts/seed-users/99-cleanup-synthetic-users.ts delete all\n');
      break;

    case 'deactivate':
      const count = Number.parseInt(args[1] || '10', 10);
      const level = args[2];
      await deactivateSyntheticUsers(count, level);
      await getSyntheticUserStats().then(displayStats);
      break;

    case 'delete':
      const deleteAll = args[1] === 'all';
      if (deleteAll && stats.active > 0) {
        console.log('⚠️  WARNING: You are about to delete ACTIVE synthetic users!');
        console.log('   Consider deactivating them first with the "deactivate" command.\n');
      }
      await deleteSyntheticUsers(deleteAll);
      await getSyntheticUserStats().then(displayStats);
      break;

    default:
      console.error(`❌ Unknown mode: ${mode}`);
      console.log('   Valid modes: status, deactivate, delete');
      process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
