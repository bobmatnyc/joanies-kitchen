/**
 * Embeddings Schema for Meals and Chefs
 *
 * Extends the existing recipe embeddings pattern to support
 * semantic search for meals and chefs.
 */

import { customType, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { chefs } from './chef-schema';
import { meals } from './meals-schema';

// Custom type for pgvector embedding columns (384 dimensions)
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
      const cleaned = value.replace(/[[\]]/g, '');
      return cleaned.split(',').map(Number);
    }
    return value as any;
  },
});

// Meals Embeddings table for vector similarity search
export const mealsEmbeddings = pgTable(
  'meals_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    meal_id: uuid('meal_id')
      .notNull()
      .references(() => meals.id, { onDelete: 'cascade' }),
    embedding: vector('embedding').notNull(),
    embedding_text: text('embedding_text').notNull(),
    model_name: varchar('model_name', { length: 100 }).notNull().default('BAAI/bge-small-en-v1.5'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    mealIdIdx: index('meals_embeddings_meal_id_idx').on(table.meal_id),
    createdAtIdx: index('meals_embeddings_created_at_idx').on(table.created_at.desc()),
  })
);

// Chefs Embeddings table for vector similarity search
export const chefsEmbeddings = pgTable(
  'chefs_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chef_id: uuid('chef_id')
      .notNull()
      .references(() => chefs.id, { onDelete: 'cascade' }),
    embedding: vector('embedding').notNull(),
    embedding_text: text('embedding_text').notNull(),
    model_name: varchar('model_name', { length: 100 }).notNull().default('BAAI/bge-small-en-v1.5'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    chefIdIdx: index('chefs_embeddings_chef_id_idx').on(table.chef_id),
    createdAtIdx: index('chefs_embeddings_created_at_idx').on(table.created_at.desc()),
  })
);

// Type exports
export type MealEmbedding = typeof mealsEmbeddings.$inferSelect;
export type NewMealEmbedding = typeof mealsEmbeddings.$inferInsert;
export type ChefEmbedding = typeof chefsEmbeddings.$inferSelect;
export type NewChefEmbedding = typeof chefsEmbeddings.$inferInsert;

// Zod schemas for validation
export const insertMealEmbeddingSchema = createInsertSchema(mealsEmbeddings);
export const selectMealEmbeddingSchema = createSelectSchema(mealsEmbeddings);
export const insertChefEmbeddingSchema = createInsertSchema(chefsEmbeddings);
export const selectChefEmbeddingSchema = createSelectSchema(chefsEmbeddings);
