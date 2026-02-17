/**
 * Test Script for Recipe Rating System
 *
 * Tests all components of the rating system:
 * 1. AI quality evaluation
 * 2. User rating submission
 * 3. Average calculation
 * 4. Database operations
 */

import { eq, sql } from 'drizzle-orm';
import { evaluateRecipeQuality } from '@/lib/ai/recipe-quality-evaluator';
import { db } from '@/lib/db';
import { recipeRatings, recipes } from '@/lib/db/schema';

// Test recipe data
const testRecipe = {
  name: 'Classic Chocolate Chip Cookies',
  description: 'Perfectly chewy chocolate chip cookies with crispy edges',
  ingredients: [
    '2 1/4 cups all-purpose flour',
    '1 tsp baking soda',
    '1 tsp salt',
    '1 cup butter, softened',
    '3/4 cup granulated sugar',
    '3/4 cup packed brown sugar',
    '2 large eggs',
    '2 tsp vanilla extract',
    '2 cups chocolate chips',
  ],
  instructions: [
    'Preheat oven to 375°F (190°C)',
    'Mix flour, baking soda, and salt in a bowl',
    'Beat butter and sugars until creamy',
    'Add eggs and vanilla, beat well',
    'Gradually mix in flour mixture',
    'Stir in chocolate chips',
    'Drop rounded tablespoons onto ungreased cookie sheets',
    'Bake 9-11 minutes until golden brown',
    'Cool on baking sheet for 2 minutes, then transfer to wire rack',
  ],
  prepTime: '15 minutes',
  cookTime: '10 minutes',
  servings: 48,
};

async function testAIEvaluation() {
  console.log('\n=== TEST 1: AI Quality Evaluation ===');

  try {
    const evaluation = await evaluateRecipeQuality(testRecipe);

    console.log(`Rating: ${evaluation.rating}/5.0`);
    console.log(`Reasoning: ${evaluation.reasoning}`);

    if (evaluation.rating >= 0 && evaluation.rating <= 5) {
      console.log('✓ Rating is within valid range (0-5)');
    } else {
      console.error('✗ Rating is out of range!');
      return false;
    }

    if (evaluation.reasoning && evaluation.reasoning.length > 10) {
      console.log('✓ Reasoning provided');
    } else {
      console.error('✗ No reasoning provided');
      return false;
    }

    return true;
  } catch (error) {
    console.error('✗ AI Evaluation failed:', error);
    return false;
  }
}

async function testRecipeStorage() {
  console.log('\n=== TEST 2: Recipe Storage with Rating ===');

  try {
    // Evaluate quality
    const qualityEval = await evaluateRecipeQuality(testRecipe);
    console.log(`AI Rating: ${qualityEval.rating}/5`);

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
        servings: testRecipe.servings,
        systemRating: qualityEval.rating.toFixed(1),
        systemRatingReason: qualityEval.reasoning,
        avgUserRating: null,
        totalUserRatings: 0,
        isAiGenerated: false,
        isPublic: true,
        isSystemRecipe: false,
      })
      .returning();

    console.log(`✓ Recipe stored with ID: ${storedRecipe.id}`);
    console.log(`✓ System rating: ${storedRecipe.systemRating}`);

    return storedRecipe.id;
  } catch (error) {
    console.error('✗ Recipe storage failed:', error);
    return null;
  }
}

async function testUserRatings(recipeId: string) {
  console.log('\n=== TEST 3: User Ratings ===');

  try {
    // Simulate multiple user ratings
    const testRatings = [
      { userId: 'user-1', rating: 5, review: 'Amazing cookies!' },
      { userId: 'user-2', rating: 4, review: 'Very good, slightly too sweet for me' },
      { userId: 'user-3', rating: 5, review: null },
      { userId: 'user-4', rating: 4, review: 'Great recipe, kids loved it' },
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

    // Update recipe
    await db
      .update(recipes)
      .set({
        avgUserRating: avgRating.toFixed(1),
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
        rating: 4, // Changed from 5 to 4
        review: 'Still great, but slightly too crispy',
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [recipeRatings.recipeId, recipeRatings.userId],
        set: {
          rating: 4,
          review: 'Still great, but slightly too crispy',
          updatedAt: new Date(),
        },
      });

    console.log('✓ Updated user-1 rating from 5 to 4');

    // Recalculate
    const stats = await db
      .select({
        avgRating: sql<number>`CAST(AVG(${recipeRatings.rating}) AS DECIMAL(2,1))`,
        totalRatings: sql<number>`COUNT(${recipeRatings.id})`,
      })
      .from(recipeRatings)
      .where(eq(recipeRatings.recipeId, recipeId));

    const newAvg = stats[0]?.avgRating || 0;
    console.log(`✓ New average: ${newAvg}/5.0 (should be lower than before)`);

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
  console.log('   RECIPE RATING SYSTEM TEST SUITE');
  console.log('=================================================');

  let recipeId: string | null = null;
  const results: { [key: string]: boolean } = {};

  try {
    // Test 1: AI Evaluation
    results['AI Evaluation'] = await testAIEvaluation();

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
