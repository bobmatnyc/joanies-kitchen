import 'server-only';
import { MODELS } from './openrouter';
import { getOpenRouterClient } from './openrouter-server';
import { validateParsedRecipe, sanitizeIngredients } from '@/lib/validations/recipe-validation';
import { validateSerialization } from '@/lib/validations/serialization-validation';

/**
 * Structured ingredient object for recipe ingestion
 */
export interface ParsedIngredient {
  quantity?: string;
  unit?: string;
  name: string;
  notes?: string;
  preparation?: string;
}

/**
 * Enhanced parsed recipe for admin ingestion
 */
export interface IngestedRecipe {
  name: string;
  description: string | null;
  ingredients: ParsedIngredient[];
  instructions: string[];
  prep_time: number | null; // in minutes
  cook_time: number | null; // in minutes
  servings: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  cuisine: string | null;
  tags: string[];
  image_url?: string | null;
  video_url?: string | null;
  nutritionInfo?: {
    calories?: number;
    protein?: number;
    carbohydrates?: number;
    fat?: number;
    fiber?: number;
  } | null;
}

/**
 * Extract JSON from LLM response, handling markdown code fences
 */
function extractJSON(response: string): string {
  // Remove markdown code fences if present (case-insensitive)
  // Handles: ```json, ```JSON, ``` json, or just ```
  const codeBlockMatch = response.match(/```\s*(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  return response.trim();
}

/**
 * Parse recipe content for admin ingestion using Claude Sonnet 4.5
 * More thorough parsing than the standard recipe parser
 */
export async function parseRecipeForIngestion(
  content: string,
  sourceUrl?: string
): Promise<IngestedRecipe> {
  const client = getOpenRouterClient();

  if (!content || content.trim().length === 0) {
    throw new Error('No content provided to parse');
  }

  const prompt = `You are a professional recipe parser. Extract structured recipe data from the following content and return it as valid JSON.

Source URL: ${sourceUrl || 'Not provided'}

Recipe Content:
${content}

Return a JSON object with this exact structure:
{
  "name": "Recipe title (string, required)",
  "description": "Brief 1-2 sentence description (string or null)",
  "ingredients": [
    {
      "quantity": "1" (string or null - e.g., "1", "1/2", "2-3"),
      "unit": "cup" (string or null - e.g., "cup", "tbsp", "oz", "g"),
      "name": "flour" (string, required - the ingredient name),
      "notes": "all-purpose" (string or null - optional notes like "diced", "fresh"),
      "preparation": "chopped" (string or null - how to prepare it)
    }
  ],
  "instructions": ["Step 1 instructions...", "Step 2 instructions...", ...],
  "prep_time": 15 (number in minutes or null),
  "cook_time": 30 (number in minutes or null),
  "servings": 4 (number or null),
  "difficulty": "easy" | "medium" | "hard" (or null),
  "cuisine": "Italian" (string or null - e.g., "Italian", "Mexican", "Asian"),
  "tags": ["vegetarian", "pasta", "dinner"] (array of strings, can be empty),
  "image_url": "https://..." (string or null - main recipe image if found in content),
  "video_url": "https://..." (string or null - recipe video URL if found),
  "nutritionInfo": {
    "calories": 350 (number or null),
    "protein": 12 (number in grams or null),
    "carbohydrates": 45 (number in grams or null),
    "fat": 8 (number in grams or null),
    "fiber": 3 (number in grams or null)
  } (or null if no nutrition info found)
}

IMPORTANT RULES:
1. Extract ALL ingredients with precise quantities, units, and names
2. Break down combined ingredients into separate entries (e.g., "2 cups flour + 1 tsp salt" becomes 2 separate ingredients)
3. Normalize units to common formats (tbsp, tsp, cup, oz, lb, g, kg, ml, l)
4. Extract preparation methods into the "preparation" field (e.g., "diced", "minced", "chopped")
5. Number each instruction step clearly and keep them concise
6. Infer difficulty based on: number of steps, cooking techniques, time required
7. Extract cuisine type from content context or recipe name
8. Generate relevant tags based on: dietary restrictions, meal type, cooking method, main ingredients
9. Use null for missing data (never use empty strings)
10. Ensure all numeric values are numbers, not strings
11. Extract image URLs only if they appear to be recipe photos (not ads or logos)
12. Look for video embeds or video URLs (YouTube, Vimeo, etc.)
13. Return ONLY valid JSON, no additional text or explanations

Be thorough and accurate. This data will be used directly in a production database.`;

  try {
    const response = await client.chat.completions.create({
      model: MODELS.CLAUDE_SONNET_4_5,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2, // Very low temperature for consistent, accurate parsing
      max_tokens: 4096,
    });

    const content_text = response.choices[0].message.content;
    if (!content_text) {
      throw new Error('No response from AI model');
    }

    // Extract JSON from response, handling markdown code fences
    const jsonString = extractJSON(content_text);
    const parsed = JSON.parse(jsonString) as IngestedRecipe;

    // LEVEL 2: Structure Validation
    const structureValidation = validateParsedRecipe(parsed);

    if (!structureValidation.isValid) {
      // Try auto-sanitization for ingredients
      const { sanitized, modified, changes } = sanitizeIngredients(parsed.ingredients);

      if (modified) {
        console.warn('[parseRecipeForIngestion] Auto-sanitized ingredients:', changes);
        parsed.ingredients = sanitized;

        // Re-validate after sanitization
        const revalidation = validateParsedRecipe(parsed);
        if (!revalidation.isValid) {
          const errorMessages = revalidation.errors.map((e) => `${e.field}: ${e.message}`);
          throw new Error(
            `Recipe validation failed after auto-sanitization:\n${errorMessages.join('\n')}`
          );
        }

        // Log warnings even if validation passes
        if (revalidation.warnings.length > 0) {
          console.warn(
            '[parseRecipeForIngestion] Validation warnings:',
            revalidation.warnings.map((w) => `${w.field}: ${w.message}`)
          );
        }
      } else {
        const errorMessages = structureValidation.errors.map((e) => `${e.field}: ${e.message}`);
        throw new Error(`Recipe validation failed:\n${errorMessages.join('\n')}`);
      }
    } else if (structureValidation.warnings.length > 0) {
      // Log warnings even if validation passes
      console.warn(
        '[parseRecipeForIngestion] Validation warnings:',
        structureValidation.warnings.map((w) => `${w.field}: ${w.message}`)
      );
    }

    // LEVEL 3: Serialization Validation
    const serializationValidation = validateSerialization(parsed);

    if (!serializationValidation.isValid) {
      const errorMessages = serializationValidation.errors.map((e) => `${e.field}: ${e.message}`);
      throw new Error(`Recipe serialization validation failed:\n${errorMessages.join('\n')}`);
    }

    // Ensure tags is an array (minor cleanup)
    if (!Array.isArray(parsed.tags)) {
      parsed.tags = [];
    }

    // Sanitize numeric fields (auto-fix invalid values)
    if (parsed.prep_time !== null && (typeof parsed.prep_time !== 'number' || parsed.prep_time < 0)) {
      console.warn('[parseRecipeForIngestion] Invalid prep_time, setting to null');
      parsed.prep_time = null;
    }

    if (parsed.cook_time !== null && (typeof parsed.cook_time !== 'number' || parsed.cook_time < 0)) {
      console.warn('[parseRecipeForIngestion] Invalid cook_time, setting to null');
      parsed.cook_time = null;
    }

    if (parsed.servings !== null && (typeof parsed.servings !== 'number' || parsed.servings < 1)) {
      console.warn('[parseRecipeForIngestion] Invalid servings, setting to null');
      parsed.servings = null;
    }

    // Validate difficulty enum
    if (parsed.difficulty && !['easy', 'medium', 'hard'].includes(parsed.difficulty)) {
      console.warn('[parseRecipeForIngestion] Invalid difficulty, setting to null');
      parsed.difficulty = null;
    }

    return parsed;
  } catch (error) {
    console.error('Error parsing recipe for ingestion:', error);
    throw new Error(
      `Failed to parse recipe: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Convert ParsedIngredient array to JSON string format for database storage
 */
export function serializeIngredients(ingredients: ParsedIngredient[]): string {
  return JSON.stringify(ingredients);
}

/**
 * Convert instructions array to JSON string format for database storage
 */
export function serializeInstructions(instructions: string[]): string {
  return JSON.stringify(instructions);
}

/**
 * Convert tags array to JSON string format for database storage
 */
export function serializeTags(tags: string[]): string {
  return JSON.stringify(tags);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
