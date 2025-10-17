#!/usr/bin/env tsx

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { recipes } from '../src/lib/db/schema';

// Load environment variables
config({ path: '.env.local' });

const systemRecipes = [
  {
    name: 'Classic Margherita Pizza',
    description: 'Traditional Italian pizza with fresh mozzarella, tomatoes, and basil',
    ingredients: JSON.stringify([
      '1 pizza dough (store-bought or homemade)',
      '1/2 cup pizza sauce',
      '8 oz fresh mozzarella cheese, sliced',
      '2-3 ripe tomatoes, sliced',
      'Fresh basil leaves',
      '2 tbsp olive oil',
      'Salt and pepper to taste',
    ]),
    instructions: JSON.stringify([
      'Preheat oven to 475°F (245°C)',
      'Roll out pizza dough to desired thickness',
      'Spread pizza sauce evenly over dough',
      'Arrange mozzarella and tomato slices',
      'Drizzle with olive oil and season with salt and pepper',
      'Bake for 12-15 minutes until crust is golden',
      'Top with fresh basil leaves before serving',
    ]),
    prepTime: 15,
    cookTime: 15,
    servings: 4,
    difficulty: 'easy' as const,
    cuisine: 'Italian',
    tags: JSON.stringify(['vegetarian', 'classic', 'italian']),
    isPublic: true,
    isSystemRecipe: true,
    images: JSON.stringify([
      'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=600&fit=crop',
    ]),
    nutritionInfo: JSON.stringify({
      calories: 285,
      protein: 12,
      carbs: 35,
      fat: 10,
      fiber: 2,
    }),
  },
  {
    name: 'Chicken Teriyaki Bowl',
    description: 'Japanese-inspired rice bowl with glazed chicken and vegetables',
    ingredients: JSON.stringify([
      '1 lb chicken thighs, boneless and skinless',
      '1/4 cup soy sauce',
      '2 tbsp honey',
      '1 tbsp rice vinegar',
      '2 cloves garlic, minced',
      '1 tsp ginger, grated',
      '2 cups cooked rice',
      '1 cup broccoli florets',
      '1 carrot, julienned',
      '2 green onions, sliced',
      '1 tbsp sesame seeds',
    ]),
    instructions: JSON.stringify([
      'Cut chicken into bite-sized pieces',
      'Mix soy sauce, honey, vinegar, garlic, and ginger for teriyaki sauce',
      'Cook chicken in a pan over medium-high heat until golden',
      'Pour teriyaki sauce over chicken and simmer until thickened',
      'Steam broccoli and carrot until tender',
      'Serve chicken and vegetables over rice',
      'Garnish with green onions and sesame seeds',
    ]),
    prepTime: 20,
    cookTime: 25,
    servings: 4,
    difficulty: 'medium' as const,
    cuisine: 'Japanese',
    tags: JSON.stringify(['asian', 'healthy', 'rice-bowl']),
    isPublic: true,
    isSystemRecipe: true,
    images: JSON.stringify([
      'https://images.unsplash.com/photo-1609501676725-7186f017a4b7?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop',
    ]),
    nutritionInfo: JSON.stringify({
      calories: 420,
      protein: 28,
      carbs: 52,
      fat: 12,
      fiber: 3,
    }),
  },
  {
    name: 'Mediterranean Quinoa Salad',
    description: 'Healthy and colorful salad with quinoa, vegetables, and feta cheese',
    ingredients: JSON.stringify([
      '1 cup quinoa, cooked and cooled',
      '1 cucumber, diced',
      '2 cups cherry tomatoes, halved',
      '1/2 red onion, finely chopped',
      '1/2 cup kalamata olives, pitted and sliced',
      '4 oz feta cheese, crumbled',
      '1/4 cup olive oil',
      '2 tbsp lemon juice',
      '2 cloves garlic, minced',
      '1 tsp dried oregano',
      'Fresh parsley, chopped',
    ]),
    instructions: JSON.stringify([
      'Cook quinoa according to package directions and let cool',
      'In a large bowl, combine quinoa, cucumber, tomatoes, onion, and olives',
      'Whisk together olive oil, lemon juice, garlic, and oregano',
      'Pour dressing over salad and toss well',
      'Add feta cheese and parsley',
      'Refrigerate for 30 minutes before serving',
      'Serve chilled or at room temperature',
    ]),
    prepTime: 20,
    cookTime: 15,
    servings: 6,
    difficulty: 'easy' as const,
    cuisine: 'Mediterranean',
    tags: JSON.stringify(['vegetarian', 'healthy', 'salad', 'gluten-free']),
    isPublic: true,
    isSystemRecipe: true,
    images: JSON.stringify([
      'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=600&fit=crop',
    ]),
    nutritionInfo: JSON.stringify({
      calories: 245,
      protein: 8,
      carbs: 28,
      fat: 12,
      fiber: 4,
    }),
  },
  {
    name: 'Thai Green Curry',
    description: 'Aromatic and spicy Thai curry with coconut milk and vegetables',
    ingredients: JSON.stringify([
      '2 tbsp green curry paste',
      '1 can (14 oz) coconut milk',
      '1 lb chicken breast, sliced',
      '1 eggplant, cubed',
      '1 bell pepper, sliced',
      '1/2 cup Thai basil leaves',
      '2 tbsp fish sauce',
      '1 tbsp brown sugar',
      '2 kaffir lime leaves',
      '1 stalk lemongrass',
      'Jasmine rice for serving',
    ]),
    instructions: JSON.stringify([
      'Heat 2 tbsp of coconut cream in a pan',
      'Add curry paste and cook until fragrant',
      'Add chicken and cook until no longer pink',
      'Pour in remaining coconut milk',
      'Add eggplant, bell pepper, and seasonings',
      'Simmer for 15-20 minutes until vegetables are tender',
      'Stir in Thai basil leaves',
      'Serve hot over jasmine rice',
    ]),
    prepTime: 15,
    cookTime: 30,
    servings: 4,
    difficulty: 'medium' as const,
    cuisine: 'Thai',
    tags: JSON.stringify(['spicy', 'asian', 'curry', 'gluten-free']),
    isPublic: true,
    isSystemRecipe: true,
    images: JSON.stringify([
      'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=800&h=600&fit=crop',
    ]),
    nutritionInfo: JSON.stringify({
      calories: 385,
      protein: 25,
      carbs: 18,
      fat: 24,
      fiber: 4,
    }),
  },
  {
    name: 'Classic Beef Tacos',
    description: 'Traditional Mexican street-style tacos with seasoned ground beef',
    ingredients: JSON.stringify([
      '1 lb ground beef',
      '1 packet taco seasoning',
      '8 corn tortillas',
      '1 cup lettuce, shredded',
      '1 cup tomatoes, diced',
      '1 cup cheddar cheese, shredded',
      '1/2 cup sour cream',
      '1 avocado, sliced',
      '1/2 cup salsa',
      'Lime wedges',
      'Fresh cilantro',
    ]),
    instructions: JSON.stringify([
      'Brown ground beef in a large skillet',
      'Add taco seasoning and water as directed on packet',
      'Simmer until sauce thickens',
      'Warm tortillas in microwave or on griddle',
      'Fill tortillas with seasoned beef',
      'Top with lettuce, tomatoes, cheese, and other toppings',
      'Serve with lime wedges and cilantro',
    ]),
    prepTime: 15,
    cookTime: 20,
    servings: 4,
    difficulty: 'easy' as const,
    cuisine: 'Mexican',
    tags: JSON.stringify(['mexican', 'quick', 'family-friendly']),
    isPublic: true,
    isSystemRecipe: true,
    images: JSON.stringify([
      'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1624300629298-e9de39c13be5?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1552332386-9e19b8a737f5?w=800&h=600&fit=crop',
    ]),
    nutritionInfo: JSON.stringify({
      calories: 420,
      protein: 24,
      carbs: 32,
      fat: 22,
      fiber: 5,
    }),
  },
];

async function populateSystemRecipes() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  console.log('🔄 Connecting to database...');
  const client = postgres(connectionString);
  const db = drizzle(client);

  try {
    console.log('📝 Inserting system recipes...');

    for (const recipe of systemRecipes) {
      const recipeData = {
        ...recipe,
        userId: 'system', // System recipes use a special user ID
        isAiGenerated: false,
        source: 'Recipe Manager Team',
      };

      await db.insert(recipes).values(recipeData);
      console.log(`   ✅ Added: ${recipe.name}`);
    }

    console.log(`\n🎉 Successfully added ${systemRecipes.length} system recipes!`);
    console.log('\n📌 These recipes are now available in the Shared Recipes section.');
  } catch (error) {
    console.error('❌ Error populating recipes:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('👋 Database connection closed');
  }
}

// Run the script
populateSystemRecipes().catch(console.error);
