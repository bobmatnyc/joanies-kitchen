#!/usr/bin/env tsx
/**
 * Add Joanie's First Recipe: Monday Night Crab Salad
 *
 * This script adds the inaugural "Joanie's Kitchen" recipe:
 * - Crab Salad with Kewpie Mayo
 * - Cheesy Tomato Melts on Sourdough
 * - Week-old kale massaged with lime and salt
 *
 * Recipe showcases Joanie's resourceful cooking philosophy:
 * - Using garden vegetables (peppers, spring onions, cilantro, tomatoes)
 * - Rescuing week-old kale
 * - Repurposing leftover sourdough
 * - Making substitutions work (rice vinegar when out of lime)
 */

import { db } from '@/lib/db/index';
import { recipes } from '@/lib/db/schema';
import { generateUniqueSlug } from '@/lib/utils/slug';

async function addJoaniesCrabSalad() {
  console.log('🦀 Adding Joanie\'s First Recipe: Monday Night Crab Salad\n');

  // Get the authenticated user ID (Joanie's account)
  // For now, we'll use a placeholder - in production this would be Joanie's actual Clerk user_id
  const JOANIES_USER_ID = 'user_joanie'; // Replace with actual Clerk user ID

  const recipeData = {
    user_id: JOANIES_USER_ID,
    name: 'Joanie\'s Monday Night Crab Salad with Cheesy Tomato Melts',
    description: `A resourceful dinner born from what's on hand: fresh crab meat dressed with Kewpie mayo and garden vegetables, served over massaged week-old kale, alongside broiled sourdough with melted aged cheddar. This recipe exemplifies Joanie's Kitchen philosophy: use what you have, waste nothing, and turn simple ingredients into something special.

**Joanie's Story**: "Monday night after grocery delivery. Had some beautiful crab meat, peppers and spring onions from the garden, week-old kale that needed rescuing, and leftover sourdough. The kale was looking sad but I knew massaging it with lime and salt would bring it back to life. Ran out of lime halfway through dressing the salad (oops!) so I subbed sweet rice wine vinegar - honestly, it was brilliant. The acidity cut through the rich Kewpie mayo perfectly."`,

    ingredients: JSON.stringify([
      // Crab Salad
      '1 lb fresh crab meat (lump or claw)',
      '3-4 tablespoons Kewpie mayonnaise',
      '1 teaspoon Dijon mustard',
      '2 small peppers (garden fresh), finely diced',
      '3-4 spring onions, finely sliced',
      '2 tablespoons fresh cilantro, chopped',
      '1 lime, juiced (or substitute sweet rice wine vinegar)',
      'Salt and black pepper to taste',
      '1/2 teaspoon Old Bay seasoning',
      'Pepitas (pumpkin seeds) for garnish',

      // Salad Base
      '1 bunch kale (week-old is fine!), stems removed and roughly chopped',
      '1/2 lime, juiced',
      '1/2 teaspoon salt (for massaging kale)',
      '2 cups mixed salad greens',
      '1 ripe tomato, sliced',

      // Cheesy Tomato Melts
      '4 slices sourdough bread (day-old or fresh)',
      '1 large tomato, sliced',
      '4-6 slices aged cheddar cheese',
      'Salt and black pepper',
      'Olive oil for brushing'
    ]),

    instructions: JSON.stringify([
      // Prepare the Kale
      {
        step: 'Rescue the kale',
        description: 'Remove tough stems from kale and roughly chop. Place in a large bowl.'
      },
      {
        step: 'Massage the kale',
        description: 'Add lime juice and 1/2 teaspoon salt to kale. Massage vigorously with your hands for 2-3 minutes until kale is tender, darker green, and reduced in volume by about half. This technique works wonders on week-old kale! Set aside.'
      },

      // Make Crab Salad
      {
        step: 'Prep the vegetables',
        description: 'Finely dice the peppers and slice the spring onions. Chop the cilantro.'
      },
      {
        step: 'Mix crab salad',
        description: 'In a medium bowl, gently combine crab meat, Kewpie mayo, Dijon mustard, diced peppers, spring onions, cilantro, lime juice (or rice vinegar), Old Bay, salt, and black pepper. Mix gently to avoid breaking up the crab too much. Taste and adjust seasoning.'
      },

      // Assemble Tomato Melts
      {
        step: 'Prepare sourdough',
        description: 'Preheat broiler to high. Brush sourdough slices lightly with olive oil on both sides. Place on a baking sheet.'
      },
      {
        step: 'Build the melts',
        description: 'Top each sourdough slice with tomato slices, salt, pepper, and 1-2 slices of aged cheddar.'
      },
      {
        step: 'Broil until bubbly',
        description: 'Broil for 3-5 minutes until cheese is melted and golden brown. Watch carefully - broilers are fast!'
      },

      // Plate and Serve
      {
        step: 'Assemble the salad',
        description: 'On each plate, create a bed of massaged kale and mixed greens. Top with a generous scoop of crab salad. Garnish with pepitas.'
      },
      {
        step: 'Serve',
        description: 'Serve crab salad alongside the hot cheesy tomato melts. The contrast of cool, fresh salad with warm, melty cheese is perfect.'
      }
    ]),

    prep_time: 20,
    cook_time: 5,
    servings: 2,
    difficulty: 'easy' as const,
    cuisine: 'American',

    tags: JSON.stringify([
      'zero-waste',
      'resourceful-cooking',
      'garden-vegetables',
      'seafood',
      'rescue-ingredients',
      'quick-dinner',
      'joanies-kitchen',
      'kale',
      'crab',
      'salad',
      'substitutions-friendly'
    ]),

    images: JSON.stringify([
      '/images/recipes/joanie-crab-salad.jpg' // Will upload actual image
    ]),

    is_ai_generated: false, // This is a real Joanie recipe!
    is_public: true,
    is_system_recipe: true, // Featured as a Joanie's Kitchen original

    source: 'Joanie\'s Kitchen - Original Recipe',

    // Resourcefulness scoring
    system_rating: '4.8',
    system_rating_reason: 'Excellent example of resourceful cooking: rescues week-old kale, uses garden vegetables, repurposes leftover bread, demonstrates successful ingredient substitution (rice vinegar for lime)',

    // Zero-waste metadata
    nutrition_info: JSON.stringify({
      calories: 420,
      protein: '28g',
      carbs: '35g',
      fat: '18g',
      fiber: '4g',
      notes: 'High in protein from crab, good source of vitamins A and C from kale and peppers'
    })
  };

  try {
    // Generate slug
    const slug = await generateUniqueSlug(recipeData.name);

    // Insert recipe
    const result = await db.insert(recipes).values({
      ...recipeData,
      slug
    }).returning();

    console.log('✅ Recipe added successfully!');
    console.log('\nRecipe Details:');
    console.log(`ID: ${result[0].id}`);
    console.log(`Slug: ${result[0].slug}`);
    console.log(`Name: ${result[0].name}`);
    console.log(`URL: /recipes/${result[0].slug}`);
    console.log('\n🎉 Joanie\'s first recipe is now in the database!');

    return result[0];
  } catch (error) {
    console.error('❌ Error adding recipe:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addJoaniesCrabSalad()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { addJoaniesCrabSalad };
