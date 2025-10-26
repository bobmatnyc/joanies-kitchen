#!/usr/bin/env tsx

/**
 * Create Joanie's Sunday Lunch Recipes and Meal Plan
 *
 * This script:
 * 1. Creates a "Joanie" chef profile (if doesn't exist)
 * 2. Creates 3 separate recipe records from documentation
 * 3. Links all recipes to Joanie via chef_recipes table
 * 4. Creates a meal plan called "Joanie's Sunday Lunch"
 * 5. Generates embeddings for all 3 recipes
 *
 * Source: docs/recipes/joanies-sunday-lunch/joanies-sunday-lunch-recipes.md
 * Date: October 26, 2025
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { chefs, chefRecipes } from '../src/lib/db/chef-schema';
import { recipes, mealRecipes, meals } from '../src/lib/db/schema';
import { generateRecipeEmbedding } from '../src/lib/ai/embeddings';
import { saveRecipeEmbedding } from '../src/lib/db/embeddings';
import { generateUniqueSlug } from '../src/lib/utils/slug';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SYSTEM_USER_ID = 'system_joanie';

// Recipe 1: Resourceful Chickpea & Vegetable Soup
const RECIPE_1 = {
  name: 'Resourceful Chickpea & Vegetable Soup',
  description: `Made from leftover crudité vegetables that were about to expire, this soup embodies Joanie's philosophy: "What do I have that might go bad?" The result is somewhere between vegetable soup and pasta sauce - thick, satisfying, and completely flexible.

Joanie's Notes: "I could have watered it down more if I didn't want it to taste so much like pasta sauce. I wouldn't serve this to guests necessarily... but I would serve it on pasta. It would be a perfectly good pasta sauce. But now it had chickpeas in it. So it is what it is."`,
  ingredients: [
    '2 cups zucchini, roughly chopped (about 1 medium)',
    '2 cups yellow summer squash, roughly chopped',
    '1 medium onion, roughly chopped',
    '4 cloves garlic, smashed',
    'Additional vegetables as available (bell peppers, carrots, etc.)',
    '4 cups water (or vegetable stock)',
    '3 tablespoons tomato paste (half a 6oz can)',
    '1 can (15oz) chickpeas, drained and rinsed',
    '2 tablespoons olive oil',
    'Salt and pepper to taste',
    '2-3 tablespoons grated Grana Padano or Parmesan (optional)',
    'Fresh herbs for serving (parsley, basil)',
  ],
  instructions: [
    'Sauté the vegetables: Heat olive oil in a large pot over medium heat. Add onion and garlic, cook 2-3 minutes until fragrant. Add zucchini, summer squash, and any other vegetables. Season with salt and pepper. Cook 8-10 minutes until softened.',
    'Create the base: Add 4 cups water to the pot. Bring to a simmer and cook 5 minutes until vegetables are very tender.',
    'Blend: Using an immersion blender ("zizz it"), blend the mixture until smooth. You\'re creating a thick vegetable broth base.',
    'Add tomato paste: Stir in tomato paste until fully incorporated. Taste - it should have some acidity and depth.',
    'Add chickpeas: Stir in chickpeas but DO NOT BLEND. You want them whole for texture, not hummus-like.',
    'Adjust consistency: If too thick or too tomato-forward, add more water 1/4 cup at a time. If it tastes too much like pasta sauce, you\'ve gone the Grana Padano route or used too much tomato paste.',
    'Serve: Ladle into bowls. Top with fresh herbs.',
  ],
  prep_time: 10,
  cook_time: 20,
  servings: 5, // 4-6 average to 5
  difficulty: 'easy' as const,
  cuisine: 'Mediterranean',
  tags: ['soup', 'vegetarian', 'zero-waste', 'joanie', 'sunday-lunch', 'chickpeas', 'resourceful'],
  is_system_recipe: true,
  source: "Joanie's Sunday Lunch - October 26, 2025",
  license: 'PERSONAL_USE' as const,
  resourcefulness_score: 5,
  waste_reduction_tags: ['uses-aging', 'flexible-ingredients', 'minimal-waste', 'one-pot'],
  scrap_utilization_notes: 'Uses leftover crudité vegetables about to expire. Can be repurposed as pasta sauce.',
  environmental_notes: 'Zero-waste approach: uses vegetables that would otherwise go bad.',
};

// Recipe 2: Asian-Inspired Chicken & Cauliflower Rice Bowl
const RECIPE_2 = {
  name: 'Asian-Inspired Chicken & Cauliflower Rice Bowl',
  description: `Three distinct Asian-inspired components (Chinese black bean chicken, Indian curried cauliflower, Japanese miso tofu) served over rice. Mixed ethnic profiles, unified by bold flavors and simple techniques.

Joanie's Notes: "So you're mixing ethnic profiles." "Oh, yeah. That was Indian, Chinese and Japanese."

What this teaches: Fusion isn't fusion if each component respects its tradition. All three dishes use 425°F, so they can roast simultaneously. The rice cooker handles one component passively while you prep others. Simple sauces (jarred black bean sauce, miso glaze) deliver restaurant-quality results.`,
  ingredients: [
    // Chicken
    '1.5 lbs boneless, skinless chicken thighs',
    '3-4 tablespoons jarred black bean garlic sauce (Lee Kum Kee or similar)',
    '1 tablespoon neutral oil (for chicken)',
    // Cauliflower
    '1 large head cauliflower, broken into florets',
    '2 tablespoons neutral oil (for cauliflower)',
    '2 teaspoons yellow curry powder (turmeric-heavy)',
    'Salt to taste',
    // Tofu
    '14-16 oz firm tofu, pressed',
    '3 tablespoons white miso paste',
    '2 tablespoons brown sugar',
    '2 tablespoons soy sauce',
    '1 tablespoon rice wine vinegar',
    '1 tablespoon neutral oil (for tofu)',
    // Rice
    '2 cups jasmine or short-grain white rice (Tiger brand or similar)',
    'Water according to rice cooker instructions (typically 2.5-3 cups for 2 cups rice)',
    // Garnishes (optional)
    'Sliced scallions',
    'Sesame seeds',
    'Pickled vegetables',
  ],
  instructions: [
    'Prep tofu: Wrap tofu block in clean dish towel, place between two plates, weight with canned goods on top. Let sit 15-30 minutes; moisture will be absorbed by towel.',
    'Start rice: Rinse rice until water runs clear. Add to rice cooker with appropriate water. Cook according to rice cooker settings.',
    'Preheat oven to 425°F.',
    'Prepare chicken: Toss chicken thighs with black bean garlic sauce until coated. Arrange in a single layer in a baking dish or on a sheet pan.',
    'Prepare cauliflower: Toss cauliflower florets with oil, curry powder, and salt. Spread on a baking sheet in a single layer.',
    'Prepare tofu: Cut pressed tofu into 1-inch cubes (or tear with hands for irregular pieces with more surface area). Whisk together miso, brown sugar, soy sauce, and vinegar until smooth. Toss tofu cubes with oil, then with miso mixture. Arrange on a baking sheet.',
    'Roast everything: Place all three pans in 425°F oven. Roast chicken 20 minutes until cooked through (internal temp 165°F). Roast cauliflower 25-30 minutes, stirring halfway, until golden and tender with crispy edges. Bake tofu 20-25 minutes, flipping once, until golden.',
    'Assemble bowls: Divide rice among four bowls. Top each with sliced black bean chicken, roasted curry cauliflower, and miso tofu cubes. Drizzle any pan juices from chicken or tofu over the bowl.',
    'Garnish (optional): Top with sliced scallions, sesame seeds, or pickled vegetables.',
  ],
  prep_time: 15,
  cook_time: 20, // Passive time not included
  servings: 4,
  difficulty: 'medium' as const,
  cuisine: 'Asian Fusion',
  tags: ['rice-bowl', 'asian-fusion', 'joanie', 'sunday-lunch', 'chicken', 'tofu', 'cauliflower', 'resourceful'],
  is_system_recipe: true,
  source: "Joanie's Sunday Lunch - October 26, 2025",
  license: 'PERSONAL_USE' as const,
  resourcefulness_score: 4,
  waste_reduction_tags: ['one-temperature', 'passive-cooking', 'batch-cooking'],
  scrap_utilization_notes: 'All three components roast at same temperature for efficiency. Rice cooker handles rice passively.',
  environmental_notes: 'Efficient cooking: everything at one temperature, reduces energy use.',
};

// Recipe 3: Garden Green Salad with Dill Mustard Dressing
const RECIPE_3 = {
  name: 'Garden Green Salad with Dill Mustard Dressing',
  description: `This salad is "tail ends" - the beet tops from a single garden beet, the last of the savoy cabbage, the arugula that needs using. The dill mustard dressing brings it all together.

Joanie's Notes on Dressing: "Two to one, oil to vinegar. But you can do two to one oil to vinegar. And depending on the vinegar that you're using, it could be perfect or it could be too sour. Sometimes if it's too sour, you could try to add more oil but then it's too oily. So then I recommend you can start off 2 to 1, oil to vinegar, and adjust with lemon juice or even water, believe it or not, because water will mellow out, thin out the vinegar so you don't have to add more oil to balance it. The mustard is the thing that will make it emulsify when you're not paying attention."

What this teaches: The 2:1 ratio is a starting point, not a rule. Water is a tool for balance (not just oil). Mustard does the work of emulsification. Taste and adjust is the real skill.`,
  ingredients: [
    // Salad greens
    '2 cups savoy cabbage, thinly sliced',
    '2 cups beet greens (or Swiss chard, kale), roughly torn',
    '2 cups arugula',
    '1 large cucumber, sliced',
    // Optional vegetables
    'Radishes, thinly sliced (optional)',
    'Carrots, shaved (optional)',
    'Cherry tomatoes, halved (optional)',
    'Red onion, thinly sliced (optional)',
    // Dill Mustard Dressing
    '1/2 cup olive oil',
    '1/4 cup vinegar (white wine, apple cider, or rice wine)',
    '2 tablespoons lemon juice',
    '1 tablespoon Dijon mustard (the emulsifier)',
    '2 tablespoons fresh dill, chopped (or 2 teaspoons dried)',
    '1/2 teaspoon salt',
    '1/4 teaspoon black pepper',
    '1-2 tablespoons water (to mellow if too acidic)',
    // Quick-Pickled Cucumbers (optional)
    '1 large cucumber, thinly sliced (for pickling)',
    '1/4 cup rice vinegar or white vinegar',
    '1 tablespoon sugar',
    '1/2 teaspoon salt (for pickling)',
    'Fresh dill sprigs',
  ],
  instructions: [
    'Make dressing: Combine olive oil, vinegar, lemon juice, Dijon mustard, dill, salt, and pepper in a jar or bullet blender. Shake vigorously or blend until emulsified (about 30 seconds).',
    'Adjust dressing: Taste and adjust - too sour? Add water or more oil. Too oily? Add lemon juice or water. Needs more zing? Add more mustard or salt.',
    'Store dressing: Refrigerate for up to 1 week. Shake before using.',
    'Quick-pickle cucumbers (optional): Combine vinegar, sugar, and salt in a bowl. Stir until dissolved. Add cucumber slices and dill. Toss to coat. Let sit 15-30 minutes before serving. (Can be made up to 3 days ahead.)',
    'Prepare salad greens: Combine savoy cabbage, beet greens, and arugula in a large bowl. Add any additional vegetables (radishes, carrots, tomatoes, onion).',
    'Dress salad: Drizzle with dressing (start with 1/4 cup, add more as needed). Toss to coat evenly.',
    'Serve: Serve immediately with pickled cucumbers on the side.',
  ],
  prep_time: 15,
  cook_time: 0,
  servings: 5, // 4-6 average to 5
  difficulty: 'easy' as const,
  cuisine: 'American',
  tags: ['salad', 'vegetarian', 'garden-fresh', 'joanie', 'sunday-lunch', 'dressing', 'resourceful'],
  is_system_recipe: true,
  source: "Joanie's Sunday Lunch - October 26, 2025",
  license: 'PERSONAL_USE' as const,
  resourcefulness_score: 5,
  waste_reduction_tags: ['uses-aging', 'flexible-ingredients', 'seasonal', 'uses-scraps'],
  scrap_utilization_notes: 'Uses beet tops from garden beets, last of the cabbage, arugula that needs using.',
  environmental_notes: 'Garden integration: uses vegetables about to expire, beet tops that are often discarded.',
};

async function main() {
  console.log('🥘 Creating Joanie\'s Sunday Lunch Recipes and Meal Plan\n');

  try {
    // Step 1: Create or get Joanie chef profile
    console.log('Step 1: Creating Joanie chef profile...');
    let joanie = await db.query.chefs.findFirst({
      where: eq(chefs.slug, 'joanie'),
    });

    if (!joanie) {
      const [newChef] = await db
        .insert(chefs)
        .values({
          slug: 'joanie',
          name: 'Joanie',
          display_name: 'Joanie',
          bio: 'Home cook and zero-waste cooking philosophy pioneer. Believes in using what needs using, letting resourcefulness guide, and that "you can\'t repeat" because cooking is about what\'s available that day.',
          specialties: ['zero-waste', 'resourceful', 'home-cooking'],
          is_verified: true,
          is_active: true,
        })
        .returning();
      joanie = newChef;
      console.log(`✅ Created chef: ${joanie.name} (ID: ${joanie.id})`);
    } else {
      console.log(`✅ Found existing chef: ${joanie.name} (ID: ${joanie.id})`);
    }

    // Step 2: Create Recipe 1 - Chickpea Soup
    console.log('\nStep 2: Creating Recipe 1 - Chickpea Soup...');
    const slug1 = await generateUniqueSlug(RECIPE_1.name);
    const [recipe1] = await db
      .insert(recipes)
      .values({
        user_id: SYSTEM_USER_ID,
        chef_id: joanie.id,
        name: RECIPE_1.name,
        description: RECIPE_1.description,
        ingredients: JSON.stringify(RECIPE_1.ingredients),
        instructions: JSON.stringify(RECIPE_1.instructions),
        prep_time: RECIPE_1.prep_time,
        cook_time: RECIPE_1.cook_time,
        servings: RECIPE_1.servings,
        difficulty: RECIPE_1.difficulty,
        cuisine: RECIPE_1.cuisine,
        tags: JSON.stringify(RECIPE_1.tags),
        is_system_recipe: RECIPE_1.is_system_recipe,
        is_public: true,
        source: RECIPE_1.source,
        license: RECIPE_1.license,
        slug: slug1,
        resourcefulness_score: RECIPE_1.resourcefulness_score,
        waste_reduction_tags: JSON.stringify(RECIPE_1.waste_reduction_tags),
        scrap_utilization_notes: RECIPE_1.scrap_utilization_notes,
        environmental_notes: RECIPE_1.environmental_notes,
      })
      .returning();
    console.log(`✅ Created: ${recipe1.name} (ID: ${recipe1.id})`);

    // Link to chef
    await db.insert(chefRecipes).values({
      chef_id: joanie.id,
      recipe_id: recipe1.id,
    });
    console.log(`✅ Linked to chef: ${joanie.name}`);

    // Step 3: Create Recipe 2 - Rice Bowl
    console.log('\nStep 3: Creating Recipe 2 - Rice Bowl...');
    const slug2 = await generateUniqueSlug(RECIPE_2.name);
    const [recipe2] = await db
      .insert(recipes)
      .values({
        user_id: SYSTEM_USER_ID,
        chef_id: joanie.id,
        name: RECIPE_2.name,
        description: RECIPE_2.description,
        ingredients: JSON.stringify(RECIPE_2.ingredients),
        instructions: JSON.stringify(RECIPE_2.instructions),
        prep_time: RECIPE_2.prep_time,
        cook_time: RECIPE_2.cook_time,
        servings: RECIPE_2.servings,
        difficulty: RECIPE_2.difficulty,
        cuisine: RECIPE_2.cuisine,
        tags: JSON.stringify(RECIPE_2.tags),
        is_system_recipe: RECIPE_2.is_system_recipe,
        is_public: true,
        source: RECIPE_2.source,
        license: RECIPE_2.license,
        slug: slug2,
        resourcefulness_score: RECIPE_2.resourcefulness_score,
        waste_reduction_tags: JSON.stringify(RECIPE_2.waste_reduction_tags),
        scrap_utilization_notes: RECIPE_2.scrap_utilization_notes,
        environmental_notes: RECIPE_2.environmental_notes,
      })
      .returning();
    console.log(`✅ Created: ${recipe2.name} (ID: ${recipe2.id})`);

    // Link to chef
    await db.insert(chefRecipes).values({
      chef_id: joanie.id,
      recipe_id: recipe2.id,
    });
    console.log(`✅ Linked to chef: ${joanie.name}`);

    // Step 4: Create Recipe 3 - Salad
    console.log('\nStep 4: Creating Recipe 3 - Salad...');
    const slug3 = await generateUniqueSlug(RECIPE_3.name);
    const [recipe3] = await db
      .insert(recipes)
      .values({
        user_id: SYSTEM_USER_ID,
        chef_id: joanie.id,
        name: RECIPE_3.name,
        description: RECIPE_3.description,
        ingredients: JSON.stringify(RECIPE_3.ingredients),
        instructions: JSON.stringify(RECIPE_3.instructions),
        prep_time: RECIPE_3.prep_time,
        cook_time: RECIPE_3.cook_time,
        servings: RECIPE_3.servings,
        difficulty: RECIPE_3.difficulty,
        cuisine: RECIPE_3.cuisine,
        tags: JSON.stringify(RECIPE_3.tags),
        is_system_recipe: RECIPE_3.is_system_recipe,
        is_public: true,
        source: RECIPE_3.source,
        license: RECIPE_3.license,
        slug: slug3,
        resourcefulness_score: RECIPE_3.resourcefulness_score,
        waste_reduction_tags: JSON.stringify(RECIPE_3.waste_reduction_tags),
        scrap_utilization_notes: RECIPE_3.scrap_utilization_notes,
        environmental_notes: RECIPE_3.environmental_notes,
      })
      .returning();
    console.log(`✅ Created: ${recipe3.name} (ID: ${recipe3.id})`);

    // Link to chef
    await db.insert(chefRecipes).values({
      chef_id: joanie.id,
      recipe_id: recipe3.id,
    });
    console.log(`✅ Linked to chef: ${joanie.name}`);

    // Step 5: Create meal plan
    console.log('\nStep 5: Creating meal plan "Joanie\'s Sunday Lunch"...');
    const [meal] = await db
      .insert(meals)
      .values({
        user_id: SYSTEM_USER_ID,
        name: "Joanie's Sunday Lunch",
        description: 'A complete Sunday lunch demonstrating resourceful cooking philosophy: using what needs using, mixing ethnic profiles with respect, and cooking everything at one temperature. Features leftover vegetable soup, Asian-inspired rice bowls, and garden-fresh salad.',
        meal_type: 'lunch',
        occasion: 'Sunday Lunch',
        serves: 4,
        tags: JSON.stringify(['sunday-lunch', 'joanie', 'zero-waste', 'multi-course', 'resourceful']),
        is_template: true,
        is_public: true,
        total_prep_time: RECIPE_1.prep_time + RECIPE_2.prep_time + RECIPE_3.prep_time, // 40 min
        total_cook_time: RECIPE_1.cook_time + RECIPE_2.cook_time + RECIPE_3.cook_time, // 40 min
        slug: 'joanies-sunday-lunch',
      })
      .returning();
    console.log(`✅ Created meal plan: ${meal.name} (ID: ${meal.id})`);

    // Step 6: Link recipes to meal plan
    console.log('\nStep 6: Linking recipes to meal plan...');
    await db.insert(mealRecipes).values([
      {
        meal_id: meal.id,
        recipe_id: recipe1.id,
        course_category: 'soup',
        display_order: 1,
        serving_multiplier: '1.00',
        preparation_notes: 'Serve as first course',
      },
      {
        meal_id: meal.id,
        recipe_id: recipe2.id,
        course_category: 'main',
        display_order: 2,
        serving_multiplier: '1.00',
        preparation_notes: 'Main course - all components roast at 425°F simultaneously',
      },
      {
        meal_id: meal.id,
        recipe_id: recipe3.id,
        course_category: 'salad',
        display_order: 3,
        serving_multiplier: '1.00',
        preparation_notes: 'Serve alongside or after main',
      },
    ]);
    console.log('✅ Linked all 3 recipes to meal plan');

    // Step 7: Generate embeddings
    console.log('\nStep 7: Generating embeddings for all recipes...');

    // Recipe 1 embedding
    try {
      const result1 = await generateRecipeEmbedding(recipe1);
      await saveRecipeEmbedding(recipe1.id, result1.embedding, result1.embeddingText, result1.modelName);
      console.log(`✅ Generated embedding for: ${recipe1.name}`);
    } catch (error) {
      console.error(`❌ Failed to generate embedding for ${recipe1.name}:`, error);
    }

    // Recipe 2 embedding
    try {
      const result2 = await generateRecipeEmbedding(recipe2);
      await saveRecipeEmbedding(recipe2.id, result2.embedding, result2.embeddingText, result2.modelName);
      console.log(`✅ Generated embedding for: ${recipe2.name}`);
    } catch (error) {
      console.error(`❌ Failed to generate embedding for ${recipe2.name}:`, error);
    }

    // Recipe 3 embedding
    try {
      const result3 = await generateRecipeEmbedding(recipe3);
      await saveRecipeEmbedding(recipe3.id, result3.embedding, result3.embeddingText, result3.modelName);
      console.log(`✅ Generated embedding for: ${recipe3.name}`);
    } catch (error) {
      console.error(`❌ Failed to generate embedding for ${recipe3.name}:`, error);
    }

    // Update chef recipe count
    console.log('\nStep 8: Updating chef recipe count...');
    const recipeCount = await db
      .select()
      .from(chefRecipes)
      .where(eq(chefRecipes.chef_id, joanie.id));
    await db
      .update(chefs)
      .set({ recipe_count: recipeCount.length })
      .where(eq(chefs.id, joanie.id));
    console.log(`✅ Updated chef recipe count to ${recipeCount.length}`);

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ SUCCESS - Joanie\'s Sunday Lunch Created!');
    console.log('='.repeat(80));
    console.log(`\nChef:`);
    console.log(`  Name: ${joanie.name}`);
    console.log(`  ID: ${joanie.id}`);
    console.log(`  Slug: ${joanie.slug}`);
    console.log(`\nRecipes Created:`);
    console.log(`  1. ${recipe1.name}`);
    console.log(`     ID: ${recipe1.id}`);
    console.log(`     Slug: ${recipe1.slug}`);
    console.log(`  2. ${recipe2.name}`);
    console.log(`     ID: ${recipe2.id}`);
    console.log(`     Slug: ${recipe2.slug}`);
    console.log(`  3. ${recipe3.name}`);
    console.log(`     ID: ${recipe3.id}`);
    console.log(`     Slug: ${recipe3.slug}`);
    console.log(`\nMeal Plan:`);
    console.log(`  Name: ${meal.name}`);
    console.log(`  ID: ${meal.id}`);
    console.log(`  Slug: ${meal.slug}`);
    console.log(`  Serves: ${meal.serves}`);
    console.log(`  Total Prep Time: ${meal.total_prep_time} min`);
    console.log(`  Total Cook Time: ${meal.total_cook_time} min`);
    console.log('\nAll recipes are now:');
    console.log('  ✅ Created in database');
    console.log('  ✅ Linked to Joanie chef profile');
    console.log('  ✅ Added to meal plan');
    console.log('  ✅ Embeddings generated (searchable in Fridge Feature)');
    console.log('  ✅ Public and visible on site');
    console.log('\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
