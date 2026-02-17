/**
 * Test Script for Recipe Rating Database Operations
 *
 * Tests database schema and basic operations without server-only modules
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipeRatings, recipes } from '@/lib/db/schema';

// Test recipe data
const testRecipe = {
  name: 'Test Chocolate Chip Cookies',
  description: 'Test recipe for rating system',
  ingredients: ['flour', 'sugar', 'butter', 'chocolate chips'],
  instructions: ['Mix ingredients', 'Bake at 350F', 'Cool and serve'],
};

async function testSchemaExists() {
  console.log('\n=== TEST 1: Verify Schema ===');

  try {
    // Check recipes table has rating columns
    const columnCheck = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'recipes'
        AND column_name IN ('system_rating', 'system_rating_reason', 'avg_user_rating', 'total_user_ratings')
      ORDER BY column_name;
    `);

    console.log('Recipes table rating columns:');
    for (const row of columnCheck.rows) {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    }

    if (columnCheck.rows.length === 4) {
      console.log('✓ All rating columns exist');
    } else {
      console.error('✗ Missing rating columns');
      return false;
    }

    // Check recipe_ratings table exists
    const tableCheck = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'recipe_ratings';
    `);

    if (tableCheck.rows.length > 0) {
      console.log('✓ recipe_ratings table exists');
    } else {
      console.error('✗ recipe_ratings table not found');
      return false;
    }

    return true;
  } catch (error) {
    console.error('✗ Schema verification failed:', error);
    return false;
  }
}

async function testRecipeStorage() {
  console.log('\n=== TEST 2: Recipe Storage with Rating ===');

  try {
    // Store recipe with rating
    const [storedRecipe] = await db
      .insert(recipes)
      .values({
        userId: 'test-user',
        name: testRecipe.name,
        description: testRecipe.description,
        ingredients: JSON.stringify(testRecipe.ingredients),
        instructions: JSON.stringify(testRecipe.instructions),
        prepTime: 15,
        cookTime: 10,
        servings: 12,
        systemRating: '4.5',
        systemRatingReason: 'Test rating: Good recipe with clear instructions',
        avgUserRating: null,
        totalUserRatings: 0,
        isAiGenerated: false,
        isPublic: true,
        isSystemRecipe: false,
      })
      .returning();

    console.log(`✓ Recipe stored with ID: ${storedRecipe.id}`);
    console.log(`✓ System rating: ${storedRecipe.systemRating}`);
    console.log(`✓ System rating reason: ${storedRecipe.systemRatingReason}`);

    return storedRecipe.id;
  } catch (error) {
    console.error('✗ Recipe storage failed:', error);
    return null;
  }
}

async function testUserRatings(recipeId: string) {
  console.log('\n=== TEST 3: User Ratings ===');

  try {
    // Add multiple user ratings
    const testRatings = [
      { userId: 'user-1', rating: 5, review: 'Amazing!' },
      { userId: 'user-2', rating: 4, review: 'Very good' },
      { userId: 'user-3', rating: 5, review: null },
      { userId: 'user-4', rating: 4, review: 'Great recipe' },
    ];

    for (const { userId, rating, review } of testRatings) {
      await db.insert(recipeRatings).values({
        recipeId,
        userId,
        rating,
        review,
      });
      console.log(`✓ Added rating: ${rating}/5 from ${userId}`);
    }

    // Calculate average
    const stats = await db
      .select({
        avgRating: sql<number>`CAST(AVG(${recipeRatings.rating}) AS DECIMAL(2,1))`,
        totalRatings: sql<number>`COUNT(${recipeRatings.id})`,
      })
      .from(recipeRatings)
      .where(eq(recipeRatings.recipeId, recipeId));

    const avgRating = stats[0]?.avgRating || 0;
    const totalRatings = stats[0]?.totalRatings || 0;

    console.log(`\n✓ Average rating: ${avgRating}/5.0`);
    console.log(`✓ Total ratings: ${totalRatings}`);

    // Verify calculation (4 + 4 + 5 + 5) / 4 = 4.5
    const expectedAvg = 4.5;
    if (Math.abs(avgRating - expectedAvg) < 0.01) {
      console.log(`✓ Average calculation correct (expected ${expectedAvg})`);
    } else {
      console.error(`✗ Average calculation incorrect (expected ${expectedAvg}, got ${avgRating})`);
      return false;
    }

    // Update recipe
    await db
      .update(recipes)
      .set({
        avgUserRating: String(avgRating),
        totalUserRatings: Number(totalRatings),
      })
      .where(eq(recipes.id, recipeId));

    console.log('✓ Recipe updated with average rating');

    return true;
  } catch (error) {
    console.error('✗ User ratings test failed:', error);
    return false;
  }
}

async function testRatingUpdate(recipeId: string) {
  console.log('\n=== TEST 4: Rating Update (Upsert) ===');

  try {
    // User 1 changes their rating
    await db
      .insert(recipeRatings)
      .values({
        recipeId,
        userId: 'user-1',
        rating: 3, // Changed from 5 to 3
        review: 'Changed my mind',
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [recipeRatings.recipeId, recipeRatings.userId],
        set: {
          rating: 3,
          review: 'Changed my mind',
          updatedAt: new Date(),
        },
      });

    console.log('✓ Updated user-1 rating from 5 to 3');

    // Verify only one rating per user
    const userRatings = await db
      .select()
      .from(recipeRatings)
      .where(eq(recipeRatings.userId, 'user-1'));

    if (userRatings.length === 1 && userRatings[0].rating === 3) {
      console.log('✓ Unique constraint working (only one rating per user)');
    } else {
      console.error('✗ Unique constraint failed');
      return false;
    }

    // Recalculate
    const stats = await db
      .select({
        avgRating: sql<number>`CAST(AVG(${recipeRatings.rating}) AS DECIMAL(2,1))`,
      })
      .from(recipeRatings)
      .where(eq(recipeRatings.recipeId, recipeId));

    const newAvg = stats[0]?.avgRating || 0;
    console.log(`✓ New average: ${newAvg}/5.0 (should be 4.0: (3+4+5+4)/4)`);

    return true;
  } catch (error) {
    console.error('✗ Rating update test failed:', error);
    return false;
  }
}

async function testRetrieveRatings(recipeId: string) {
  console.log('\n=== TEST 5: Retrieve Recipe with Ratings ===');

  try {
    const recipe = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);

    if (recipe.length === 0) {
      console.error('✗ Recipe not found');
      return false;
    }

    const r = recipe[0];
    console.log('\n--- Recipe Rating Summary ---');
    console.log(`Recipe: ${r.name}`);
    console.log(`System Rating: ${r.systemRating}/5.0`);
    console.log(`Reason: ${r.systemRatingReason}`);
    console.log(`Community Rating: ${r.avgUserRating}/5.0`);
    console.log(`Total User Ratings: ${r.totalUserRatings}`);

    // Get all user ratings
    const userRatingsData = await db
      .select()
      .from(recipeRatings)
      .where(eq(recipeRatings.recipeId, recipeId));

    console.log('\n--- Individual User Ratings ---');
    for (const rating of userRatingsData) {
      console.log(`${rating.userId}: ${rating.rating}/5 - ${rating.review || 'No review'}`);
    }

    return true;
  } catch (error) {
    console.error('✗ Retrieve ratings test failed:', error);
    return false;
  }
}

async function cleanup(recipeId: string | null) {
  console.log('\n=== Cleanup ===');

  try {
    if (recipeId) {
      // Delete test recipe (cascade will delete ratings)
      await db.delete(recipes).where(eq(recipes.id, recipeId));
      console.log('✓ Test recipe deleted');
    }
  } catch (error) {
    console.error('✗ Cleanup failed:', error);
  }
}

async function runAllTests() {
  console.log('=================================================');
  console.log('   RECIPE RATING DATABASE TEST SUITE');
  console.log('=================================================');

  let recipeId: string | null = null;
  const results: { [key: string]: boolean } = {};

  try {
    // Test 1: Schema verification
    results['Schema Verification'] = await testSchemaExists();

    // Test 2: Recipe Storage
    recipeId = await testRecipeStorage();
    results['Recipe Storage'] = recipeId !== null;

    if (recipeId) {
      // Test 3: User Ratings
      results['User Ratings'] = await testUserRatings(recipeId);

      // Test 4: Rating Update
      results['Rating Update'] = await testRatingUpdate(recipeId);

      // Test 5: Retrieve Ratings
      results['Retrieve Ratings'] = await testRetrieveRatings(recipeId);
    }

    // Print summary
    console.log('\n=================================================');
    console.log('   TEST SUMMARY');
    console.log('=================================================');

    let passed = 0;
    let failed = 0;

    for (const [test, result] of Object.entries(results)) {
      const status = result ? '✓ PASS' : '✗ FAIL';
      console.log(`${status} - ${test}`);
      if (result) passed++;
      else failed++;
    }

    console.log('\n-------------------------------------------------');
    console.log(`Total: ${passed + failed} tests`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log('=================================================');

    // Cleanup
    await cleanup(recipeId);

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n✗ Test suite failed:', error);
    await cleanup(recipeId);
    process.exit(1);
  }
}

runAllTests();
