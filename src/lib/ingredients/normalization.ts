/**
 * Ingredient Normalization Utilities
 *
 * Core functions for normalizing ingredient names and extracting metadata.
 * Handles:
 * - Removing quantity/measurement prefixes
 * - Extracting preparation methods
 * - Standardizing capitalization
 * - Generating clean slugs
 * - Applying ingredient consolidation mappings
 *
 * @module lib/ingredients/normalization
 */

import { PREPARATION_METHODS } from '../db/ingredients-schema';
import { applyConsolidation } from './consolidation-map';

/**
 * Result of ingredient normalization
 */
export interface NormalizedIngredient {
  base: string; // Normalized base ingredient (e.g., "Butter")
  preparation?: string; // Preparation method (e.g., "chopped", "leaves")
  quantity?: string; // Extracted quantity (e.g., "1/4 stick", "10-ounce")
  unit?: string; // Extracted unit (e.g., "stick", "ounce", "can")
  original: string; // Original input for reference
}

/**
 * Common quantity patterns to extract
 */
const QUANTITY_PATTERNS = [
  // Parenthesized quantities: "(1/4 Stick)", "(10-ounce)", "(4 3/4- to 5-pound)"
  /^\(([^)]+)\)\s*/i,

  // Leading measurements: "10-ounce Bag", "8 oz Can"
  /^(\d+(?:\s*-\s*\d+)?(?:\s*\/\s*\d+)?(?:\s+\d+\/\d+)?)\s*(oz|ounce|lb|pound|stick|can|package|pkg|bag|box|jar|bottle)s?\s+/i,

  // Complex fractions: "4 3/4- to 5-pound"
  /^(\d+\s+\d+\/\d+\s*-?\s*to\s*\d+(?:\s*-)?)\s*(pound|lb|oz|ounce)s?\s*/i,
];

/**
 * Preparation suffix patterns (order matters - check longest first)
 */
const PREPARATION_SUFFIXES = [
  // Compound preparations
  { pattern: /\s+leaves?\s+with\s+tender\s+stems?$/i, prep: 'leaves with tender stems' },
  { pattern: /\s+leaves?\s+only$/i, prep: 'leaves only' },

  // Standard preparations
  { pattern: /\s+leaves?$/i, prep: 'leaves' },
  { pattern: /\s+chopped$/i, prep: 'chopped' },
  { pattern: /\s+diced$/i, prep: 'diced' },
  { pattern: /\s+sliced$/i, prep: 'sliced' },
  { pattern: /\s+minced$/i, prep: 'minced' },
  { pattern: /\s+grated$/i, prep: 'grated' },
  { pattern: /\s+shredded$/i, prep: 'shredded' },
  { pattern: /\s+crushed$/i, prep: 'crushed' },
  { pattern: /\s+whole$/i, prep: 'whole' },
  { pattern: /\s+halved$/i, prep: 'halved' },
  { pattern: /\s+quartered$/i, prep: 'quartered' },
  { pattern: /\s+peeled$/i, prep: 'peeled' },
  { pattern: /\s+seeded$/i, prep: 'seeded' },
  { pattern: /\s+trimmed$/i, prep: 'trimmed' },

  // Finely/coarsely modifiers
  { pattern: /\s+finely\s+chopped$/i, prep: 'finely chopped' },
  { pattern: /\s+finely\s+diced$/i, prep: 'finely diced' },
  { pattern: /\s+finely\s+minced$/i, prep: 'finely minced' },
  { pattern: /\s+coarsely\s+chopped$/i, prep: 'coarsely chopped' },
  { pattern: /\s+coarsely\s+diced$/i, prep: 'coarsely diced' },
  { pattern: /\s+roughly\s+chopped$/i, prep: 'roughly chopped' },

  // State preparations
  { pattern: /\s+fresh$/i, prep: 'fresh' },
  { pattern: /\s+dried$/i, prep: 'dried' },
  { pattern: /\s+frozen$/i, prep: 'frozen' },
  { pattern: /\s+canned$/i, prep: 'canned' },
  { pattern: /\s+roasted$/i, prep: 'roasted' },
  { pattern: /\s+toasted$/i, prep: 'toasted' },
  { pattern: /\s+blanched$/i, prep: 'blanched' },
  { pattern: /\s+melted$/i, prep: 'melted' },
  { pattern: /\s+softened$/i, prep: 'softened' },
];

/**
 * Ingredient prefixes that should be preserved (not treated as preparation)
 * Example: "Baby Arugula" - "Baby" is part of the ingredient name, not preparation
 */
const _PRESERVE_PREFIXES = [
  'baby',
  'young',
  'fresh',
  'frozen',
  'canned',
  'dried',
  'smoked',
  'wild',
  'organic',
  'raw',
  'cooked',
  'instant',
  'quick',
  'light',
  'dark',
  'extra',
  'super',
  'mini',
  'jumbo',
  'large',
  'medium',
  'small',
];

/**
 * Special cases where "leaves" is part of the ingredient name, not preparation
 */
const LEAVES_ARE_INGREDIENT = [
  'bay leaves', // Bay leaves are the ingredient itself
  'banana leaves', // Banana leaves are the ingredient
  'grape leaves', // Grape leaves are the ingredient
  'kaffir lime leaves', // Kaffir lime leaves are the ingredient
  'curry leaves', // Curry leaves are the ingredient
  'lemon verbena leaves', // Lemon verbena leaves are the ingredient
  'collard leaves', // Collard leaves (not just "collards")
  'beet leaves', // Beet leaves are distinct from beets
  'beetroot leaves', // Same as above
  'hierba santa leaves', // The leaves are the ingredient
  'geranium leaves', // Geranium leaves are the ingredient
];

/**
 * Normalize an ingredient name by extracting metadata
 *
 * @param raw - Raw ingredient name as stored in database
 * @param applyConsolidationMap - Whether to apply consolidation mappings (default: true)
 * @returns Normalized ingredient with extracted metadata
 *
 * @example
 * normalizeIngredientName("(1/4 Stick) Butter")
 * // Returns: { base: "Butter", quantity: "1/4 Stick", unit: "Stick", original: "..." }
 *
 * @example
 * normalizeIngredientName("Basil Leaves")
 * // Returns: { base: "Basil", preparation: "leaves", original: "..." }
 *
 * @example
 * normalizeIngredientName("Baby Arugula Leaves")
 * // Returns: { base: "Baby Arugula", preparation: "leaves", original: "..." }
 *
 * @example
 * normalizeIngredientName("Basil") // with consolidation enabled
 * // Returns: { base: "Basil Leaves", original: "Basil" }
 * // Note: "basil" consolidates to "basil leaves"
 */
export function normalizeIngredientName(
  raw: string,
  applyConsolidationMap: boolean = true
): NormalizedIngredient {
  let working = raw.trim();
  const result: NormalizedIngredient = {
    base: working,
    original: raw,
  };

  // Step 1: Extract quantity/measurement prefixes
  for (const pattern of QUANTITY_PATTERNS) {
    const match = working.match(pattern);
    if (match) {
      result.quantity = match[1].trim();
      if (match[2]) {
        result.unit = match[2];
      }
      // Remove the matched quantity/unit from working string
      working = working.replace(pattern, '').trim();
      break;
    }
  }

  // Step 2: Check if this is a special case where "leaves" is part of the name
  const lowerWorking = working.toLowerCase();
  if (LEAVES_ARE_INGREDIENT.some((special) => lowerWorking === special)) {
    // Keep as-is, don't extract "leaves" as preparation
    result.base = capitalizeWords(working);
    return result;
  }

  // Step 3: Extract preparation suffixes (try longest patterns first)
  for (const { pattern, prep } of PREPARATION_SUFFIXES) {
    if (pattern.test(working)) {
      result.preparation = prep;
      working = working.replace(pattern, '').trim();
      break;
    }
  }

  // Step 4: Apply consolidation mapping (if enabled)
  // This maps variant ingredients to canonical forms (e.g., "basil" -> "basil leaves")
  if (applyConsolidationMap) {
    working = applyConsolidation(working);
  }

  // Step 5: Clean and capitalize the base ingredient
  result.base = capitalizeWords(working);

  return result;
}

/**
 * Capitalize words properly for display names
 * Handles special cases like "and", "or", "of", "the"
 *
 * @param str - String to capitalize
 * @returns Properly capitalized string
 */
export function capitalizeWords(str: string): string {
  const lowercase = ['and', 'or', 'of', 'the', 'in', 'with', 'to', 'a', 'an'];

  return str
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLowerCase();

      // Always capitalize first word
      if (index === 0) {
        return word.charAt(0).toUpperCase() + lower.slice(1);
      }

      // Keep lowercase for common words (unless first word)
      if (lowercase.includes(lower)) {
        return lower;
      }

      // Capitalize other words
      return word.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/**
 * Generate a URL-friendly slug from ingredient name
 *
 * @param name - Ingredient name
 * @returns URL-friendly slug
 *
 * @example
 * generateCanonicalSlug("Extra-Virgin Olive Oil")
 * // Returns: "extra-virgin-olive-oil"
 */
export function generateCanonicalSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      // Replace spaces, underscores, and multiple hyphens with single hyphen
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      // Remove special characters except hyphens
      .replace(/[^a-z0-9-]/g, '')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
  );
}

/**
 * Normalize and clean an ingredient slug
 * Handles variations like "olive_oil" vs "olive-oil" vs "olive oil"
 *
 * @param slug - Input slug (may have underscores, spaces, or hyphens)
 * @returns Normalized slug with consistent formatting
 */
export function normalizeSlug(slug: string): string {
  return generateCanonicalSlug(slug);
}

/**
 * Extract preparation method from a recipe ingredient string
 * This is more aggressive than the suffix extraction - it looks anywhere in the string
 *
 * @param ingredientString - Full ingredient string from recipe
 * @returns Detected preparation method or undefined
 */
export function detectPreparationMethod(ingredientString: string): string | undefined {
  const lower = ingredientString.toLowerCase();

  // Check for known preparation methods
  for (const method of PREPARATION_METHODS) {
    if (lower.includes(method)) {
      return method;
    }
  }

  // Check for custom patterns
  if (/leaves?\s+with\s+tender\s+stems?/i.test(lower)) {
    return 'leaves with tender stems';
  }
  if (/leaves?\s+only/i.test(lower)) {
    return 'leaves only';
  }
  if (/finely\s+\w+/i.test(lower)) {
    const match = lower.match(/finely\s+(\w+)/);
    if (match) {
      return `finely ${match[1]}`;
    }
  }
  if (/coarsely\s+\w+/i.test(lower)) {
    const match = lower.match(/coarsely\s+(\w+)/);
    if (match) {
      return `coarsely ${match[1]}`;
    }
  }

  return undefined;
}

/**
 * Check if two ingredient names are likely variants of each other
 * Uses simple heuristics like:
 * - Same after removing hyphens/underscores
 * - One is substring of other (with word boundaries)
 * - Very high similarity (>95%)
 *
 * @param name1 - First ingredient name
 * @param name2 - Second ingredient name
 * @returns True if likely variants
 */
export function areVariants(name1: string, name2: string): boolean {
  const clean1 = name1.toLowerCase().replace(/[-_\s]/g, '');
  const clean2 = name2.toLowerCase().replace(/[-_\s]/g, '');

  // Exact match after cleaning
  if (clean1 === clean2) {
    return true;
  }

  // One is substring of other (with reasonable length)
  const words1 = name1.toLowerCase().split(/\s+/);
  const words2 = name2.toLowerCase().split(/\s+/);

  if (words1.length === words2.length) {
    return false; // Same word count but different - not variants
  }

  // Check if all words from shorter name appear in longer name
  const shorter = words1.length < words2.length ? words1 : words2;
  const longer = words1.length < words2.length ? words2 : words1;

  const allWordsMatch = shorter.every((word) => longer.includes(word));
  if (allWordsMatch) {
    return true;
  }

  return false;
}

/**
 * Determine the canonical (preferred) name between two variants
 * Prefers: shorter, more common, without special characters
 *
 * @param name1 - First ingredient name
 * @param name2 - Second ingredient name
 * @returns Canonical name
 */
export function selectCanonical(name1: string, name2: string): string {
  // Remove special characters for comparison
  const clean1 = name1.replace(/[-_]/g, ' ').toLowerCase();
  const clean2 = name2.replace(/[-_]/g, ' ').toLowerCase();

  // Prefer the one without underscores
  const hasUnderscore1 = name1.includes('_');
  const hasUnderscore2 = name2.includes('_');
  if (hasUnderscore1 && !hasUnderscore2) return name2;
  if (!hasUnderscore1 && hasUnderscore2) return name1;

  // Prefer the shorter one (usually more canonical)
  if (clean1.length < clean2.length) return name1;
  if (clean2.length < clean1.length) return name2;

  // Prefer spaces over hyphens
  const hasSpace1 = name1.includes(' ');
  const hasSpace2 = name2.includes(' ');
  if (hasSpace1 && !hasSpace2) return name1;
  if (!hasSpace1 && hasSpace2) return name2;

  // Default to alphabetically first
  return name1.toLowerCase() < name2.toLowerCase() ? name1 : name2;
}

/**
 * Batch normalize ingredients
 *
 * @param ingredients - Array of raw ingredient names
 * @returns Array of normalized ingredients
 */
export function batchNormalize(ingredients: string[]): NormalizedIngredient[] {
  return ingredients.map((ing) => normalizeIngredientName(ing));
}

/**
 * Generate a report of normalization changes
 *
 * @param normalized - Normalized ingredient result
 * @returns Human-readable change description
 */
export function formatNormalizationChange(normalized: NormalizedIngredient): string {
  const parts: string[] = [];

  if (normalized.quantity || normalized.unit) {
    parts.push(
      `Extracted quantity: ${normalized.quantity || ''}${normalized.unit ? ` ${normalized.unit}` : ''}`
    );
  }

  if (normalized.preparation) {
    parts.push(`Extracted preparation: "${normalized.preparation}"`);
  }

  if (normalized.original !== normalized.base) {
    parts.push(`Renamed: "${normalized.original}" → "${normalized.base}"`);
  }

  return parts.length > 0 ? parts.join(', ') : 'No changes needed';
}
