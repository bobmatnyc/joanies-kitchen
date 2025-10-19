/**
 * Tag Localization System
 *
 * Multi-language support for tag labels and descriptions
 * Currently supports: English (en)
 * Future support: Spanish (es), French (fr)
 */

import type { TagId } from './tag-ids';

/**
 * Supported locales
 * Currently: en (English) only
 * Future: es (Spanish), fr (French)
 */
export type Locale = 'en' | 'es' | 'fr';

/**
 * Tag label with multi-language support
 */
export interface TagLabel {
  /** Tag ID */
  id: TagId;
  /** Display label in different languages */
  label: Record<Locale, string>;
  /** Optional description in different languages */
  description?: Record<Locale, string>;
}

/**
 * Helper to create tag label with English and placeholders for other languages
 * This makes it easy to add translations later
 */
function createLabel(
  id: TagId,
  en: string,
  description?: string
): TagLabel {
  return {
    id,
    label: {
      en,
      es: en, // Placeholder - will be translated
      fr: en, // Placeholder - will be translated
    },
    ...(description && {
      description: {
        en: description,
        es: description, // Placeholder
        fr: description, // Placeholder
      },
    }),
  };
}

/**
 * All tag labels
 * Maps tag IDs to their localized labels
 *
 * NOTE: This is a comprehensive list. For brevity, we define the most important tags here.
 * Missing tags will fall back to the tag ID.
 */
export const TAG_LABELS: Partial<Record<TagId, TagLabel>> = {
  // ==================== DIFFICULTY ====================
  'difficulty.beginner': createLabel(
    'difficulty.beginner',
    'Beginner',
    'Easy recipes for beginners with basic cooking skills'
  ),
  'difficulty.intermediate': createLabel(
    'difficulty.intermediate',
    'Intermediate',
    'Moderate difficulty requiring some cooking experience'
  ),
  'difficulty.advanced': createLabel(
    'difficulty.advanced',
    'Advanced',
    'Challenging recipes for experienced home cooks'
  ),
  'difficulty.expert': createLabel(
    'difficulty.expert',
    'Expert',
    'Professional-level recipes with complex techniques'
  ),

  // ==================== CUISINE (Selected examples) ====================
  'cuisine.italian': createLabel('cuisine.italian', 'Italian', 'Italian cuisine and cooking traditions'),
  'cuisine.italian.sicilian': createLabel('cuisine.italian.sicilian', 'Sicilian', 'Sicilian regional Italian cuisine'),
  'cuisine.italian.tuscan': createLabel('cuisine.italian.tuscan', 'Tuscan', 'Tuscan regional Italian cuisine'),
  'cuisine.mexican': createLabel('cuisine.mexican', 'Mexican', 'Mexican cuisine and traditions'),
  'cuisine.chinese': createLabel('cuisine.chinese', 'Chinese', 'Chinese cuisine and cooking styles'),
  'cuisine.japanese': createLabel('cuisine.japanese', 'Japanese', 'Japanese cuisine and traditions'),
  'cuisine.indian': createLabel('cuisine.indian', 'Indian', 'Indian cuisine and spices'),
  'cuisine.french': createLabel('cuisine.french', 'French', 'French cuisine and cooking techniques'),
  'cuisine.thai': createLabel('cuisine.thai', 'Thai', 'Thai cuisine with bold flavors'),
  'cuisine.mediterranean': createLabel('cuisine.mediterranean', 'Mediterranean', 'Mediterranean regional cuisine'),
  'cuisine.american': createLabel('cuisine.american', 'American', 'American cuisine'),
  'cuisine.korean': createLabel('cuisine.korean', 'Korean', 'Korean cuisine'),
  'cuisine.vietnamese': createLabel('cuisine.vietnamese', 'Vietnamese', 'Vietnamese cuisine'),

  // ==================== MEAL TYPE ====================
  'mealType.breakfast': createLabel('mealType.breakfast', 'Breakfast', 'Morning meal recipes'),
  'mealType.brunch': createLabel('mealType.brunch', 'Brunch', 'Late morning combination of breakfast and lunch'),
  'mealType.lunch': createLabel('mealType.lunch', 'Lunch', 'Midday meal recipes'),
  'mealType.dinner': createLabel('mealType.dinner', 'Dinner', 'Evening main meal recipes'),
  'mealType.snack': createLabel('mealType.snack', 'Snack', 'Light snacks and appetizers'),
  'mealType.dessert': createLabel('mealType.dessert', 'Dessert', 'Sweet treats and desserts'),
  'mealType.appetizer': createLabel('mealType.appetizer', 'Appetizer', 'Starters and small bites'),
  'mealType.beverage': createLabel('mealType.beverage', 'Beverage', 'Drinks and beverages'),

  // ==================== COURSE ====================
  'course.appetizer': createLabel('course.appetizer', 'Appetizer', 'First course or starter'),
  'course.soup': createLabel('course.soup', 'Soup', 'Soup course'),
  'course.salad': createLabel('course.salad', 'Salad', 'Salad course'),
  'course.main': createLabel('course.main', 'Main Course', 'Primary dish of the meal'),
  'course.side': createLabel('course.side', 'Side Dish', 'Accompaniment to the main course'),
  'course.dessert': createLabel('course.dessert', 'Dessert', 'Sweet final course'),
  'course.beverage': createLabel('course.beverage', 'Beverage', 'Drink or cocktail'),

  // ==================== DISH TYPE ====================
  'dishType.soup': createLabel('dishType.soup', 'Soup', 'Soup and broth recipes'),
  'dishType.stew': createLabel('dishType.stew', 'Stew', 'Hearty stew recipes'),
  'dishType.salad': createLabel('dishType.salad', 'Salad', 'Fresh salad recipes'),
  'dishType.sandwich': createLabel('dishType.sandwich', 'Sandwich', 'Sandwich and sub recipes'),
  'dishType.wrap': createLabel('dishType.wrap', 'Wrap', 'Wrap and burrito recipes'),
  'dishType.pizza': createLabel('dishType.pizza', 'Pizza', 'Pizza recipes'),
  'dishType.pasta': createLabel('dishType.pasta', 'Pasta', 'Pasta dishes'),
  'dishType.casserole': createLabel('dishType.casserole', 'Casserole', 'Baked casserole dishes'),
  'dishType.stirFry': createLabel('dishType.stirFry', 'Stir-Fry', 'Quick stir-fried dishes'),
  'dishType.curry': createLabel('dishType.curry', 'Curry', 'Curry dishes'),
  'dishType.bowl': createLabel('dishType.bowl', 'Bowl', 'Bowl-based meals'),
  'dishType.taco': createLabel('dishType.taco', 'Taco', 'Taco recipes'),
  'dishType.burger': createLabel('dishType.burger', 'Burger', 'Burger recipes'),
  'dishType.smoothie': createLabel('dishType.smoothie', 'Smoothie', 'Blended drinks'),

  // ==================== DIETARY ====================
  'dietary.vegetarian': createLabel('dietary.vegetarian', 'Vegetarian', 'No meat or fish'),
  'dietary.vegetarian.vegan': createLabel('dietary.vegetarian.vegan', 'Vegan', 'No animal products'),
  'dietary.glutenFree': createLabel('dietary.glutenFree', 'Gluten-Free', 'No wheat, barley, or rye'),
  'dietary.dairyFree': createLabel('dietary.dairyFree', 'Dairy-Free', 'No milk products'),
  'dietary.nutFree': createLabel('dietary.nutFree', 'Nut-Free', 'No nuts or nut products'),
  'dietary.lowCarb': createLabel('dietary.lowCarb', 'Low-Carb', 'Reduced carbohydrate content'),
  'dietary.lowCarb.keto': createLabel('dietary.lowCarb.keto', 'Keto', 'Ketogenic diet (high fat, low carb)'),
  'dietary.paleo': createLabel('dietary.paleo', 'Paleo', 'Paleolithic diet (whole foods, no grains)'),
  'dietary.whole30': createLabel('dietary.whole30', 'Whole30', 'Whole30 compliant'),
  'dietary.highProtein': createLabel('dietary.highProtein', 'High-Protein', 'Protein-rich recipes'),
  'dietary.lowFat': createLabel('dietary.lowFat', 'Low-Fat', 'Reduced fat content'),
  'dietary.lowSodium': createLabel('dietary.lowSodium', 'Low-Sodium', 'Reduced sodium content'),
  'dietary.sugarFree': createLabel('dietary.sugarFree', 'Sugar-Free', 'No added sugar'),

  // ==================== COOKING METHOD (Selected) ====================
  'cookingMethod.dryHeat.baking': createLabel('cookingMethod.dryHeat.baking', 'Baking', 'Cooked in an oven'),
  'cookingMethod.dryHeat.roasting': createLabel('cookingMethod.dryHeat.roasting', 'Roasting', 'High-heat dry cooking'),
  'cookingMethod.dryHeat.grilling': createLabel('cookingMethod.dryHeat.grilling', 'Grilling', 'Cooked on a grill'),
  'cookingMethod.moistHeat.boiling': createLabel('cookingMethod.moistHeat.boiling', 'Boiling', 'Boiled in water'),
  'cookingMethod.moistHeat.steaming': createLabel('cookingMethod.moistHeat.steaming', 'Steaming', 'Cooked with steam'),
  'cookingMethod.fatBased.frying': createLabel('cookingMethod.fatBased.frying', 'Frying', 'Fried in oil'),
  'cookingMethod.fatBased.sauteing': createLabel('cookingMethod.fatBased.sauteing', 'Sautéing', 'Quick-cooked in a pan'),
  'cookingMethod.fatBased.stirFrying': createLabel('cookingMethod.fatBased.stirFrying', 'Stir-Frying', 'Quick-cooked in a wok'),
  'cookingMethod.slowCooker': createLabel('cookingMethod.slowCooker', 'Slow Cooker', 'Slow cooker recipes'),
  'cookingMethod.instantPot': createLabel('cookingMethod.instantPot', 'Instant Pot', 'Pressure cooker recipes'),
  'cookingMethod.airFryer': createLabel('cookingMethod.airFryer', 'Air Fryer', 'Air fryer recipes'),
  'cookingMethod.noCook': createLabel('cookingMethod.noCook', 'No-Cook', 'No cooking required'),

  // ==================== MAIN INGREDIENT (Selected) ====================
  'mainIngredient.protein.chicken': createLabel('mainIngredient.protein.chicken', 'Chicken', 'Chicken-based recipes'),
  'mainIngredient.protein.beef': createLabel('mainIngredient.protein.beef', 'Beef', 'Beef-based recipes'),
  'mainIngredient.protein.pork': createLabel('mainIngredient.protein.pork', 'Pork', 'Pork-based recipes'),
  'mainIngredient.protein.seafood': createLabel('mainIngredient.protein.seafood', 'Seafood', 'Seafood and shellfish'),
  'mainIngredient.protein.fish': createLabel('mainIngredient.protein.fish', 'Fish', 'Fish recipes'),
  'mainIngredient.protein.tofu': createLabel('mainIngredient.protein.tofu', 'Tofu', 'Tofu-based recipes'),
  'mainIngredient.grain.rice': createLabel('mainIngredient.grain.rice', 'Rice', 'Rice-based dishes'),
  'mainIngredient.grain.pasta': createLabel('mainIngredient.grain.pasta', 'Pasta', 'Pasta dishes'),
  'mainIngredient.legume.beans': createLabel('mainIngredient.legume.beans', 'Beans', 'Bean recipes'),
  'mainIngredient.legume.lentils': createLabel('mainIngredient.legume.lentils', 'Lentils', 'Lentil recipes'),
  'mainIngredient.vegetable': createLabel('mainIngredient.vegetable', 'Vegetables', 'Vegetable-focused recipes'),
  'mainIngredient.vegetable.potatoes': createLabel('mainIngredient.vegetable.potatoes', 'Potatoes', 'Potato dishes'),
  'mainIngredient.dairy.cheese': createLabel('mainIngredient.dairy.cheese', 'Cheese', 'Cheese-based recipes'),
  'mainIngredient.eggs': createLabel('mainIngredient.eggs', 'Eggs', 'Egg dishes'),
  'mainIngredient.fruit': createLabel('mainIngredient.fruit', 'Fruit', 'Fruit-based recipes'),

  // ==================== SEASON ====================
  'season.spring': createLabel('season.spring', 'Spring', 'Spring seasonal recipes'),
  'season.summer': createLabel('season.summer', 'Summer', 'Summer seasonal recipes'),
  'season.fall': createLabel('season.fall', 'Fall', 'Autumn harvest recipes'),
  'season.winter': createLabel('season.winter', 'Winter', 'Winter comfort food'),
  'season.holiday.thanksgiving': createLabel('season.holiday.thanksgiving', 'Thanksgiving', 'Thanksgiving recipes'),
  'season.holiday.christmas': createLabel('season.holiday.christmas', 'Christmas', 'Christmas recipes'),
  'season.holiday.halloween': createLabel('season.holiday.halloween', 'Halloween', 'Halloween treats'),

  // ==================== PLANNING ====================
  'planning.quick': createLabel('planning.quick', 'Quick', 'Fast recipes (under 30 min)'),
  'planning.makeAhead': createLabel('planning.makeAhead', 'Make-Ahead', 'Can be prepared in advance'),
  'planning.freezerFriendly': createLabel('planning.freezerFriendly', 'Freezer-Friendly', 'Can be frozen'),
  'planning.mealPrep': createLabel('planning.mealPrep', 'Meal Prep', 'Great for meal prepping'),
  'planning.leftoverFriendly': createLabel('planning.leftoverFriendly', 'Leftover-Friendly', 'Reheats well'),
  'planning.onePot': createLabel('planning.onePot', 'One-Pot', 'One pot meal'),
  'planning.onePan': createLabel('planning.onePan', 'One-Pan', 'One pan meal'),
  'planning.sheetPan': createLabel('planning.sheetPan', 'Sheet Pan', 'Sheet pan dinner'),
  'planning.overnight': createLabel('planning.overnight', 'Overnight', 'Requires overnight preparation'),

  // ==================== CHARACTERISTICS ====================
  'characteristics.comfortFood': createLabel('characteristics.comfortFood', 'Comfort Food', 'Cozy and comforting'),
  'characteristics.kidFriendly': createLabel('characteristics.kidFriendly', 'Kid-Friendly', 'Kids love it'),
  'characteristics.crowdPleaser': createLabel('characteristics.crowdPleaser', 'Crowd-Pleaser', 'Perfect for groups'),
  'characteristics.budgetFriendly': createLabel('characteristics.budgetFriendly', 'Budget-Friendly', 'Affordable ingredients'),
  'characteristics.healthy': createLabel('characteristics.healthy', 'Healthy', 'Nutritious and wholesome'),
  'characteristics.light': createLabel('characteristics.light', 'Light', 'Light and refreshing'),
  'characteristics.hearty': createLabel('characteristics.hearty', 'Hearty', 'Filling and substantial'),
  'characteristics.spicy': createLabel('characteristics.spicy', 'Spicy', 'Has heat and spice'),
  'characteristics.sweet': createLabel('characteristics.sweet', 'Sweet', 'Sweet flavors'),
  'characteristics.savory': createLabel('characteristics.savory', 'Savory', 'Savory flavors'),
  'characteristics.crispy': createLabel('characteristics.crispy', 'Crispy', 'Crispy texture'),
  'characteristics.creamy': createLabel('characteristics.creamy', 'Creamy', 'Rich and creamy'),
  'characteristics.fresh': createLabel('characteristics.fresh', 'Fresh', 'Fresh ingredients'),
  'characteristics.gourmet': createLabel('characteristics.gourmet', 'Gourmet', 'Restaurant-quality'),
  'characteristics.elegant': createLabel('characteristics.elegant', 'Elegant', 'Refined and sophisticated'),
};

/**
 * Get localized label for a tag
 * Falls back to tag ID if label not found
 */
export function getTagLabel(tagId: TagId, locale: Locale = 'en'): string {
  const tagLabel = TAG_LABELS[tagId];
  if (!tagLabel) {
    // Fallback: use last part of tag ID (e.g., "cuisine.italian" → "Italian")
    const parts = tagId.split('.');
    const lastPart = parts[parts.length - 1];

    // Handle common patterns
    const patterns: [RegExp, string][] = [
      [/free$/i, ' Free'],  // soyfree → soy Free, glutenfree → gluten Free
      [/based$/i, ' Based'],  // plantbased → plant Based
    ];

    let formatted = lastPart;
    for (const [pattern, replacement] of patterns) {
      formatted = formatted.replace(pattern, replacement);
    }

    // Convert camelCase to spaces (e.g., "glutenFree" → "gluten Free")
    formatted = formatted
      .replace(/([A-Z])/g, ' $1')  // Add space before capital letters
      .trim();

    // Capitalize each word
    return formatted
      .split(/[\s-]+/)  // Split on spaces or hyphens
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  return tagLabel.label[locale];
}

/**
 * Get localized description for a tag
 * Returns undefined if no description available
 */
export function getTagDescription(tagId: TagId, locale: Locale = 'en'): string | undefined {
  const tagLabel = TAG_LABELS[tagId];
  return tagLabel?.description?.[locale];
}

/**
 * Check if a tag has a localized label
 */
export function hasTagLabel(tagId: TagId): boolean {
  return tagId in TAG_LABELS;
}

/**
 * Get all available locales
 */
export function getAvailableLocales(): Locale[] {
  return ['en', 'es', 'fr'];
}

/**
 * Get current locale from browser or default
 * This would typically integrate with i18n system
 */
export function getCurrentLocale(): Locale {
  // For now, default to English
  // In production, this would check browser language or user preference
  return 'en';
}
