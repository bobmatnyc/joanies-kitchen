import {
  boolean,
  decimal,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { recipes } from './schema';

/**
 * Meals Feature Schema
 *
 * A "Meal" is a collection of recipes that make up a complete dining experience.
 * Examples:
 * - Family Dinner: Main dish + 2 sides + dessert
 * - Sunday Brunch: Eggs + pancakes + fruit salad
 * - Holiday Feast: Appetizer + main + 3 sides + dessert
 *
 * Key Features:
 * - Combine multiple recipes with specified serving adjustments
 * - Calculate consolidated shopping lists
 * - LLM-powered price estimation
 * - Meal templates for quick creation
 */

// Meals table - defines a collection of recipes
export const meals = pgTable(
  'meals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: text('user_id').notNull(), // Clerk user ID
    name: text('name').notNull(), // e.g., "Thanksgiving Dinner", "Tuesday Family Meal"
    description: text('description'), // Optional notes
    meal_type: text('meal_type', {
      enum: [
        'breakfast',
        'brunch',
        'lunch',
        'dinner',
        'snack',
        'dessert',
        'party',
        'holiday',
        'custom',
      ],
    }),
    occasion: text('occasion'), // e.g., "Thanksgiving", "Birthday", "Sunday Dinner"
    serves: integer('serves').notNull().default(4), // Default serving size for the meal
    tags: text('tags'), // JSON array of tags (e.g., ["Family Dinner", "Quick Weeknight"])

    // Price estimation (LLM-powered)
    estimated_total_cost: decimal('estimated_total_cost', { precision: 10, scale: 2 }), // Total cost in USD
    estimated_cost_per_serving: decimal('estimated_cost_per_serving', { precision: 10, scale: 2 }), // Cost per person
    price_estimation_date: timestamp('price_estimation_date'), // When price was last estimated
    price_estimation_confidence: decimal('price_estimation_confidence', { precision: 3, scale: 2 }), // 0.00-1.00

    // Metadata
    is_template: boolean('is_template').default(false), // Template for others to use
    is_public: boolean('is_public').default(false), // Share with others
    total_prep_time: integer('total_prep_time'), // Total prep time in minutes (calculated)
    total_cook_time: integer('total_cook_time'), // Total cook time in minutes (calculated)

    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdIdx: index('meals_user_id_idx').on(table.user_id),
    mealTypeIdx: index('meals_meal_type_idx').on(table.meal_type),
    isTemplateIdx: index('meals_is_template_idx').on(table.is_template),
    isPublicIdx: index('meals_is_public_idx').on(table.is_public),
    createdAtIdx: index('meals_created_at_idx').on(table.created_at.desc()),
  })
);

// Meal Recipes junction table - links recipes to meals with adjustments
export const mealRecipes = pgTable(
  'meal_recipes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    meal_id: uuid('meal_id')
      .notNull()
      .references(() => meals.id, { onDelete: 'cascade' }),
    recipe_id: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),

    // Recipe role in the meal
    course_category: text('course_category', {
      enum: ['appetizer', 'main', 'side', 'dessert', 'drink', 'bread', 'salad', 'soup', 'other'],
    })
      .notNull()
      .default('main'),
    display_order: integer('display_order').notNull().default(0), // For organizing recipes in meal

    // Serving adjustments
    serving_multiplier: decimal('serving_multiplier', { precision: 4, scale: 2 })
      .notNull()
      .default('1.00'),
    // If recipe serves 4 and multiplier is 1.5, it will serve 6

    // Optional notes
    preparation_notes: text('preparation_notes'), // e.g., "Start this first", "Can make ahead"

    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    mealIdIdx: index('meal_recipes_meal_id_idx').on(table.meal_id),
    recipeIdIdx: index('meal_recipes_recipe_id_idx').on(table.recipe_id),
    displayOrderIdx: index('meal_recipes_display_order_idx').on(table.meal_id, table.display_order),
    // Ensure same recipe not added twice to same meal
    mealRecipeUnique: unique().on(table.meal_id, table.recipe_id),
  })
);

// Shopping Lists table - consolidated from meals
export const shoppingLists = pgTable(
  'shopping_lists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: text('user_id').notNull(), // Clerk user ID
    meal_id: uuid('meal_id').references(() => meals.id, { onDelete: 'set null' }), // Optional link to meal

    name: text('name').notNull(), // e.g., "Thanksgiving Shopping List"
    notes: text('notes'), // Optional shopping notes

    // Shopping list items (consolidated and optimized)
    items: text('items').notNull(), // JSON array of shopping items
    // Example structure:
    // [
    //   {
    //     ingredient_id: "uuid",
    //     name: "chicken breast",
    //     quantity: 2.5,
    //     unit: "lbs",
    //     category: "proteins",
    //     estimated_price: 12.50,
    //     checked: false,
    //     from_recipes: ["recipe_id_1", "recipe_id_2"]
    //   }
    // ]

    // Price estimation
    estimated_total_cost: decimal('estimated_total_cost', { precision: 10, scale: 2 }),
    estimated_cost_breakdown: text('estimated_cost_breakdown'), // JSON object with category costs

    // Status
    status: text('status', {
      enum: ['draft', 'active', 'shopping', 'completed', 'archived'],
    })
      .notNull()
      .default('draft'),

    completed_at: timestamp('completed_at'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdIdx: index('shopping_lists_user_id_idx').on(table.user_id),
    mealIdIdx: index('shopping_lists_meal_id_idx').on(table.meal_id),
    statusIdx: index('shopping_lists_status_idx').on(table.status),
    createdAtIdx: index('shopping_lists_created_at_idx').on(table.created_at.desc()),
  })
);

// Meal Templates - predefined meal combinations
export const mealTemplates = pgTable(
  'meal_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(), // e.g., "Classic Sunday Roast", "Taco Tuesday"
    description: text('description'),
    meal_type: text('meal_type', {
      enum: [
        'breakfast',
        'brunch',
        'lunch',
        'dinner',
        'snack',
        'dessert',
        'party',
        'holiday',
        'custom',
      ],
    }),
    occasion: text('occasion'),

    // Template structure (JSON with recipe requirements)
    template_structure: text('template_structure').notNull(),
    // Example:
    // {
    //   courses: [
    //     { category: "main", required: true, suggestions: ["roasted chicken", "pot roast"] },
    //     { category: "side", required: true, count: 2 },
    //     { category: "dessert", required: false }
    //   ]
    // }

    default_serves: integer('default_serves').notNull().default(4),
    is_system: boolean('is_system').default(false), // System-provided template
    created_by: text('created_by'), // User ID who created (if not system)

    // Usage tracking
    times_used: integer('times_used').default(0),

    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    mealTypeIdx: index('meal_templates_meal_type_idx').on(table.meal_type),
    isSystemIdx: index('meal_templates_is_system_idx').on(table.is_system),
    timesUsedIdx: index('meal_templates_times_used_idx').on(table.times_used.desc()),
  })
);

// Type exports
export type Meal = typeof meals.$inferSelect;
export type NewMeal = typeof meals.$inferInsert;
export type MealRecipe = typeof mealRecipes.$inferSelect;
export type NewMealRecipe = typeof mealRecipes.$inferInsert;
export type ShoppingList = typeof shoppingLists.$inferSelect;
export type NewShoppingList = typeof shoppingLists.$inferInsert;
export type MealTemplate = typeof mealTemplates.$inferSelect;
export type NewMealTemplate = typeof mealTemplates.$inferInsert;

// Zod schemas for validation
export const insertMealSchema = createInsertSchema(meals);
export const selectMealSchema = createSelectSchema(meals);
export const insertMealRecipeSchema = createInsertSchema(mealRecipes);
export const selectMealRecipeSchema = createSelectSchema(mealRecipes);
export const insertShoppingListSchema = createInsertSchema(shoppingLists);
export const selectShoppingListSchema = createSelectSchema(shoppingLists);
export const insertMealTemplateSchema = createInsertSchema(mealTemplates);
export const selectMealTemplateSchema = createSelectSchema(mealTemplates);

// Extended types with relations
export type MealWithRecipes = Meal & {
  recipes: (MealRecipe & { recipe: typeof recipes.$inferSelect })[];
};

export type ShoppingListItem = {
  ingredient_id?: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  estimated_price?: number;
  checked: boolean;
  from_recipes: string[]; // Recipe IDs that require this ingredient
  notes?: string;
};

export type ShoppingListWithMeal = ShoppingList & {
  meal?: Meal;
};
