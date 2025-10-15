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
  userId: text('user_id').notNull(), // Clerk user ID
  name: text('name').notNull(),
  description: text('description'),
  ingredients: text('ingredients').notNull(), // JSON array of strings
  instructions: text('instructions').notNull(), // JSON array of strings
  prepTime: integer('prep_time'), // in minutes
  cookTime: integer('cook_time'), // in minutes
  servings: integer('servings'),
  difficulty: text('difficulty', { enum: ['easy', 'medium', 'hard'] }),
  cuisine: text('cuisine'),
  tags: text('tags'), // JSON array of strings
  imageUrl: text('image_url'), // External URL only (deprecated - kept for backwards compatibility)
  images: text('images'), // JSON array of image URLs (up to 6)
  isAiGenerated: boolean('is_ai_generated').default(false),
  isPublic: boolean('is_public').default(false), // Recipe visibility
  isSystemRecipe: boolean('is_system_recipe').default(false), // System/curated recipes
  nutritionInfo: text('nutrition_info'), // JSON object with nutritional data
  modelUsed: text('model_used'), // AI model used for generation
  source: text('source'), // Recipe source (URL, chef name, etc.)
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),

  // Enhanced provenance tracking fields
  searchQuery: text('search_query'), // Search query that discovered this recipe
  discoveryDate: timestamp('discovery_date', { withTimezone: true }), // When recipe was discovered
  confidenceScore: decimal('confidence_score', { precision: 3, scale: 2 }), // Validation confidence (0.00-1.00)
  validationModel: text('validation_model'), // AI model used for validation
  embeddingModel: text('embedding_model'), // Embedding model name for vector search

  // Week tracking for weekly recipe discovery
  discoveryWeek: integer('discovery_week'), // ISO week number (1-52) when discovered
  discoveryYear: integer('discovery_year'), // Year when discovered
  publishedDate: timestamp('published_date'), // Original publication date from source

  // Recipe ratings
  systemRating: decimal('system_rating', { precision: 2, scale: 1 }), // AI-generated quality score (0.0-5.0)
  systemRatingReason: text('system_rating_reason'), // Explanation of AI rating
  avgUserRating: decimal('avg_user_rating', { precision: 2, scale: 1 }), // Average user rating
  totalUserRatings: integer('total_user_ratings').default(0), // Count of user ratings
}, (table) => ({
  // Performance indexes for pagination and filtering
  ratingIdx: index('idx_recipes_rating').on(table.systemRating.desc(), table.avgUserRating.desc()),
  createdIdx: index('idx_recipes_created').on(table.createdAt.desc()),
  userPublicIdx: index('idx_recipes_user_public').on(table.userId, table.isPublic),
  systemIdx: index('idx_recipes_system').on(table.isSystemRecipe),
  cuisineIdx: index('idx_recipes_cuisine').on(table.cuisine),
  difficultyIdx: index('idx_recipes_difficulty').on(table.difficulty),
  publicSystemIdx: index('idx_recipes_public_system').on(table.isPublic, table.isSystemRecipe),
  discoveryWeekIdx: index('idx_recipes_discovery_week').on(table.discoveryYear, table.discoveryWeek),
}));

// Recipe Embeddings table for vector similarity search
export const recipeEmbeddings = pgTable('recipe_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  embedding: vector('embedding').notNull(),
  embeddingText: text('embedding_text').notNull(),
  modelName: varchar('model_name', { length: 100 })
    .notNull()
    .default('all-MiniLM-L6-v2'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Recipe Ratings table for individual user ratings
export const recipeRatings = pgTable('recipe_ratings', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(), // Clerk user ID
  rating: integer('rating').notNull(), // 0-5 star rating
  review: text('review'), // Optional review text
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // Unique constraint: one rating per user per recipe
  recipeUserUnique: unique().on(table.recipeId, table.userId),
  // Indexes for efficient queries
  recipeIdIdx: index('recipe_ratings_recipe_id_idx').on(table.recipeId),
  userIdIdx: index('recipe_ratings_user_id_idx').on(table.userId),
}));

// Type exports
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type RecipeEmbedding = typeof recipeEmbeddings.$inferSelect;
export type NewRecipeEmbedding = typeof recipeEmbeddings.$inferInsert;
export type RecipeRating = typeof recipeRatings.$inferSelect;
export type NewRecipeRating = typeof recipeRatings.$inferInsert;

// Zod schemas for validation
export const insertRecipeSchema = createInsertSchema(recipes);
export const selectRecipeSchema = createSelectSchema(recipes);
export const insertRecipeEmbeddingSchema = createInsertSchema(recipeEmbeddings);
export const selectRecipeEmbeddingSchema = createSelectSchema(recipeEmbeddings);
export const insertRecipeRatingSchema = createInsertSchema(recipeRatings);
export const selectRecipeRatingSchema = createSelectSchema(recipeRatings);