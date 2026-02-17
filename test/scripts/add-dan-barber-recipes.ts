import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';

const sql = neon(process.env.DATABASE_URL!);

const DAN_BARBER_CHEF_ID = '7ba1f4c2-cfef-45bf-a9e3-ee3f99df80ae';

async function addDanBarberRecipes() {
  console.log('Adding Dan Barber recipes...\n');

  // Recipe 1: Kale and White Bean Stew
  const recipe1Id = randomUUID();
  const recipe1Slug = 'kale-white-bean-stew';
  const recipe1Ingredients = [
    '1 bunch lacinato (Tuscan) kale (about 1 pound)',
    '4 tablespoons extra virgin olive oil, divided',
    '1 large carrot, peeled and finely chopped',
    '1 celery stalk, finely chopped',
    '2 medium shallots, finely chopped',
    '4 garlic cloves, sliced',
    '1/2 cup dry white wine',
    '3 cups cooked white beans (or two 15-ounce cans, drained and rinsed)',
    '4 cups chicken or vegetable broth',
    '2 sprigs fresh thyme',
    '1 bay leaf',
    '2 teaspoons sherry vinegar',
    'Chopped fresh herbs (parsley, chives) for serving',
  ];
  const recipe1Instructions = [
    'Strip the kale leaves from the stems. Chop the stems into small pieces and roughly chop the leaves, keeping them separate. Heat 2 tablespoons olive oil in a large pot over medium heat. Add the carrots, celery, shallots, and chopped kale stems. Cook, stirring occasionally, until softened, about 8 minutes. Add the garlic and cook 1 minute more. Add the wine and simmer until reduced by half, about 3 minutes.',
    'Add the beans, broth, thyme, and bay leaf. Bring to a boil, then reduce heat and simmer for 15 minutes. Add the kale leaves and cook until tender, about 10 minutes. Remove thyme sprigs and bay leaf. Stir in the vinegar and remaining 2 tablespoons olive oil. Season with salt and pepper. Serve garnished with fresh herbs.',
  ];
  const recipe1Tags = [
    'stew',
    'soup',
    'vegetarian',
    'vegan',
    'dairy-free',
    'gluten-free',
    'nut-free',
    'one-pot',
    'weeknight',
    'fall',
    'winter',
  ];

  // Recipe 2: Zucchini Carbonara
  const recipe2Id = randomUUID();
  const recipe2Slug = 'zucchini-carbonara';
  const recipe2Ingredients = [
    '3 lbs medium to large zucchini',
    '1 1/4 cups heavy cream',
    '1 small garlic clove, finely minced',
    '1 shallot',
    '3 tablespoons extra virgin olive oil',
    '2 thick cut slices of bacon (about 5 oz)',
    '4 egg yolks',
    '1/2 teaspoon Sherry or Red Wine Vinegar',
    '1 Tablespoon finely grated Parmigiano Reggiano, plus more for grating over the finished plate',
    'Salt and pepper',
  ];
  const recipe2Instructions = [
    'Cut about 1/2-3/4 inch off the zucchini ends and reserve. Using a mandolin, carefully slice the zucchini lengthwise into "noodles," slicing all the way down the core until you reach the seeds. You should end up with approximately 7-8 cups of zucchini "noodles". Reserve the cores. In a small pot, cook the heavy cream and small garlic clove over low heat until reduced by half. Reserve the cream and set aside.',
    'Cut the 2 slices of bacon into 6 equal-size pieces each. In a medium sauté pan, heat 1 tablespoon of oil over medium flame. Add the 12 small pieces of bacon and render until crispy, about 4 minutes per side. Remove from the heat, drain the crispy bacon on a plate lined with a paper towel, and reserve the rendered bacon fat.',
    'Heat a small pot of water very gently to 100˚F. Remove from the heat and gently add the egg yolks to the water. Allow to sit and poach in the warm water until ready to use.',
    'Heat the remaining 2 tablespoons of oil in a large sauté pan over medium heat. Add the chopped shallot and sauté for 1 minute. Add the julienned zucchini and increase the heat to high. Saute for 3 minutes, seasoning very well with salt and pepper. Add the reduced heavy cream and vinegar and stir to combine. Stir in the Parmigiano Reggiano cheese and a generous grinding of fresh pepper.',
    'Divide the zucchini equally among 4 bowls. Using a slotted spoon, gently place 1 egg yolk on top of each mound of zucchini and arrange 3 pieces of crispy bacon per bowl. Top with a generous grating of cheese.',
  ];
  const recipe2Tags = [
    'pasta',
    'italian',
    'carbonara',
    'zucchini',
    'summer',
    'bacon',
    'eggs',
    'low-carb',
    'keto-friendly',
    'elegant',
    'dinner-party',
  ];

  try {
    // Insert Recipe 1: Kale and White Bean Stew
    console.log('Inserting Recipe 1: Kale and White Bean Stew...');
    await sql`
      INSERT INTO recipes (
        id, user_id, chef_id, name, description, ingredients, instructions,
        prep_time, cook_time, servings, difficulty, cuisine, tags, source,
        is_public, is_system_recipe, license, slug, system_rating
      ) VALUES (
        ${recipe1Id},
        'system',
        ${DAN_BARBER_CHEF_ID},
        'Kale and White Bean Stew',
        'A hearty vegetarian stew featuring lacinato kale and creamy white beans in a flavorful broth. Perfect for fall and winter meals.',
        ${JSON.stringify(recipe1Ingredients)},
        ${JSON.stringify(recipe1Instructions)},
        25,
        45,
        6,
        'easy',
        'American',
        ${JSON.stringify(recipe1Tags)},
        'https://www.epicurious.com/recipes/food/views/kale-and-white-bean-stew-351254',
        true,
        true,
        'PUBLIC_DOMAIN',
        ${recipe1Slug},
        4.2
      )
    `;
    console.log(`✓ Recipe 1 inserted with ID: ${recipe1Id}`);
    console.log(`  Slug: ${recipe1Slug}\n`);

    // Insert Recipe 2: Zucchini Carbonara
    console.log('Inserting Recipe 2: Zucchini Carbonara...');
    await sql`
      INSERT INTO recipes (
        id, user_id, chef_id, name, description, ingredients, instructions,
        prep_time, cook_time, servings, difficulty, cuisine, tags, source,
        is_public, is_system_recipe, license, slug
      ) VALUES (
        ${recipe2Id},
        'system',
        ${DAN_BARBER_CHEF_ID},
        'Zucchini Carbonara',
        'An innovative twist on classic carbonara using zucchini "noodles" instead of pasta. A low-carb, elegant dish perfect for summer dinner parties.',
        ${JSON.stringify(recipe2Ingredients)},
        ${JSON.stringify(recipe2Instructions)},
        20,
        15,
        4,
        'medium',
        'Italian-American',
        ${JSON.stringify(recipe2Tags)},
        'Dan Barber',
        true,
        true,
        'PUBLIC_DOMAIN',
        ${recipe2Slug}
      )
    `;
    console.log(`✓ Recipe 2 inserted with ID: ${recipe2Id}`);
    console.log(`  Slug: ${recipe2Slug}\n`);

    // Verify chef exists and update recipe count
    console.log('Verifying Dan Barber chef record...');
    const chefResult = await sql`
      SELECT id, name, slug, recipe_count FROM chefs WHERE id = ${DAN_BARBER_CHEF_ID}
    `;

    if (chefResult.length === 0) {
      console.warn('⚠ WARNING: Dan Barber chef record not found!');
      console.warn('  Expected chef_id:', DAN_BARBER_CHEF_ID);
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

    console.log('\n✅ Successfully added both Dan Barber recipes!');
    console.log('\nRecipe URLs:');
    console.log(`  1. /recipes/${recipe1Slug}`);
    console.log(`  2. /recipes/${recipe2Slug}`);
    console.log(`\nChef profile: /chef/dan-barber`);
  } catch (error) {
    console.error('❌ Error adding recipes:', error);
    throw error;
  }
}

addDanBarberRecipes()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
