import type { Recipe } from '@/lib/db/schema';

// Helper function to safely parse a field that could be JSON array or plain text
function safeParseArray(value: string | string[] | null | undefined): string[] {
  // Already an array
  if (Array.isArray(value)) {
    return value;
  }

  // Null or undefined
  if (!value) {
    return [];
  }

  // Try parsing as JSON
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      // Handle legacy object format: [{item: "...", quantity: "..."}]
      if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
        return parsed.map((obj: any) => {
          // If it's an object with item and quantity, convert to string
          if ('item' in obj && 'quantity' in obj) {
            // Format: "quantity item" (e.g., "4 Eggs")
            return `${obj.quantity} ${obj.item}`.trim();
          }
          // Otherwise, stringify the object
          return String(obj);
        });
      }
      return parsed;
    }
    // If parsed but not an array, treat as single item
    return [String(parsed)];
  } catch {
    // Not valid JSON - treat as plain text
    // Split on newlines if multi-line, otherwise single item
    const lines = value
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return lines.length > 0 ? lines : [value];
  }
}

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
    ingredients: safeParseArray(recipe.ingredients),
    instructions: safeParseArray(recipe.instructions),
    tags: recipe.tags ? safeParseArray(recipe.tags) : [],
    images: recipe.images ? safeParseArray(recipe.images) : [],
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
  const hasAmount =
    /^[\d½¼¾⅓⅔⅛⅜⅝⅞]|^(a |an |one |two |three |four |five |six |some |few |several |pinch of |dash of |splash of )/i.test(
      trimmed
    );

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
