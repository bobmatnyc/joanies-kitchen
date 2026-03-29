import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

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

// Type exports
export type RecipeDiscoveryRun = typeof recipeDiscoveryRuns.$inferSelect;
export type NewRecipeDiscoveryRun = typeof recipeDiscoveryRuns.$inferInsert;

// Zod schemas for validation
export const insertRecipeDiscoveryRunSchema = createInsertSchema(recipeDiscoveryRuns);
export const selectRecipeDiscoveryRunSchema = createSelectSchema(recipeDiscoveryRuns);
