/**
 * Embedding Generation Utilities for Recipe Manager
 *
 * Uses Hugging Face Inference API with sentence-transformers/all-MiniLM-L6-v2
 * Model details: 384-dimensional embeddings optimized for semantic similarity
 *
 * Features:
 * - Single and batch embedding generation
 * - Recipe-specific embedding generation
 * - Automatic retry with exponential backoff
 * - Rate limiting support
 * - Comprehensive error handling
 */

import { Recipe } from '@/lib/db/schema';

// Constants
const HF_API_URL = 'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2';
const EMBEDDING_DIMENSION = 384;
const DEFAULT_TIMEOUT = 30000; // 30 seconds (accounts for model cold start)
const DEFAULT_RETRIES = 5; // Increased from 3 to handle cold starts better
const INITIAL_RETRY_DELAY = 2000; // 2 seconds base delay

// Types
export interface EmbeddingGenerationOptions {
  retries?: number;
  timeout?: number;
  waitForModel?: boolean; // Wait for model to load if it's cold
}

export interface RecipeEmbeddingResult {
  embedding: number[];
  embeddingText: string;
  modelName: string;
}

export interface BatchEmbeddingOptions {
  batchSize?: number;
  delayMs?: number;
  onProgress?: (processed: number, total: number) => void;
}

export class EmbeddingError extends Error {
  constructor(
    message: string,
    public code: 'API_ERROR' | 'VALIDATION_ERROR' | 'RATE_LIMIT' | 'TIMEOUT' | 'CONFIG_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

/**
 * Validates that an embedding has the correct dimensions
 */
function validateEmbedding(embedding: number[]): void {
  if (!Array.isArray(embedding)) {
    throw new EmbeddingError(
      'Invalid embedding: not an array',
      'VALIDATION_ERROR',
      { received: typeof embedding }
    );
  }

  if (embedding.length !== EMBEDDING_DIMENSION) {
    throw new EmbeddingError(
      `Invalid embedding dimension: expected ${EMBEDDING_DIMENSION}, got ${embedding.length}`,
      'VALIDATION_ERROR',
      { expected: EMBEDDING_DIMENSION, actual: embedding.length }
    );
  }

  // Check for NaN or invalid values
  if (embedding.some(val => typeof val !== 'number' || isNaN(val))) {
    throw new EmbeddingError(
      'Invalid embedding: contains non-numeric or NaN values',
      'VALIDATION_ERROR'
    );
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generates a single embedding from text using Hugging Face API
 *
 * @param text - Text to generate embedding for
 * @param options - Generation options (retries, timeout)
 * @returns 384-dimensional embedding vector
 *
 * @throws {EmbeddingError} If API key is missing, API call fails, or validation fails
 *
 * @example
 * const embedding = await generateEmbedding("Delicious pasta recipe");
 * console.log(embedding.length); // 384
 */
export async function generateEmbedding(
  text: string,
  options: EmbeddingGenerationOptions = {}
): Promise<number[]> {
  const {
    retries = DEFAULT_RETRIES,
    timeout = DEFAULT_TIMEOUT,
    waitForModel = true,
  } = options;

  // Validate API key
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new EmbeddingError(
      'HUGGINGFACE_API_KEY not configured in environment variables',
      'CONFIG_ERROR',
      { hint: 'Get your API key from https://huggingface.co/settings/tokens' }
    );
  }

  // Validate input
  if (!text || text.trim().length === 0) {
    throw new EmbeddingError(
      'Text cannot be empty',
      'VALIDATION_ERROR'
    );
  }

  let lastError: Error | null = null;

  // Retry loop with exponential backoff
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(HF_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: text,
            options: {
              wait_for_model: waitForModel,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle different response statuses
        if (!response.ok) {
          const errorBody = await response.text();
          let errorData: any;
          try {
            errorData = JSON.parse(errorBody);
          } catch {
            errorData = { message: errorBody };
          }

          // Rate limiting - retry with backoff
          if (response.status === 503 || response.status === 429) {
            const estimatedTime = errorData.estimated_time || 20;

            if (attempt < retries) {
              const delay = Math.min(
                INITIAL_RETRY_DELAY * Math.pow(2, attempt),
                Math.max(estimatedTime * 1000, 5000) // At least 5 seconds for model loading
              );
              console.log(
                `[HuggingFace] Model loading or rate limited (HTTP ${response.status}), retrying in ${(delay / 1000).toFixed(1)}s (attempt ${attempt + 1}/${retries + 1})`
              );
              console.log(`[HuggingFace] API response: ${JSON.stringify(errorData).substring(0, 200)}`);
              await sleep(delay);
              continue;
            }

            throw new EmbeddingError(
              `Rate limit or model loading after ${retries + 1} attempts: ${errorData.error || 'Service unavailable'}`,
              'RATE_LIMIT',
              { status: response.status, estimatedTime, errorData, attempts: retries + 1 }
            );
          }

          // Other API errors
          throw new EmbeddingError(
            `Hugging Face API error: ${errorData.error || errorBody}`,
            'API_ERROR',
            { status: response.status, errorData }
          );
        }

        // Parse and validate response
        const embedding = await response.json();

        // Handle nested array response (some models return [[...]])
        const flatEmbedding = Array.isArray(embedding[0]) ? embedding[0] : embedding;

        validateEmbedding(flatEmbedding);

        return flatEmbedding;

      } finally {
        clearTimeout(timeoutId);
      }

    } catch (error: any) {
      lastError = error;

      // Don't retry on validation or config errors
      if (error instanceof EmbeddingError &&
          (error.code === 'VALIDATION_ERROR' || error.code === 'CONFIG_ERROR')) {
        throw error;
      }

      // Handle timeout
      if (error.name === 'AbortError') {
        if (attempt < retries) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          console.log(`[HuggingFace] Request timeout, retrying in ${(delay / 1000).toFixed(1)}s (attempt ${attempt + 1}/${retries + 1})`);
          await sleep(delay);
          continue;
        }
        throw new EmbeddingError(
          `Request timeout after ${timeout}ms and ${retries + 1} attempts`,
          'TIMEOUT',
          { timeout, attempts: retries + 1 }
        );
      }

      // Retry on network errors
      if (attempt < retries) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        console.log(`[HuggingFace] Network error, retrying in ${(delay / 1000).toFixed(1)}s (attempt ${attempt + 1}/${retries + 1}): ${error.message}`);
        await sleep(delay);
        continue;
      }
    }
  }

  // All retries exhausted
  throw new EmbeddingError(
    `Failed to generate embedding after ${retries + 1} attempts`,
    'API_ERROR',
    {
      lastError: lastError?.message,
      attempts: retries + 1,
      hint: 'HuggingFace model may be cold starting. Consider retrying in a few minutes.'
    }
  );
}

/**
 * Builds the text representation of a recipe for embedding generation
 * Combines name, description, cuisine, tags, and ingredients
 *
 * @param recipe - Recipe object to build text from
 * @returns Combined text string for embedding
 */
export function buildRecipeEmbeddingText(recipe: Recipe): string {
  const parts: string[] = [];

  // Add recipe name (most important)
  if (recipe.name) {
    parts.push(recipe.name);
  }

  // Add description
  if (recipe.description) {
    parts.push(recipe.description);
  }

  // Add cuisine
  if (recipe.cuisine) {
    parts.push(`Cuisine: ${recipe.cuisine}`);
  }

  // Add tags
  if (recipe.tags) {
    try {
      const tags = typeof recipe.tags === 'string'
        ? JSON.parse(recipe.tags)
        : recipe.tags;
      if (Array.isArray(tags) && tags.length > 0) {
        parts.push(`Tags: ${tags.join(', ')}`);
      }
    } catch (error) {
      console.warn('Failed to parse recipe tags:', error);
    }
  }

  // Add ingredients
  if (recipe.ingredients) {
    try {
      const ingredients = typeof recipe.ingredients === 'string'
        ? JSON.parse(recipe.ingredients)
        : recipe.ingredients;
      if (Array.isArray(ingredients) && ingredients.length > 0) {
        parts.push(`Ingredients: ${ingredients.join(', ')}`);
      }
    } catch (error) {
      console.warn('Failed to parse recipe ingredients:', error);
    }
  }

  // Add difficulty level
  if (recipe.difficulty) {
    parts.push(`Difficulty: ${recipe.difficulty}`);
  }

  return parts.filter(Boolean).join('. ').trim();
}

/**
 * Generates an embedding specifically for a recipe
 * Combines recipe metadata into optimal text representation
 *
 * @param recipe - Recipe object to generate embedding for
 * @param options - Generation options
 * @returns Embedding result with vector, text, and model name
 *
 * @example
 * const result = await generateRecipeEmbedding(recipe);
 * console.log(result.embedding.length); // 384
 * console.log(result.embeddingText); // "Spaghetti Carbonara. Classic Italian pasta..."
 */
export async function generateRecipeEmbedding(
  recipe: Recipe,
  options?: EmbeddingGenerationOptions
): Promise<RecipeEmbeddingResult> {
  const embeddingText = buildRecipeEmbeddingText(recipe);

  if (!embeddingText) {
    throw new EmbeddingError(
      'Cannot generate embedding: recipe has no content',
      'VALIDATION_ERROR',
      { recipeId: recipe.id }
    );
  }

  const embedding = await generateEmbedding(embeddingText, options);

  return {
    embedding,
    embeddingText,
    modelName: 'sentence-transformers/all-MiniLM-L6-v2',
  };
}

/**
 * Generates embeddings for multiple texts in batches
 * Includes rate limiting to avoid overwhelming the API
 *
 * @param texts - Array of texts to generate embeddings for
 * @param options - Batch processing options
 * @returns Array of embedding vectors in same order as input texts
 *
 * @example
 * const embeddings = await generateEmbeddingsBatch(
 *   ["Recipe 1", "Recipe 2", "Recipe 3"],
 *   { batchSize: 5, delayMs: 1000 }
 * );
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  options: BatchEmbeddingOptions = {}
): Promise<number[][]> {
  const {
    batchSize = 10,
    delayMs = 1000,
    onProgress,
  } = options;

  if (texts.length === 0) {
    return [];
  }

  const results: number[][] = [];
  const errors: Array<{ index: number; text: string; error: Error }> = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchStart = i;

    // Process batch in parallel
    const batchPromises = batch.map(async (text, idx) => {
      try {
        return await generateEmbedding(text);
      } catch (error) {
        errors.push({
          index: batchStart + idx,
          text: text.substring(0, 100),
          error: error as Error,
        });
        // Return null for failed embeddings, will be filtered out
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);

    // Filter out nulls and add to results
    const validResults = batchResults.filter((r): r is number[] => r !== null);
    results.push(...validResults);

    // Report progress
    if (onProgress) {
      onProgress(Math.min(i + batchSize, texts.length), texts.length);
    }

    // Rate limiting delay between batches
    if (i + batchSize < texts.length) {
      await sleep(delayMs);
    }
  }

  // Log errors if any occurred
  if (errors.length > 0) {
    console.error(`Failed to generate ${errors.length} embeddings:`, errors);
  }

  return results;
}

/**
 * Calculates cosine similarity between two embedding vectors
 * Returns a value between -1 and 1, where 1 means identical
 *
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns Cosine similarity score
 *
 * @example
 * const similarity = cosineSimilarity(embedding1, embedding2);
 * console.log(similarity); // 0.85 (high similarity)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new EmbeddingError(
      'Vectors must have the same length',
      'VALIDATION_ERROR',
      { aLength: a.length, bLength: b.length }
    );
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Finds the most similar embeddings to a query embedding
 *
 * @param queryEmbedding - Query embedding vector
 * @param candidates - Array of candidate embeddings with metadata
 * @param topK - Number of top results to return
 * @returns Array of top K most similar candidates with similarity scores
 */
export function findSimilar<T extends { embedding: number[] }>(
  queryEmbedding: number[],
  candidates: T[],
  topK: number = 5
): Array<T & { similarity: number }> {
  const withSimilarity = candidates.map(candidate => ({
    ...candidate,
    similarity: cosineSimilarity(queryEmbedding, candidate.embedding),
  }));

  return withSimilarity
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
