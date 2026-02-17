/**
 * Recipe parser for standalone scripts
 * Uses Ollama with local models to extract recipe data from markdown/HTML
 */

export interface ParsedRecipe {
  name: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  prepTime?: string | null;
  cookTime?: string | null;
  totalTime?: string | null;
  servings?: string | null;
  difficulty?: 'easy' | 'medium' | 'hard' | null;
  cuisine?: string | null;
  tags?: string[];
  imageUrl?: string | null;
  confidence?: number; // 0-1 score of extraction quality
}

/**
 * Get Ollama model name from environment or use default
 *
 * Recommended models (in order of speed/quality balance):
 * - mistral:latest (default) - Fast, reliable, 4.4GB
 * - mistral-small3.2:latest - Better quality, slower, 15GB
 * - qwen2.5:72b - Best quality, very slow, 47GB
 */
function getOllamaModel(): string {
  return process.env.OLLAMA_MODEL || 'mistral:latest';
}

/**
 * Check if Ollama server is running
 */
async function checkOllamaServer(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Extract recipe from markdown using Ollama local model
 */
export async function extractRecipeWithAI(
  markdown: string,
  url: string,
  metadata?: any
): Promise<ParsedRecipe | null> {
  // Check if Ollama is available
  const isServerRunning = await checkOllamaServer();
  if (!isServerRunning) {
    console.error('   ✗ Ollama server is not running. Start it with: ollama serve');
    throw new Error('Ollama server not available at http://localhost:11434');
  }

  const model = getOllamaModel();
  console.log(`   🤖 Using Ollama model: ${model}`);

  // Use metadata if available
  const ogTitle = metadata?.ogTitle || metadata?.title || '';
  const ogDescription = metadata?.ogDescription || metadata?.description || '';
  const ogImage = metadata?.ogImage || '';

  const prompt = `Extract recipe information from this web page content and return valid JSON.

URL: ${url}
${ogTitle ? `Title: ${ogTitle}` : ''}
${ogDescription ? `Description: ${ogDescription}` : ''}

Page Content (Markdown):
${markdown.substring(0, 8000)} ${markdown.length > 8000 ? '... (truncated)' : ''}

Extract and return a JSON object with this EXACT structure:
{
  "name": "recipe title (string, required)",
  "description": "brief 1-2 sentence description (string or null)",
  "ingredients": ["ingredient 1 with amount", "ingredient 2", ...] (array of strings, required),
  "instructions": ["step 1", "step 2", ...] (array of strings, required),
  "prepTime": "15 minutes" or null (string or null),
  "cookTime": "30 minutes" or null (string or null),
  "totalTime": "45 minutes" or null (string or null),
  "servings": "4 servings" or null (string or null),
  "difficulty": "easy" or "medium" or "hard" or null,
  "cuisine": "cuisine type" or null,
  "tags": ["tag1", "tag2"] (array, can be empty),
  "imageUrl": "${ogImage || 'null'}" (use provided og:image or extract from content),
  "confidence": 0.85 (number 0-1, your confidence in extraction quality)
}

RULES:
1. Extract ALL ingredients with amounts (e.g., "2 cups flour", "1 lb chicken")
2. Extract ALL instruction steps as separate array items
3. If you cannot find ingredients OR instructions, set confidence to 0.0
4. Keep times as strings with units (e.g., "30 minutes", "2 hours")
5. Use null for missing data, NOT empty strings
6. Return ONLY valid JSON, no markdown or explanations
7. If this doesn't look like a recipe page, set confidence to 0.0

Respond with ONLY the JSON object, no other text.`;

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        format: 'json',
        stream: false,
        options: {
          temperature: 0.2, // Low temperature for consistent parsing
          num_predict: 2000, // Max tokens
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content_text = data.response;

    if (!content_text) {
      throw new Error('No response from Ollama model');
    }

    // Parse JSON response
    let parsed: ParsedRecipe;
    try {
      parsed = JSON.parse(content_text);
    } catch (parseError) {
      console.error(
        `   ✗ Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
      );
      console.error(`   Response was: ${content_text.substring(0, 200)}...`);
      return null;
    }

    // Validate required fields
    if (!parsed.name || !parsed.ingredients || !parsed.instructions) {
      console.log('   ⚠ AI extraction missing required fields');
      return null;
    }

    if (!Array.isArray(parsed.ingredients) || parsed.ingredients.length === 0) {
      console.log('   ⚠ AI extraction: no ingredients found');
      return null;
    }

    if (!Array.isArray(parsed.instructions) || parsed.instructions.length === 0) {
      console.log('   ⚠ AI extraction: no instructions found');
      return null;
    }

    // Check confidence score
    if (parsed.confidence !== undefined && parsed.confidence < 0.5) {
      console.log(`   ⚠ AI extraction: low confidence (${parsed.confidence})`);
      return null;
    }

    console.log(`   ✓ AI extracted: ${parsed.name} (confidence: ${parsed.confidence || 'N/A'})`);
    console.log(
      `      - ${parsed.ingredients.length} ingredients, ${parsed.instructions.length} steps`
    );

    return parsed;
  } catch (error) {
    console.error(
      `   ✗ AI extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return null;
  }
}

/**
 * Rate limiting helper for AI requests
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
