import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  json,
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
 * User Discovery Schema
 *
 * This file contains all database tables for user discovery features:
 * - User profiles (extended user information beyond Clerk)
 * - Collections (themed recipe groupings)
 * - Social features (follows, favorites)
 * - Analytics & tracking (views, statistics)
 *
 * Phase 1 Implementation: Profiles, Collections, Favorites
 * Future: Follows, Views, Moderation (Phase 2-4)
 */

// ============================================================================
// 1. USER PROFILES
// ============================================================================

/**
 * Extended user profile information beyond Clerk authentication
 * One-to-one relationship with Clerk user ID
 */
export const userProfiles = pgTable(
  'user_profiles',
  {
    // Primary Key & Identity
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: text('user_id').notNull().unique(), // Clerk user ID

    // Profile Information
    username: varchar('username', { length: 30 }).notNull().unique(), // URL-friendly, unique identifier
    display_name: varchar('display_name', { length: 100 }).notNull(),
    bio: text('bio'), // Markdown support, max 500 chars enforced in app
    profile_image_url: text('profile_image_url'), // Optional custom profile image

    // Location & Contact
    location: varchar('location', { length: 100 }), // City, State/Country
    website: text('website'),

    // Cooking Profile
    specialties: json('specialties').$type<string[]>(), // e.g., ["Italian", "Baking"]

    // Privacy Settings
    is_public: boolean('is_public').notNull().default(true),

    // Timestamps
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // Indexes
    userIdIdx: index('user_profiles_user_id_idx').on(table.user_id),
    usernameIdx: index('user_profiles_username_lower_idx').on(sql`LOWER(${table.username})`),
    publicIdx: index('user_profiles_public_idx').on(table.is_public),
  })
);

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;

// Zod validation schemas
// Simplified for Zod v3 compatibility - using drizzle-zod's generated schema as-is
export const insertUserProfileSchema = createInsertSchema(userProfiles);

export const selectUserProfileSchema = createSelectSchema(userProfiles);

// ============================================================================
// 2. COLLECTIONS
// ============================================================================

/**
 * Recipe collections - themed groupings of recipes
 * Similar to Pinterest boards or Spotify playlists
 */
export const collections = pgTable(
  'collections',
  {
    // Primary Key
    id: uuid('id').primaryKey().defaultRandom(),

    // Ownership
    user_id: text('user_id')
      .notNull()
      .references(() => userProfiles.user_id, { onDelete: 'cascade' }),

    // Collection Information
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(), // URL-friendly
    description: text('description'), // Markdown support, 500 chars

    // Cover Image (optional, auto-generated from first 4 recipes if not provided)
    cover_image_url: text('cover_image_url'),

    // Metadata
    recipe_count: integer('recipe_count').notNull().default(0), // Computed via trigger

    // Visibility
    is_public: boolean('is_public').notNull().default(false),

    // Timestamps
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
    last_recipe_added_at: timestamp('last_recipe_added_at'),
  },
  (table) => ({
    // Unique constraint: slug must be unique per user
    userSlugUnique: unique('collections_user_slug_unique').on(table.user_id, table.slug),

    // Indexes
    userIdIdx: index('collections_user_id_idx').on(table.user_id),
    publicIdx: index('collections_public_idx').on(table.is_public, table.created_at.desc()),
    slugIdx: index('collections_slug_idx').on(table.slug),
  })
);

export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;

// Zod validation schemas
// Simplified for Zod v3 compatibility
export const insertCollectionSchema = createInsertSchema(collections);

export const selectCollectionSchema = createSelectSchema(collections);

// ============================================================================
// 3. COLLECTION RECIPES
// ============================================================================

/**
 * Many-to-many relationship between collections and recipes
 * Allows manual ordering and personal notes
 */
export const collectionRecipes = pgTable(
  'collection_recipes',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Relationships
    collection_id: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    recipe_id: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),

    // Organization
    position: integer('position').notNull().default(0), // Manual ordering
    personal_note: text('personal_note'), // Personal note about this recipe

    // Timestamps
    added_at: timestamp('added_at').notNull().defaultNow(),
  },
  (table) => ({
    // Unique constraint: recipe can only be in collection once
    collectionRecipeUnique: unique('collection_recipes_unique').on(
      table.collection_id,
      table.recipe_id
    ),

    // Indexes
    collectionIdIdx: index('collection_recipes_collection_id_idx').on(table.collection_id),
    recipeIdIdx: index('collection_recipes_recipe_id_idx').on(table.recipe_id),
    positionIdx: index('collection_recipes_position_idx').on(table.collection_id, table.position),
  })
);

export type CollectionRecipe = typeof collectionRecipes.$inferSelect;
export type NewCollectionRecipe = typeof collectionRecipes.$inferInsert;

// Simplified for Zod v3 compatibility
export const insertCollectionRecipeSchema = createInsertSchema(collectionRecipes);

export const selectCollectionRecipeSchema = createSelectSchema(collectionRecipes);

// ============================================================================
// 4. FAVORITES
// ============================================================================

/**
 * User favorite recipes (heart button)
 * Separate from collections for quick favoriting without organizing
 */
export const favorites = pgTable(
  'favorites',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Relationships
    user_id: text('user_id')
      .notNull()
      .references(() => userProfiles.user_id, { onDelete: 'cascade' }),
    recipe_id: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),

    // Timestamps
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    // Unique constraint: recipe can only be favorited once per user
    userRecipeUnique: unique('favorites_unique').on(table.user_id, table.recipe_id),

    // Indexes
    userIdIdx: index('favorites_user_id_idx').on(table.user_id, table.created_at.desc()),
    recipeIdIdx: index('favorites_recipe_id_idx').on(table.recipe_id),
  })
);

export type Favorite = typeof favorites.$inferSelect;
export type NewFavorite = typeof favorites.$inferInsert;

export const insertFavoriteSchema = createInsertSchema(favorites);
export const selectFavoriteSchema = createSelectSchema(favorites);

// ============================================================================
// 5. RECIPE VIEWS
// ============================================================================

/**
 * Recipe view history for analytics and "recently viewed" feature
 */
export const recipeViews = pgTable(
  'recipe_views',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Relationships (user_id can be null for anonymous views)
    user_id: text('user_id').references(() => userProfiles.user_id, { onDelete: 'cascade' }),
    recipe_id: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),

    // Timestamps
    viewed_at: timestamp('viewed_at').notNull().defaultNow(),
  },
  (table) => ({
    // Indexes
    userIdViewedAtIdx: index('recipe_views_user_id_viewed_at_idx').on(
      table.user_id,
      table.viewed_at.desc()
    ),
    recipeIdIdx: index('recipe_views_recipe_id_idx').on(table.recipe_id),
    viewedAtIdx: index('recipe_views_viewed_at_idx').on(table.viewed_at.desc()),
  })
);

export type RecipeView = typeof recipeViews.$inferSelect;
export type NewRecipeView = typeof recipeViews.$inferInsert;

export const insertRecipeViewSchema = createInsertSchema(recipeViews);
export const selectRecipeViewSchema = createSelectSchema(recipeViews);

// ============================================================================
// PHASE 1 EXPORTS
// ============================================================================

/**
 * Phase 1 Tables (Current Implementation):
 * - userProfiles
 * - collections
 * - collectionRecipes
 * - favorites
 * - recipeViews
 *
 * Future Phases:
 * - follows (Phase 2)
 * - collectionFollowers (Phase 2)
 * - profileStatistics (Phase 3)
 * - profileViews (Phase 3)
 * - collectionViews (Phase 3)
 * - userReports (Phase 4)
 * - collectionReports (Phase 4)
 */
