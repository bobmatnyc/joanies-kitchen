/**
 * Preparation Method Parser
 *
 * Advanced parsing for extracting preparation methods from ingredient strings.
 * Handles complex patterns and contextual preparation detection.
 *
 * @module lib/ingredients/preparation-parser
 */

import { PREPARATION_METHODS } from '../db/ingredients-schema';

/**
 * Parsed preparation information
 */
export interface PreparationInfo {
  method?: string; // Primary preparation method
  modifier?: string; // Modifier (e.g., "finely", "coarsely")
  state?: string; // State (e.g., "fresh", "dried", "frozen")
  combined?: string; // Full combined preparation string
}

/**
 * Preparation modifiers
 */
const MODIFIERS = [
  'finely',
  'coarsely',
  'roughly',
  'thinly',
  'thickly',
  'lightly',
  'well',
  'very',
  'extra',
];

/**
 * State keywords
 */
const STATES = ['fresh', 'dried', 'frozen', 'canned', 'jarred', 'bottled', 'raw', 'cooked'];

/**
 * Parse preparation information from an ingredient string
 *
 * @param ingredientString - Full ingredient string (e.g., "2 cups finely chopped onions")
 * @returns Parsed preparation information
 *
 * @example
 * parsePreparation("2 cups finely chopped fresh basil")
 * // Returns: { method: "chopped", modifier: "finely", state: "fresh", combined: "finely chopped fresh" }
 */
export function parsePreparation(ingredientString: string): PreparationInfo {
  const lower = ingredientString.toLowerCase();
  const result: PreparationInfo = {};

  // Extract modifier + method combinations (e.g., "finely chopped")
  for (const modifier of MODIFIERS) {
    for (const method of PREPARATION_METHODS) {
      const pattern = new RegExp(`\\b${modifier}\\s+${method}\\b`, 'i');
      if (pattern.test(lower)) {
        result.modifier = modifier;
        result.method = method;
        break;
      }
    }
    if (result.method) break;
  }

  // If no modifier+method found, try method alone
  if (!result.method) {
    for (const method of PREPARATION_METHODS) {
      const pattern = new RegExp(`\\b${method}\\b`, 'i');
      if (pattern.test(lower)) {
        result.method = method;
        break;
      }
    }
  }

  // Extract state
  for (const state of STATES) {
    const pattern = new RegExp(`\\b${state}\\b`, 'i');
    if (pattern.test(lower)) {
      result.state = state;
      break;
    }
  }

  // Build combined string
  const parts: string[] = [];
  if (result.modifier) parts.push(result.modifier);
  if (result.method) parts.push(result.method);
  if (result.state && result.state !== result.method) parts.push(result.state);

  if (parts.length > 0) {
    result.combined = parts.join(' ');
  }

  return result;
}

/**
 * Extract all preparation details from recipe ingredient text
 *
 * @param ingredientText - Full ingredient text with amounts and preparation
 * @returns Cleaned ingredient name and preparation details
 *
 * @example
 * extractPreparation("2 cups fresh basil leaves, chopped")
 * // Returns: {
 * //   ingredient: "basil",
 * //   preparation: "fresh leaves, chopped",
 * //   amount: "2",
 * //   unit: "cups"
 * // }
 */
export function extractPreparation(ingredientText: string): {
  ingredient: string;
  preparation?: string;
  amount?: string;
  unit?: string;
} {
  let working = ingredientText.trim();

  // Extract amount and unit (simple pattern)
  const amountPattern = /^(\d+(?:\s*\/\s*\d+)?(?:\s*-\s*\d+)?)\s+([a-z]+)\s+/i;
  let amount: string | undefined;
  let unit: string | undefined;

  const amountMatch = working.match(amountPattern);
  if (amountMatch) {
    amount = amountMatch[1];
    unit = amountMatch[2];
    working = working.replace(amountPattern, '');
  }

  // Parse preparation
  const prepInfo = parsePreparation(working);

  // Remove preparation from ingredient name
  let ingredientName = working;
  if (prepInfo.combined) {
    // Remove the preparation text
    const prepPattern = new RegExp(prepInfo.combined.replace(/\s+/g, '\\s+'), 'gi');
    ingredientName = ingredientName.replace(prepPattern, '').trim();
  }

  // Clean up commas and extra whitespace
  ingredientName = ingredientName.replace(/,/g, '').replace(/\s+/g, ' ').trim();

  return {
    ingredient: ingredientName,
    preparation: prepInfo.combined,
    amount,
    unit,
  };
}

/**
 * Standardize preparation text for consistency
 *
 * @param preparation - Raw preparation text
 * @returns Standardized preparation text
 */
export function standardizePreparation(preparation: string): string {
  const info = parsePreparation(preparation);
  return info.combined || preparation.toLowerCase().trim();
}

/**
 * Merge multiple preparation methods
 * Example: "chopped" + "fresh" → "fresh chopped"
 *
 * @param preparations - Array of preparation strings
 * @returns Merged preparation string
 */
export function mergePreparations(preparations: string[]): string {
  const allInfo = preparations.map(parsePreparation);

  const modifiers = new Set<string>();
  const methods = new Set<string>();
  const states = new Set<string>();

  for (const info of allInfo) {
    if (info.modifier) modifiers.add(info.modifier);
    if (info.method) methods.add(info.method);
    if (info.state) states.add(info.state);
  }

  const parts: string[] = [];
  if (modifiers.size > 0) parts.push(Array.from(modifiers).join(' and '));
  if (methods.size > 0) parts.push(Array.from(methods).join(' and '));
  if (states.size > 0) parts.push(Array.from(states).join(' and '));

  return parts.join(' ');
}
