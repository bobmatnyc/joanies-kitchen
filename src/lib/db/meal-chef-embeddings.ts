/**
 * Database Helper Functions for Meal and Chef Embeddings
 *
 * Provides CRUD operations for storing and retrieving meal and chef embeddings
 * in the PostgreSQL database with pgvector extension.
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import type { Chef } from '@/lib/db/chef-schema';
import type { Meal } from '@/lib/db/schema';
import { chefs } from './chef-schema';
import {
  type ChefEmbedding,
  chefsEmbeddings,
  type MealEmbedding,
  mealsEmbeddings,
} from './embeddings-schema';
import { meals } from './meals-schema';

/**
 * Error class for embedding database operations
 */
export class EmbeddingDatabaseError extends Error {
  constructor(
    message: string,
    public operation: 'save' | 'get' | 'delete' | 'update' | 'search' | 'count',
    public details?: any
  ) {
    super(message);
    this.name = 'EmbeddingDatabaseError';
  }
}

// ===========================
// MEAL EMBEDDINGS
// ===========================

/**
 * Saves a meal embedding to the database
 * Creates a new record or updates existing one
 */
export async function saveMealEmbedding(
  mealId: string,
  embedding: number[],
  embeddingText: string,
  modelName: string = 'BAAI/bge-small-en-v1.5'
): Promise<MealEmbedding> {
  try {
    // Validate embedding dimensions
    if (embedding.length !== 384) {
      throw new EmbeddingDatabaseError(
        `Invalid embedding dimension: expected 384, got ${embedding.length}`,
        'save',
        { mealId, dimension: embedding.length }
      );
    }

    // Verify meal exists
    const meal = await db.query.meals.findFirst({
      where: eq(meals.id, mealId),
    });

    if (!meal) {
      throw new EmbeddingDatabaseError(`Meal not found: ${mealId}`, 'save', { mealId });
    }

    // Check if embedding already exists
    const existingEmbedding = await db
      .select()
      .from(mealsEmbeddings)
      .where(eq(mealsEmbeddings.meal_id, mealId))
      .limit(1);

    if (existingEmbedding.length > 0) {
      // Update existing embedding
      const [updated] = await db
        .update(mealsEmbeddings)
        .set({
          embedding,
          embedding_text: embeddingText,
          model_name: modelName,
          updated_at: new Date(),
        })
        .where(eq(mealsEmbeddings.meal_id, mealId))
        .returning();

      return updated;
    }

    // Insert new embedding
    const [created] = await db
      .insert(mealsEmbeddings)
      .values({
        meal_id: mealId,
        embedding,
        embedding_text: embeddingText,
        model_name: modelName,
      })
      .returning();

    return created;
  } catch (error: any) {
    if (error instanceof EmbeddingDatabaseError) {
      throw error;
    }

    throw new EmbeddingDatabaseError(`Failed to save meal embedding: ${error.message}`, 'save', {
      mealId,
      originalError: error,
    });
  }
}

/**
 * Retrieves a meal embedding from the database
 */
export async function getMealEmbedding(mealId: string): Promise<MealEmbedding | null> {
  try {
    const [embedding] = await db
      .select()
      .from(mealsEmbeddings)
      .where(eq(mealsEmbeddings.meal_id, mealId))
      .limit(1);

    return embedding || null;
  } catch (error: any) {
    throw new EmbeddingDatabaseError(`Failed to get meal embedding: ${error.message}`, 'get', {
      mealId,
      originalError: error,
    });
  }
}

/**
 * Deletes a meal embedding from the database
 */
export async function deleteMealEmbedding(mealId: string): Promise<boolean> {
  try {
    const result = await db
      .delete(mealsEmbeddings)
      .where(eq(mealsEmbeddings.meal_id, mealId))
      .returning();

    return result.length > 0;
  } catch (error: any) {
    throw new EmbeddingDatabaseError(
      `Failed to delete meal embedding: ${error.message}`,
      'delete',
      {
        mealId,
        originalError: error,
      }
    );
  }
}

/**
 * Finds similar meals using vector similarity search
 */
export async function findSimilarMeals(
  queryEmbedding: number[],
  limit: number = 10,
  minSimilarity: number = 0.3
): Promise<Array<MealEmbedding & { similarity: number; meal?: Meal }>> {
  try {
    if (queryEmbedding.length !== 384) {
      throw new EmbeddingDatabaseError(
        `Invalid query embedding dimension: expected 384, got ${queryEmbedding.length}`,
        'search',
        { dimension: queryEmbedding.length }
      );
    }

    const vectorString = `[${queryEmbedding.join(',')}]`;

    const results = await db.execute(sql`
      SELECT
        e.*,
        (1 - (e.embedding <=> ${vectorString}::vector)) as similarity,
        m.*
      FROM meals_embeddings e
      JOIN meals m ON e.meal_id = m.id
      WHERE (1 - (e.embedding <=> ${vectorString}::vector)) >= ${minSimilarity}
      ORDER BY e.embedding <=> ${vectorString}::vector
      LIMIT ${limit}
    `);

    return results.rows as any[];
  } catch (error: any) {
    throw new EmbeddingDatabaseError(`Failed to find similar meals: ${error.message}`, 'search', {
      originalError: error,
    });
  }
}

/**
 * Counts the total number of meal embeddings
 */
export async function countMealEmbeddings(): Promise<number> {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM meals_embeddings
    `);

    return Number(result.rows[0]?.count || 0);
  } catch (error: any) {
    throw new EmbeddingDatabaseError(`Failed to count meal embeddings: ${error.message}`, 'count', {
      originalError: error,
    });
  }
}

/**
 * Gets meals that need embedding generation
 */
export async function getMealsNeedingEmbedding(modelName?: string): Promise<Meal[]> {
  try {
    let query;

    if (modelName) {
      query = sql`
        SELECT m.*
        FROM meals m
        LEFT JOIN meals_embeddings e ON m.id = e.meal_id
        WHERE e.id IS NULL OR e.model_name != ${modelName}
        ORDER BY m.created_at DESC
      `;
    } else {
      query = sql`
        SELECT m.*
        FROM meals m
        LEFT JOIN meals_embeddings e ON m.id = e.meal_id
        WHERE e.id IS NULL
        ORDER BY m.created_at DESC
      `;
    }

    const results = await db.execute(query);
    return results.rows as Meal[];
  } catch (error: any) {
    throw new EmbeddingDatabaseError(
      `Failed to get meals needing embedding: ${error.message}`,
      'get',
      { originalError: error }
    );
  }
}

// ===========================
// CHEF EMBEDDINGS
// ===========================

/**
 * Saves a chef embedding to the database
 * Creates a new record or updates existing one
 */
export async function saveChefEmbedding(
  chefId: string,
  embedding: number[],
  embeddingText: string,
  modelName: string = 'BAAI/bge-small-en-v1.5'
): Promise<ChefEmbedding> {
  try {
    // Validate embedding dimensions
    if (embedding.length !== 384) {
      throw new EmbeddingDatabaseError(
        `Invalid embedding dimension: expected 384, got ${embedding.length}`,
        'save',
        { chefId, dimension: embedding.length }
      );
    }

    // Verify chef exists
    const chef = await db.query.chefs.findFirst({
      where: eq(chefs.id, chefId),
    });

    if (!chef) {
      throw new EmbeddingDatabaseError(`Chef not found: ${chefId}`, 'save', { chefId });
    }

    // Check if embedding already exists
    const existingEmbedding = await db
      .select()
      .from(chefsEmbeddings)
      .where(eq(chefsEmbeddings.chef_id, chefId))
      .limit(1);

    if (existingEmbedding.length > 0) {
      // Update existing embedding
      const [updated] = await db
        .update(chefsEmbeddings)
        .set({
          embedding,
          embedding_text: embeddingText,
          model_name: modelName,
          updated_at: new Date(),
        })
        .where(eq(chefsEmbeddings.chef_id, chefId))
        .returning();

      return updated;
    }

    // Insert new embedding
    const [created] = await db
      .insert(chefsEmbeddings)
      .values({
        chef_id: chefId,
        embedding,
        embedding_text: embeddingText,
        model_name: modelName,
      })
      .returning();

    return created;
  } catch (error: any) {
    if (error instanceof EmbeddingDatabaseError) {
      throw error;
    }

    throw new EmbeddingDatabaseError(`Failed to save chef embedding: ${error.message}`, 'save', {
      chefId,
      originalError: error,
    });
  }
}

/**
 * Retrieves a chef embedding from the database
 */
export async function getChefEmbedding(chefId: string): Promise<ChefEmbedding | null> {
  try {
    const [embedding] = await db
      .select()
      .from(chefsEmbeddings)
      .where(eq(chefsEmbeddings.chef_id, chefId))
      .limit(1);

    return embedding || null;
  } catch (error: any) {
    throw new EmbeddingDatabaseError(`Failed to get chef embedding: ${error.message}`, 'get', {
      chefId,
      originalError: error,
    });
  }
}

/**
 * Deletes a chef embedding from the database
 */
export async function deleteChefEmbedding(chefId: string): Promise<boolean> {
  try {
    const result = await db
      .delete(chefsEmbeddings)
      .where(eq(chefsEmbeddings.chef_id, chefId))
      .returning();

    return result.length > 0;
  } catch (error: any) {
    throw new EmbeddingDatabaseError(
      `Failed to delete chef embedding: ${error.message}`,
      'delete',
      {
        chefId,
        originalError: error,
      }
    );
  }
}

/**
 * Finds similar chefs using vector similarity search
 */
export async function findSimilarChefs(
  queryEmbedding: number[],
  limit: number = 10,
  minSimilarity: number = 0.3
): Promise<Array<ChefEmbedding & { similarity: number; chef?: Chef }>> {
  try {
    if (queryEmbedding.length !== 384) {
      throw new EmbeddingDatabaseError(
        `Invalid query embedding dimension: expected 384, got ${queryEmbedding.length}`,
        'search',
        { dimension: queryEmbedding.length }
      );
    }

    const vectorString = `[${queryEmbedding.join(',')}]`;

    const results = await db.execute(sql`
      SELECT
        e.*,
        (1 - (e.embedding <=> ${vectorString}::vector)) as similarity,
        c.*
      FROM chefs_embeddings e
      JOIN chefs c ON e.chef_id = c.id
      WHERE (1 - (e.embedding <=> ${vectorString}::vector)) >= ${minSimilarity}
      ORDER BY e.embedding <=> ${vectorString}::vector
      LIMIT ${limit}
    `);

    return results.rows as any[];
  } catch (error: any) {
    throw new EmbeddingDatabaseError(`Failed to find similar chefs: ${error.message}`, 'search', {
      originalError: error,
    });
  }
}

/**
 * Counts the total number of chef embeddings
 */
export async function countChefEmbeddings(): Promise<number> {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM chefs_embeddings
    `);

    return Number(result.rows[0]?.count || 0);
  } catch (error: any) {
    throw new EmbeddingDatabaseError(`Failed to count chef embeddings: ${error.message}`, 'count', {
      originalError: error,
    });
  }
}

/**
 * Gets chefs that need embedding generation
 */
export async function getChefsNeedingEmbedding(modelName?: string): Promise<Chef[]> {
  try {
    let query;

    if (modelName) {
      query = sql`
        SELECT c.*
        FROM chefs c
        LEFT JOIN chefs_embeddings e ON c.id = e.chef_id
        WHERE e.id IS NULL OR e.model_name != ${modelName}
        ORDER BY c.created_at DESC
      `;
    } else {
      query = sql`
        SELECT c.*
        FROM chefs c
        LEFT JOIN chefs_embeddings e ON c.id = e.chef_id
        WHERE e.id IS NULL
        ORDER BY c.created_at DESC
      `;
    }

    const results = await db.execute(query);
    return results.rows as Chef[];
  } catch (error: any) {
    throw new EmbeddingDatabaseError(
      `Failed to get chefs needing embedding: ${error.message}`,
      'get',
      { originalError: error }
    );
  }
}
