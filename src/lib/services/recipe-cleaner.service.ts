/**
 * Recipe Cleaner Service
 *
 * Uses a local Ollama model (Gemma) to clean and standardize recipe text:
 * - Fix spelling and grammar
 * - Standardize measurements
 * - Number instructions clearly
 * - Make instructions crisp and actionable
 *
 * Tracks cleanup with last_cleaned_at and last_cleaned_model columns.
 */

import 'server-only';
import { and, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { isOllamaAvailable, ollamaGenerate, DEFAULT_OLLAMA_MODEL } from '@/lib/ai/ollama-client';

const CLEAN_MODEL = DEFAULT_OLLAMA_MODEL;
const DELAY_BETWEEN_RECIPES_MS = 1000; // 1 second delay between recipes
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface CleanRecipesResult {
  processed: number;
  skipped: number;
  errors: string[];
}

interface CleanedRecipeFields {
  title: string;
  description: string;
  ingredients: string[];
  instructions: string;
}

/**
 * Build the cleaning prompt for a recipe
 */
function buildCleaningPrompt(recipe: {
  name: string;
  description: string | null;
  ingredients: string;
  instructions: string;
}): string {
  let ingredientsText = recipe.ingredients;
  try {
    const parsed = JSON.parse(recipe.ingredients) as string[];
    ingredientsText = parsed.join('\n');
  } catch {
    // Use raw text if not valid JSON
  }

  let instructionsText = recipe.instructions;
  try {
    const parsed = JSON.parse(recipe.instructions) as string[];
    instructionsText = parsed.join('\n');
  } catch {
    // Use raw text if not valid JSON
  }

  return `You are a professional recipe editor. Clean up and standardize this recipe.
Rules:
- Fix spelling and grammar
- Standardize measurements (e.g., "1 tbsp" not "1 tablespoon" throughout)
- Number the instructions clearly (1. 2. 3.)
- Remove filler words and make instructions crisp and actionable
- Keep the same meaning — do NOT change the recipe
- Return ONLY the cleaned recipe as JSON with no markdown fences: { "title": "...", "description": "...", "ingredients": [...], "instructions": "..." }
- ingredients must be a JSON array of strings
- instructions must be a single string with numbered steps

Recipe to clean:
Title: ${recipe.name}
Description: ${recipe.description || ''}
Ingredients:
${ingredientsText}
Instructions:
${instructionsText}`;
}

/**
 * Parse the Ollama JSON response, handling common formatting issues
 */
function parseCleanedRecipe(rawResponse: string): CleanedRecipeFields | null {
  // Strip markdown code fences if present
  let cleaned = rawResponse.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Find the first { and last } to extract JSON object
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;

  const jsonStr = cleaned.slice(start, end + 1);

  const parsed = JSON.parse(jsonStr) as unknown;

  if (typeof parsed !== 'object' || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.title !== 'string' || !obj.title) return null;
  if (!Array.isArray(obj.ingredients) || obj.ingredients.length === 0) return null;
  if (typeof obj.instructions !== 'string' || !obj.instructions) return null;

  return {
    title: obj.title,
    description: typeof obj.description === 'string' ? obj.description : '',
    ingredients: (obj.ingredients as unknown[]).map(String),
    instructions: obj.instructions,
  };
}

/**
 * Sleep for the specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clean recipes using local Ollama model.
 *
 * Processes recipes where last_cleaned_at IS NULL or last_cleaned_at < 30 days ago.
 */
export async function cleanRecipesWithOllama(
  limit: number = 5
): Promise<CleanRecipesResult> {
  const result: CleanRecipesResult = { processed: 0, skipped: 0, errors: [] };

  // Check Ollama availability first
  const available = await isOllamaAvailable();
  if (!available) {
    throw new Error(
      'Ollama is not running. Please start Ollama (e.g., `ollama serve`) and ensure the gemma3:4b model is pulled.'
    );
  }

  // Query recipes that need cleaning
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);

  const recipesToClean = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      description: recipes.description,
      ingredients: recipes.ingredients,
      instructions: recipes.instructions,
    })
    .from(recipes)
    .where(
      and(
        isNull(recipes.deleted_at),
        or(
          isNull(recipes.last_cleaned_at),
          lt(recipes.last_cleaned_at, thirtyDaysAgo)
        )
      )
    )
    .limit(limit);

  for (const recipe of recipesToClean) {
    const prompt = buildCleaningPrompt(recipe);

    let rawResponse: string;
    try {
      rawResponse = await ollamaGenerate(prompt, CLEAN_MODEL);
    } catch (err) {
      const msg = `Recipe "${recipe.name}" (${recipe.id}): Ollama generation failed — ${err instanceof Error ? err.message : String(err)}`;
      console.error('[recipe-cleaner]', msg);
      result.errors.push(msg);
      result.skipped++;
      await sleep(DELAY_BETWEEN_RECIPES_MS);
      continue;
    }

    let cleaned: CleanedRecipeFields | null = null;
    try {
      cleaned = parseCleanedRecipe(rawResponse);
    } catch (err) {
      const msg = `Recipe "${recipe.name}" (${recipe.id}): JSON parse failed — ${err instanceof Error ? err.message : String(err)}`;
      console.error('[recipe-cleaner]', msg);
      result.errors.push(msg);
      result.skipped++;
      await sleep(DELAY_BETWEEN_RECIPES_MS);
      continue;
    }

    if (!cleaned) {
      const msg = `Recipe "${recipe.name}" (${recipe.id}): could not extract valid cleaned fields from Ollama response`;
      console.error('[recipe-cleaner]', msg);
      result.errors.push(msg);
      result.skipped++;
      await sleep(DELAY_BETWEEN_RECIPES_MS);
      continue;
    }

    // Update recipe in DB with cleaned fields
    await db
      .update(recipes)
      .set({
        name: cleaned.title,
        description: cleaned.description || recipe.description,
        ingredients: JSON.stringify(cleaned.ingredients),
        instructions: cleaned.instructions,
        last_cleaned_at: new Date(),
        last_cleaned_model: CLEAN_MODEL,
        updated_at: new Date(),
      })
      .where(sql`${recipes.id} = ${recipe.id}`);

    console.info(`[recipe-cleaner] Cleaned recipe "${recipe.name}" (${recipe.id})`);
    result.processed++;

    await sleep(DELAY_BETWEEN_RECIPES_MS);
  }

  return result;
}
