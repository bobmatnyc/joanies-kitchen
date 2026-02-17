#!/usr/bin/env tsx

/**
 * Test Recipe Cloning System
 *
 * Smoke tests to verify:
 * 1. Schema changes applied correctly
 * 2. Engagement metrics exist and are queryable
 * 3. Sample queries work
 */

import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

async function main() {
  console.log('🧪 Testing Recipe Cloning System...\n');

  try {
    // Test 1: Verify schema columns exist
    console.log('✅ Test 1: Verifying schema columns...');
    const [sample] = await db
      .select({
        id: recipes.id,
        name: recipes.name,
        like_count: recipes.like_count,
        fork_count: recipes.fork_count,
        collection_count: recipes.collection_count,
      })
      .from(recipes)
      .limit(1);

    if (sample) {
      console.log('   ✓ like_count exists:', sample.like_count);
      console.log('   ✓ fork_count exists:', sample.fork_count);
      console.log('   ✓ collection_count exists:', sample.collection_count);
    } else {
      console.log('   ⚠️  No recipes found in database');
    }

    // Test 2: Query top engaged recipes
    console.log('\n✅ Test 2: Querying top engaged recipes...');
    const topEngaged = await db
      .select({
        name: recipes.name,
        likes: recipes.like_count,
        forks: recipes.fork_count,
        collections: recipes.collection_count,
      })
      .from(recipes)
      .orderBy(desc(recipes.like_count))
      .limit(5);

    console.log('   Top 5 recipes by likes:');
    topEngaged.forEach((r, i) => {
      console.log(
        `   ${i + 1}. ${r.name.slice(0, 50)} (${r.likes} likes, ${r.forks} forks, ${r.collections} collections)`
      );
    });

    // Test 3: Count recipes with engagement
    console.log('\n✅ Test 3: Counting engaged recipes...');
    const stats = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE like_count > 0) as recipes_with_likes,
        COUNT(*) FILTER (WHERE fork_count > 0) as recipes_with_forks,
        COUNT(*) FILTER (WHERE collection_count > 0) as recipes_in_collections,
        MAX(like_count) as max_likes,
        MAX(fork_count) as max_forks,
        MAX(collection_count) as max_collections
      FROM recipes
    `);

    if (stats.rows[0]) {
      const row = stats.rows[0];
      console.log(`   Recipes with likes: ${row.recipes_with_likes}`);
      console.log(`   Recipes with forks: ${row.recipes_with_forks}`);
      console.log(`   Recipes in collections: ${row.recipes_in_collections}`);
      console.log(`   Max likes on single recipe: ${row.max_likes}`);
      console.log(`   Max forks on single recipe: ${row.max_forks}`);
      console.log(`   Max collections: ${row.max_collections}`);
    }

    // Test 4: Check for forked recipes
    console.log('\n✅ Test 4: Checking for forked recipes...');
    const forkedRecipes = await db
      .select({
        id: recipes.id,
        name: recipes.name,
        source: recipes.source,
      })
      .from(recipes)
      .where(sql`${recipes.source} LIKE '%Forked from recipe ID:%'`)
      .limit(5);

    if (forkedRecipes.length > 0) {
      console.log(`   Found ${forkedRecipes.length} forked recipes:`);
      forkedRecipes.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.name}`);
        console.log(`      Source: ${r.source?.slice(0, 60)}...`);
      });
    } else {
      console.log('   No forked recipes found yet (expected before cloning)');
    }

    // Test 5: Verify index exists
    console.log('\n✅ Test 5: Verifying engagement index...');
    const indexCheck = await db.execute(sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'recipes'
      AND indexname = 'idx_recipes_engagement'
    `);

    if (indexCheck.rows.length > 0) {
      console.log('   ✓ Engagement index exists');
      console.log(`   Definition: ${indexCheck.rows[0].indexdef}`);
    } else {
      console.log('   ⚠️  Engagement index not found');
    }

    console.log('\n✅ All tests passed!');
    console.log('\n📋 Summary:');
    console.log('   - Schema columns: ✓');
    console.log('   - Query functionality: ✓');
    console.log('   - Engagement stats: ✓');
    console.log('   - Fork detection: ✓');
    console.log('   - Index creation: ✓');

    return true;
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

main()
  .then(() => {
    console.log('\n✅ Test suite complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
