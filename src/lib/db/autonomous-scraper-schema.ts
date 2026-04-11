import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { recipes } from './schema';

/**
 * Recipe Discovery Runs table
 *
 * Tracks each autonomous scraper run for monitoring and observability.
 * One record per run (daily cron or manual trigger).
 */
export const recipeDiscoveryRuns = pgTable(
  'recipe_discovery_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    run_type: text('run_type').notNull().default('daily'), // 'daily' | 'manual'
    status: text('status').notNull().default('running'), // 'running' | 'completed' | 'failed'
    urls_discovered: integer('urls_discovered').default(0),
    recipes_extracted: integer('recipes_extracted').default(0),
    recipes_stored: integer('recipes_stored').default(0),
    recipes_skipped: integer('recipes_skipped').default(0),
    chefs_created: integer('chefs_created').default(0),
    errors: jsonb('errors').$type<string[]>().default([]),
    dry_run: boolean('dry_run').default(false),
    started_at: timestamp('started_at').defaultNow(),
    completed_at: timestamp('completed_at'),
    duration_ms: integer('duration_ms'),
  },
  (table) => ({
    statusIdx: index('idx_recipe_discovery_runs_status').on(table.status),
    runTypeIdx: index('idx_recipe_discovery_runs_run_type').on(table.run_type),
    startedAtIdx: index('idx_recipe_discovery_runs_started_at').on(table.started_at.desc()),
  })
);

/**
 * Recipe of the Day table
 *
 * Tracks which recipe was featured on each date.
 * One record per calendar day — unique constraint on date.
 * Populated by the daily cron job after ingestion runs.
 */
export const recipeOfTheDay = pgTable(
  'recipe_of_the_day',
  {
    id: serial('id').primaryKey(),
    recipe_id: text('recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
    date: date('date').notNull(),
    source_url: text('source_url'),
    scraped_at: timestamp('scraped_at').defaultNow(),
    theme: text('theme').default('no-waste'), // e.g., "no-waste", "seasonal"
  },
  (table) => ({
    dateUnique: unique('recipe_of_the_day_date_unique').on(table.date),
    dateIdx: index('idx_recipe_of_the_day_date').on(table.date),
    recipeIdIdx: index('idx_recipe_of_the_day_recipe_id').on(table.recipe_id),
  })
);

// Type exports
export type RecipeDiscoveryRun = typeof recipeDiscoveryRuns.$inferSelect;
export type NewRecipeDiscoveryRun = typeof recipeDiscoveryRuns.$inferInsert;
export type RecipeOfTheDay = typeof recipeOfTheDay.$inferSelect;
export type NewRecipeOfTheDay = typeof recipeOfTheDay.$inferInsert;

// Zod schemas for validation
export const insertRecipeDiscoveryRunSchema = createInsertSchema(recipeDiscoveryRuns);
export const selectRecipeDiscoveryRunSchema = createSelectSchema(recipeDiscoveryRuns);
export const insertRecipeOfTheDaySchema = createInsertSchema(recipeOfTheDay);
export const selectRecipeOfTheDaySchema = createSelectSchema(recipeOfTheDay);
