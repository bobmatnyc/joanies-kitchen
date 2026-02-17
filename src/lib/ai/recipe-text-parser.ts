import 'server-only';
import { sanitizeIngredients, validateParsedRecipe } from '@/lib/validations/recipe-validation';
import { validateSerialization } from '@/lib/validations/serialization-validation';
import { type IngestedRecipe } from './recipe-ingestion-parser';
import { MODELS } from './openrouter';
import { getOpenRouterClient } from './openrouter-server';

/**
 * Response from recipe detection
 */
export interface RecipeDetectionResult {
  isRecipe: boolean;
  recipe?: IngestedRecipe;
  error?: string;
  confidence?: number; // 0.0-1.0 confidence score
}

/**
 * Extract JSON from LLM response, handling markdown code fences
 */
function extractJSON(response: string): string {
  // Remove markdown code fences if present (case-insensitive)
  const codeBlockMatch = response.match(/```\s*(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  return response.trim();
}

/**
 * Normalize and fix common LLM response issues
 * This ensures data types match expected schema
 */
function normalizeRecipeData(recipe: any): IngestedRecipe {
  // Fix ingredients - ensure it's an array of objects
  if (typeof recipe.ingredients === 'string') {
    // Convert string to array if LLM returned a string
    console.warn('[normalizeRecipeData] Converting ingredients from string to array');
    recipe.ingredients = recipe.ingredients.split('\n').filter((i: string) => i.trim()).map((i: string) => ({
      name: i.trim(),
      quantity: '',
      unit: '',
      notes: '',
      preparation: '',
    }));
  } else if (!Array.isArray(recipe.ingredients)) {
    console.warn('[normalizeRecipeData] Invalid ingredients format, setting to empty array');
    recipe.ingredients = [];
  }

  // Ensure each ingredient has required fields with proper string types
  recipe.ingredients = recipe.ingredients.map((ing: any) => {
    if (typeof ing === 'string') {
      return {
        name: ing.trim(),
        quantity: '',
        unit: '',
        notes: '',
        preparation: '',
      };
    }

    // Convert all fields to strings and ensure they exist
    return {
      name: String(ing.name || '').trim(),
      quantity: ing.quantity !== null && ing.quantity !== undefined ? String(ing.quantity).trim() : '',
      unit: ing.unit !== null && ing.unit !== undefined ? String(ing.unit).trim() : '',
      notes: ing.notes !== null && ing.notes !== undefined ? String(ing.notes).trim() : '',
      preparation: ing.preparation !== null && ing.preparation !== undefined ? String(ing.preparation).trim() : '',
    };
  });

  // Fix instructions - ensure it's an array of strings
  if (typeof recipe.instructions === 'string') {
    console.warn('[normalizeRecipeData] Converting instructions from string to array');
    recipe.instructions = recipe.instructions.split('\n').filter((i: string) => i.trim());
  } else if (!Array.isArray(recipe.instructions)) {
    console.warn('[normalizeRecipeData] Invalid instructions format, setting to empty array');
    recipe.instructions = [];
  }

  // Ensure instructions are strings
  recipe.instructions = recipe.instructions.map((inst: any) => String(inst));

  // Fix tags - ensure it's an array of strings
  if (!recipe.tags) {
    recipe.tags = [];
  } else if (typeof recipe.tags === 'string') {
    console.warn('[normalizeRecipeData] Converting tags from string to array');
    recipe.tags = [recipe.tags];
  } else if (!Array.isArray(recipe.tags)) {
    console.warn('[normalizeRecipeData] Invalid tags format, setting to empty array');
    recipe.tags = [];
  }

  // Ensure tags are strings
  recipe.tags = recipe.tags.map((tag: any) => String(tag));

  // Convert string numbers to actual numbers
  if (typeof recipe.prep_time === 'string') {
    const parsed = parseInt(recipe.prep_time, 10);
    recipe.prep_time = isNaN(parsed) ? null : parsed;
    console.warn(`[normalizeRecipeData] Converted prep_time from string to ${recipe.prep_time}`);
  }

  if (typeof recipe.cook_time === 'string') {
    const parsed = parseInt(recipe.cook_time, 10);
    recipe.cook_time = isNaN(parsed) ? null : parsed;
    console.warn(`[normalizeRecipeData] Converted cook_time from string to ${recipe.cook_time}`);
  }

  if (typeof recipe.servings === 'string') {
    const parsed = parseInt(recipe.servings, 10);
    recipe.servings = isNaN(parsed) ? null : parsed;
    console.warn(`[normalizeRecipeData] Converted servings from string to ${recipe.servings}`);
  }

  // Ensure numeric fields are null or valid numbers
  if (recipe.prep_time !== null && (typeof recipe.prep_time !== 'number' || recipe.prep_time < 0)) {
    console.warn('[normalizeRecipeData] Invalid prep_time, setting to null');
    recipe.prep_time = null;
  }

  if (recipe.cook_time !== null && (typeof recipe.cook_time !== 'number' || recipe.cook_time < 0)) {
    console.warn('[normalizeRecipeData] Invalid cook_time, setting to null');
    recipe.cook_time = null;
  }

  if (recipe.servings !== null && (typeof recipe.servings !== 'number' || recipe.servings < 1)) {
    console.warn('[normalizeRecipeData] Invalid servings, setting to null');
    recipe.servings = null;
  }

  // Validate and normalize difficulty
  if (recipe.difficulty && !['easy', 'medium', 'hard'].includes(recipe.difficulty)) {
    console.warn(`[normalizeRecipeData] Invalid difficulty "${recipe.difficulty}", setting to null`);
    recipe.difficulty = null;
  }

  // Normalize nutritionInfo if present
  if (recipe.nutritionInfo && typeof recipe.nutritionInfo === 'object') {
    const nutrition = recipe.nutritionInfo;

    // Convert string numbers to actual numbers
    ['calories', 'protein', 'carbohydrates', 'fat', 'fiber'].forEach((field) => {
      if (typeof nutrition[field] === 'string') {
        const parsed = parseFloat(nutrition[field]);
        nutrition[field] = isNaN(parsed) ? null : parsed;
      }

      // Validate numbers
      if (nutrition[field] !== null && (typeof nutrition[field] !== 'number' || nutrition[field] < 0)) {
        nutrition[field] = null;
      }
    });
  }

  return recipe as IngestedRecipe;
}

/**
 * Parse text content with recipe detection
 * First detects if the text contains a recipe, then extracts it if valid
 */
export async function parseTextWithLLM(text: string): Promise<RecipeDetectionResult> {
  const client = getOpenRouterClient();

  if (!text || text.trim().length === 0) {
    return {
      isRecipe: false,
      error: 'No text provided to parse',
    };
  }

  // Check minimum length (recipes need a reasonable amount of content)
  if (text.trim().length < 100) {
    return {
      isRecipe: false,
      error: 'Text is too short to be a recipe (minimum 100 characters)',
    };
  }

  const prompt = `You are a recipe detection and extraction specialist. Your task is to analyze the provided text and determine if it contains a valid recipe.

A VALID RECIPE MUST HAVE:
1. A clear recipe name/title
2. A list of ingredients with quantities (at least 3 ingredients)
3. Step-by-step cooking instructions (at least 3 steps)

If the text does NOT meet these criteria, return:
{
  "isRecipe": false,
  "error": "Brief explanation of why this is not a recipe",
  "confidence": 0.0
}

If the text DOES contain a valid recipe, extract it and return:
{
  "isRecipe": true,
  "confidence": 0.95,
  "recipe": {
    "name": "Recipe title (string, required)",
    "description": "Brief 1-2 sentence description (string or null)",
    "ingredients": [
      {
        "name": "all-purpose flour",
        "quantity": "2",
        "unit": "cups",
        "notes": "",
        "preparation": "sifted"
      },
      {
        "name": "butter",
        "quantity": "1",
        "unit": "cup",
        "notes": "softened",
        "preparation": ""
      }
    ],
    "instructions": ["Step 1 instructions...", "Step 2 instructions...", ...],
    "prep_time": 15 (number in minutes or null),
    "cook_time": 30 (number in minutes or null),
    "servings": 4 (number or null),
    "difficulty": "easy" | "medium" | "hard" (or null),
    "cuisine": "Italian" (string or null - e.g., "Italian", "Mexican", "Asian"),
    "tags": ["vegetarian", "pasta", "dinner"] (array of strings, can be empty),
    "image_url": null (always null for text input),
    "video_url": null (always null for text input),
    "nutritionInfo": {
      "calories": 350 (number or null),
      "protein": 12 (number in grams or null),
      "carbohydrates": 45 (number in grams or null),
      "fat": 8 (number in grams or null),
      "fiber": 3 (number in grams or null)
    } (or null if no nutrition info found)
  }
}

CRITICAL DATA TYPE REQUIREMENTS (MUST FOLLOW EXACTLY):
1. ingredients MUST be an array of objects (minimum 3 items)
2. Each ingredient object MUST have a "name" field (string, required)
3. Each ingredient object MUST have these fields (all strings):
   - name: string (required - the ingredient name)
   - quantity: string (e.g., "1", "2", "1/2", "1.5") - use empty string "" if not specified
   - unit: string (e.g., "cups", "tsp", "oz", "g") - use empty string "" if not specified
   - notes: string (optional details) - use empty string "" if not specified
   - preparation: string (e.g., "chopped", "diced") - use empty string "" if not specified
4. instructions MUST be an array of strings (minimum 3 items)
5. name MUST be a non-empty string
6. prep_time MUST be a number or null (NEVER a string)
7. cook_time MUST be a number or null (NEVER a string)
8. servings MUST be a number or null (NEVER a string)
9. tags MUST be an array of strings (can be empty array [])
10. difficulty MUST be "easy", "medium", "hard", or null (no other values)
11. Use null for missing numeric data (NEVER use 0 for missing data)
12. Use empty string "" for missing ingredient text fields (quantity, unit, notes, preparation)

IMPORTANT RULES FOR EXTRACTION:
1. Extract ALL ingredients with precise quantities, units, and names
2. Break down combined ingredients into separate entries
3. Normalize units to common formats (tbsp, tsp, cup, oz, lb, g, kg, ml, l)
4. Extract preparation methods into the "preparation" field (e.g., "diced", "minced", "chopped")
5. Number each instruction step clearly and keep them concise
6. Infer difficulty based on: number of steps, cooking techniques, time required
7. Extract cuisine type from content context or recipe name
8. Generate relevant tags based on: dietary restrictions, meal type, cooking method, main ingredients
9. Ensure all numeric values are actual numbers, not strings (e.g., 15 not "15")
10. Set confidence score (0.0-1.0) based on recipe clarity and completeness

TEXT TO ANALYZE:
${text}

Return ONLY valid JSON matching the exact structure above, no additional text or explanations.`;

  try {
    const response = await client.chat.completions.create({
      model: MODELS.CLAUDE_SONNET_4_5,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2, // Low temperature for consistent detection
      max_tokens: 4096,
    });

    const content_text = response.choices[0].message.content;
    if (!content_text) {
      return {
        isRecipe: false,
        error: 'No response from AI model',
      };
    }

    // Extract JSON from response
    const jsonString = extractJSON(content_text);
    const parsed = JSON.parse(jsonString) as RecipeDetectionResult;

    // If not a recipe, return early
    if (!parsed.isRecipe) {
      return {
        isRecipe: false,
        error: parsed.error || 'Text does not contain a valid recipe',
        confidence: parsed.confidence || 0.0,
      };
    }

    // If recipe is detected, validate it
    if (!parsed.recipe) {
      return {
        isRecipe: false,
        error: 'Recipe detection succeeded but no recipe data was extracted',
      };
    }

    // Normalize recipe data to fix common LLM response issues
    let recipe = normalizeRecipeData(parsed.recipe);

    // LEVEL 2: Structure Validation
    const structureValidation = validateParsedRecipe(recipe);

    if (!structureValidation.isValid) {
      // Try auto-sanitization for ingredients
      const { sanitized, modified, changes } = sanitizeIngredients(recipe.ingredients);

      if (modified) {
        console.warn('[parseTextWithLLM] Auto-sanitized ingredients:', changes);
        recipe.ingredients = sanitized;

        // Re-validate after sanitization
        const revalidation = validateParsedRecipe(recipe);
        if (!revalidation.isValid) {
          const errorMessages = revalidation.errors.map((e) => `${e.field}: ${e.message}`);
          return {
            isRecipe: false,
            error: `Recipe validation failed after auto-sanitization:\n${errorMessages.join('\n')}`,
          };
        }

        // Log warnings even if validation passes
        if (revalidation.warnings.length > 0) {
          console.warn(
            '[parseTextWithLLM] Validation warnings:',
            revalidation.warnings.map((w) => `${w.field}: ${w.message}`)
          );
        }
      } else {
        const errorMessages = structureValidation.errors.map((e) => `${e.field}: ${e.message}`);
        return {
          isRecipe: false,
          error: `Recipe validation failed:\n${errorMessages.join('\n')}`,
        };
      }
    } else if (structureValidation.warnings.length > 0) {
      // Log warnings even if validation passes
      console.warn(
        '[parseTextWithLLM] Validation warnings:',
        structureValidation.warnings.map((w) => `${w.field}: ${w.message}`)
      );
    }

    // LEVEL 3: Serialization Validation
    const serializationValidation = validateSerialization(recipe);

    if (!serializationValidation.isValid) {
      const errorMessages = serializationValidation.errors.map((e) => `${e.field}: ${e.message}`);
      return {
        isRecipe: false,
        error: `Recipe serialization validation failed:\n${errorMessages.join('\n')}`,
      };
    }

    // All normalization is now handled by normalizeRecipeData function

    return {
      isRecipe: true,
      recipe,
      confidence: parsed.confidence || 0.95,
    };
  } catch (error) {
    console.error('[parseTextWithLLM] Error:', error);

    return {
      isRecipe: false,
      error: `Failed to parse text: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
