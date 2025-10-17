import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { recipes } from './schema';

// Chefs table - Famous chefs/creators (no login required)
export const chefs = pgTable(
  'chefs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(), // URL-friendly: kenji-lopez-alt
    name: text('name').notNull(), // Kenji López-Alt
    display_name: text('display_name'), // J. Kenji López-Alt
    bio: text('bio'),
    profile_image_url: text('profile_image_url'),
    website: text('website'),
    social_links: jsonb('social_links').$type<{
      instagram?: string;
      twitter?: string;
      youtube?: string;
      tiktok?: string;
      facebook?: string;
    }>(),
    specialties: text('specialties').array().default([]), // ['asian', 'science', 'technique']
    is_verified: boolean('is_verified').default(false),
    is_active: boolean('is_active').default(true),
    recipe_count: integer('recipe_count').default(0),
    created_at: timestamp('created_at').defaultNow(),
    updated_at: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    slugIdx: index('idx_chefs_slug').on(table.slug),
    activeIdx: index('idx_chefs_active').on(table.is_active),
    recipeCountIdx: index('idx_chefs_recipe_count').on(table.recipe_count.desc()),
  })
);

// Chef Recipes table - Link recipes to chefs
export const chefRecipes = pgTable(
  'chef_recipes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chef_id: uuid('chef_id')
      .notNull()
      .references(() => chefs.id, { onDelete: 'cascade' }),
    recipe_id: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    original_url: text('original_url'), // Source URL from scraping
    scraped_at: timestamp('scraped_at'),
    created_at: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    uniqueChefRecipe: unique('unique_chef_recipe').on(table.chef_id, table.recipe_id),
    chefIdIdx: index('idx_chef_recipes_chef_id').on(table.chef_id),
    recipeIdIdx: index('idx_chef_recipes_recipe_id').on(table.recipe_id),
  })
);

// Scraping Jobs table - Track scraping operations
export const scrapingJobs = pgTable(
  'scraping_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chef_id: uuid('chef_id').references(() => chefs.id, { onDelete: 'set null' }),
    source_url: text('source_url').notNull(),
    status: text('status', {
      enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
    })
      .notNull()
      .default('pending'),
    recipes_scraped: integer('recipes_scraped').default(0),
    recipes_failed: integer('recipes_failed').default(0),
    total_pages: integer('total_pages').default(0),
    current_page: integer('current_page').default(0),
    error: text('error'),
    metadata: jsonb('metadata').$type<{
      crawl_id?: string;
      estimated_time?: number;
      user_agent?: string;
    }>(),
    started_at: timestamp('started_at'),
    completed_at: timestamp('completed_at'),
    created_at: timestamp('created_at').defaultNow(),
    updated_at: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    statusIdx: index('idx_scraping_jobs_status').on(table.status),
    chefIdIdx: index('idx_scraping_jobs_chef_id').on(table.chef_id),
    createdAtIdx: index('idx_scraping_jobs_created_at').on(table.created_at.desc()),
  })
);

// Type exports
export type Chef = typeof chefs.$inferSelect;
export type NewChef = typeof chefs.$inferInsert;
export type ChefRecipe = typeof chefRecipes.$inferSelect;
export type NewChefRecipe = typeof chefRecipes.$inferInsert;
export type ScrapingJob = typeof scrapingJobs.$inferSelect;
export type NewScrapingJob = typeof scrapingJobs.$inferInsert;

// Zod schemas for validation
export const insertChefSchema = createInsertSchema(chefs);
export const selectChefSchema = createSelectSchema(chefs);
export const insertChefRecipeSchema = createInsertSchema(chefRecipes);
export const selectChefRecipeSchema = createSelectSchema(chefRecipes);
export const insertScrapingJobSchema = createInsertSchema(scrapingJobs);
export const selectScrapingJobSchema = createSelectSchema(scrapingJobs);
