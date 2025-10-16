/**
 * Database Helper Functions for Recipe Embeddings
 *
 * Provides CRUD operations for storing and retrieving recipe embeddings
 * in the PostgreSQL database with pgvector extension.
 */

import { db } from '@/lib/db';
import { recipeEmbeddings, recipes, RecipeEmbedding, NewRecipeEmbedding } from '@/lib/db/schema';
import { eq, sql, desc } from 'drizzle-orm';

/**
 * Error class for embedding database operations
 */
export class EmbeddingDatabaseError extends Error {
  constructor(
    message: string,
    public operation: 'save' | 'get' | 'delete' | 'update' | 'search',
    public details?: any
  ) {
    super(message);
    this.name = 'EmbeddingDatabaseError';
  }
}

/**
 * Saves a recipe embedding to the database
 * Creates a new record or updates existing one
 *
 * @param recipeId - Recipe ID to associate embedding with
 * @param embedding - 384-dimensional embedding vector
 * @param embeddingText - Text that was used to generate the embedding
 * @param modelName - Name of the embedding model (default: all-MiniLM-L6-v2)
 * @returns Created embedding record
 *
 * @throws {EmbeddingDatabaseError} If recipe doesn't exist or database operation fails
 *
 * @example
 * const result = await saveRecipeEmbedding(
 *   "recipe-123",
 *   [0.1, 0.2, ...],
 *   "Spaghetti Carbonara. Classic Italian pasta...",
 *   "all-MiniLM-L6-v2"
 * );
 */
export async function saveRecipeEmbedding(
  recipeId: string,
  embedding: number[],
  embeddingText: string,
  modelName: string = 'BAAI/bge-small-en-v1.5'
): Promise<RecipeEmbedding> {
  try {
    // Validate embedding dimensions
    if (embedding.length !== 384) {
      throw new EmbeddingDatabaseError(
        `Invalid embedding dimension: expected 384, got ${embedding.length}`,
        'save',
        { recipeId, dimension: embedding.length }
      );
    }

    // Verify recipe exists
    const recipe = await db.query.recipes.findFirst({
      where: eq(recipes.id, recipeId),
    });

    if (!recipe) {
      throw new EmbeddingDatabaseError(
        `Recipe not found: ${recipeId}`,
        'save',
        { recipeId }
      );
    }

    // Check if embedding already exists
    const existingEmbedding = await db.query.recipeEmbeddings.findFirst({
      where: eq(recipeEmbeddings.recipe_id, recipeId),
    });

    if (existingEmbedding) {
      // Update existing embedding
      const [updated] = await db
        .update(recipeEmbeddings)
        .set({
          embedding,
          embedding_text: embeddingText,
          model_name: modelName,
          updated_at: new Date(),
        })
        .where(eq(recipeEmbeddings.recipe_id, recipeId))
        .returning();

      // Update the recipe's embedding_model field as well
      await db
        .update(recipes)
        .set({ embedding_model: modelName })
        .where(eq(recipes.id, recipeId));

      return updated;
    }

    // Insert new embedding
    const [created] = await db
      .insert(recipeEmbeddings)
      .values({
        recipe_id: recipeId,
        embedding,
        embedding_text: embeddingText,
        model_name: modelName,
      })
      .returning();

    // Update the recipe's embedding_model field
    await db
      .update(recipes)
      .set({ embedding_model: modelName })
      .where(eq(recipes.id, recipeId));

    return created;

  } catch (error: any) {
    if (error instanceof EmbeddingDatabaseError) {
      throw error;
    }

    throw new EmbeddingDatabaseError(
      `Failed to save recipe embedding: ${error.message}`,
      'save',
      { recipeId, originalError: error }
    );
  }
}

/**
 * Retrieves a recipe embedding from the database
 *
 * @param recipeId - Recipe ID to get embedding for
 * @returns Recipe embedding record or null if not found
 *
 * @example
 * const embedding = await getRecipeEmbedding("recipe-123");
 * if (embedding) {
 *   console.log(embedding.embedding.length); // 384
 * }
 */
export async function getRecipeEmbedding(
  recipeId: string
): Promise<RecipeEmbedding | null> {
  try {
    const embedding = await db.query.recipeEmbeddings.findFirst({
      where: eq(recipeEmbeddings.recipe_id, recipeId),
    });

    return embedding || null;

  } catch (error: any) {
    throw new EmbeddingDatabaseError(
      `Failed to get recipe embedding: ${error.message}`,
      'get',
      { recipeId, originalError: error }
    );
  }
}

/**
 * Deletes a recipe embedding from the database
 *
 * @param recipeId - Recipe ID to delete embedding for
 * @returns True if embedding was deleted, false if not found
 *
 * @example
 * const deleted = await deleteRecipeEmbedding("recipe-123");
 * console.log(deleted); // true
 */
export async function deleteRecipeEmbedding(recipeId: string): Promise<boolean> {
  try {
    const result = await db
      .delete(recipeEmbeddings)
      .where(eq(recipeEmbeddings.recipe_id, recipeId))
      .returning();

    // Clear the recipe's embedding_model field
    if (result.length > 0) {
      await db
        .update(recipes)
        .set({ embedding_model: null })
        .where(eq(recipes.id, recipeId));
    }

    return result.length > 0;

  } catch (error: any) {
    throw new EmbeddingDatabaseError(
      `Failed to delete recipe embedding: ${error.message}`,
      'delete',
      { recipeId, originalError: error }
    );
  }
}

/**
 * Updates an existing recipe embedding
 * This is an alias for saveRecipeEmbedding which handles both create and update
 *
 * @param recipeId - Recipe ID to update embedding for
 * @param embedding - New 384-dimensional embedding vector
 * @param embeddingText - New text that was used to generate the embedding
 * @param modelName - Name of the embedding model
 * @returns Updated embedding record
 *
 * @example
 * const updated = await updateRecipeEmbedding(
 *   "recipe-123",
 *   newEmbedding,
 *   "Updated recipe text"
 * );
 */
export async function updateRecipeEmbedding(
  recipeId: string,
  embedding: number[],
  embeddingText: string,
  modelName: string = 'BAAI/bge-small-en-v1.5'
): Promise<RecipeEmbedding> {
  return saveRecipeEmbedding(recipeId, embedding, embeddingText, modelName);
}

/**
 * Finds similar recipes using vector similarity search
 * Uses cosine distance to find nearest neighbors
 *
 * @param queryEmbedding - Query embedding vector to find similar recipes for
 * @param limit - Maximum number of results to return (default: 10)
 * @param minSimilarity - Minimum similarity threshold (default: 0.3)
 * @returns Array of recipe embeddings sorted by similarity (most similar first)
 *
 * @example
 * const similar = await findSimilarRecipes(queryEmbedding, 5, 0.5);
 * similar.forEach(result => {
 *   console.log(`Recipe: ${result.recipe?.name}, Similarity: ${result.similarity}`);
 * });
 */
export async function findSimilarRecipes(
  queryEmbedding: number[],
  limit: number = 10,
  minSimilarity: number = 0.3
): Promise<Array<RecipeEmbedding & { similarity: number; recipe?: any }>> {
  try {
    // Validate query embedding
    if (queryEmbedding.length !== 384) {
      throw new EmbeddingDatabaseError(
        `Invalid query embedding dimension: expected 384, got ${queryEmbedding.length}`,
        'search',
        { dimension: queryEmbedding.length }
      );
    }

    // Convert to pgvector format
    const vectorString = `[${queryEmbedding.join(',')}]`;

    // Query using cosine distance
    // Note: Smaller distance = more similar
    // Cosine distance = 1 - cosine_similarity
    // So we convert back: similarity = 1 - distance
    const results = await db.execute(sql`
      SELECT
        e.*,
        (1 - (e.embedding <=> ${vectorString}::vector)) as similarity,
        r.name as recipe_name,
        r.description as recipe_description,
        r.cuisine as recipe_cuisine
      FROM recipe_embeddings e
      JOIN recipes r ON e.recipe_id = r.id
      WHERE (1 - (e.embedding <=> ${vectorString}::vector)) >= ${minSimilarity}
      ORDER BY e.embedding <=> ${vectorString}::vector
      LIMIT ${limit}
    `);

    return results.rows as any[];

  } catch (error: any) {
    throw new EmbeddingDatabaseError(
      `Failed to find similar recipes: ${error.message}`,
      'search',
      { originalError: error }
    );
  }
}

/**
 * Gets all recipe embeddings with their associated recipes
 * Useful for batch processing or analytics
 *
 * @param limit - Maximum number of results to return
 * @param offset - Number of results to skip (for pagination)
 * @returns Array of recipe embeddings with recipe data
 *
 * @example
 * const embeddings = await getAllRecipeEmbeddings(100, 0);
 * console.log(`Found ${embeddings.length} embeddings`);
 */
export async function getAllRecipeEmbeddings(
  limit: number = 100,
  offset: number = 0
): Promise<Array<RecipeEmbedding & { recipe?: any }>> {
  try {
    const results = await db.execute(sql`
      SELECT
        e.*,
        r.name as recipe_name,
        r.description as recipe_description,
        r.cuisine as recipe_cuisine,
        r.tags as recipe_tags
      FROM recipe_embeddings e
      LEFT JOIN recipes r ON e.recipe_id = r.id
      ORDER BY e.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    return results.rows as any[];

  } catch (error: any) {
    throw new EmbeddingDatabaseError(
      `Failed to get all recipe embeddings: ${error.message}`,
      'get',
      { originalError: error }
    );
  }
}

/**
 * Counts the total number of recipe embeddings in the database
 *
 * @returns Total count of embeddings
 *
 * @example
 * const count = await countRecipeEmbeddings();
 * console.log(`Total embeddings: ${count}`);
 */
export async function countRecipeEmbeddings(): Promise<number> {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM recipe_embeddings
    `);

    return Number(result.rows[0]?.count || 0);

  } catch (error: any) {
    throw new EmbeddingDatabaseError(
      `Failed to count recipe embeddings: ${error.message}`,
      'get',
      { originalError: error }
    );
  }
}

/**
 * Gets recipe embeddings that are missing or outdated
 * Useful for batch regeneration of embeddings
 *
 * @param modelName - Filter by model name (optional)
 * @returns Array of recipes that need embedding generation
 *
 * @example
 * const needsEmbedding = await getRecipesNeedingEmbedding();
 * console.log(`${needsEmbedding.length} recipes need embeddings`);
 */
export async function getRecipesNeedingEmbedding(
  modelName?: string
): Promise<any[]> {
  try {
    let query;

    if (modelName) {
      // Find recipes with embeddings from different model
      query = sql`
        SELECT r.*
        FROM recipes r
        LEFT JOIN recipe_embeddings e ON r.id = e.recipe_id
        WHERE e.id IS NULL OR e.model_name != ${modelName}
        ORDER BY r.created_at DESC
      `;
    } else {
      // Find recipes without any embeddings
      query = sql`
        SELECT r.*
        FROM recipes r
        LEFT JOIN recipe_embeddings e ON r.id = e.recipe_id
        WHERE e.id IS NULL
        ORDER BY r.created_at DESC
      `;
    }

    const results = await db.execute(query);
    return results.rows as any[];

  } catch (error: any) {
    throw new EmbeddingDatabaseError(
      `Failed to get recipes needing embedding: ${error.message}`,
      'get',
      { originalError: error }
    );
  }
}

/**
 * Batch saves multiple recipe embeddings
 * More efficient than saving one at a time
 *
 * @param embeddings - Array of embedding data to save
 * @returns Array of saved embedding records
 *
 * @example
 * const saved = await batchSaveRecipeEmbeddings([
 *   { recipeId: "1", embedding: [...], embeddingText: "..." },
 *   { recipeId: "2", embedding: [...], embeddingText: "..." },
 * ]);
 */
export async function batchSaveRecipeEmbeddings(
  embeddings: Array<{
    recipeId: string;
    embedding: number[];
    embeddingText: string;
    modelName?: string;
  }>
): Promise<RecipeEmbedding[]> {
  try {
    const results: RecipeEmbedding[] = [];
    const errors: Array<{ recipeId: string; error: Error }> = [];

    // Process in parallel with error handling
    const promises = embeddings.map(async ({ recipeId, embedding, embeddingText, modelName }) => {
      try {
        return await saveRecipeEmbedding(recipeId, embedding, embeddingText, modelName);
      } catch (error) {
        errors.push({ recipeId, error: error as Error });
        return null;
      }
    });

    const settled = await Promise.all(promises);
    results.push(...settled.filter((r): r is RecipeEmbedding => r !== null));

    if (errors.length > 0) {
      console.error(`Failed to save ${errors.length} embeddings:`, errors);
    }

    return results;

  } catch (error: any) {
    throw new EmbeddingDatabaseError(
      `Failed to batch save recipe embeddings: ${error.message}`,
      'save',
      { originalError: error }
    );
  }
}
