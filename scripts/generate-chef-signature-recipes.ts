#!/usr/bin/env tsx
/**
 * Generate signature recipes for each famous chef
 * Using AI to create recipes in their distinctive style
 */

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefRecipes, chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';

// Chef signature recipe ideas
const CHEF_RECIPES = [
  {
    chefSlug: 'gordon-ramsay',
    recipes: [
      { name: 'Beef Wellington', cuisine: 'British', difficulty: 'hard' },
      { name: 'Pan-Seared Scallops', cuisine: 'British', difficulty: 'medium' },
      { name: 'Sticky Toffee Pudding', cuisine: 'British', difficulty: 'medium' },
    ],
  },
  {
    chefSlug: 'ina-garten',
    recipes: [
      { name: 'Roast Chicken with Lemon', cuisine: 'American', difficulty: 'easy' },
      { name: "Barefoot Contessa's Chocolate Cake", cuisine: 'American', difficulty: 'medium' },
      { name: 'Herb-Roasted Turkey Breast', cuisine: 'American', difficulty: 'medium' },
    ],
  },
  {
    chefSlug: 'jacques-pepin',
    recipes: [
      { name: 'Classic French Omelet', cuisine: 'French', difficulty: 'medium' },
      { name: 'Chicken Ballotine', cuisine: 'French', difficulty: 'hard' },
      { name: 'Ratatouille Niçoise', cuisine: 'French', difficulty: 'easy' },
    ],
  },
  {
    chefSlug: 'yotam-ottolenghi',
    recipes: [
      { name: 'Shakshuka', cuisine: 'Middle Eastern', difficulty: 'easy' },
      { name: 'Roasted Cauliflower with Tahini', cuisine: 'Middle Eastern', difficulty: 'easy' },
      { name: 'Persian-Style Rice with Tahdig', cuisine: 'Middle Eastern', difficulty: 'medium' },
    ],
  },
  {
    chefSlug: 'nigella-lawson',
    recipes: [
      { name: 'Chocolate Guinness Cake', cuisine: 'British', difficulty: 'easy' },
      { name: 'Spaghetti with Marmite', cuisine: 'Italian', difficulty: 'easy' },
      { name: 'Flourless Chocolate Orange Cake', cuisine: 'British', difficulty: 'medium' },
    ],
  },
  {
    chefSlug: 'alton-brown',
    recipes: [
      { name: 'Good Eats Roast Turkey', cuisine: 'American', difficulty: 'medium' },
      { name: 'The Chewy Chocolate Chip Cookie', cuisine: 'American', difficulty: 'easy' },
      { name: 'Baked Mac and Cheese', cuisine: 'American', difficulty: 'easy' },
    ],
  },
  {
    chefSlug: 'madhur-jaffrey',
    recipes: [
      { name: 'Chicken Tikka Masala', cuisine: 'Indian', difficulty: 'medium' },
      { name: 'Dal Makhani', cuisine: 'Indian', difficulty: 'easy' },
      { name: 'Aloo Gobi', cuisine: 'Indian', difficulty: 'easy' },
    ],
  },
  {
    chefSlug: 'samin-nosrat',
    recipes: [
      { name: 'Salt Fat Acid Heat Focaccia', cuisine: 'Italian', difficulty: 'medium' },
      { name: 'Persian-Style Rice', cuisine: 'Persian', difficulty: 'medium' },
      { name: 'Buttermilk Marinated Chicken', cuisine: 'American', difficulty: 'easy' },
    ],
  },
];

async function generateChefRecipes() {
  console.log('👨‍🍳 Generating signature recipes for famous chefs...\n');
  console.log('⚠️  NOTE: This creates placeholder recipes. We should replace these');
  console.log('   with real scraped recipes when available.\n');

  let totalCreated = 0;

  for (const chefData of CHEF_RECIPES) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Chef: ${chefData.chefSlug}`);
    console.log('='.repeat(70));

    try {
      // Get chef from database
      const [chef] = await db
        .select()
        .from(chefs)
        .where(eq(chefs.slug, chefData.chefSlug))
        .limit(1);

      if (!chef) {
        console.log(`⚠️  Chef not found: ${chefData.chefSlug}`);
        continue;
      }

      console.log(`Creating ${chefData.recipes.length} recipes for ${chef.name}...\n`);

      for (const recipeData of chefData.recipes) {
        try {
          // Create placeholder recipe
          const [newRecipe] = await db
            .insert(recipes)
            .values({
              user_id: 'system',
              name: recipeData.name,
              description: `A signature ${recipeData.name} recipe in the style of ${chef.name}. This is a placeholder recipe that should be replaced with authentic content.`,
              ingredients: JSON.stringify(['Placeholder ingredient 1', 'Placeholder ingredient 2']),
              instructions: JSON.stringify([
                'Step 1: Prepare ingredients',
                'Step 2: Cook',
                'Step 3: Serve',
              ]),
              prep_time: 15,
              cook_time: 30,
              servings: 4,
              difficulty: recipeData.difficulty as 'easy' | 'medium' | 'hard',
              cuisine: recipeData.cuisine,
              tags: JSON.stringify([chef.name, 'placeholder']),
              images: JSON.stringify([]), // No image yet
              is_ai_generated: false,
              is_public: false, // Keep private until we have real content
              is_system_recipe: true,
              source: `${chef.name} - Placeholder`,
              model_used: null,
              nutrition_info: null,
            })
            .returning();

          // Link to chef
          await db.insert(chefRecipes).values({
            chef_id: chef.id,
            recipe_id: newRecipe.id,
            scraped_at: new Date(),
          });

          console.log(`  ✅ Created: ${recipeData.name}`);
          totalCreated++;
        } catch (error) {
          console.error(`  ❌ Error creating ${recipeData.name}:`, error);
        }
      }

      // Update chef's recipe count
      const [recipeCount] = await db
        .select()
        .from(chefRecipes)
        .where(eq(chefRecipes.chef_id, chef.id));

      await db
        .update(chefs)
        .set({
          recipe_count: recipeCount ? recipeCount.length : 0,
          updated_at: new Date(),
        })
        .where(eq(chefs.id, chef.id));

      const [updatedChef] = await db.select().from(chefs).where(eq(chefs.id, chef.id)).limit(1);

      console.log(`\n📊 ${chef.name} now has ${updatedChef.recipe_count} recipes`);
    } catch (error) {
      console.error(`\n❌ Error processing ${chefData.chefSlug}:`, error);
    }
  }

  console.log('\n\n');
  console.log('═'.repeat(70));
  console.log('SUMMARY');
  console.log('═'.repeat(70));
  console.log(`Total placeholder recipes created: ${totalCreated}`);
  console.log('\n⚠️  These are PLACEHOLDER recipes with minimal content');
  console.log('   Next steps:');
  console.log('   1. Generate AI images for these recipes');
  console.log('   2. Replace with real scraped recipes when available');
  console.log('═'.repeat(70));

  console.log('\n🎉 Success! Placeholder recipes created.');
  console.log(`\n🌐 View chefs: http://localhost:3002/discover/chefs`);
}

// Run the script
generateChefRecipes()
  .then(() => {
    console.log('\n✅ Script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
