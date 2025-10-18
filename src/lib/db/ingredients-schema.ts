import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { recipes } from './schema';

/**
 * Ingredients Schema
 *
 * Normalized ingredient database for the Recipe Manager application.
 * Provides:
 * - Master ingredient list with categorization
 * - Standardized ingredient names and aliases
 * - Recipe-ingredient relationships with amounts and preparation
 * - Fuzzy search support via trigram indexes
 *
 * Architecture:
 * - ingredients: Master list (normalized, deduplicated)
 * - recipeIngredients: Many-to-many join with enhanced metadata
 */

// ============================================================================
// 1. INGREDIENTS MASTER TABLE
// ============================================================================

/**
 * Master ingredient list - normalized and deduplicated
 * Contains canonical ingredient information and metadata
 */
export const ingredients = pgTable(
  'ingredients',
  {
    // Primary Key
    id: uuid('id').primaryKey().defaultRandom(),

    // Normalized Names
    name: text('name').notNull().unique(), // Lowercase normalized name (e.g., "green onion")
    display_name: text('display_name').notNull(), // Properly capitalized (e.g., "Green Onion")

    // Categorization
    category: varchar('category', { length: 50 }), // e.g., 'vegetables', 'proteins', 'dairy', 'grains', 'spices', 'condiments', 'herbs', 'fruits', 'nuts', 'oils', 'sweeteners', 'baking', 'beverages', 'other'

    // Metadata
    common_units: text('common_units'), // JSON array: ['cup', 'tablespoon', 'piece', 'gram', 'ounce']
    aliases: text('aliases'), // JSON array: alternative names (e.g., ['scallion', 'spring onion'] for 'green onion')

    // Flags
    is_common: boolean('is_common').notNull().default(false), // Frequently used ingredients (for autocomplete priority)
    is_allergen: boolean('is_allergen').notNull().default(false), // Common allergens (dairy, nuts, shellfish, etc.)

    // Nutritional Reference (optional - for future features)
    typical_unit: varchar('typical_unit', { length: 20 }), // Most common unit used (e.g., "cup", "piece")

    // Timestamps
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // Indexes for performance
    nameIdx: index('ingredients_name_idx').on(table.name), // Exact name lookup
    nameLowerIdx: index('ingredients_name_lower_idx').on(sql`LOWER(${table.name})`), // Case-insensitive search
    displayNameIdx: index('ingredients_display_name_idx').on(table.display_name),
    categoryIdx: index('ingredients_category_idx').on(table.category), // Filter by category
    commonIdx: index('ingredients_common_idx').on(table.is_common, table.name), // Common ingredients first
    allergenIdx: index('ingredients_allergen_idx').on(table.is_allergen), // Allergen filtering

    // Trigram index for fuzzy search (requires pg_trgm extension)
    // This enables fast similarity searches like: SELECT * FROM ingredients WHERE name % 'onin'
    // Note: This requires the pg_trgm extension to be enabled in PostgreSQL
    nameTrigramIdx: index('ingredients_name_trgm_idx').using(
      'gin',
      sql`${table.name} gin_trgm_ops`
    ),
    displayNameTrigramIdx: index('ingredients_display_name_trgm_idx').using(
      'gin',
      sql`${table.display_name} gin_trgm_ops`
    ),
  })
);

export type Ingredient = typeof ingredients.$inferSelect;
export type NewIngredient = typeof ingredients.$inferInsert;

// Zod validation schemas
// Simplified for Zod v3 compatibility - using drizzle-zod's generated schema as-is
export const insertIngredientSchema = createInsertSchema(ingredients);

export const selectIngredientSchema = createSelectSchema(ingredients);

// Helper schemas for working with JSON arrays
export const commonUnitsSchema = z.array(z.string()).max(15, 'Maximum 15 common units');
export const aliasesSchema = z.array(z.string()).max(20, 'Maximum 20 aliases');

// ============================================================================
// 2. RECIPE INGREDIENTS JOIN TABLE
// ============================================================================

/**
 * Many-to-many relationship between recipes and ingredients
 * Includes amount, unit, preparation method, and ordering
 */
export const recipeIngredients = pgTable(
  'recipe_ingredients',
  {
    // Primary Key
    id: uuid('id').primaryKey().defaultRandom(),

    // Relationships
    recipe_id: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }), // Delete ingredients when recipe is deleted
    ingredient_id: uuid('ingredient_id')
      .notNull()
      .references(() => ingredients.id, { onDelete: 'cascade' }), // Delete link when ingredient is deleted

    // Quantity Information
    amount: varchar('amount', { length: 50 }), // e.g., "2", "1/2", "1-2", "to taste"
    unit: varchar('unit', { length: 50 }), // e.g., "cups", "tablespoons", "pieces", "grams", "ounces"

    // Preparation
    preparation: varchar('preparation', { length: 200 }), // e.g., "chopped", "diced", "minced", "finely sliced"

    // Metadata
    is_optional: boolean('is_optional').notNull().default(false), // Optional ingredient
    position: integer('position').notNull().default(0), // Order in recipe (0-based)

    // Grouping (for sectioned ingredient lists)
    ingredient_group: varchar('ingredient_group', { length: 100 }), // e.g., "For the sauce", "For the topping"

    // Timestamps
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    // Unique constraint: ingredient can only appear once per recipe at same position
    // Note: We allow same ingredient multiple times with different positions (e.g., "add garlic twice")
    recipeIngredientPositionUnique: unique('recipe_ingredients_position_unique').on(
      table.recipe_id,
      table.ingredient_id,
      table.position
    ),

    // Indexes for performance
    recipeIdIdx: index('recipe_ingredients_recipe_id_idx').on(table.recipe_id), // Get all ingredients for a recipe
    ingredientIdIdx: index('recipe_ingredients_ingredient_id_idx').on(table.ingredient_id), // Find recipes using an ingredient
    positionIdx: index('recipe_ingredients_position_idx').on(table.recipe_id, table.position), // Ordered ingredient list
    optionalIdx: index('recipe_ingredients_optional_idx').on(table.recipe_id, table.is_optional), // Filter optional ingredients
    groupIdx: index('recipe_ingredients_group_idx').on(table.recipe_id, table.ingredient_group), // Group by section
  })
);

export type RecipeIngredient = typeof recipeIngredients.$inferSelect;
export type NewRecipeIngredient = typeof recipeIngredients.$inferInsert;

// Zod validation schemas
// Simplified for Zod v3 compatibility
export const insertRecipeIngredientSchema = createInsertSchema(recipeIngredients);

export const selectRecipeIngredientSchema = createSelectSchema(recipeIngredients);

// ============================================================================
// 3. INGREDIENT STATISTICS (Future Enhancement)
// ============================================================================

/**
 * Optional table for tracking ingredient usage statistics
 * This can be populated asynchronously and used for:
 * - Trending ingredients
 * - Popular combinations
 * - Seasonal analysis
 *
 * Note: This is a denormalized table for performance
 * Can be rebuilt from recipeIngredients at any time
 */
export const ingredientStatistics = pgTable(
  'ingredient_statistics',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Reference
    ingredient_id: uuid('ingredient_id')
      .notNull()
      .unique()
      .references(() => ingredients.id, { onDelete: 'cascade' }),

    // Counts
    total_recipes: integer('total_recipes').notNull().default(0), // Total recipes using this ingredient
    public_recipes: integer('public_recipes').notNull().default(0), // Public recipes count
    system_recipes: integer('system_recipes').notNull().default(0), // System/curated recipes count

    // Popularity (updated weekly/monthly)
    popularity_score: integer('popularity_score').notNull().default(0), // Calculated score based on usage
    trending_score: integer('trending_score').notNull().default(0), // Recent usage trend

    // Last updated
    last_calculated: timestamp('last_calculated').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // Indexes
    popularityIdx: index('ingredient_statistics_popularity_idx').on(table.popularity_score.desc()),
    trendingIdx: index('ingredient_statistics_trending_idx').on(table.trending_score.desc()),
    recipeCountIdx: index('ingredient_statistics_recipe_count_idx').on(table.total_recipes.desc()),
  })
);

export type IngredientStatistics = typeof ingredientStatistics.$inferSelect;
export type NewIngredientStatistics = typeof ingredientStatistics.$inferInsert;

export const insertIngredientStatisticsSchema = createInsertSchema(ingredientStatistics);
export const selectIngredientStatisticsSchema = createSelectSchema(ingredientStatistics);

// ============================================================================
// HELPER TYPES FOR APPLICATION USE
// ============================================================================

/**
 * Extended recipe ingredient with full ingredient details
 * Used when fetching recipe ingredients with joins
 */
export type RecipeIngredientWithDetails = RecipeIngredient & {
  ingredient: Ingredient;
};

/**
 * Ingredient with usage statistics
 * Used in autocomplete and ingredient discovery
 */
export type IngredientWithStats = Ingredient & {
  statistics?: IngredientStatistics;
};

/**
 * Grouped ingredient list for recipe display
 */
export type GroupedRecipeIngredients = {
  group: string | null;
  ingredients: RecipeIngredientWithDetails[];
};

// ============================================================================
// UTILITY FUNCTIONS FOR INGREDIENT PARSING
// ============================================================================

/**
 * Common ingredient categories enum for type safety
 */
export const INGREDIENT_CATEGORIES = [
  'vegetables',
  'proteins',
  'dairy',
  'grains',
  'spices',
  'condiments',
  'herbs',
  'fruits',
  'nuts',
  'oils',
  'sweeteners',
  'baking',
  'beverages',
  'seafood',
  'meat',
  'poultry',
  'legumes',
  'pasta',
  'other',
] as const;

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

/**
 * Common measurement units for validation
 */
export const COMMON_UNITS = [
  // Volume
  'teaspoon',
  'teaspoons',
  'tsp',
  'tablespoon',
  'tablespoons',
  'tbsp',
  'cup',
  'cups',
  'c',
  'pint',
  'pints',
  'pt',
  'quart',
  'quarts',
  'qt',
  'gallon',
  'gallons',
  'gal',
  'milliliter',
  'milliliters',
  'ml',
  'liter',
  'liters',
  'l',
  'fluid ounce',
  'fluid ounces',
  'fl oz',

  // Weight
  'ounce',
  'ounces',
  'oz',
  'pound',
  'pounds',
  'lb',
  'lbs',
  'gram',
  'grams',
  'g',
  'kilogram',
  'kilograms',
  'kg',

  // Count
  'piece',
  'pieces',
  'pc',
  'slice',
  'slices',
  'clove',
  'cloves',
  'sprig',
  'sprigs',
  'bunch',
  'bunches',
  'head',
  'heads',
  'can',
  'cans',
  'package',
  'packages',
  'pkg',
  'bag',
  'bags',
  'box',
  'boxes',

  // Special
  'pinch',
  'pinches',
  'dash',
  'dashes',
  'to taste',
  'as needed',
] as const;

export type MeasurementUnit = (typeof COMMON_UNITS)[number];

/**
 * Common preparation methods
 */
export const PREPARATION_METHODS = [
  'chopped',
  'diced',
  'minced',
  'sliced',
  'julienned',
  'cubed',
  'grated',
  'shredded',
  'crushed',
  'whole',
  'halved',
  'quartered',
  'peeled',
  'seeded',
  'deveined',
  'trimmed',
  'blanched',
  'toasted',
  'roasted',
  'melted',
  'softened',
  'room temperature',
  'chilled',
  'frozen',
  'fresh',
  'dried',
  'canned',
] as const;

export type PreparationMethod = (typeof PREPARATION_METHODS)[number];
