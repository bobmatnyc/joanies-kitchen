/**
 * Recipe Placeholder Image System
 * Maps recipe tags to themed placeholder images
 */

import { categorizeTag } from '@/lib/tag-ontology';

export type PlaceholderTheme =
  | 'breakfast'
  | 'lunch-dinner'
  | 'dessert'
  | 'salad'
  | 'soup'
  | 'pasta'
  | 'meat'
  | 'vegetarian'
  | 'baked'
  | 'beverage'
  | 'seafood'
  | 'generic';

/**
 * Placeholder theme mapping based on tag categories
 * Priority order: Course > Meal Type > Main Ingredient > Cooking Method > Dietary
 */
const THEME_MAPPING: Record<string, PlaceholderTheme> = {
  // Course-based (highest priority)
  salad: 'salad',
  soup: 'soup',
  stew: 'soup',
  pasta: 'pasta',
  noodles: 'pasta',
  pizza: 'pasta',
  sandwich: 'lunch-dinner',
  wrap: 'lunch-dinner',
  bowl: 'lunch-dinner',
  casserole: 'lunch-dinner',

  // Meal Type
  breakfast: 'breakfast',
  brunch: 'breakfast',
  dessert: 'dessert',
  beverage: 'beverage',
  drink: 'beverage',
  snack: 'dessert',
  appetizer: 'lunch-dinner',

  // Main Ingredient
  chicken: 'meat',
  beef: 'meat',
  pork: 'meat',
  lamb: 'meat',
  turkey: 'meat',
  fish: 'seafood',
  seafood: 'seafood',
  salmon: 'seafood',
  shrimp: 'seafood',
  tuna: 'seafood',
  rice: 'lunch-dinner',
  quinoa: 'lunch-dinner',
  vegetables: 'vegetarian',
  tofu: 'vegetarian',
  beans: 'vegetarian',
  lentils: 'vegetarian',
  mushrooms: 'vegetarian',

  // Cooking Method
  baked: 'baked',
  baking: 'baked',
  roasted: 'meat',
  grilled: 'meat',
  fried: 'meat',

  // Dietary
  vegan: 'vegetarian',
  vegetarian: 'vegetarian',
};

/**
 * Get the appropriate placeholder theme for a recipe based on its tags
 * Returns the most specific match based on priority order
 */
export function getPlaceholderTheme(tags: string[]): PlaceholderTheme {
  if (!tags || tags.length === 0) {
    return 'generic';
  }

  // Normalize tags
  const normalizedTags = tags.map((tag) => tag.toLowerCase().trim());

  // Priority 1: Course-specific tags
  const courseMatches = normalizedTags.filter((tag) =>
    ['salad', 'soup', 'stew', 'pasta', 'noodles', 'pizza'].some((keyword) => tag.includes(keyword))
  );
  if (courseMatches.length > 0) {
    for (const tag of courseMatches) {
      for (const [keyword, theme] of Object.entries(THEME_MAPPING)) {
        if (tag.includes(keyword)) {
          return theme;
        }
      }
    }
  }

  // Priority 2: Meal Type
  const mealTypeMatches = normalizedTags.filter((tag) =>
    ['breakfast', 'brunch', 'dessert', 'beverage', 'drink'].some((keyword) => tag.includes(keyword))
  );
  if (mealTypeMatches.length > 0) {
    for (const tag of mealTypeMatches) {
      for (const [keyword, theme] of Object.entries(THEME_MAPPING)) {
        if (tag.includes(keyword)) {
          return theme;
        }
      }
    }
  }

  // Priority 3: Main Ingredient
  const ingredientMatches = normalizedTags.filter((tag) =>
    Object.keys(THEME_MAPPING).some((keyword) => tag.includes(keyword))
  );
  if (ingredientMatches.length > 0) {
    for (const tag of ingredientMatches) {
      for (const [keyword, theme] of Object.entries(THEME_MAPPING)) {
        if (tag.includes(keyword)) {
          return theme;
        }
      }
    }
  }

  // Priority 4: Check categorized tags
  for (const tag of tags) {
    const category = categorizeTag(tag);

    // Special handling for dietary tags
    if (
      category === 'Dietary' &&
      (tag.toLowerCase().includes('vegan') || tag.toLowerCase().includes('vegetarian'))
    ) {
      return 'vegetarian';
    }

    // Special handling for cooking methods
    if (category === 'Cooking Method' && tag.toLowerCase().includes('baked')) {
      return 'baked';
    }
  }

  return 'generic';
}

/**
 * Get the full path to the placeholder image for a recipe
 */
export function getPlaceholderImage(tags: string[]): string {
  const theme = getPlaceholderTheme(tags);
  return `/placeholders/${theme}.svg`;
}

/**
 * Get a descriptive alt text for the placeholder image
 */
export function getPlaceholderAlt(theme: PlaceholderTheme): string {
  const altTexts: Record<PlaceholderTheme, string> = {
    breakfast: 'Breakfast dish placeholder',
    'lunch-dinner': 'Lunch or dinner dish placeholder',
    dessert: 'Dessert placeholder',
    salad: 'Salad placeholder',
    soup: 'Soup or stew placeholder',
    pasta: 'Pasta dish placeholder',
    meat: 'Meat dish placeholder',
    vegetarian: 'Vegetarian dish placeholder',
    baked: 'Baked goods placeholder',
    beverage: 'Beverage placeholder',
    seafood: 'Seafood dish placeholder',
    generic: 'Recipe placeholder',
  };

  return altTexts[theme];
}
