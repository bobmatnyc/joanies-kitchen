#!/usr/bin/env tsx
/**
 * Add Joanie's Comment to Monday Night Crab Salad
 *
 * This script adds Joanie's authentic cooking story to the Monday Night Crab Salad recipe.
 *
 * The comment captures:
 * - The context (Monday night after grocery delivery)
 * - Ingredients on hand (crab meat, garden veggies, aging kale)
 * - The substitution (lime → rice wine vinegar)
 * - Why it worked (acidity cutting through rich mayo)
 *
 * Usage:
 *   pnpm tsx scripts/add-joanie-crab-salad-comment.ts
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes, joanieComments } from '@/lib/db/schema';

async function addJoanieCrabSaladComment() {
  console.log('Finding Monday Night Crab Salad recipe...');

  try {
    // Find the recipe by name
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(eq(recipes.name, 'Monday Night Crab Salad'))
      .limit(1);

    if (!recipe) {
      console.error('❌ Recipe not found: Monday Night Crab Salad');
      console.log('\nTry searching for it:');
      console.log('  psql $DATABASE_URL -c "SELECT id, name FROM recipes WHERE name ILIKE \'%crab%salad%\';"');
      return;
    }

    console.log(`✓ Found recipe: ${recipe.name} (ID: ${recipe.id})`);

    // Check if comment already exists
    const [existingComment] = await db
      .select()
      .from(joanieComments)
      .where(eq(joanieComments.recipe_id, recipe.id))
      .limit(1);

    if (existingComment) {
      console.log('\n⚠️  Comment already exists for this recipe');
      console.log('Current comment:');
      console.log(`  Type: ${existingComment.comment_type}`);
      console.log(`  Text: ${existingComment.comment_text.substring(0, 100)}...`);
      console.log('\nTo update, run the update script instead.');
      return;
    }

    // Add Joanie's comment
    console.log('\nAdding Joanie\'s comment...');

    const commentText = `Monday night after grocery delivery. Had some beautiful crab meat, peppers and spring onions from the garden, week-old kale that needed rescuing, and leftover sourdough. The kale was looking sad but I knew massaging it with lime and salt would bring it back to life. Ran out of lime halfway through dressing the salad (oops!) so I subbed sweet rice wine vinegar - honestly, it was brilliant. The acidity cut through the rich Kewpie mayo perfectly.`;

    const [comment] = await db
      .insert(joanieComments)
      .values({
        recipe_id: recipe.id,
        comment_text: commentText,
        comment_type: 'story',
      })
      .returning();

    console.log('✓ Comment added successfully!');
    console.log(`  Comment ID: ${comment.id}`);
    console.log(`  Type: ${comment.comment_type}`);
    console.log(`  Length: ${comment.comment_text.length} characters`);

    console.log('\n✓ Joanie\'s comment is now attached to Monday Night Crab Salad');
    console.log('\nTo view the comment on the recipe page:');
    console.log(`  http://localhost:3002/recipes/${recipe.id}`);

  } catch (error) {
    console.error('❌ Failed to add comment:', error);
    throw error;
  }
}

// Run script
addJoanieCrabSaladComment()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript failed:', error);
    process.exit(1);
  });
