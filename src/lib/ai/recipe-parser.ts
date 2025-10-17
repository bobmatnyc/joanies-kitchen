import 'server-only';
import { MODELS } from './openrouter';
import { getOpenRouterClient } from './openrouter-server';

export interface ParsedRecipe {
  name: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  cuisine?: string;
  tags?: string[];
  imageUrl?: string;
  nutritionInfo?: {
    calories?: number;
    protein?: number;
    carbohydrates?: number;
    fat?: number;
    fiber?: number;
  };
}

/**
 * Parse recipe content using AI (Claude Sonnet 4.5)
 * Supports text, markdown, and images
 */
export async function parseRecipeWithAI(content: {
  text?: string;
  markdown?: string;
  html?: string;
  images?: string[];
}): Promise<ParsedRecipe> {
  const client = getOpenRouterClient();

  // Construct the content for the AI
  const textContent = content.text || content.markdown || content.html || '';

  if (!textContent && (!content.images || content.images.length === 0)) {
    throw new Error('No content provided to parse');
  }

  const prompt = `Parse this recipe content and extract structured data in valid JSON format.

Recipe Content:
${textContent}

${content.images && content.images.length > 0 ? `Image URLs: ${content.images.join(', ')}` : ''}

Return a JSON object with this exact structure:
{
  "name": "recipe title",
  "description": "brief description (1-2 sentences)",
  "ingredients": ["ingredient with amount", "another ingredient", ...],
  "instructions": ["step 1", "step 2", ...],
  "prepTime": minutes (number or null),
  "cookTime": minutes (number or null),
  "servings": number (or null),
  "difficulty": "easy" | "medium" | "hard" (or null),
  "cuisine": "cuisine type" (or null),
  "tags": ["tag1", "tag2"] (or empty array),
  "imageUrl": "main image URL if available" (or null),
  "nutritionInfo": {
    "calories": number (or null),
    "protein": number in grams (or null),
    "carbohydrates": number in grams (or null),
    "fat": number in grams (or null),
    "fiber": number in grams (or null)
  }
}

IMPORTANT:
- Be thorough and accurate
- Extract ALL ingredients with specific amounts and units
- Number each instruction step clearly
- If information is missing, use null (not empty strings)
- Ensure valid JSON format
- Estimate difficulty based on techniques and time if not specified
- Extract nutrition info if available, otherwise leave as null`;

  try {
    const response = await client.chat.completions.create({
      model: MODELS.CLAUDE_SONNET_4_5,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent parsing
    });

    const content_text = response.choices[0].message.content;
    if (!content_text) {
      throw new Error('No response from AI model');
    }

    const parsed = JSON.parse(content_text) as ParsedRecipe;

    // Validate required fields
    if (!parsed.name || !parsed.ingredients || !parsed.instructions) {
      throw new Error('Missing required fields in parsed recipe');
    }

    if (!Array.isArray(parsed.ingredients) || parsed.ingredients.length === 0) {
      throw new Error('Invalid ingredients format');
    }

    if (!Array.isArray(parsed.instructions) || parsed.instructions.length === 0) {
      throw new Error('Invalid instructions format');
    }

    return parsed;
  } catch (error) {
    console.error('Error parsing recipe with AI:', error);
    throw new Error(
      `Failed to parse recipe: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Parse recipe from image using vision model
 */
export async function parseRecipeFromImage(imageUrl: string): Promise<ParsedRecipe> {
  const client = getOpenRouterClient();

  const prompt = `Extract the recipe from this image and return structured JSON data.

Return a JSON object with this exact structure:
{
  "name": "recipe title",
  "description": "brief description",
  "ingredients": ["ingredient with amount", ...],
  "instructions": ["step 1", "step 2", ...],
  "prepTime": minutes (number or null),
  "cookTime": minutes (number or null),
  "servings": number (or null),
  "difficulty": "easy" | "medium" | "hard" (or null),
  "cuisine": "cuisine type" (or null),
  "tags": ["tag1", "tag2"],
  "nutritionInfo": {...} or null
}

Be thorough and extract all visible information.`;

  try {
    const response = await client.chat.completions.create({
      model: MODELS.GPT_4O, // Use vision model
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content_text = response.choices[0].message.content;
    if (!content_text) {
      throw new Error('No response from AI model');
    }

    const parsed = JSON.parse(content_text) as ParsedRecipe;

    // Validate required fields
    if (!parsed.name || !parsed.ingredients || !parsed.instructions) {
      throw new Error('Missing required fields in parsed recipe');
    }

    return parsed;
  } catch (error) {
    console.error('Error parsing recipe from image:', error);
    throw new Error(
      `Failed to parse recipe from image: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Batch parse multiple recipes
 */
export async function batchParseRecipes(
  recipes: Array<{ text?: string; markdown?: string; html?: string; images?: string[] }>
): Promise<ParsedRecipe[]> {
  const results: ParsedRecipe[] = [];

  // Process sequentially to avoid rate limits
  for (const recipe of recipes) {
    try {
      const parsed = await parseRecipeWithAI(recipe);
      results.push(parsed);

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Error parsing recipe in batch:', error);
      // Continue with next recipe even if one fails
    }
  }

  return results;
}
