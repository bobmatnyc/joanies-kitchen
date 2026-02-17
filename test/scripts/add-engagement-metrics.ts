#!/usr/bin/env tsx

/**
 * Add engagement metrics to recipes table
 *
 * Adds like_count, fork_count, and collection_count fields to recipes table
 * and backfills from existing data in recipeLikes, recipeForks, and collectionRecipes
 */

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

async function main() {
  console.log('Adding engagement metrics to recipes table...\n');

  try {
    // Add columns (if they don't exist)
    console.log('1. Adding like_count column...');
    await db.execute(sql`
      ALTER TABLE recipes
      ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0 NOT NULL
    `);

    console.log('2. Adding fork_count column...');
    await db.execute(sql`
      ALTER TABLE recipes
      ADD COLUMN IF NOT EXISTS fork_count INTEGER DEFAULT 0 NOT NULL
    `);

    console.log('3. Adding collection_count column...');
    await db.execute(sql`
      ALTER TABLE recipes
      ADD COLUMN IF NOT EXISTS collection_count INTEGER DEFAULT 0 NOT NULL
    `);

    // Create index for engagement sorting
    console.log('4. Creating engagement index...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_recipes_engagement
      ON recipes(like_count DESC, fork_count DESC, collection_count DESC)
    `);

    // Backfill like_count from favorites table (existing)
    console.log('\n5. Backfilling like_count from favorites...');
    const likeResult = await db.execute(sql`
      UPDATE recipes r
      SET like_count = COALESCE(
        (SELECT COUNT(*) FROM favorites f WHERE f.recipe_id = r.id),
        0
      )
    `);
    console.log(`   Updated ${likeResult.rowCount || 0} recipes`);

    // Fork count starts at 0 (will be incremented when cloning is implemented)
    console.log('6. Initializing fork_count to 0...');
    await db.execute(sql`UPDATE recipes SET fork_count = 0`);
    console.log('   Initialized');

    // Backfill collection_count from collection_recipes (existing)
    console.log('7. Backfilling collection_count from collection_recipes...');
    const collectionResult = await db.execute(sql`
      UPDATE recipes r
      SET collection_count = COALESCE(
        (SELECT COUNT(*) FROM collection_recipes cr WHERE cr.recipe_id = r.id),
        0
      )
    `);
    console.log(`   Updated ${collectionResult.rowCount || 0} recipes`);

    console.log('\n✅ Successfully added and backfilled engagement metrics!');

    // Show summary stats
    const stats = await db.execute(sql`
      SELECT
        COUNT(*) as total_recipes,
        SUM(CASE WHEN like_count > 0 THEN 1 ELSE 0 END) as recipes_with_likes,
        SUM(CASE WHEN fork_count > 0 THEN 1 ELSE 0 END) as recipes_with_forks,
        SUM(CASE WHEN collection_count > 0 THEN 1 ELSE 0 END) as recipes_in_collections,
        MAX(like_count) as max_likes,
        MAX(fork_count) as max_forks,
        MAX(collection_count) as max_collections
      FROM recipes
    `);

    console.log('\n📊 Engagement Metrics Summary:');
    if (stats.rows[0]) {
      const row = stats.rows[0];
      console.log(`   Total recipes: ${row.total_recipes}`);
      console.log(`   Recipes with likes: ${row.recipes_with_likes}`);
      console.log(`   Recipes with forks: ${row.recipes_with_forks}`);
      console.log(`   Recipes in collections: ${row.recipes_in_collections}`);
      console.log(`   Max likes: ${row.max_likes}`);
      console.log(`   Max forks: ${row.max_forks}`);
      console.log(`   Max collections: ${row.max_collections}`);
    }

  } catch (error) {
    console.error('❌ Error adding engagement metrics:', error);
    throw error;
  }
}

main()
  .then(() => {
    console.log('\n✅ Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
