#!/usr/bin/env tsx
/**
 * Add Dan Barber's Braised Short Ribs Recipe
 *
 * This script adds Dan Barber's signature braised short ribs recipe
 * as taught to Amanda Hesser of The New York Times.
 *
 * Recipe Attribution: Amanda Hesser / The New York Times
 * Chef: Dan Barber
 */

import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';

const sql = neon(process.env.DATABASE_URL!);

const DAN_BARBER_CHEF_ID = '7ba1f4c2-cfef-45bf-a9e3-ee3f99df80ae';

async function addBraisedShortRibs() {
  console.log('Adding Dan Barber\'s Braised Short Ribs recipe...\n');

  const recipeId = randomUUID();
  const slug = 'dan-barbers-braised-short-ribs';

  const ingredients = [
    '5 pounds beef short ribs, bone on',
    'Kosher salt',
    'Freshly ground black pepper (I like a coarse grind)',
    '1 tablespoon vegetable oil',
    '1 large onion chopped',
    '1 carrot, peeled and chopped',
    '1 celery rib, chopped',
    '2 garlic cloves, skin left on',
    '2 tablespoons light brown sugar',
    '1 tablespoon Worcestershire sauce',
    '1 tablespoon tamarind concentrate (comes in a jar; slightly thicker than ketchup) or paste (comes in a block)',
    '2 fresh (or dry) bay leaves',
    '1/2 cup Madeira',
    '1 cup red wine',
    '2 to 3 cups chicken broth',
  ];

  const instructions = [
    'Heat the oven to 225 degrees. Season the short ribs with salt and pepper. Heat a large heavy Dutch oven over medium high heat. Add the oil, then the short ribs (add them in batches, if necessary) and brown on all sides. Transfer the ribs to a plate as they finish browning. Pour off all but 1 tablespoon fat.',
    'Add the onion, carrot, celery, and garlic to the pot, reduce the heat to medium, and cook until the vegetables are soft and all the browned bits in the base of the pot have been loosened. Put the short ribs (and any juices that have collected on the plate) back in the pot.',
    'Add the light brown sugar, Worcestershire sauce, tamarind paste, and bay leaves. Pour in the Madeira and red wine. Add enough chicken broth to just cover the ribs. Bring the liquid to a boil, then cover the pot and transfer to the oven.',
    'Braise the shortribs until they are very tender when pierced with a fork, about 4 hours (longer if the short ribs are big). Using a slotted spoon, transfer the shortribs to a plate. Let the cooking liquid settle; spoon off as much fat as possible (ideally, you\'d do this over the course of two days and would, at this point, put the liquid in the fridge overnight and peel off the layer of fat in the morning). Set the pot on the stove over medium high heat. Bring the cooking liquid to a boil and reduce to a syrupy consistency.',
    'Lay a short rib or two in each of 4 wide shallow bowls. Spoon over a little sauce. Serve proudly.',
  ];

  const tags = [
    'beef',
    'short-ribs',
    'braised',
    'comfort-food',
    'dinner-party',
    'elegant',
    'fall',
    'winter',
    'slow-cooked',
    'dutch-oven',
    'wine-braised',
    'make-ahead',
  ];

  const description = `One evening, not long after I was married, my husband Tad and I hosted a dinner party at our apartment. I pulled one of my usual tricks back then, which was to cook five entirely new dishes rather than hedge my bets with a few known winners... Dan hopped into the kitchen, waved his skilled hand over the short ribs -- at least, that's how I remember it -- and managed to make them edible. A few weeks later, I asked him if he'd teach me how to properly braise a short rib. I spent a morning with him in Blue Hill's kitchen on Washington Place. Now I know how to braise.`;

  try {
    // Check if recipe already exists
    console.log('Checking for existing recipe...');
    const existingRecipe = await sql`
      SELECT id, name, slug FROM recipes WHERE slug = ${slug}
    `;

    if (existingRecipe.length > 0) {
      console.log('⚠️  Recipe already exists!');
      console.log(`   ID: ${existingRecipe[0].id}`);
      console.log(`   Name: ${existingRecipe[0].name}`);
      console.log(`   Slug: ${existingRecipe[0].slug}`);
      console.log('\nSkipping insertion. If you want to re-add this recipe, please delete it first.');
      return;
    }

    // Insert the recipe
    console.log('Inserting Braised Short Ribs recipe...');
    await sql`
      INSERT INTO recipes (
        id, user_id, chef_id, name, description, ingredients, instructions,
        prep_time, cook_time, servings, difficulty, cuisine, tags, source,
        is_public, is_system_recipe, license, slug, system_rating
      ) VALUES (
        ${recipeId},
        'system',
        ${DAN_BARBER_CHEF_ID},
        'Dan Barber''s Braised Short Ribs',
        ${description},
        ${JSON.stringify(ingredients)},
        ${JSON.stringify(instructions)},
        30,
        240,
        4,
        'medium',
        'American',
        ${JSON.stringify(tags)},
        'Amanda Hesser / The New York Times',
        true,
        true,
        'PUBLIC_DOMAIN',
        ${slug},
        4.7
      )
    `;
    console.log(`✓ Recipe inserted with ID: ${recipeId}`);
    console.log(`  Slug: ${slug}\n`);

    // Verify chef exists and update recipe count
    console.log('Verifying Dan Barber chef record...');
    const chefResult = await sql`
      SELECT id, name, slug, recipe_count FROM chefs WHERE id = ${DAN_BARBER_CHEF_ID}
    `;

    if (chefResult.length === 0) {
      console.warn('⚠️  WARNING: Dan Barber chef record not found!');
      console.warn('   Expected chef_id:', DAN_BARBER_CHEF_ID);
    } else {
      console.log(`✓ Chef found: ${chefResult[0].name} (${chefResult[0].slug})`);
      console.log(`  Current recipe_count: ${chefResult[0].recipe_count}`);

      // Count actual recipes for this chef
      const recipeCount = await sql`
        SELECT COUNT(*) as count FROM recipes WHERE chef_id = ${DAN_BARBER_CHEF_ID}
      `;
      console.log(`  Actual recipes in DB: ${recipeCount[0].count}`);

      // Update chef recipe count
      await sql`
        UPDATE chefs SET recipe_count = ${parseInt(recipeCount[0].count)} WHERE id = ${DAN_BARBER_CHEF_ID}
      `;
      console.log(`  ✓ Updated chef recipe_count to ${recipeCount[0].count}`);
    }

    console.log('\n✅ Successfully added Dan Barber\'s Braised Short Ribs!');
    console.log('\nRecipe URL:');
    console.log(`  /recipes/${slug}`);
    console.log(`\nChef profile: /chef/dan-barber`);
  } catch (error) {
    console.error('❌ Error adding recipe:', error);
    throw error;
  }
}

addBraisedShortRibs()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
