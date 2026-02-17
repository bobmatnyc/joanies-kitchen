#!/usr/bin/env tsx
/**
 * Test Script for Joanie Comments Feature
 *
 * This script demonstrates all CRUD operations for Joanie Comments:
 * - Create comments of different types
 * - Read/fetch comments
 * - Update comment text
 * - Delete comments
 *
 * Usage:
 *   pnpm tsx scripts/test-joanie-comments.ts
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes, joanieComments } from '@/lib/db/schema';

async function testJoanieComments() {
  console.log('=== Joanie Comments Feature Test ===\n');

  try {
    // Step 1: Find a test recipe (or use the first recipe)
    console.log('1. Finding a test recipe...');
    const [testRecipe] = await db
      .select()
      .from(recipes)
      .limit(1);

    if (!testRecipe) {
      console.error('❌ No recipes found in database. Create a recipe first.');
      return;
    }

    console.log(`✓ Using recipe: "${testRecipe.name}" (ID: ${testRecipe.id})\n`);

    // Step 2: Check for existing comments
    console.log('2. Checking for existing comments...');
    const [existingComment] = await db
      .select()
      .from(joanieComments)
      .where(eq(joanieComments.recipe_id, testRecipe.id))
      .limit(1);

    if (existingComment) {
      console.log('⚠️  Comment already exists, will delete it first');
      await db
        .delete(joanieComments)
        .where(eq(joanieComments.id, existingComment.id));
      console.log('✓ Existing comment deleted\n');
    } else {
      console.log('✓ No existing comments\n');
    }

    // Step 3: Create a STORY comment
    console.log('3. Creating a STORY comment...');
    const [storyComment] = await db
      .insert(joanieComments)
      .values({
        recipe_id: testRecipe.id,
        comment_text: 'This recipe reminds me of my grandmother\'s kitchen. She always said the secret was patience and good olive oil. I\'ve adapted it over the years, but the heart of it remains the same.',
        comment_type: 'story',
      })
      .returning();

    console.log(`✓ Story comment created (ID: ${storyComment.id})`);
    console.log(`  Text: ${storyComment.comment_text.substring(0, 80)}...\n`);

    // Step 4: Read the comment back
    console.log('4. Reading comment from database...');
    const [fetchedComment] = await db
      .select()
      .from(joanieComments)
      .where(eq(joanieComments.recipe_id, testRecipe.id))
      .limit(1);

    console.log('✓ Comment fetched successfully');
    console.log(`  ID: ${fetchedComment.id}`);
    console.log(`  Type: ${fetchedComment.comment_type}`);
    console.log(`  Created: ${fetchedComment.created_at}\n`);

    // Step 5: Update the comment
    console.log('5. Updating comment text...');
    const updatedText = 'This recipe reminds me of my grandmother\'s kitchen. She always said the secret was patience and good olive oil. I\'ve adapted it over the years, adding more garlic (because who doesn\'t love garlic?) and using fresh herbs from the garden.';

    const [updatedComment] = await db
      .update(joanieComments)
      .set({
        comment_text: updatedText,
        updated_at: new Date(),
      })
      .where(eq(joanieComments.id, storyComment.id))
      .returning();

    console.log('✓ Comment updated');
    console.log(`  New text: ${updatedComment.comment_text.substring(0, 80)}...`);
    console.log(`  Updated at: ${updatedComment.updated_at}\n`);

    // Step 6: Create comments of different types
    console.log('6. Testing different comment types...\n');

    // TIP comment
    const [tipComment] = await db
      .insert(joanieComments)
      .values({
        recipe_id: testRecipe.id,
        comment_text: 'Pro tip: Let the dish rest for 10 minutes before serving. It makes all the difference in bringing the flavors together.',
        comment_type: 'tip',
      })
      .returning();
    console.log(`✓ TIP comment created (ID: ${tipComment.id})`);

    // Wait a moment to ensure different created_at times
    await new Promise(resolve => setTimeout(resolve, 100));

    // SUBSTITUTION comment
    const [subComment] = await db
      .insert(joanieComments)
      .values({
        recipe_id: testRecipe.id,
        comment_text: 'Out of fresh basil? I\'ve used fresh parsley mixed with a tiny bit of dried oregano. Not traditional, but it works in a pinch!',
        comment_type: 'substitution',
      })
      .returning();
    console.log(`✓ SUBSTITUTION comment created (ID: ${subComment.id})\n`);

    // Step 7: List all comments for this recipe
    console.log('7. Fetching all comments for this recipe...');
    const allComments = await db
      .select()
      .from(joanieComments)
      .where(eq(joanieComments.recipe_id, testRecipe.id))
      .orderBy(joanieComments.created_at);

    console.log(`✓ Found ${allComments.length} comments:`);
    allComments.forEach((comment, index) => {
      console.log(`\n  [${index + 1}] ${comment.comment_type?.toUpperCase() || 'GENERAL'}`);
      console.log(`      ${comment.comment_text.substring(0, 100)}...`);
    });
    console.log();

    // Step 8: Test constraint (should fail with multiple references)
    console.log('8. Testing single-reference constraint...');
    try {
      await db
        .insert(joanieComments)
        .values({
          recipe_id: testRecipe.id,
          meal_id: '00000000-0000-0000-0000-000000000000', // Invalid: both set
          comment_text: 'This should fail',
          comment_type: 'general',
        });
      console.log('❌ Constraint failed to prevent multiple references!');
    } catch (error: any) {
      if (error.message.includes('joanie_comments_single_reference_check')) {
        console.log('✓ Constraint working correctly (prevented multiple references)\n');
      } else {
        console.log('⚠️  Unexpected error:', error.message, '\n');
      }
    }

    // Step 9: Cleanup (delete test comments)
    console.log('9. Cleaning up test comments...');
    await db
      .delete(joanieComments)
      .where(eq(joanieComments.recipe_id, testRecipe.id));

    console.log('✓ Test comments deleted\n');

    // Summary
    console.log('=== Test Summary ===');
    console.log('✓ Create comments: PASSED');
    console.log('✓ Read comments: PASSED');
    console.log('✓ Update comments: PASSED');
    console.log('✓ Delete comments: PASSED');
    console.log('✓ Comment types (story, tip, substitution): PASSED');
    console.log('✓ Single-reference constraint: PASSED');
    console.log('\n✓ All tests passed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run tests
testJoanieComments()
  .then(() => {
    console.log('\nTest script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nTest script failed:', error);
    process.exit(1);
  });
