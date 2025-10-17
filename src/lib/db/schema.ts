import { pgTable, text, integer, timestamp, boolean, uuid, varchar, customType, decimal, unique, index } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';

// Custom type for pgvector embedding columns
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(384)';
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: string): number[] {
    if (typeof value === 'string') {
      // Handle pgvector format: '[0.1,0.2,0.3]' or '[0.1, 0.2, 0.3]'
      const cleaned = value.replace(/[\[\]]/g, '');
      return cleaned.split(',').map(Number);
    }
    return value as any;
  },
});

// Recipes table with authentication support
export const recipes = pgTable('recipes', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  user_id: text('user_id').notNull(), // Clerk user ID
  chef_id: uuid('chef_id'), // Optional reference to chef (for chef-attributed recipes)
  name: text('name').notNull(),
  description: text('description'),
  ingredients: text('ingredients').notNull(), // JSON array of strings
  instructions: text('instructions').notNull(), // JSON array of strings
  prep_time: integer('prep_time'), // in minutes
  cook_time: integer('cook_time'), // in minutes
  servings: integer('servings'),
  difficulty: text('difficulty', { enum: ['easy', 'medium', 'hard'] }),
  cuisine: text('cuisine'),
  tags: text('tags'), // JSON array of strings
  image_url: text('image_url'), // External URL only (deprecated - kept for backwards compatibility)
  images: text('images'), // JSON array of image URLs (up to 6)
  is_ai_generated: boolean('is_ai_generated').default(false),
  is_public: boolean('is_public').default(false), // Recipe visibility
  is_system_recipe: boolean('is_system_recipe').default(false), // System/curated recipes
  nutrition_info: text('nutrition_info'), // JSON object with nutritional data
  model_used: text('model_used'), // AI model used for generation
  source: text('source'), // Recipe source (URL, chef name, etc.)
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),

  // Enhanced provenance tracking fields
  search_query: text('search_query'), // Search query that discovered this recipe
  discovery_date: timestamp('discovery_date', { withTimezone: true }), // When recipe was discovered
  confidence_score: decimal('confidence_score', { precision: 3, scale: 2 }), // Validation confidence (0.00-1.00)
  validation_model: text('validation_model'), // AI model used for validation
  embedding_model: text('embedding_model'), // Embedding model name for vector search

  // Week tracking for weekly recipe discovery
  discovery_week: integer('discovery_week'), // ISO week number (1-52) when discovered
  discovery_year: integer('discovery_year'), // Year when discovered
  published_date: timestamp('published_date'), // Original publication date from source

  // Recipe ratings
  system_rating: decimal('system_rating', { precision: 2, scale: 1 }), // AI-generated quality score (0.0-5.0)
  system_rating_reason: text('system_rating_reason'), // Explanation of AI rating
  avg_user_rating: decimal('avg_user_rating', { precision: 2, scale: 1 }), // Average user rating
  total_user_ratings: integer('total_user_ratings').default(0), // Count of user ratings

  // SEO slug for friendly URLs
  slug: varchar('slug', { length: 255 }).unique(), // SEO-friendly URL slug (e.g., "grandmas-chocolate-chip-cookies")

  // Meal prep flag
  is_meal_prep_friendly: boolean('is_meal_prep_friendly').default(false), // Can be frozen/stored for meal prep
}, (table) => ({
  // Performance indexes for pagination and filtering
  ratingIdx: index('idx_recipes_rating').on(table.system_rating.desc(), table.avg_user_rating.desc()),
  createdIdx: index('idx_recipes_created').on(table.created_at.desc()),
  userPublicIdx: index('idx_recipes_user_public').on(table.user_id, table.is_public),
  systemIdx: index('idx_recipes_system').on(table.is_system_recipe),
  cuisineIdx: index('idx_recipes_cuisine').on(table.cuisine),
  difficultyIdx: index('idx_recipes_difficulty').on(table.difficulty),
  publicSystemIdx: index('idx_recipes_public_system').on(table.is_public, table.is_system_recipe),
  discoveryWeekIdx: index('idx_recipes_discovery_week').on(table.discovery_year, table.discovery_week),
  slugIdx: index('idx_recipes_slug').on(table.slug), // Index for slug-based lookups
}));

// Recipe Embeddings table for vector similarity search
export const recipeEmbeddings = pgTable('recipe_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipe_id: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  embedding: vector('embedding').notNull(),
  embedding_text: text('embedding_text').notNull(),
  model_name: varchar('model_name', { length: 100 })
    .notNull()
    .default('all-MiniLM-L6-v2'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Recipe Ratings table for individual user ratings
export const recipeRatings = pgTable('recipe_ratings', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipe_id: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull(), // Clerk user ID
  rating: integer('rating').notNull(), // 0-5 star rating
  review: text('review'), // Optional review text
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // Unique constraint: one rating per user per recipe
  recipeUserUnique: unique().on(table.recipe_id, table.user_id),
  // Indexes for efficient queries
  recipeIdIdx: index('recipe_ratings_recipe_id_idx').on(table.recipe_id),
  userIdIdx: index('recipe_ratings_user_id_idx').on(table.user_id),
}));

// Recipe Flags table for content moderation
export const recipeFlags = pgTable('recipe_flags', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipe_id: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull(), // Clerk user ID of reporter
  reason: text('reason', {
    enum: ['inappropriate', 'spam', 'copyright', 'quality', 'other']
  }).notNull(),
  description: text('description'), // Optional detailed explanation
  status: text('status', {
    enum: ['pending', 'reviewed', 'resolved', 'dismissed']
  }).notNull().default('pending'),
  reviewed_by: text('reviewed_by'), // Admin user ID who reviewed
  reviewed_at: timestamp('reviewed_at'),
  review_notes: text('review_notes'), // Admin notes on review
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // Indexes for efficient queries
  recipeIdIdx: index('recipe_flags_recipe_id_idx').on(table.recipe_id),
  statusIdx: index('recipe_flags_status_idx').on(table.status),
  userIdIdx: index('recipe_flags_user_id_idx').on(table.user_id),
  createdAtIdx: index('recipe_flags_created_at_idx').on(table.created_at.desc()),
}));

// Slideshow photos table
export const slideshowPhotos = pgTable('slideshow_photos', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  image_url: text('image_url').notNull(), // Vercel Blob URL
  caption: text('caption'),
  display_order: integer('display_order').notNull().default(0), // For manual ordering
  is_active: boolean('is_active').notNull().default(true), // Can hide without deleting
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  displayOrderIdx: index('slideshow_photos_display_order_idx').on(table.display_order),
  isActiveIdx: index('slideshow_photos_is_active_idx').on(table.is_active),
}));

// Hero Background Images table
export const heroBackgrounds = pgTable('hero_backgrounds', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  image_url: text('image_url').notNull(), // Vercel Blob URL
  display_order: integer('display_order').notNull().default(0), // For sequencing
  is_active: boolean('is_active').notNull().default(true), // Can hide without deleting
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  displayOrderIdx: index('hero_backgrounds_display_order_idx').on(table.display_order),
  isActiveIdx: index('hero_backgrounds_is_active_idx').on(table.is_active),
}));

// ====================
// SOCIAL FEATURES (v0.6.0)
// ====================

// Recipe Likes table - thumbs-up/like system
export const recipeLikes = pgTable('recipe_likes', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipe_id: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull(), // Clerk user ID
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  // Unique constraint: one like per user per recipe
  recipeUserUnique: unique().on(table.recipe_id, table.user_id),
  // Indexes for efficient queries
  recipeIdIdx: index('recipe_likes_recipe_id_idx').on(table.recipe_id),
  userIdIdx: index('recipe_likes_user_id_idx').on(table.user_id),
  createdAtIdx: index('recipe_likes_created_at_idx').on(table.created_at.desc()),
}));

// Recipe Forks table - recipe copying with attribution
export const recipeForks = pgTable('recipe_forks', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipe_id: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }), // The forked (new) recipe
  original_recipe_id: text('original_recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }), // The original recipe
  user_id: text('user_id').notNull(), // Clerk user ID who forked
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  // Indexes for efficient queries
  recipeIdIdx: index('recipe_forks_recipe_id_idx').on(table.recipe_id),
  originalRecipeIdIdx: index('recipe_forks_original_recipe_id_idx').on(table.original_recipe_id),
  userIdIdx: index('recipe_forks_user_id_idx').on(table.user_id),
  createdAtIdx: index('recipe_forks_created_at_idx').on(table.created_at.desc()),
}));

// Recipe Comments table - flat commenting with emoji support
export const recipeComments = pgTable('recipe_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipe_id: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull(), // Clerk user ID
  content: text('content').notNull(), // Comment text (supports emojis)
  is_edited: boolean('is_edited').notNull().default(false), // Track if edited
  is_flagged: boolean('is_flagged').notNull().default(false), // Moderation flag
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Indexes for efficient queries
  recipeIdIdx: index('recipe_comments_recipe_id_idx').on(table.recipe_id),
  userIdIdx: index('recipe_comments_user_id_idx').on(table.user_id),
  createdAtIdx: index('recipe_comments_created_at_idx').on(table.created_at.desc()),
  isFlaggedIdx: index('recipe_comments_is_flagged_idx').on(table.is_flagged),
}));

// ====================
// MEAL PLANNING INFRASTRUCTURE (v0.65.0)
// ====================

// Normalized Ingredients table - canonical ingredient database
export const ingredients = pgTable('ingredients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(), // Canonical name (e.g., "all-purpose flour")
  display_name: text('display_name').notNull(), // Display name (e.g., "All-Purpose Flour")
  category: text('category', {
    enum: [
      'produce', 'meat', 'seafood', 'dairy', 'grains', 'baking',
      'spices', 'condiments', 'canned', 'frozen', 'beverages', 'other'
    ]
  }).notNull(),
  subcategory: text('subcategory'), // e.g., "vegetables", "chicken", "herbs"

  // Standard unit information
  standard_unit: text('standard_unit').notNull(), // cup, tbsp, oz, g, etc.
  unit_type: text('unit_type', {
    enum: ['volume', 'weight', 'count', 'subjective'] // subjective = "to taste", "pinch"
  }).notNull(),

  // Conversion factors (for shopping list consolidation)
  grams_per_cup: decimal('grams_per_cup', { precision: 8, scale: 2 }), // For weight conversions
  ml_per_cup: decimal('ml_per_cup', { precision: 8, scale: 2 }), // For volume conversions

  // Shopping/storage information
  typical_package_size: text('typical_package_size'), // "1 lb", "16 oz", "bunch"
  average_price_usd: decimal('average_price_usd', { precision: 6, scale: 2 }), // Estimated price
  shelf_life_days: integer('shelf_life_days'), // Average shelf life
  storage_location: text('storage_location', {
    enum: ['pantry', 'refrigerator', 'freezer', 'counter']
  }),

  // Metadata
  is_common: boolean('is_common').default(false), // Commonly stocked ingredient
  aliases: text('aliases'), // JSON array of alternative names
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  nameIdx: index('ingredients_name_idx').on(table.name),
  categoryIdx: index('ingredients_category_idx').on(table.category),
  isCommonIdx: index('ingredients_is_common_idx').on(table.is_common),
}));

// Recipe Ingredients mapping - connects recipes to normalized ingredients
export const recipeIngredients = pgTable('recipe_ingredients', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipe_id: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  ingredient_id: uuid('ingredient_id')
    .notNull()
    .references(() => ingredients.id, { onDelete: 'cascade' }),

  // Amount information (parsed by LLM once, stored forever)
  amount: decimal('amount', { precision: 8, scale: 3 }), // Numeric amount (e.g., 2.5)
  unit: text('unit'), // Unit as written (cup, tbsp, oz)
  preparation: text('preparation'), // "diced", "minced", "to taste"
  is_optional: boolean('is_optional').default(false),
  display_order: integer('display_order').notNull(), // Order in recipe

  // Original text for reference
  original_text: text('original_text').notNull(), // Original ingredient line from recipe

  // LLM processing metadata
  parsed_by_model: text('parsed_by_model'), // Which LLM parsed this
  confidence_score: decimal('confidence_score', { precision: 3, scale: 2 }), // 0.00-1.00
  needs_review: boolean('needs_review').default(false), // Flag for manual review

  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  recipeIdIdx: index('recipe_ingredients_recipe_id_idx').on(table.recipe_id),
  ingredientIdIdx: index('recipe_ingredients_ingredient_id_idx').on(table.ingredient_id),
  displayOrderIdx: index('recipe_ingredients_display_order_idx').on(table.recipe_id, table.display_order),
}));

// Kitchen Tools/Equipment table
export const tools = pgTable('tools', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(), // Canonical name (e.g., "large-pot")
  display_name: text('display_name').notNull(), // Display name (e.g., "Large Pot")
  category: text('category', {
    enum: [
      'cookware', 'bakeware', 'knives', 'utensils', 'appliances',
      'measuring', 'prep', 'serving', 'other'
    ]
  }).notNull(),

  // Tool characteristics
  is_essential: boolean('is_essential').default(false), // Part of basic kitchen
  is_specialized: boolean('is_specialized').default(false), // Specialized equipment
  alternatives: text('alternatives'), // JSON array of alternative tools

  // Metadata
  typical_price_usd: decimal('typical_price_usd', { precision: 8, scale: 2 }),
  description: text('description'),

  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  nameIdx: index('tools_name_idx').on(table.name),
  categoryIdx: index('tools_category_idx').on(table.category),
  isEssentialIdx: index('tools_is_essential_idx').on(table.is_essential),
}));

// Recipe Tools mapping
export const recipeTools = pgTable('recipe_tools', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipe_id: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  tool_id: uuid('tool_id')
    .notNull()
    .references(() => tools.id, { onDelete: 'cascade' }),

  is_optional: boolean('is_optional').default(false),
  quantity: integer('quantity').default(1), // How many needed (e.g., 2 mixing bowls)
  notes: text('notes'), // Special notes (e.g., "8-inch or larger")

  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  recipeIdIdx: index('recipe_tools_recipe_id_idx').on(table.recipe_id),
  toolIdIdx: index('recipe_tools_tool_id_idx').on(table.tool_id),
}));

// Recipe Tasks - breaks down cooking into trackable tasks
export const recipeTasks = pgTable('recipe_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipe_id: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),

  // Task description
  task_name: text('task_name').notNull(), // e.g., "Dice onions", "Boil pasta"
  task_order: integer('task_order').notNull(), // Sequence in recipe
  instruction_text: text('instruction_text').notNull(), // Full instruction

  // Task classification
  task_type: text('task_type', {
    enum: [
      'prep', 'mixing', 'cooking', 'baking', 'chilling', 'resting',
      'boiling', 'simmering', 'sauteing', 'searing', 'roasting',
      'grilling', 'frying', 'assembly', 'plating', 'other'
    ]
  }).notNull(),

  // Restaurant-style role (for better task organization)
  role: text('role', {
    enum: [
      'prep_cook',      // Chopping, peeling, measuring
      'line_cook',      // Active cooking, sautéing, searing
      'pastry',         // Baking, desserts
      'garde_manger',   // Cold prep, salads, appetizers
      'sous_chef',      // Coordination, multi-tasking
      'expeditor'       // Final plating, assembly
    ]
  }).notNull(),

  // Time estimates (in minutes)
  active_time: integer('active_time').notNull(), // Hands-on time
  passive_time: integer('passive_time').default(0), // Waiting time (oven, chilling)

  // Dependencies and parallelization
  can_be_parallel: boolean('can_be_parallel').default(true), // Can be done alongside other tasks
  depends_on_task_ids: text('depends_on_task_ids'), // JSON array of task IDs that must be completed first

  // Tools and ingredients used in this specific task
  ingredient_ids: text('ingredient_ids'), // JSON array of ingredient IDs used
  tool_ids: text('tool_ids'), // JSON array of tool IDs used

  // Metadata
  parsed_by_model: text('parsed_by_model'), // LLM that generated this breakdown
  confidence_score: decimal('confidence_score', { precision: 3, scale: 2 }),

  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  recipeIdIdx: index('recipe_tasks_recipe_id_idx').on(table.recipe_id),
  taskOrderIdx: index('recipe_tasks_task_order_idx').on(table.recipe_id, table.task_order),
  taskTypeIdx: index('recipe_tasks_task_type_idx').on(table.task_type),
  roleIdx: index('recipe_tasks_role_idx').on(table.role),
}));

// Meals table - complete meal plans with multiple recipes
export const meals = pgTable('meals', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: text('user_id'), // NULL for anonymous users
  name: text('name').notNull(),
  occasion: text('occasion').notNull(), // Thanksgiving, Date Night, BBQ, etc.
  servings: integer('servings').notNull(),
  description: text('description'),

  // Cached aggregated data (calculated from recipes)
  estimated_total_time: integer('estimated_total_time'), // Minutes
  estimated_active_time: integer('estimated_active_time'), // Minutes
  estimated_cost: decimal('estimated_cost', { precision: 8, scale: 2 }), // USD

  // Metadata
  is_public: boolean('is_public').default(false),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('meals_user_id_idx').on(table.user_id),
  occasionIdx: index('meals_occasion_idx').on(table.occasion),
  createdAtIdx: index('meals_created_at_idx').on(table.created_at.desc()),
}));

// Meal Recipes - links recipes to meals with course type
export const mealRecipes = pgTable('meal_recipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  meal_id: uuid('meal_id')
    .notNull()
    .references(() => meals.id, { onDelete: 'cascade' }),
  recipe_id: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),

  course_type: text('course_type', {
    enum: ['appetizer', 'main', 'side', 'dessert']
  }).notNull(),

  servings_override: integer('servings_override'), // Override recipe servings for this meal
  display_order: integer('display_order').default(0), // Order within course

  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  mealIdIdx: index('meal_recipes_meal_id_idx').on(table.meal_id),
  recipeIdIdx: index('meal_recipes_recipe_id_idx').on(table.recipe_id),
  courseTypeIdx: index('meal_recipes_course_type_idx').on(table.course_type),
}));

// Meal Occasions - predefined occasions/themes
export const mealOccasions = pgTable('meal_occasions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  display_name: text('display_name').notNull(),
  description: text('description'),
  tags: text('tags'), // JSON array
  is_holiday: boolean('is_holiday').default(false),
  season: text('season', {
    enum: ['spring', 'summer', 'fall', 'winter', 'year-round']
  }),
  icon: text('icon'), // Icon name for UI
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  nameIdx: index('meal_occasions_name_idx').on(table.name),
  seasonIdx: index('meal_occasions_season_idx').on(table.season),
}));

// Type exports
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type RecipeEmbedding = typeof recipeEmbeddings.$inferSelect;
export type NewRecipeEmbedding = typeof recipeEmbeddings.$inferInsert;
export type RecipeRating = typeof recipeRatings.$inferSelect;
export type NewRecipeRating = typeof recipeRatings.$inferInsert;
export type RecipeFlag = typeof recipeFlags.$inferSelect;
export type NewRecipeFlag = typeof recipeFlags.$inferInsert;
export type SlideshowPhoto = typeof slideshowPhotos.$inferSelect;
export type NewSlideshowPhoto = typeof slideshowPhotos.$inferInsert;
export type HeroBackground = typeof heroBackgrounds.$inferSelect;
export type NewHeroBackground = typeof heroBackgrounds.$inferInsert;
export type RecipeLike = typeof recipeLikes.$inferSelect;
export type NewRecipeLike = typeof recipeLikes.$inferInsert;
export type RecipeFork = typeof recipeForks.$inferSelect;
export type NewRecipeFork = typeof recipeForks.$inferInsert;
export type RecipeComment = typeof recipeComments.$inferSelect;
export type NewRecipeComment = typeof recipeComments.$inferInsert;
export type Ingredient = typeof ingredients.$inferSelect;
export type NewIngredient = typeof ingredients.$inferInsert;
export type RecipeIngredient = typeof recipeIngredients.$inferSelect;
export type NewRecipeIngredient = typeof recipeIngredients.$inferInsert;
export type Tool = typeof tools.$inferSelect;
export type NewTool = typeof tools.$inferInsert;
export type RecipeTool = typeof recipeTools.$inferSelect;
export type NewRecipeTool = typeof recipeTools.$inferInsert;
export type RecipeTask = typeof recipeTasks.$inferSelect;
export type NewRecipeTask = typeof recipeTasks.$inferInsert;
export type Meal = typeof meals.$inferSelect;
export type NewMeal = typeof meals.$inferInsert;
export type MealRecipe = typeof mealRecipes.$inferSelect;
export type NewMealRecipe = typeof mealRecipes.$inferInsert;
export type MealOccasion = typeof mealOccasions.$inferSelect;
export type NewMealOccasion = typeof mealOccasions.$inferInsert;

// Zod schemas for validation
export const insertRecipeSchema = createInsertSchema(recipes);
export const selectRecipeSchema = createSelectSchema(recipes);
export const insertRecipeEmbeddingSchema = createInsertSchema(recipeEmbeddings);
export const selectRecipeEmbeddingSchema = createSelectSchema(recipeEmbeddings);
export const insertRecipeRatingSchema = createInsertSchema(recipeRatings);
export const selectRecipeRatingSchema = createSelectSchema(recipeRatings);
export const insertRecipeFlagSchema = createInsertSchema(recipeFlags);
export const selectRecipeFlagSchema = createSelectSchema(recipeFlags);
export const insertSlideshowPhotoSchema = createInsertSchema(slideshowPhotos);
export const selectSlideshowPhotoSchema = createSelectSchema(slideshowPhotos);
export const insertHeroBackgroundSchema = createInsertSchema(heroBackgrounds);
export const selectHeroBackgroundSchema = createSelectSchema(heroBackgrounds);
export const insertRecipeLikeSchema = createInsertSchema(recipeLikes);
export const selectRecipeLikeSchema = createSelectSchema(recipeLikes);
export const insertRecipeForkSchema = createInsertSchema(recipeForks);
export const selectRecipeForkSchema = createSelectSchema(recipeForks);
export const insertRecipeCommentSchema = createInsertSchema(recipeComments);
export const selectRecipeCommentSchema = createSelectSchema(recipeComments);
export const insertIngredientSchema = createInsertSchema(ingredients);
export const selectIngredientSchema = createSelectSchema(ingredients);
export const insertRecipeIngredientSchema = createInsertSchema(recipeIngredients);
export const selectRecipeIngredientSchema = createSelectSchema(recipeIngredients);
export const insertToolSchema = createInsertSchema(tools);
export const selectToolSchema = createSelectSchema(tools);
export const insertRecipeToolSchema = createInsertSchema(recipeTools);
export const selectRecipeToolSchema = createSelectSchema(recipeTools);
export const insertRecipeTaskSchema = createInsertSchema(recipeTasks);
export const selectRecipeTaskSchema = createSelectSchema(recipeTasks);
export const insertMealSchema = createInsertSchema(meals);
export const selectMealSchema = createSelectSchema(meals);
export const insertMealRecipeSchema = createInsertSchema(mealRecipes);
export const selectMealRecipeSchema = createSelectSchema(mealRecipes);
export const insertMealOccasionSchema = createInsertSchema(mealOccasions);
export const selectMealOccasionSchema = createSelectSchema(mealOccasions);