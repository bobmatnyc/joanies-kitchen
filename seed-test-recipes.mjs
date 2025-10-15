import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
const sql = neon(databaseUrl);

const testRecipes = [
  {
    name: 'Classic Margherita Pizza',
    description: 'Traditional Italian pizza with tomato, mozzarella, and basil',
    ingredients: JSON.stringify(['Pizza dough', 'Tomato sauce', 'Fresh mozzarella', 'Fresh basil', 'Olive oil', 'Salt']),
    instructions: JSON.stringify(['Preheat oven to 475°F', 'Roll out dough', 'Spread tomato sauce', 'Add cheese', 'Bake for 12-15 minutes', 'Top with fresh basil']),
    cuisine: 'Italian',
    difficulty: 'easy',
    prep_time: 15,
    cook_time: 15,
    servings: 4,
    tags: JSON.stringify(['pizza', 'italian', 'vegetarian', 'classic']),
    is_public: true,
    is_system_recipe: true,
    image_url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800',
    images: JSON.stringify(['https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800'])
  },
  {
    name: 'Chicken Tikka Masala',
    description: 'Creamy Indian curry with tender chicken pieces',
    ingredients: JSON.stringify(['Chicken breast', 'Yogurt', 'Tomato sauce', 'Heavy cream', 'Garam masala', 'Ginger', 'Garlic', 'Onion']),
    instructions: JSON.stringify(['Marinate chicken in yogurt and spices', 'Grill chicken pieces', 'Prepare curry sauce', 'Simmer chicken in sauce', 'Serve with rice or naan']),
    cuisine: 'Indian',
    difficulty: 'medium',
    prep_time: 30,
    cook_time: 40,
    servings: 6,
    tags: JSON.stringify(['curry', 'indian', 'chicken', 'spicy']),
    is_public: true,
    is_system_recipe: true,
    image_url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800',
    images: JSON.stringify(['https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800'])
  },
  {
    name: 'Classic Caesar Salad',
    description: 'Crisp romaine lettuce with creamy Caesar dressing',
    ingredients: JSON.stringify(['Romaine lettuce', 'Parmesan cheese', 'Croutons', 'Caesar dressing', 'Lemon', 'Black pepper']),
    instructions: JSON.stringify(['Wash and chop lettuce', 'Prepare dressing', 'Toss lettuce with dressing', 'Add croutons and parmesan', 'Serve immediately']),
    cuisine: 'American',
    difficulty: 'easy',
    prep_time: 10,
    cook_time: 0,
    servings: 4,
    tags: JSON.stringify(['salad', 'vegetarian', 'quick', 'healthy']),
    is_public: true,
    is_system_recipe: true,
    image_url: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=800',
    images: JSON.stringify(['https://images.unsplash.com/photo-1546793665-c74683f339c1?w=800', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800'])
  },
  {
    name: 'Beef Tacos',
    description: 'Mexican-style tacos with seasoned ground beef',
    ingredients: JSON.stringify(['Ground beef', 'Taco shells', 'Lettuce', 'Tomatoes', 'Cheese', 'Sour cream', 'Taco seasoning']),
    instructions: JSON.stringify(['Brown ground beef', 'Add taco seasoning', 'Warm taco shells', 'Assemble tacos with toppings', 'Serve with lime']),
    cuisine: 'Mexican',
    difficulty: 'easy',
    prep_time: 10,
    cook_time: 15,
    servings: 4,
    tags: JSON.stringify(['tacos', 'mexican', 'beef', 'quick']),
    is_public: true,
    is_system_recipe: true,
    image_url: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800',
    images: JSON.stringify(['https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800'])
  },
  {
    name: 'Chocolate Chip Cookies',
    description: 'Classic homemade chocolate chip cookies',
    ingredients: JSON.stringify(['All-purpose flour', 'Butter', 'Brown sugar', 'White sugar', 'Eggs', 'Vanilla extract', 'Chocolate chips', 'Baking soda', 'Salt']),
    instructions: JSON.stringify(['Cream butter and sugars', 'Add eggs and vanilla', 'Mix in dry ingredients', 'Fold in chocolate chips', 'Bake at 350°F for 10-12 minutes']),
    cuisine: 'American',
    difficulty: 'easy',
    prep_time: 15,
    cook_time: 12,
    servings: 24,
    tags: JSON.stringify(['dessert', 'cookies', 'baking', 'chocolate']),
    is_public: true,
    is_system_recipe: true,
    image_url: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800',
    images: JSON.stringify(['https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800', 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800'])
  }
];

async function seedRecipes() {
  console.log('\n======================================');
  console.log('SEEDING TEST RECIPES');
  console.log('======================================\n');

  try {
    for (const recipe of testRecipes) {
      await sql`
        INSERT INTO recipes (
          name, description, ingredients, instructions, cuisine, difficulty,
          prep_time, cook_time, servings, tags, is_public, is_system_recipe,
          image_url, images, user_id
        ) VALUES (
          ${recipe.name}, ${recipe.description}, ${recipe.ingredients},
          ${recipe.instructions}, ${recipe.cuisine}, ${recipe.difficulty},
          ${recipe.prep_time}, ${recipe.cook_time}, ${recipe.servings},
          ${recipe.tags}, ${recipe.is_public}, ${recipe.is_system_recipe},
          ${recipe.image_url}, ${recipe.images}, 'system'
        )
      `;
      console.log(`✓ Added: ${recipe.name}`);
    }

    console.log(`\n✓ Successfully seeded ${testRecipes.length} public recipes\n`);

    // Verify
    const count = await sql`SELECT COUNT(*) as count FROM recipes WHERE is_public = true`;
    console.log(`Total public recipes now: ${count[0].count}\n`);
  } catch (error) {
    console.error('Error seeding recipes:', error.message);
    console.error(error);
  }
}

seedRecipes();
