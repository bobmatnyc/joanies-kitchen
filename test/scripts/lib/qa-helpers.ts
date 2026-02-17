/**
 * QA Helper Utilities
 *
 * Shared utility functions for QA scripts
 */

/**
 * Parse LLM JSON response handling markdown code blocks
 *
 * Handles formats:
 * - Plain JSON: ["item1", "item2"]
 * - Markdown: ```json\n["item1", "item2"]\n```
 * - Markdown (no language): ```\n["item1", "item2"]\n```
 */
export function parseJsonResponse(content: string): any {
  let cleaned = content.trim();

  // Remove markdown code blocks if present
  const markdownMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (markdownMatch) {
    cleaned = markdownMatch[1].trim();
  }

  // Try to parse
  try {
    return JSON.parse(cleaned);
  } catch (_parseError) {
    // Fallback: try to extract JSON array or object
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);

    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    } else if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }

    throw new Error(`Failed to parse JSON from response: ${cleaned.substring(0, 100)}...`);
  }
}

/**
 * Extract ingredient array from LLM response
 * Handles multiple response formats
 */
export function extractIngredientArray(parsed: any): string[] {
  if (Array.isArray(parsed)) {
    return parsed.filter((item) => typeof item === 'string');
  } else if (parsed.ingredients && Array.isArray(parsed.ingredients)) {
    return parsed.ingredients.filter((item: any) => typeof item === 'string');
  } else if (typeof parsed === 'object' && Object.keys(parsed).length === 1) {
    // Handle case where response is {key: [...]}
    const key = Object.keys(parsed)[0];
    if (Array.isArray(parsed[key])) {
      return parsed[key].filter((item: any) => typeof item === 'string');
    }
  }

  throw new Error(`Unexpected response format: ${JSON.stringify(parsed).substring(0, 100)}`);
}

/**
 * Sleep utility for retry delays
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
