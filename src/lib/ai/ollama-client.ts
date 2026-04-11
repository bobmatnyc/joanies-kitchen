// Server-only Ollama REST client
// Communicates with local Ollama instance at http://localhost:11434
import 'server-only';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
export const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:4b';
const DEFAULT_MODEL = DEFAULT_OLLAMA_MODEL;

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
  };
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

/**
 * Generate text using local Ollama model
 * Uses non-streaming mode for simplicity
 */
export async function ollamaGenerate(
  prompt: string,
  model: string = DEFAULT_MODEL,
  options?: OllamaGenerateRequest['options']
): Promise<string> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 200,
        ...options,
      },
    } satisfies OllamaGenerateRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as OllamaGenerateResponse;
  return data.response.trim();
}

/**
 * Check if Ollama is available (any model running)
 * Convenience alias for use in recipe-cleaner service
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { models: Array<{ name: string }> };
    return Array.isArray(data.models);
  } catch {
    return false;
  }
}

/**
 * Check if Ollama is running and the model is available
 */
export async function checkOllamaHealth(model: string = DEFAULT_MODEL): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { models: Array<{ name: string }> };
    return data.models.some((m) => m.name.startsWith(model.split(':')[0]));
  } catch {
    return false;
  }
}

/**
 * Generate a vivid food photography prompt for a recipe
 * Uses the recipe name, cuisine, and ingredients to craft a detailed DALL-E / Pollinations prompt
 */
export async function generateFoodPhotographyPrompt(recipe: {
  name: string;
  cuisine?: string | null;
  ingredients?: string | null;
  description?: string | null;
}): Promise<string> {
  const ingredientsSummary = recipe.ingredients
    ? (() => {
        try {
          const parsed = JSON.parse(recipe.ingredients) as string[];
          return parsed.slice(0, 6).join(', ');
        } catch {
          return recipe.ingredients.slice(0, 200);
        }
      })()
    : '';

  const prompt = `You are a food photography art director. Write a single, vivid image generation prompt (max 120 words) for a professional food photo of "${recipe.name}"${recipe.cuisine ? ` (${recipe.cuisine} cuisine)` : ''}.${ingredientsSummary ? ` Key ingredients: ${ingredientsSummary}.` : ''}${recipe.description ? ` Description: ${recipe.description.slice(0, 150)}.` : ''}

The prompt must describe: plating style, lighting (e.g. soft natural window light), camera angle (e.g. overhead 45-degree), props (e.g. rustic wooden board, linen napkin), background, and overall mood. Make it appetizing and realistic. Output ONLY the prompt text, no explanation.`;

  const result = await ollamaGenerate(prompt, DEFAULT_MODEL, {
    temperature: 0.8,
    num_predict: 150,
  });

  // Strip any leading/trailing quotes Ollama might add
  return result.replace(/^["']|["']$/g, '').trim();
}
