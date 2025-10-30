/**
 * Advanced Ingredient Consolidation Utilities
 *
 * Features:
 * - Unit conversion (cups ↔ tbsp, lbs ↔ oz, etc.)
 * - Fuzzy matching for ingredient names
 * - Smart consolidation of similar ingredients
 * - Price estimation integration
 */

import type { ShoppingListItem } from '@/lib/db/schema';
import {
  consolidateUsageNotes,
  extractUsageNotes,
  normalizeIngredientName as normalizeForShopping,
} from '@/lib/utils/ingredient-normalizer';

// ============================================================================
// Unit Conversion Tables
// ============================================================================

// Volume conversions (to tablespoons as base unit)
const VOLUME_TO_TBSP: Record<string, number> = {
  tbsp: 1,
  tablespoon: 1,
  tablespoons: 1,
  tsp: 1 / 3,
  teaspoon: 1 / 3,
  teaspoons: 1 / 3,
  cup: 16,
  cups: 16,
  'fl oz': 2,
  'fluid ounce': 2,
  'fluid ounces': 2,
  pint: 32,
  pints: 32,
  quart: 64,
  quarts: 64,
  gallon: 256,
  gallons: 256,
  ml: 1 / 14.787, // approximate
  milliliter: 1 / 14.787,
  milliliters: 1 / 14.787,
  liter: 67.628,
  liters: 67.628,
};

// Weight conversions (to ounces as base unit)
const WEIGHT_TO_OZ: Record<string, number> = {
  oz: 1,
  ounce: 1,
  ounces: 1,
  lb: 16,
  lbs: 16,
  pound: 16,
  pounds: 16,
  g: 1 / 28.35,
  gram: 1 / 28.35,
  grams: 1 / 28.35,
  kg: 35.274,
  kilogram: 35.274,
  kilograms: 35.274,
};

// Count-based units (pieces, items, etc.)
const COUNT_UNITS = new Set([
  'piece',
  'pieces',
  'item',
  'items',
  'whole',
  'clove',
  'cloves',
  'head',
  'heads',
  'bunch',
  'bunches',
  'slice',
  'slices',
  'can',
  'cans',
  'jar',
  'jars',
  'package',
  'packages',
  'box',
  'boxes',
]);

// ============================================================================
// Unit Conversion Functions
// ============================================================================

export function convertToBaseUnit(
  quantity: number,
  unit: string
): { baseQuantity: number; baseUnit: string } {
  const normalizedUnit = unit.toLowerCase().trim();

  // Volume conversions
  if (VOLUME_TO_TBSP[normalizedUnit]) {
    return {
      baseQuantity: quantity * VOLUME_TO_TBSP[normalizedUnit],
      baseUnit: 'tbsp',
    };
  }

  // Weight conversions
  if (WEIGHT_TO_OZ[normalizedUnit]) {
    return {
      baseQuantity: quantity * WEIGHT_TO_OZ[normalizedUnit],
      baseUnit: 'oz',
    };
  }

  // Count-based units (no conversion)
  if (COUNT_UNITS.has(normalizedUnit)) {
    return {
      baseQuantity: quantity,
      baseUnit: normalizedUnit,
    };
  }

  // Unknown unit - return as-is
  return {
    baseQuantity: quantity,
    baseUnit: unit,
  };
}

export function convertFromBaseUnit(
  baseQuantity: number,
  baseUnit: string,
  targetUnit?: string
): { quantity: number; unit: string } {
  // If no target unit specified, use smart defaults
  if (!targetUnit) {
    if (baseUnit === 'tbsp') {
      // Convert tbsp to cups if >= 16 tbsp (1 cup)
      if (baseQuantity >= 16) {
        return { quantity: baseQuantity / 16, unit: 'cups' };
      }
      return { quantity: baseQuantity, unit: 'tbsp' };
    }

    if (baseUnit === 'oz') {
      // Convert oz to lbs if >= 16 oz (1 lb)
      if (baseQuantity >= 16) {
        return { quantity: baseQuantity / 16, unit: 'lbs' };
      }
      return { quantity: baseQuantity, unit: 'oz' };
    }

    return { quantity: baseQuantity, unit: baseUnit };
  }

  const normalizedTarget = targetUnit.toLowerCase().trim();

  // Volume conversion from tbsp
  if (baseUnit === 'tbsp' && VOLUME_TO_TBSP[normalizedTarget]) {
    return {
      quantity: baseQuantity / VOLUME_TO_TBSP[normalizedTarget],
      unit: targetUnit,
    };
  }

  // Weight conversion from oz
  if (baseUnit === 'oz' && WEIGHT_TO_OZ[normalizedTarget]) {
    return {
      quantity: baseQuantity / WEIGHT_TO_OZ[normalizedTarget],
      unit: targetUnit,
    };
  }

  // No conversion possible
  return { quantity: baseQuantity, unit: baseUnit };
}

// ============================================================================
// Ingredient Name Normalization
// ============================================================================

/**
 * Normalize ingredient name for matching
 * - Remove adjectives (fresh, organic, chopped, etc.)
 * - Singularize (onions → onion)
 * - Lowercase and trim
 */
export function normalizeIngredientName(name: string): string {
  let normalized = name.toLowerCase().trim();

  // Remove common adjectives and qualifiers
  const removeWords = [
    'fresh',
    'frozen',
    'organic',
    'raw',
    'cooked',
    'chopped',
    'diced',
    'minced',
    'sliced',
    'grated',
    'shredded',
    'ground',
    'whole',
    'large',
    'medium',
    'small',
    'extra',
    'super',
    'about',
    'approximately',
    'or to taste',
  ];

  for (const word of removeWords) {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
  }

  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Simple singularization (not perfect but good enough)
  if (normalized.endsWith('ies')) {
    normalized = `${normalized.slice(0, -3)}y`;
  } else if (normalized.endsWith('es')) {
    normalized = normalized.slice(0, -2);
  } else if (normalized.endsWith('s') && !normalized.endsWith('ss')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Calculate similarity between two ingredient names (0-1)
 * Uses Levenshtein distance
 */
export function calculateIngredientSimilarity(name1: string, name2: string): number {
  const norm1 = normalizeIngredientName(name1);
  const norm2 = normalizeIngredientName(name2);

  // Exact match after normalization
  if (norm1 === norm2) return 1.0;

  // Check if one contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.9;

  // Levenshtein distance
  const distance = levenshteinDistance(norm1, norm2);
  const maxLength = Math.max(norm1.length, norm2.length);
  const similarity = 1 - distance / maxLength;

  return Math.max(0, similarity);
}

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
      }
    }
  }

  return dp[m][n];
}

// ============================================================================
// Shopping List Consolidation
// ============================================================================

export interface ParsedIngredient {
  quantity: number;
  unit: string;
  name: string;
  original: string;
  isToTaste?: boolean;
}

/**
 * Parse ingredient string into components
 * Supports formats:
 * - "2 cups milk"
 * - "1/2 tsp salt"
 * - "3-4 cloves garlic"
 * - "salt and pepper to taste"
 */
export function parseIngredientString(ingredient: string): ParsedIngredient | null {
  const trimmed = ingredient.trim();

  // Check for "to taste" or similar qualifiers FIRST
  const toTastePattern = /\b(to taste|as needed|for seasoning|if desired|to season)\b/i;
  const isToTaste = toTastePattern.test(trimmed);

  // Strip the qualifier from the text for further parsing
  let text = trimmed;
  if (isToTaste) {
    text = text.replace(toTastePattern, '').trim();
    // Clean up any trailing commas or "and"
    text = text.replace(/,?\s*and?\s*$/, '').trim();
  }

  // Pattern 1: "quantity unit name" (e.g., "2 cups milk")
  const pattern1 = /^(\d+(?:\.\d+)?|\d+\/\d+|\d+-\d+)\s+([a-zA-Z]+)\s+(.+)$/;
  const match1 = text.match(pattern1);
  if (match1) {
    const [, qtyStr, unit, name] = match1;
    const quantity = parseQuantity(qtyStr);
    return {
      quantity: isToTaste ? 0 : quantity,
      unit: unit.toLowerCase(),
      name: name.trim(),
      original: ingredient,
      isToTaste,
    };
  }

  // Pattern 2: "quantity name" (e.g., "2 onions")
  const pattern2 = /^(\d+(?:\.\d+)?|\d+\/\d+|\d+-\d+)\s+(.+)$/;
  const match2 = text.match(pattern2);
  if (match2) {
    const [, qtyStr, name] = match2;
    const quantity = parseQuantity(qtyStr);
    return {
      quantity: isToTaste ? 0 : quantity,
      unit: 'pieces',
      name: name.trim(),
      original: ingredient,
      isToTaste,
    };
  }

  // Pattern 3: No quantity (e.g., "salt to taste")
  return {
    quantity: 0,
    unit: '',
    name: text,
    original: ingredient,
    isToTaste,
  };
}

function parseQuantity(qtyStr: string): number {
  // Handle fractions (e.g., "1/2")
  if (qtyStr.includes('/')) {
    const [num, den] = qtyStr.split('/').map(Number);
    return num / den;
  }

  // Handle ranges (e.g., "3-4") - take average
  if (qtyStr.includes('-')) {
    const [min, max] = qtyStr.split('-').map(Number);
    return (min + max) / 2;
  }

  return parseFloat(qtyStr);
}

/**
 * Consolidate shopping list items
 * - Combines items with same name (after normalization)
 * - Converts units to common base
 * - Sums quantities
 * - Consolidates usage notes
 */
export function consolidateShoppingListItems(items: ShoppingListItem[]): ShoppingListItem[] {
  const consolidated = new Map<
    string,
    ShoppingListItem & { originalNames?: string[]; usageNotes?: (string | null)[] }
  >();

  for (const item of items) {
    // Use the new normalization that handles usage notes
    const normalizedName = normalizeForShopping(item.name);
    const usageNote = extractUsageNotes(item.name);

    // Check if similar item already exists
    let matchedKey: string | null = null;
    let highestSimilarity = 0;

    for (const [key, _existingItem] of consolidated.entries()) {
      const similarity = calculateIngredientSimilarity(normalizedName, key);
      if (similarity > 0.85 && similarity > highestSimilarity) {
        highestSimilarity = similarity;
        matchedKey = key;
      }
    }

    if (matchedKey) {
      // Merge with existing item
      const existing = consolidated.get(matchedKey)!;

      // Convert both to common base unit
      const { baseQuantity: existingBase, baseUnit: existingBaseUnit } = convertToBaseUnit(
        existing.quantity,
        existing.unit
      );
      const { baseQuantity: newBase, baseUnit: newBaseUnit } = convertToBaseUnit(
        item.quantity,
        item.unit
      );

      // Only consolidate if units are compatible (same base unit)
      if (existingBaseUnit === newBaseUnit) {
        const combinedBase = existingBase + newBase;
        const { quantity, unit } = convertFromBaseUnit(combinedBase, existingBaseUnit);

        // Preserve isToTaste flag - if either item is "to taste", mark the result as such
        const isToTaste = existing.isToTaste || item.isToTaste;

        // Consolidate usage notes
        const existingNotes = existing.usageNotes || [];
        const combinedNotes = [...existingNotes, usageNote];
        const consolidatedNote = consolidateUsageNotes(combinedNotes);

        consolidated.set(matchedKey, {
          ...existing,
          name: normalizedName, // Use normalized name for display
          quantity: isToTaste ? 0 : quantity, // Zero out quantity if "to taste"
          unit,
          from_recipes: [...new Set([...existing.from_recipes, ...item.from_recipes])],
          estimated_price: (existing.estimated_price || 0) + (item.estimated_price || 0),
          isToTaste,
          originalNames: [...(existing.originalNames || []), item.name],
          usageNotes: combinedNotes,
          notes: consolidatedNote || existing.notes, // Add consolidated usage notes to notes field
        });
      } else {
        // Units not compatible - keep separate
        consolidated.set(normalizedName, {
          ...item,
          name: normalizedName,
          originalNames: [item.name],
          usageNotes: [usageNote],
        });
      }
    } else {
      // New item
      consolidated.set(normalizedName, {
        ...item,
        name: normalizedName, // Use normalized name for display
        originalNames: [item.name],
        usageNotes: [usageNote],
        notes: usageNote || item.notes, // Include usage note in notes field if present
      });
    }
  }

  // Remove temporary tracking fields before returning
  return Array.from(consolidated.values()).map(({ originalNames, usageNotes, ...item }) => item);
}

/**
 * Group shopping list items by category with smart ordering
 */
export function groupAndSortByCategory(
  items: ShoppingListItem[]
): Record<string, ShoppingListItem[]> {
  const CATEGORY_ORDER = [
    'produce',
    'proteins',
    'dairy',
    'grains',
    'condiments',
    'spices',
    'beverages',
    'other',
  ];

  const grouped = items.reduce(
    (acc, item) => {
      const category = item.category || 'other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    },
    {} as Record<string, ShoppingListItem[]>
  );

  // Sort items within each category alphabetically
  for (const category in grouped) {
    grouped[category].sort((a, b) => a.name.localeCompare(b.name));
  }

  // Return ordered categories
  const ordered: Record<string, ShoppingListItem[]> = {};
  for (const category of CATEGORY_ORDER) {
    if (grouped[category]) {
      ordered[category] = grouped[category];
    }
  }

  // Add any remaining categories not in the order
  for (const category in grouped) {
    if (!ordered[category]) {
      ordered[category] = grouped[category];
    }
  }

  return ordered;
}
