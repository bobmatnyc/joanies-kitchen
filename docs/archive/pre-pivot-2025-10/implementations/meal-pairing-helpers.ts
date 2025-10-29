/**
 * Meal Pairing Helper Functions
 *
 * Utility functions for working with meal pairing metadata
 * Based on the pairing logic from src/lib/ai/meal-pairing-system.ts
 *
 * @version 0.65.0
 */

import type { Recipe } from '@/lib/db/schema';

// ============================================================================
// Type Definitions
// ============================================================================

export type PairingScore = 1 | 2 | 3 | 4 | 5;
export type SweetnessLevel = 'light' | 'moderate' | 'rich';
export type ServingTemperature = 'hot' | 'cold' | 'room';

export const VALID_TEXTURES = [
  'crispy',
  'creamy',
  'crunchy',
  'soft',
  'flaky',
  'smooth',
  'tender',
  'chewy',
  'silky',
  'velvety',
  'airy',
  'dense',
] as const;

export const VALID_FLAVORS = [
  'umami',
  'sweet',
  'salty',
  'bitter',
  'sour',
  'spicy',
  'savory',
  'tangy',
  'earthy',
  'smoky',
  'herbal',
  'citrus',
] as const;

export type Texture = (typeof VALID_TEXTURES)[number];
export type Flavor = (typeof VALID_FLAVORS)[number];

export interface PairingMetadata {
  weight_score: PairingScore;
  richness_score: PairingScore;
  acidity_score: PairingScore;
  sweetness_level?: SweetnessLevel;
  dominant_textures: Texture[];
  dominant_flavors: Flavor[];
  serving_temperature: ServingTemperature;
  pairing_rationale: string;
}

// ============================================================================
// Parsing Helpers (JSON to Arrays)
// ============================================================================

/**
 * Safely parse dominant_textures from JSON string to array
 */
export function parseTextures(recipe: Recipe): Texture[] {
  if (!recipe.dominant_textures) return [];
  try {
    const parsed = JSON.parse(recipe.dominant_textures);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Safely parse dominant_flavors from JSON string to array
 */
export function parseFlavors(recipe: Recipe): Flavor[] {
  if (!recipe.dominant_flavors) return [];
  try {
    const parsed = JSON.parse(recipe.dominant_flavors);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Serialize textures array to JSON string for database storage
 */
export function serializeTextures(textures: Texture[]): string {
  return JSON.stringify(textures);
}

/**
 * Serialize flavors array to JSON string for database storage
 */
export function serializeFlavors(flavors: Flavor[]): string {
  return JSON.stringify(flavors);
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if recipe has complete pairing metadata
 */
export function hasCompletePairingMetadata(recipe: Recipe): boolean {
  return !!(
    recipe.weight_score &&
    recipe.richness_score &&
    recipe.acidity_score &&
    recipe.dominant_textures &&
    recipe.serving_temperature
  );
}

/**
 * Validate score is in 1-5 range
 */
export function isValidScore(score: number | null | undefined): score is PairingScore {
  return typeof score === 'number' && score >= 1 && score <= 5;
}

/**
 * Validate texture is in allowed list
 */
export function isValidTexture(texture: string): texture is Texture {
  return VALID_TEXTURES.includes(texture as Texture);
}

/**
 * Validate flavor is in allowed list
 */
export function isValidFlavor(flavor: string): flavor is Flavor {
  return VALID_FLAVORS.includes(flavor as Flavor);
}

// ============================================================================
// Pairing Logic Helpers
// ============================================================================

/**
 * Check if a side dish balances a main dish based on weight
 * Heavy mains (4-5) → Light sides (1-2)
 * Medium mains (3) → Light-medium sides (2-3)
 * Light mains (1-2) → Light sides (1-3)
 */
export function isWeightBalanced(main: Recipe, side: Recipe): boolean {
  if (!isValidScore(main.weight_score) || !isValidScore(side.weight_score)) {
    return false;
  }

  if (main.weight_score >= 4) {
    // Heavy main needs light side
    return side.weight_score <= 2;
  } else if (main.weight_score === 3) {
    // Medium main needs light-medium side
    return side.weight_score >= 2 && side.weight_score <= 3;
  } else {
    // Light main needs light side
    return side.weight_score <= 3;
  }
}

/**
 * Check if a side provides adequate acidity for a rich main
 * Rule: side_acidity >= main_richness - 1
 */
export function hasAcidFatBalance(main: Recipe, side: Recipe): boolean {
  if (!isValidScore(main.richness_score) || !isValidScore(side.acidity_score)) {
    return false;
  }

  return side.acidity_score >= main.richness_score - 1;
}

/**
 * Count unique textures across multiple recipes
 */
export function countUniqueTextures(recipes: Recipe[]): number {
  const allTextures = new Set<Texture>();

  recipes.forEach((recipe) => {
    const textures = parseTextures(recipe);
    textures.forEach((t) => allTextures.add(t));
  });

  return allTextures.size;
}

/**
 * Check if consecutive courses have identical textures (anti-pattern)
 */
export function hasTextureConflict(recipe1: Recipe, recipe2: Recipe): boolean {
  const textures1 = parseTextures(recipe1);
  const textures2 = parseTextures(recipe2);

  // Check for complete overlap (bad)
  return textures1.some((t) => textures2.includes(t)) && textures1.length === textures2.length;
}

/**
 * Generate temperature progression from courses
 * Ideal: Hot → Cold → Hot → Cold
 */
export function getTemperatureProgression(courses: Recipe[]): ServingTemperature[] {
  return courses.map((c) => c.serving_temperature).filter((t): t is ServingTemperature => !!t);
}

/**
 * Check if temperature progression is varied (not all same temp)
 */
export function hasTemperatureVariety(courses: Recipe[]): boolean {
  const temps = getTemperatureProgression(courses);
  const uniqueTemps = new Set(temps);
  return uniqueTemps.size >= 2;
}

// ============================================================================
// Compatibility Scoring
// ============================================================================

export interface CompatibilityScore {
  score: number; // 0-100
  weightBalance: boolean;
  acidFatBalance: boolean;
  textureVariety: boolean;
  temperatureVariety: boolean;
  issues: string[];
}

/**
 * Calculate overall compatibility score for a multi-course meal
 */
export function calculateMealCompatibility(
  appetizer: Recipe,
  main: Recipe,
  side: Recipe,
  dessert: Recipe
): CompatibilityScore {
  const courses = [appetizer, main, side, dessert];
  const issues: string[] = [];
  let score = 100;

  // Check weight balance (20 points)
  const weightBalanced = isWeightBalanced(main, side);
  if (!weightBalanced) {
    issues.push('Side dish weight does not balance main dish');
    score -= 20;
  }

  // Check acid-fat balance (20 points)
  const acidFatBalanced = hasAcidFatBalance(main, side);
  if (!acidFatBalanced) {
    issues.push('Insufficient acidity to balance rich main dish');
    score -= 20;
  }

  // Check texture variety (30 points)
  const textureCount = countUniqueTextures(courses);
  const textureVariety = textureCount >= 6;
  if (!textureVariety) {
    issues.push(`Only ${textureCount} unique textures (minimum 6 recommended)`);
    score -= 30;
  }

  // Check temperature variety (20 points)
  const tempVariety = hasTemperatureVariety(courses);
  if (!tempVariety) {
    issues.push('All courses at same temperature - lacks variety');
    score -= 20;
  }

  // Check texture conflicts (10 points)
  const hasConflicts =
    hasTextureConflict(appetizer, main) ||
    hasTextureConflict(main, side) ||
    hasTextureConflict(side, dessert);

  if (hasConflicts) {
    issues.push('Consecutive courses have identical textures');
    score -= 10;
  }

  return {
    score: Math.max(0, score),
    weightBalance: weightBalanced,
    acidFatBalance: acidFatBalanced,
    textureVariety,
    temperatureVariety: tempVariety,
    issues,
  };
}

// ============================================================================
// Query Builders (for use with Drizzle)
// ============================================================================

/**
 * Build WHERE conditions for finding compatible side dishes
 */
export function buildSideQueryConditions(main: Recipe) {
  const conditions: Record<string, any> = {};

  if (isValidScore(main.weight_score)) {
    // Determine target weight range
    if (main.weight_score >= 4) {
      conditions.weight_score_max = 2;
    } else if (main.weight_score === 3) {
      conditions.weight_score_min = 2;
      conditions.weight_score_max = 3;
    } else {
      conditions.weight_score_max = 3;
    }
  }

  if (isValidScore(main.richness_score)) {
    // Need acidity >= richness - 1
    conditions.acidity_score_min = Math.max(1, main.richness_score - 1);
  }

  return conditions;
}

/**
 * Build WHERE conditions for finding appetizers
 * Appetizers should be light (1-2), stimulating
 */
export function buildAppetizerQueryConditions() {
  return {
    weight_score_max: 2,
    serving_temperature: ['hot', 'cold'], // Not room temp
  };
}

/**
 * Build WHERE conditions for finding desserts
 * Should provide sweet closure without overwhelming
 */
export function buildDessertQueryConditions(mainCourses: Recipe[]) {
  const avgRichness =
    mainCourses
      .map((r) => r.richness_score)
      .filter(isValidScore)
      .reduce((sum, val) => sum + val, 0) / mainCourses.length;

  // If main courses were rich, prefer lighter dessert
  const targetSweetness = avgRichness >= 4 ? 'light' : 'moderate';

  return {
    sweetness_level: [targetSweetness],
    serving_temperature: ['cold', 'room'], // Typically not hot
  };
}

// ============================================================================
// Display Helpers
// ============================================================================

/**
 * Format pairing score for display
 */
export function formatScore(score: number | null | undefined): string {
  if (!isValidScore(score)) return 'Not rated';
  const labels = ['', 'Very Light', 'Light', 'Medium', 'Rich', 'Very Rich'];
  return labels[score] || 'Unknown';
}

/**
 * Get emoji for serving temperature
 */
export function getTemperatureEmoji(temp: ServingTemperature | null | undefined): string {
  if (!temp) return '🌡️';
  const emojis: Record<ServingTemperature, string> = {
    hot: '🔥',
    cold: '❄️',
    room: '🌡️',
  };
  return emojis[temp];
}

/**
 * Format texture list for display
 */
export function formatTextures(textures: Texture[]): string {
  if (textures.length === 0) return 'No textures defined';
  return textures.join(', ');
}

/**
 * Format flavor list for display
 */
export function formatFlavors(flavors: Flavor[]): string {
  if (flavors.length === 0) return 'No flavors defined';
  return flavors.join(', ');
}

// ============================================================================
// Example Usage
// ============================================================================

/*
// Example: Check if recipes are compatible
const mainDish: Recipe = {
  // ... other fields
  weight_score: 4,
  richness_score: 5,
  acidity_score: 2,
  serving_temperature: 'hot',
  dominant_textures: '["tender", "creamy"]'
};

const sideDish: Recipe = {
  // ... other fields
  weight_score: 2,
  richness_score: 1,
  acidity_score: 4,
  serving_temperature: 'cold',
  dominant_textures: '["crispy", "crunchy"]'
};

const weightOk = isWeightBalanced(mainDish, sideDish); // true (heavy main, light side)
const acidOk = hasAcidFatBalance(mainDish, sideDish); // true (acidity 4 >= richness 5 - 1)

console.log('Compatible pairing:', weightOk && acidOk);

// Example: Calculate full meal compatibility
const compatibility = calculateMealCompatibility(
  appetizerRecipe,
  mainRecipe,
  sideRecipe,
  dessertRecipe
);

console.log(`Compatibility Score: ${compatibility.score}/100`);
if (compatibility.issues.length > 0) {
  console.log('Issues:', compatibility.issues);
}
*/
