/**
 * Database Helper Functions for Recipe Embeddings
 *
 * Provides CRUD operations for storing and retrieving recipe embeddings
 * in the PostgreSQL database with pgvector extension.
 */

import { eq, type SQL, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { type RecipeEmbedding, recipeEmbeddings, recipes } from '@/lib/db/schema';
import { SEARCH_MIN_SIMILARITY } from '@/lib/search/similarity-cutoffs';

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
      throw new EmbeddingDatabaseError(`Recipe not found: ${recipeId}`, 'save', { recipeId });
    }

    // recipe_embeddings_recipe_id_unique (0001): upsert, not insert
    const [saved] = await db
      .insert(recipeEmbeddings)
      .values({
        recipe_id: recipeId,
        embedding,
        embedding_text: embeddingText,
        model_name: modelName,
      })
      .onConflictDoUpdate({
        target: recipeEmbeddings.recipe_id,
        set: {
          embedding,
          embedding_text: embeddingText,
          model_name: modelName,
          updated_at: new Date(),
        },
      })
      .returning();

    // Update the recipe's embedding_model field
    await db.update(recipes).set({ embedding_model: modelName }).where(eq(recipes.id, recipeId));

    return saved;
  } catch (error: any) {
    if (error instanceof EmbeddingDatabaseError) {
      throw error;
    }

    throw new EmbeddingDatabaseError(`Failed to save recipe embedding: ${error.message}`, 'save', {
      recipeId,
      originalError: error,
    });
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
export async function getRecipeEmbedding(recipeId: string): Promise<RecipeEmbedding | null> {
  try {
    const embedding = await db.query.recipeEmbeddings.findFirst({
      where: eq(recipeEmbeddings.recipe_id, recipeId),
    });

    return embedding || null;
  } catch (error: any) {
    throw new EmbeddingDatabaseError(`Failed to get recipe embedding: ${error.message}`, 'get', {
      recipeId,
      originalError: error,
    });
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
      await db.update(recipes).set({ embedding_model: null }).where(eq(recipes.id, recipeId));
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

/** #131: `hnsw.ef_search` for findSimilarRecipes; at 100 the Neon dry run planner chose a seq scan. */
export const HNSW_EF_SEARCH = 40;

/**
 * #131: kNN over-fetch K = max(100, limit * 4). The index returns K nearest
 * rows before the visibility, soft-delete and cutoff filters run.
 */
export function knnCandidateCount(limit: number): number {
  return Math.max(100, limit * 4);
}

/**
 * Finds similar recipes using vector similarity search
 * Uses cosine distance to find nearest neighbors
 *
 * @param queryEmbedding - Query embedding vector to find similar recipes for
 * @param limit - Maximum number of results to return (default: 10)
 * @param minSimilarity - Minimum similarity threshold (default: SEARCH_MIN_SIMILARITY)
 * @param options - #96: optional SQL filters applied before LIMIT. `visibility`
 *   is a predicate on `recipes` (e.g. `recipeVisibilityCondition(viewer)`);
 *   `excludeRecipeId` drops one recipe (the source) from the candidates.
 * @returns Array of recipe embeddings sorted by similarity (most similar first)
 *
 * Test: `src/lib/db/__tests__/embeddings-knn.test.ts`,
 * `src/lib/db/__tests__/embeddings-soft-delete.test.ts`
 *
 * @example
 * const similar = await findSimilarRecipes(queryEmbedding, 5, SEARCH_MIN_SIMILARITY);
 * similar.forEach(result => {
 *   console.log(`Recipe: ${result.recipe?.name}, Similarity: ${result.similarity}`);
 * });
 */
export async function findSimilarRecipes(
  queryEmbedding: number[],
  limit: number = 10,
  minSimilarity: number = SEARCH_MIN_SIMILARITY, // #96 D57: calibrated cutoff
  options: { visibility?: SQL; excludeRecipeId?: string } = {}
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
    const vector = sql`${`[${queryEmbedding.join(',')}]`}::vector`;

    // #96: filter before the outer LIMIT, so hidden recipes and the source
    // cannot fill every slot. The predicate reads unaliased `recipes`, which is
    // how drizzle renders the visibility condition's columns.
    const visibilityFilter = options.visibility ? sql`AND (${options.visibility})` : sql``;
    const excludeFilter = options.excludeRecipeId
      ? sql`AND knn.recipe_id <> ${options.excludeRecipeId}`
      : sql``;

    // #131: `knn` reads only ids and distance, ordered by `<=>` with a LIMIT, so
    // the planner can use the HNSW index (migration 0006). MATERIALIZED keeps
    // the filters below out of the index scan. Over-fetch K rows so hidden,
    // soft-deleted (#135) and below-cutoff neighbours still leave `limit` rows.
    // `hits` joins `recipes` and filters; the wide `e.*` columns are read only
    // for the final rows. similarity = 1 - cosine distance.
    const knnQuery = sql`
      WITH knn AS MATERIALIZED (
        SELECT e.id, e.recipe_id, e.embedding <=> ${vector} AS dist
        FROM recipe_embeddings e
        ORDER BY e.embedding <=> ${vector}
        LIMIT ${knnCandidateCount(limit)}
      ),
      hits AS MATERIALIZED (
        SELECT knn.id, knn.dist,
          recipes.name AS recipe_name,
          recipes.description AS recipe_description,
          recipes.cuisine AS recipe_cuisine
        FROM knn
        JOIN recipes ON recipes.id = knn.recipe_id
        WHERE recipes.deleted_at IS NULL
          AND (1 - knn.dist) >= ${minSimilarity}
          ${visibilityFilter}
          ${excludeFilter}
        ORDER BY knn.dist
        LIMIT ${limit}
      )
      SELECT e.*, (1 - hits.dist) AS similarity,
        hits.recipe_name, hits.recipe_description, hits.recipe_cuisine
      FROM hits
      JOIN recipe_embeddings e ON e.id = hits.id
      ORDER BY hits.dist
    `;

    // #131: SET LOCAL lasts until the end of the current transaction, so it
    // must share one with the SELECT. On neon-http `db.batch` sends all three
    // statements in one HTTP request that runs as one transaction
    // (`neon().transaction`). ef_search 40 keeps the planner on the index, but
    // one HNSW pass returns at most ~ef_search rows, fewer than K; the
    // iterative scan keeps going until K. relaxed_order may emit slightly
    // out of order; the ORDER BY in `hits` re-sorts.
    const [, , results] = await db.batch([
      db.execute(sql.raw(`SET LOCAL hnsw.ef_search = ${HNSW_EF_SEARCH}`)),
      db.execute(sql.raw('SET LOCAL hnsw.iterative_scan = relaxed_order')),
      db.execute(knnQuery),
    ]);

    return results.rows as any[];
  } catch (error: any) {
    throw new EmbeddingDatabaseError(`Failed to find similar recipes: ${error.message}`, 'search', {
      originalError: error,
    });
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
    // #135: skip soft-deleted recipes; an orphan embedding (no recipe row) still lists.
    const results = await db.execute(sql`
      SELECT
        e.*,
        r.name as recipe_name,
        r.description as recipe_description,
        r.cuisine as recipe_cuisine,
        r.tags as recipe_tags
      FROM recipe_embeddings e
      LEFT JOIN recipes r ON e.recipe_id = r.id
      WHERE r.deleted_at IS NULL
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
    throw new EmbeddingDatabaseError(`Failed to count recipe embeddings: ${error.message}`, 'get', {
      originalError: error,
    });
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
export async function getRecipesNeedingEmbedding(modelName?: string): Promise<any[]> {
  try {
    let query;

    if (modelName) {
      // Find recipes with embeddings from different model
      // #135: never re-embed a soft-deleted recipe.
      query = sql`
        SELECT r.*
        FROM recipes r
        LEFT JOIN recipe_embeddings e ON r.id = e.recipe_id
        WHERE (e.id IS NULL OR e.model_name != ${modelName}) AND r.deleted_at IS NULL
        ORDER BY r.created_at DESC
      `;
    } else {
      // Find recipes without any embeddings
      // #135: never embed a soft-deleted recipe.
      query = sql`
        SELECT r.*
        FROM recipes r
        LEFT JOIN recipe_embeddings e ON r.id = e.recipe_id
        WHERE e.id IS NULL AND r.deleted_at IS NULL
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
