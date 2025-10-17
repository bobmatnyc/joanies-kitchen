/**
 * JSON Parser Utilities
 *
 * Safe JSON parsing utilities for handling database JSON/text fields.
 * All parsers handle null/undefined gracefully and never throw.
 */

/**
 * Safely parse JSON string to array
 * Returns empty array if parsing fails or value is null/undefined
 */
export function parseJsonArray<T = string>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('[Parser] Failed to parse JSON array:', error);
    return [];
  }
}

/**
 * Safely parse JSON string to object
 * Returns null if parsing fails or value is null/undefined
 */
export function parseJsonObject<T extends object>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch (error) {
    console.warn('[Parser] Failed to parse JSON object:', error);
    return null;
  }
}

/**
 * Safely parse JSON string with custom default value
 */
export function parseJson<T>(value: string | null | undefined, defaultValue: T): T {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn('[Parser] Failed to parse JSON:', error);
    return defaultValue;
  }
}

/**
 * Parse recipe tags (string array)
 */
export function parseRecipeTags(tags: string | null | undefined): string[] {
  return parseJsonArray<string>(tags);
}

/**
 * Parse recipe images (string array)
 */
export function parseRecipeImages(images: string | null | undefined): string[] {
  return parseJsonArray<string>(images);
}

/**
 * Parse recipe ingredients (string array)
 */
export function parseRecipeIngredients(ingredients: string | null | undefined): string[] {
  return parseJsonArray<string>(ingredients);
}

/**
 * Parse recipe instructions (string array)
 */
export function parseRecipeInstructions(instructions: string | null | undefined): string[] {
  return parseJsonArray<string>(instructions);
}

/**
 * Parse nutrition info object
 */
export interface NutritionInfo {
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  servingSize?: string;
}

export function parseNutritionInfo(nutritionInfo: string | null | undefined): NutritionInfo | null {
  return parseJsonObject<NutritionInfo>(nutritionInfo);
}

/**
 * Parse social links object
 */
export interface SocialLinks {
  instagram?: string;
  twitter?: string;
  youtube?: string;
  tiktok?: string;
  facebook?: string;
}

export function parseSocialLinks(socialLinks: object | null | undefined): SocialLinks {
  if (!socialLinks || typeof socialLinks !== 'object') return {};
  return socialLinks as SocialLinks;
}

/**
 * Serialize array to JSON string for database storage
 */
export function serializeArray<T>(array: T[] | null | undefined): string {
  if (!array || !Array.isArray(array)) return '[]';
  try {
    return JSON.stringify(array);
  } catch (error) {
    console.error('[Serializer] Failed to serialize array:', error);
    return '[]';
  }
}

/**
 * Serialize object to JSON string for database storage
 */
export function serializeObject<T extends object>(obj: T | null | undefined): string | null {
  if (!obj || typeof obj !== 'object') return null;
  try {
    return JSON.stringify(obj);
  } catch (error) {
    console.error('[Serializer] Failed to serialize object:', error);
    return null;
  }
}

/**
 * Helper: Get first image from images array or fallback to image_url
 */
export function getRecipeDisplayImage(
  images: string | null | undefined,
  imageUrl: string | null | undefined
): string | null {
  const parsedImages = parseRecipeImages(images);
  return parsedImages[0] || imageUrl || null;
}

/**
 * Helper: Get total time (prep + cook)
 */
export function getRecipeTotalTime(
  prepTime: number | null | undefined,
  cookTime: number | null | undefined
): number {
  return (prepTime || 0) + (cookTime || 0);
}

/**
 * Helper: Check if recipe has multiple images
 */
export function hasMultipleImages(images: string | null | undefined): boolean {
  const parsedImages = parseRecipeImages(images);
  return parsedImages.length > 1;
}

/**
 * Helper: Get image count
 */
export function getImageCount(images: string | null | undefined): number {
  const parsedImages = parseRecipeImages(images);
  return parsedImages.length;
}

/**
 * Helper: Parse decimal field to number
 */
export function parseDecimal(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Helper: Check if recipe is top-rated (4.5+ stars)
 */
export function isTopRatedRecipe(
  systemRating: string | null | undefined,
  avgUserRating: string | null | undefined
): boolean {
  const sysRating = parseDecimal(systemRating);
  const userRating = parseDecimal(avgUserRating);
  return sysRating >= 4.5 || userRating >= 4.5;
}
