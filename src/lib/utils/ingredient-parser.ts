/**
 * Ingredient Parser Utility
 *
 * Provides functions for parsing ingredient strings into structured data
 * that can be stored in the normalized ingredients database.
 *
 * Example inputs:
 * - "2 cups chopped onions"
 * - "1/2 teaspoon salt"
 * - "3-4 cloves garlic, minced"
 * - "1 pound chicken breast, cut into cubes"
 */

import { COMMON_UNITS, PREPARATION_METHODS } from '../db/ingredients-schema';

export interface ParsedIngredient {
  amount?: string;
  unit?: string;
  ingredient: string;
  preparation?: string;
  isOptional?: boolean;
}

/**
 * Parse a raw ingredient string into structured components
 *
 * @param ingredientString - Raw ingredient string (e.g., "2 cups chopped onions")
 * @returns ParsedIngredient object with structured data
 *
 * @example
 * parseIngredientString("2 cups chopped onions")
 * // Returns: { amount: "2", unit: "cups", ingredient: "onions", preparation: "chopped" }
 */
export function parseIngredientString(ingredientString: string): ParsedIngredient {
  // Remove extra whitespace and normalize
  const normalized = ingredientString.trim().replace(/\s+/g, ' ');

  // Check if optional (contains "optional" or parentheses)
  const isOptional = /\(optional\)/i.test(normalized) || /^optional:/i.test(normalized);
  const cleanString = normalized
    .replace(/\(optional\)/gi, '')
    .replace(/^optional:\s*/i, '')
    .trim();

  // Regular expression to match amount (including fractions and ranges)
  // Matches: "2", "1/2", "1-2", "2.5", "1 1/2"
  const amountRegex = /^(\d+(?:[\s-]\d+)?(?:\/\d+)?(?:\.\d+)?)\s*/;
  const amountMatch = cleanString.match(amountRegex);

  let remaining = cleanString;
  let amount: string | undefined;

  if (amountMatch) {
    amount = amountMatch[1].trim();
    remaining = cleanString.slice(amountMatch[0].length);
  }

  // Extract unit (if present)
  let unit: string | undefined;
  for (const commonUnit of COMMON_UNITS) {
    const unitRegex = new RegExp(`^${commonUnit}\\s+`, 'i');
    if (unitRegex.test(remaining)) {
      unit = commonUnit;
      remaining = remaining.replace(unitRegex, '');
      break;
    }
  }

  // Split remaining by comma to separate ingredient from preparation
  const parts = remaining.split(',').map((p) => p.trim());
  const ingredient = parts[0] || remaining;

  // Extract preparation methods
  let preparation: string | undefined;
  if (parts.length > 1) {
    preparation = parts.slice(1).join(', ');
  } else {
    // Check if any preparation method appears in the ingredient name
    for (const method of PREPARATION_METHODS) {
      const methodRegex = new RegExp(`\\b${method}\\b`, 'i');
      if (methodRegex.test(ingredient)) {
        // Extract preparation from ingredient
        const ingredientParts = ingredient.split(/\s+/);
        const prepWords: string[] = [];
        const ingredientWords: string[] = [];

        for (const word of ingredientParts) {
          if (PREPARATION_METHODS.some((m) => m === word.toLowerCase())) {
            prepWords.push(word);
          } else {
            ingredientWords.push(word);
          }
        }

        if (prepWords.length > 0) {
          preparation = prepWords.join(' ');
          return {
            amount,
            unit,
            ingredient: ingredientWords.join(' '),
            preparation,
            isOptional,
          };
        }
      }
    }
  }

  return {
    amount,
    unit,
    ingredient,
    preparation,
    isOptional,
  };
}

/**
 * Normalize ingredient name for database storage
 * Converts to lowercase and removes extra whitespace
 *
 * @param name - Ingredient name to normalize
 * @returns Normalized lowercase name
 *
 * @example
 * normalizeIngredientName("Green Onions")
 * // Returns: "green onions"
 */
export function normalizeIngredientName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Create display name from normalized name
 * Capitalizes first letter of each word
 *
 * @param normalizedName - Normalized ingredient name
 * @returns Display name with proper capitalization
 *
 * @example
 * createDisplayName("green onions")
 * // Returns: "Green Onions"
 */
export function createDisplayName(normalizedName: string): string {
  return normalizedName
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Detect if an ingredient name matches known allergens
 *
 * @param ingredientName - Ingredient name to check
 * @returns true if ingredient is a known allergen
 */
export function isAllergen(ingredientName: string): boolean {
  const allergenKeywords = [
    'milk',
    'dairy',
    'cheese',
    'butter',
    'cream',
    'yogurt',
    'egg',
    'eggs',
    'peanut',
    'peanuts',
    'tree nut',
    'almond',
    'cashew',
    'walnut',
    'pecan',
    'pistachio',
    'soy',
    'soybean',
    'tofu',
    'wheat',
    'gluten',
    'fish',
    'salmon',
    'tuna',
    'cod',
    'shellfish',
    'shrimp',
    'crab',
    'lobster',
    'clam',
    'mussel',
    'oyster',
    'sesame',
  ];

  const normalized = normalizeIngredientName(ingredientName);
  return allergenKeywords.some((allergen) => normalized.includes(allergen));
}

/**
 * Suggest category for an ingredient based on its name
 *
 * @param ingredientName - Ingredient name
 * @returns Suggested category
 */
export function suggestCategory(ingredientName: string): string {
  const normalized = normalizeIngredientName(ingredientName);

  // Category keyword mappings
  const categoryMap: Record<string, string[]> = {
    vegetables: [
      'onion',
      'garlic',
      'tomato',
      'carrot',
      'celery',
      'pepper',
      'lettuce',
      'spinach',
      'broccoli',
      'cauliflower',
      'zucchini',
      'eggplant',
      'cucumber',
      'cabbage',
      'kale',
    ],
    fruits: [
      'apple',
      'banana',
      'orange',
      'lemon',
      'lime',
      'berry',
      'strawberry',
      'blueberry',
      'grape',
      'mango',
      'peach',
      'pear',
      'cherry',
    ],
    proteins: ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'tofu', 'tempeh'],
    seafood: [
      'fish',
      'salmon',
      'tuna',
      'cod',
      'shrimp',
      'crab',
      'lobster',
      'clam',
      'mussel',
      'oyster',
    ],
    dairy: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'sour cream'],
    grains: ['rice', 'quinoa', 'oats', 'barley', 'wheat', 'bread', 'flour'],
    pasta: ['pasta', 'noodle', 'spaghetti', 'penne', 'fettuccine', 'linguine', 'macaroni'],
    legumes: ['bean', 'lentil', 'chickpea', 'pea'],
    nuts: ['almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'peanut'],
    herbs: ['basil', 'oregano', 'thyme', 'rosemary', 'cilantro', 'parsley', 'mint', 'sage', 'dill'],
    spices: [
      'pepper',
      'salt',
      'cumin',
      'paprika',
      'cinnamon',
      'nutmeg',
      'ginger',
      'turmeric',
      'curry',
      'chili',
    ],
    condiments: ['sauce', 'ketchup', 'mustard', 'mayonnaise', 'vinegar', 'soy sauce'],
    oils: ['oil', 'olive oil', 'vegetable oil', 'coconut oil', 'butter'],
    sweeteners: ['sugar', 'honey', 'syrup', 'maple syrup', 'agave'],
    baking: ['flour', 'baking powder', 'baking soda', 'yeast', 'vanilla extract'],
    beverages: ['water', 'stock', 'broth', 'wine', 'beer', 'juice'],
  };

  // Check each category
  for (const [category, keywords] of Object.entries(categoryMap)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return category;
    }
  }

  return 'other';
}

/**
 * Extract common units from a list of ingredient strings
 *
 * @param ingredients - Array of ingredient strings
 * @returns Array of unique units found
 */
export function extractCommonUnits(ingredients: string[]): string[] {
  const units = new Set<string>();

  for (const ingredient of ingredients) {
    const parsed = parseIngredientString(ingredient);
    if (parsed.unit) {
      units.add(parsed.unit);
    }
  }

  return Array.from(units);
}

/**
 * Find potential ingredient aliases
 * This is a simple implementation - in production, you might use a more comprehensive mapping
 *
 * @param ingredientName - Ingredient name
 * @returns Array of potential aliases
 */
export function findAliases(ingredientName: string): string[] {
  const normalized = normalizeIngredientName(ingredientName);

  // Common alias mappings
  const aliasMap: Record<string, string[]> = {
    'green onion': ['scallion', 'spring onion'],
    scallion: ['green onion', 'spring onion'],
    cilantro: ['coriander', 'chinese parsley'],
    coriander: ['cilantro'],
    'bell pepper': ['sweet pepper', 'capsicum'],
    zucchini: ['courgette'],
    eggplant: ['aubergine'],
    'snow pea': ['sugar snap pea', 'mangetout'],
    chickpea: ['garbanzo bean'],
    'garbanzo bean': ['chickpea'],
  };

  return aliasMap[normalized] || [];
}

/**
 * Batch parse multiple ingredient strings
 *
 * @param ingredientStrings - Array of raw ingredient strings
 * @returns Array of parsed ingredients
 */
export function batchParseIngredients(ingredientStrings: string[]): ParsedIngredient[] {
  return ingredientStrings.map(parseIngredientString);
}

/**
 * Convert parsed ingredient back to string format
 *
 * @param parsed - ParsedIngredient object
 * @returns Formatted ingredient string
 *
 * @example
 * formatIngredient({ amount: "2", unit: "cups", ingredient: "onions", preparation: "chopped" })
 * // Returns: "2 cups onions, chopped"
 */
export function formatIngredient(parsed: ParsedIngredient): string {
  const parts: string[] = [];

  if (parsed.amount) parts.push(parsed.amount);
  if (parsed.unit) parts.push(parsed.unit);
  parts.push(parsed.ingredient);

  let result = parts.join(' ');

  if (parsed.preparation) {
    result += `, ${parsed.preparation}`;
  }

  if (parsed.isOptional) {
    result += ' (optional)';
  }

  return result;
}
