/**
 * Embedding generation for Recipe Manager.
 *
 * #96 D57: embeddings are computed in-process with `@huggingface/transformers`
 * running `Xenova/bge-small-en-v1.5` (fp32, CLS pooling, L2-normalised, 384
 * dimensions). That is the model and settings that wrote ~93% of the stored
 * vectors (`test/scripts/generate_embeddings_local.py`), so queries and new
 * recipes land in the same vector space. The model is loaded from disk
 * (`models/`, fetched at build time); no network call and no paid call is made.
 *
 * Passages (recipes) are embedded with no prefix. Search queries go through
 * `generateQueryEmbedding`, which adds the BGE retrieval instruction.
 */

import path from 'node:path';
import type { FeatureExtractionPipeline } from '@huggingface/transformers';
import type { Recipe } from '@/lib/db/schema';
import { EMBEDDING_MODEL_REPO, EMBEDDING_MODEL_ROOT } from './embedding-model';

// Constants
const EMBEDDING_DIMENSION = 384;
// #96 D57: label stored in recipe_embeddings.model_name / recipes.embedding_model.
const MODEL_NAME = 'BAAI/bge-small-en-v1.5';
/** #96 D57: BGE v1.5 retrieval instruction, applied to short queries only. */
export const BGE_QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';

// Types
export interface EmbeddingGenerationOptions {
  /** @deprecated #96 D57: ignored; in-process inference has no transient network failure to retry. */
  retries?: number;
  /** @deprecated #96 D57: ignored; in-process inference is not network-bound. */
  timeout?: number;
  /** @deprecated Retained for API compatibility; the model loads once per process. */
  waitForModel?: boolean;
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
    throw new EmbeddingError('Invalid embedding: not an array', 'VALIDATION_ERROR', {
      received: typeof embedding,
    });
  }

  if (embedding.length !== EMBEDDING_DIMENSION) {
    throw new EmbeddingError(
      `Invalid embedding dimension: expected ${EMBEDDING_DIMENSION}, got ${embedding.length}`,
      'VALIDATION_ERROR',
      { expected: EMBEDDING_DIMENSION, actual: embedding.length }
    );
  }

  // Check for NaN or invalid values
  if (embedding.some((val) => typeof val !== 'number' || Number.isNaN(val))) {
    throw new EmbeddingError(
      'Invalid embedding: contains non-numeric or NaN values',
      'VALIDATION_ERROR'
    );
  }
}

/**
 * Sleep utility for batch pacing
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// #96 D57: one pipeline per process; concurrent first calls share the same load.
let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

/** Absolute directory holding `<repo>/<file>`; Vercel bundles it via `outputFileTracingIncludes`. */
export function embeddingModelDir(): string {
  return path.join(process.cwd(), EMBEDDING_MODEL_ROOT);
}

/**
 * Why: loading the ONNX session costs ~0.3-1 s, so it must happen once per
 * process, and never over the network (#96 D57).
 * What: Lazily imports `@huggingface/transformers` (no work at module load),
 * pins it to the local `models/` directory with `allowRemoteModels=false`, and
 * caches the fp32 feature-extraction pipeline in a module-level promise. A
 * failed load clears the cache so the next call retries, and throws
 * `EmbeddingError('CONFIG_ERROR')`.
 * Test: `matches the Python sentence-transformers vectors`, `throws EmbeddingError when the model files are missing`
 */
function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      // #96 D57: transformers loads onnxruntime-node through createRequire, which the
      // build tracer cannot follow; naming it here puts the native runtime in the function.
      await import('onnxruntime-node');
      const { env, pipeline } = await import('@huggingface/transformers');
      env.allowRemoteModels = false;
      env.allowLocalModels = true;
      env.localModelPath = embeddingModelDir();
      return (await pipeline('feature-extraction', EMBEDDING_MODEL_REPO, {
        dtype: 'fp32',
        device: 'cpu',
      })) as FeatureExtractionPipeline;
    })().catch((error: unknown) => {
      extractorPromise = null;
      // #96: the message reaches the browser via searchFailure, so the server path
      // stays in `details` and the server log.
      const modelDir = embeddingModelDir();
      console.error(`[embeddings] failed to load ${EMBEDDING_MODEL_REPO} from ${modelDir}`, error);
      throw new EmbeddingError(
        'Search is temporarily unavailable (embedding model failed to load)',
        'CONFIG_ERROR',
        {
          modelDir,
          cause: error instanceof Error ? error.message : String(error),
          hint: 'Run `pnpm exec tsx scripts/fetch-embedding-model.ts` (runs in prebuild).',
        }
      );
    });
  }
  return extractorPromise;
}

/** Test-only: drops the cached pipeline so a test can exercise a fresh load. */
export function resetEmbeddingModelForTests(): void {
  extractorPromise = null;
}

interface TokenTensor {
  data: BigInt64Array;
  dims: number[];
}

/**
 * #96 D57: transformers.js truncates after adding special tokens, so a text
 * over 512 tokens loses its trailing [SEP] (Hugging Face keeps it). Writing
 * [SEP] back into the last attended position of such a row gives the same
 * token ids as sentence-transformers. Rows that were not truncated already end
 * in [SEP] or padding and are left alone.
 * Test: `keeps [SEP] when truncating a text over 512 tokens`
 */
function restoreTruncatedSep(
  inputIds: TokenTensor,
  attentionMask: TokenTensor,
  sepId: number
): void {
  const [rows, cols] = inputIds.dims;
  const sep = BigInt(sepId);
  for (let row = 0; row < rows; row++) {
    const last = row * cols + cols - 1;
    if (attentionMask.data[last] === BigInt(1) && inputIds.data[last] !== sep) {
      inputIds.data[last] = sep;
    }
  }
}

/**
 * Why: every public entry point needs the same CLS-pooled, L2-normalised
 * 384-dim vectors that sentence-transformers wrote to the DB (#96 D57).
 * What: Tokenises `inputs` with the cached pipeline's tokenizer (padding,
 * truncation to 512 with [SEP] kept, as sentence-transformers does), runs one
 * forward pass, takes the [CLS] hidden state and L2-normalises it. This is the
 * pipeline's own `pooling:'cls', normalize:true` path plus the [SEP] repair.
 * Returns one validated vector per input, in input order.
 * Test: `matches the Python sentence-transformers vectors`
 */
async function embedTexts(inputs: string[]): Promise<number[][]> {
  const extractor = await getExtractor();
  let vectors: number[][];
  try {
    const { tokenizer, model } = extractor;
    const modelInputs = tokenizer(inputs, { padding: true, truncation: true });
    restoreTruncatedSep(
      modelInputs.input_ids as unknown as TokenTensor,
      modelInputs.attention_mask as unknown as TokenTensor,
      tokenizer.sep_token_id as number
    );
    const outputs = await model(modelInputs);
    const output = outputs.last_hidden_state.slice(null, 0).normalize(2, -1);
    vectors = output.tolist() as number[][];
  } catch (error: unknown) {
    throw new EmbeddingError('Embedding inference failed', 'API_ERROR', {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  if (vectors.length !== inputs.length) {
    throw new EmbeddingError(
      `Embedding model returned ${vectors.length} vectors for ${inputs.length} inputs`,
      'API_ERROR'
    );
  }
  for (const vector of vectors) validateEmbedding(vector);
  return vectors;
}

/**
 * Generates a passage embedding for `text` (no query prefix).
 *
 * @param text - Text to generate embedding for
 * @param _options - Retained for API compatibility; ignored (#96 D57)
 * @returns 384-dimensional L2-normalised embedding vector
 *
 * @throws {EmbeddingError} If the text is empty, the model cannot be loaded, or inference fails
 *
 * @example
 * const embedding = await generateEmbedding("Delicious pasta recipe");
 * console.log(embedding.length); // 384
 */
export async function generateEmbedding(
  text: string,
  _options: EmbeddingGenerationOptions = {}
): Promise<number[]> {
  // Validate input
  if (!text || text.trim().length === 0) {
    throw new EmbeddingError('Text cannot be empty', 'VALIDATION_ERROR');
  }

  // #96 D57: in-process bge-small; the Jina call and its cost booking are gone.
  const [embedding] = await embedTexts([text]);
  return embedding;
}

/**
 * Why: BGE v1.5 is trained with an instruction on the query side of
 * short-query-to-passage retrieval; the stored recipe vectors have none (#96 D57).
 * What: Prepends `BGE_QUERY_PREFIX` to `query` and embeds it. Use this for
 * search queries only; recipes and other passages use `generateEmbedding`.
 * Test: `generateQueryEmbedding prepends the BGE instruction`, `generateEmbedding adds no prefix`
 *
 * @throws {EmbeddingError} If the query is empty, the model cannot be loaded, or inference fails
 */
export async function generateQueryEmbedding(
  query: string,
  _options: EmbeddingGenerationOptions = {}
): Promise<number[]> {
  if (!query || query.trim().length === 0) {
    throw new EmbeddingError('Query cannot be empty', 'VALIDATION_ERROR');
  }
  const [embedding] = await embedTexts([`${BGE_QUERY_PREFIX}${query}`]);
  return embedding;
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
      const tags = typeof recipe.tags === 'string' ? JSON.parse(recipe.tags) : recipe.tags;
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
      const ingredients =
        typeof recipe.ingredients === 'string'
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
    modelName: MODEL_NAME,
  };
}

/**
 * Generates passage embeddings for multiple texts in batches.
 *
 * @param texts - Array of texts to generate embeddings for
 * @param options - Batch size, optional pause between batches, progress callback
 * @returns Array of embedding vectors in input order; a failed batch is
 *   skipped and logged, so the result can be shorter than `texts`
 *
 * @example
 * const embeddings = await generateEmbeddingsBatch(
 *   ["Recipe 1", "Recipe 2", "Recipe 3"],
 *   { batchSize: 5 }
 * );
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  options: BatchEmbeddingOptions = {}
): Promise<number[][]> {
  // #96 D57: in-process inference has no rate limit, so batches run back to back by default.
  const { batchSize = 32, delayMs = 0, onProgress } = options;

  if (texts.length === 0) {
    return [];
  }

  const results: number[][] = [];
  const errors: Array<{ batchStart: number; size: number; error: Error }> = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    // Keep a placeholder for empty strings so output order matches input order.
    const sanitized = batch.map((t) => (t && t.trim().length > 0 ? t : ' '));

    try {
      results.push(...(await embedTexts(sanitized)));
    } catch (error) {
      errors.push({ batchStart: i, size: batch.length, error: error as Error });
      // Skip this batch's embeddings; downstream callers should handle shorter arrays.
    }

    if (onProgress) {
      onProgress(Math.min(i + batchSize, texts.length), texts.length);
    }

    if (delayMs > 0 && i + batchSize < texts.length) {
      await sleep(delayMs);
    }
  }

  if (errors.length > 0) {
    console.error(`Failed to generate ${errors.length} embedding batch(es):`, errors);
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
    throw new EmbeddingError('Vectors must have the same length', 'VALIDATION_ERROR', {
      aLength: a.length,
      bLength: b.length,
    });
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
  const withSimilarity = candidates.map((candidate) => ({
    ...candidate,
    similarity: cosineSimilarity(queryEmbedding, candidate.embedding),
  }));

  return withSimilarity.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
}
