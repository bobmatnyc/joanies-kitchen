import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/index.js';

async function completeIndexes() {
  console.log('Completing meals feature indexes...\n');

  const indexes = [
    // Meals indexes
    { name: 'meals_user_id_idx', table: 'meals', column: 'user_id' },
    { name: 'meals_is_template_idx', table: 'meals', column: 'is_template' },
    { name: 'meals_is_public_idx', table: 'meals', column: 'is_public' },
    { name: 'meals_created_at_idx', table: 'meals', column: 'created_at DESC' },

    // Meal recipes indexes
    { name: 'meal_recipes_meal_id_idx', table: 'meal_recipes', column: 'meal_id' },
    { name: 'meal_recipes_recipe_id_idx', table: 'meal_recipes', column: 'recipe_id' },

    // Shopping lists indexes
    { name: 'shopping_lists_user_id_idx', table: 'shopping_lists', column: 'user_id' },
    { name: 'shopping_lists_meal_id_idx', table: 'shopping_lists', column: 'meal_id' },
    { name: 'shopping_lists_created_at_idx', table: 'shopping_lists', column: 'created_at DESC' },

    // Meal templates indexes
    { name: 'meal_templates_is_system_idx', table: 'meal_templates', column: 'is_system' },
    { name: 'meal_templates_times_used_idx', table: 'meal_templates', column: 'times_used DESC' },
  ];

  for (const idx of indexes) {
    try {
      await db.execute(
        sql.raw(`CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.table}(${idx.column})`)
      );
      console.log(`✅ Created index: ${idx.name}`);
    } catch (error: any) {
      console.log(`⚠️  Index ${idx.name} already exists or failed:`, error.message);
    }
  }

  console.log('\n✅ Meals feature schema complete!\n');
  process.exit(0);
}

completeIndexes();
