/**
 * Database type definitions and utilities
 * Provides type-safe interfaces for database operations
 */

import type { chefs, ingredients, recipes } from './schema';

/**
 * Inferred types from Drizzle schema
 */
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;

export type Chef = typeof chefs.$inferSelect;
export type NewChef = typeof chefs.$inferInsert;

export type Ingredient = typeof ingredients.$inferSelect;
export type NewIngredient = typeof ingredients.$inferInsert;

/**
 * Generic database query result type
 */
export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

/**
 * Generic database row type for raw SQL queries
 */
export type DatabaseRow = Record<string, unknown>;

/**
 * Embedding vector type (for pgvector)
 */
export type EmbeddingVector = number[];

/**
 * Type guard to check if a value is a valid embedding vector
 */
export function isEmbeddingVector(value: unknown): value is EmbeddingVector {
  return Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'number');
}

/**
 * Database transaction type
 */
export type Transaction = {
  execute: <T = DatabaseRow>(query: string, params?: unknown[]) => Promise<QueryResult<T>>;
};
