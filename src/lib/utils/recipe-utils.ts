import { type Recipe } from '@/lib/db/schema';

// Helper function to safely parse JSON with fallback
function safeJsonParse(value: string | any[], fallback: any[] = []): any[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (error) {
      // If JSON parse fails, treat as plain text
      console.warn('Failed to parse JSON, using fallback:', error);
      // If it's a non-empty string, return it as a single-item array
      return value.trim() ? [value.trim()] : fallback;
    }
  }

  return fallback;
}

// Helper function to parse JSON fields for client-side use
export function parseRecipe(recipe: Recipe) {
  return {
    ...recipe,
    ingredients: safeJsonParse(recipe.ingredients, []),
    instructions: safeJsonParse(recipe.instructions, []),
    tags: safeJsonParse(recipe.tags, []),
    images: safeJsonParse(recipe.images, []),
  };
}

// Check if an ingredient has a proper amount or valid qualifier
export function hasValidAmountOrQualifier(ingredient: string): boolean {
  const trimmed = ingredient.trim();

  // Common qualifiers that are valid without specific amounts
  const validQualifiers = [
    /to taste$/i,
    /as needed$/i,
    /as desired$/i,
    /optional$/i,
    /for serving$/i,
    /for garnish$/i,
    /for decoration$/i,
  ];

  // Check if ingredient has a valid qualifier
  for (const qualifier of validQualifiers) {
    if (qualifier.test(trimmed)) {
      return true;
    }
  }

  // Check if ingredient has a measurable amount
  // Numbers, fractions, or common amount words at the start
  const hasAmount = /^[\d½¼¾⅓⅔⅛⅜⅝⅞]|^(a |an |one |two |three |four |five |six |some |few |several |pinch of |dash of |splash of )/i.test(trimmed);

  return hasAmount;
}

// Normalize ingredient formatting for consistent display
export function normalizeIngredient(ingredient: string): string {
  let normalized = ingredient.trim();

  // Normalize qualifiers: add comma before them if missing
  const qualifiers = [
    'to taste',
    'as needed',
    'as desired',
    'optional',
    'for serving',
    'for garnish',
    'for decoration',
  ];

  for (const qualifier of qualifiers) {
    // Pattern: word boundary + space + qualifier at end (no comma before)
    // Example: "Salt to taste" matches, "Salt, to taste" doesn't match
    const pattern = new RegExp(`\\s+(${qualifier})$`, 'i');
    if (pattern.test(normalized)) {
      // Check if already has comma
      const hasCommaPattern = new RegExp(`,\\s*${qualifier}$`, 'i');
      if (!hasCommaPattern.test(normalized)) {
        // Replace " qualifier" with ", qualifier"
        normalized = normalized.replace(pattern, `, ${qualifier}`);
      }
    }
  }

  return normalized;
}