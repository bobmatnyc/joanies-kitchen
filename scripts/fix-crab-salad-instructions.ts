#!/usr/bin/env tsx
/**
 * Fix Crab Salad Instructions Format
 *
 * The recipe display component expects instructions as a simple array of strings,
 * not an array of objects. This script converts the instructions to the correct format.
 */

import { db } from '../src/lib/db/index';
import { recipes } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function fixInstructions() {
  console.log('🔧 Fixing Crab Salad Instructions Format...\n');

  const RECIPE_SLUG = 'joanies-monday-night-crab-salad-cheesy-tomato-melts';

  // New instructions as simple array of strings
  const instructions = [
    'Remove tough stems from kale and roughly chop. Place in a large bowl. Add lime juice and 1/2 teaspoon salt to kale. Massage vigorously with your hands for 2-3 minutes until kale is tender, darker green, and reduced in volume by about half. This technique works wonders on week-old kale! Set aside.',

    'Finely dice the peppers and slice the spring onions. Chop the cilantro.',

    'In a medium bowl, gently combine crab meat, Kewpie mayo, Dijon mustard, diced peppers, spring onions, cilantro, lime juice (or rice vinegar), Old Bay, salt, and black pepper. Mix gently to avoid breaking up the crab too much. Taste and adjust seasoning.',

    'Preheat broiler to high. Brush sourdough slices lightly with olive oil on both sides. Place on a baking sheet.',

    'Top each sourdough slice with tomato slices, salt, pepper, and 1-2 slices of aged cheddar.',

    'Broil for 3-5 minutes until cheese is melted and golden brown. Watch carefully - broilers are fast!',

    'On each plate, create a bed of massaged kale and mixed greens. Top with a generous scoop of crab salad. Garnish with pepitas.',

    'Serve crab salad alongside the hot cheesy tomato melts. The contrast of cool, fresh salad with warm, melty cheese is perfect.',
  ];

  // Update the recipe
  await db
    .update(recipes)
    .set({
      instructions: JSON.stringify(instructions),
      updated_at: new Date(),
    })
    .where(eq(recipes.slug, RECIPE_SLUG));

  console.log('✅ Instructions updated to simple string array format');
  console.log(`   Total steps: ${instructions.length}`);
  console.log('\n🎉 Recipe should now display correctly!');
}

fixInstructions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
