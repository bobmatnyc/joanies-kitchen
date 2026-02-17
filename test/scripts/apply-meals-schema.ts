import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/index.js';

/**
 * Apply Meals Feature Schema to Database
 *
 * Creates 4 new tables:
 * 1. meals - Main meal definitions
 * 2. meal_recipes - Junction table linking recipes to meals
 * 3. shopping_lists - Consolidated shopping lists
 * 4. meal_templates - Predefined meal combinations
 */

async function applyMealsSchema() {
  console.log('🍽️  Applying Meals Feature Schema...\n');

  try {
    // Create meals table
    console.log('Creating meals table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS meals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        meal_type TEXT CHECK (meal_type IN ('breakfast', 'brunch', 'lunch', 'dinner', 'snack', 'dessert', 'party', 'holiday', 'custom')),
        occasion TEXT,
        serves INTEGER NOT NULL DEFAULT 4,
        estimated_total_cost DECIMAL(10, 2),
        estimated_cost_per_serving DECIMAL(10, 2),
        price_estimation_date TIMESTAMP WITH TIME ZONE,
        price_estimation_confidence DECIMAL(3, 2),
        is_template BOOLEAN DEFAULT FALSE,
        is_public BOOLEAN DEFAULT FALSE,
        total_prep_time INTEGER,
        total_cook_time INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ meals table created\n');

    // Create meal_recipes junction table
    console.log('Creating meal_recipes junction table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS meal_recipes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
        recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        course_category TEXT NOT NULL DEFAULT 'main' CHECK (course_category IN ('appetizer', 'main', 'side', 'dessert', 'drink', 'bread', 'salad', 'soup', 'other')),
        display_order INTEGER NOT NULL DEFAULT 0,
        serving_multiplier DECIMAL(4, 2) NOT NULL DEFAULT 1.00,
        preparation_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (meal_id, recipe_id)
      )
    `);
    console.log('✅ meal_recipes table created\n');

    // Create shopping_lists table
    console.log('Creating shopping_lists table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS shopping_lists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        meal_id UUID REFERENCES meals(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        notes TEXT,
        items TEXT NOT NULL,
        estimated_total_cost DECIMAL(10, 2),
        estimated_cost_breakdown TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'shopping', 'completed', 'archived')),
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ shopping_lists table created\n');

    // Create meal_templates table
    console.log('Creating meal_templates table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS meal_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        meal_type TEXT CHECK (meal_type IN ('breakfast', 'brunch', 'lunch', 'dinner', 'snack', 'dessert', 'party', 'holiday', 'custom')),
        occasion TEXT,
        template_structure TEXT NOT NULL,
        default_serves INTEGER NOT NULL DEFAULT 4,
        is_system BOOLEAN DEFAULT FALSE,
        created_by TEXT,
        times_used INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ meal_templates table created\n');

    // Create indexes for meals
    console.log('Creating indexes for meals...');
    await db.execute(sql`CREATE INDEX IF NOT EXISTS meals_user_id_idx ON meals(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS meals_meal_type_idx ON meals(meal_type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS meals_is_template_idx ON meals(is_template)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS meals_is_public_idx ON meals(is_public)`);
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS meals_created_at_idx ON meals(created_at DESC)`
    );
    console.log('✅ Meals indexes created\n');

    // Create indexes for meal_recipes
    console.log('Creating indexes for meal_recipes...');
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS meal_recipes_meal_id_idx ON meal_recipes(meal_id)`
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS meal_recipes_recipe_id_idx ON meal_recipes(recipe_id)`
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS meal_recipes_display_order_idx ON meal_recipes(meal_id, display_order)`
    );
    console.log('✅ Meal recipes indexes created\n');

    // Create indexes for shopping_lists
    console.log('Creating indexes for shopping_lists...');
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS shopping_lists_user_id_idx ON shopping_lists(user_id)`
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS shopping_lists_meal_id_idx ON shopping_lists(meal_id)`
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS shopping_lists_status_idx ON shopping_lists(status)`
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS shopping_lists_created_at_idx ON shopping_lists(created_at DESC)`
    );
    console.log('✅ Shopping lists indexes created\n');

    // Create indexes for meal_templates
    console.log('Creating indexes for meal_templates...');
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS meal_templates_meal_type_idx ON meal_templates(meal_type)`
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS meal_templates_is_system_idx ON meal_templates(is_system)`
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS meal_templates_times_used_idx ON meal_templates(times_used DESC)`
    );
    console.log('✅ Meal templates indexes created\n');

    console.log('🎉 Meals feature schema applied successfully!\n');
    console.log('Tables created:');
    console.log('  ✓ meals (meal definitions)');
    console.log('  ✓ meal_recipes (recipe-meal links)');
    console.log('  ✓ shopping_lists (consolidated shopping)');
    console.log('  ✓ meal_templates (predefined combinations)\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error applying schema:', error);
    process.exit(1);
  }
}

applyMealsSchema();
