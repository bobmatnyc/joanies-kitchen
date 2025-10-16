/**
 * Recipe Slug Generation Utility
 *
 * Generates SEO-friendly URL slugs from recipe names
 * with duplicate detection and validation.
 */

import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Reserved slugs that cannot be used for recipes
 * These protect system routes from conflicts
 */
export const RESERVED_SLUGS = [
  // Recipe system routes
  'new',
  'edit',
  'delete',
  'create',
  'top-50',
  'discover',
  'search',
  'trending',
  'import',
  'export',

  // Admin routes
  'admin',
  'api',
  'auth',
  'settings',
  'profile',

  // Common system terms
  'help',
  'about',
  'contact',
  'privacy',
  'terms',
  'dashboard',
  'shared',
  'favorites',
  'collections',
];

/**
 * Check if a slug is reserved by the system
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase());
}

/**
 * Generate a slug from a recipe name
 *
 * Rules:
 * - Convert to lowercase
 * - Replace spaces with hyphens
 * - Remove special characters (keep alphanumeric and hyphens)
 * - Remove common filler words for cleaner URLs
 * - Trim multiple hyphens to single hyphen
 * - Limit to 100 characters
 *
 * @param name Recipe name
 * @returns Generated slug
 */
export function generateSlugFromName(name: string): string {
  // Common filler words to remove for cleaner URLs
  const fillerWords = [
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'under', 'again',
    'very', 'really', 'best', 'ultimate', 'perfect', 'amazing', 'delicious',
  ];

  let slug = name
    .toLowerCase()
    // Remove possessives (e.g., "Grandma's" -> "Grandmas")
    .replace(/['']s\b/g, 's')
    .replace(/['']/g, '')
    // Replace ampersand with 'and'
    .replace(/\s*&\s*/g, '-and-')
    // Replace spaces and special chars with hyphens
    .replace(/[^a-z0-9]+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');

  // Split into words and filter out filler words
  const words = slug.split('-').filter(word => {
    return word.length > 0 && !fillerWords.includes(word);
  });

  // Rejoin and limit length
  slug = words.join('-');

  // If filtering removed everything, use original slug
  if (slug.length === 0) {
    slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Limit to 100 characters
  if (slug.length > 100) {
    // Try to cut at a word boundary
    const truncated = slug.substring(0, 100);
    const lastHyphen = truncated.lastIndexOf('-');
    if (lastHyphen > 50) {
      slug = truncated.substring(0, lastHyphen);
    } else {
      slug = truncated;
    }
  }

  return slug;
}

/**
 * Validate slug format
 *
 * Rules:
 * - Must be 1-100 characters
 * - Only lowercase alphanumeric and hyphens
 * - Cannot start or end with hyphen
 * - Cannot be a reserved slug
 *
 * @param slug Slug to validate
 * @returns Validation result with error message if invalid
 */
export function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug || slug.length === 0) {
    return { valid: false, error: 'Slug cannot be empty' };
  }

  if (slug.length > 100) {
    return { valid: false, error: 'Slug must be 100 characters or less' };
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { valid: false, error: 'Slug must contain only lowercase letters, numbers, and hyphens' };
  }

  if (slug.startsWith('-') || slug.endsWith('-')) {
    return { valid: false, error: 'Slug cannot start or end with a hyphen' };
  }

  if (/--+/.test(slug)) {
    return { valid: false, error: 'Slug cannot contain consecutive hyphens' };
  }

  if (isReservedSlug(slug)) {
    return { valid: false, error: `"${slug}" is a reserved system slug` };
  }

  return { valid: true };
}

/**
 * Check if a slug already exists in the database
 *
 * @param slug Slug to check
 * @param excludeId Optional recipe ID to exclude (for updates)
 * @returns True if slug exists, false otherwise
 */
export async function slugExists(slug: string, excludeId?: string): Promise<boolean> {
  try {
    const query = db
      .select({ id: recipes.id })
      .from(recipes)
      .where(eq(recipes.slug, slug))
      .limit(1);

    const result = await query;

    if (result.length === 0) {
      return false;
    }

    // If excluding an ID, check if the found recipe is the excluded one
    if (excludeId && result[0].id === excludeId) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking slug existence:', error);
    // On error, assume it exists to be safe
    return true;
  }
}

/**
 * Generate a unique slug by appending a numeric suffix if needed
 *
 * Algorithm:
 * 1. Generate base slug from name
 * 2. Check if it exists in database
 * 3. If exists, try slug-2, slug-3, etc.
 * 4. Return first available slug
 *
 * @param name Recipe name
 * @param excludeId Optional recipe ID to exclude (for updates)
 * @param maxAttempts Maximum number of attempts (default 100)
 * @returns Unique slug
 */
export async function generateUniqueSlug(
  name: string,
  excludeId?: string,
  maxAttempts: number = 100
): Promise<string> {
  const baseSlug = generateSlugFromName(name);

  // Validate base slug format
  const validation = validateSlug(baseSlug);
  if (!validation.valid) {
    throw new Error(`Invalid slug format: ${validation.error}`);
  }

  // Check if base slug is available
  const exists = await slugExists(baseSlug, excludeId);
  if (!exists) {
    return baseSlug;
  }

  // Try with numeric suffixes
  for (let i = 2; i <= maxAttempts; i++) {
    const candidateSlug = `${baseSlug}-${i}`;

    // Validate candidate slug
    const candidateValidation = validateSlug(candidateSlug);
    if (!candidateValidation.valid) {
      continue;
    }

    const candidateExists = await slugExists(candidateSlug, excludeId);
    if (!candidateExists) {
      return candidateSlug;
    }
  }

  // If we exhausted attempts, append timestamp
  const timestamp = Date.now().toString(36);
  const fallbackSlug = `${baseSlug}-${timestamp}`;

  return fallbackSlug;
}

/**
 * Update a recipe's slug
 *
 * @param recipeId Recipe ID
 * @param newSlug New slug value
 * @returns True if successful, false otherwise
 */
export async function updateRecipeSlug(recipeId: string, newSlug: string): Promise<boolean> {
  try {
    // Validate slug
    const validation = validateSlug(newSlug);
    if (!validation.valid) {
      throw new Error(`Invalid slug: ${validation.error}`);
    }

    // Check if slug is already in use by another recipe
    const exists = await slugExists(newSlug, recipeId);
    if (exists) {
      throw new Error(`Slug "${newSlug}" is already in use`);
    }

    // Update recipe
    await db
      .update(recipes)
      .set({
        slug: newSlug,
        updated_at: new Date(),
      })
      .where(eq(recipes.id, recipeId));

    return true;
  } catch (error) {
    console.error('Error updating recipe slug:', error);
    return false;
  }
}

/**
 * Batch check if multiple slugs exist
 * Useful for bulk operations
 *
 * @param slugs Array of slugs to check
 * @returns Map of slug -> exists boolean
 */
export async function batchCheckSlugs(slugs: string[]): Promise<Map<string, boolean>> {
  try {
    const result = await db
      .select({ slug: recipes.slug })
      .from(recipes)
      .where(sql`${recipes.slug} = ANY(${slugs})`);

    const existingSet = new Set(result.map(r => r.slug));
    const resultMap = new Map<string, boolean>();

    for (const slug of slugs) {
      resultMap.set(slug, existingSet.has(slug));
    }

    return resultMap;
  } catch (error) {
    console.error('Error batch checking slugs:', error);
    // On error, assume all exist to be safe
    const resultMap = new Map<string, boolean>();
    for (const slug of slugs) {
      resultMap.set(slug, true);
    }
    return resultMap;
  }
}

/**
 * Get all existing slugs from the database
 * Useful for bulk operations and validation
 *
 * @returns Array of all slugs
 */
export async function getAllSlugs(): Promise<string[]> {
  try {
    const result = await db
      .select({ slug: recipes.slug })
      .from(recipes)
      .where(sql`${recipes.slug} IS NOT NULL`);

    return result.map(r => r.slug).filter((s): s is string => s !== null);
  } catch (error) {
    console.error('Error getting all slugs:', error);
    return [];
  }
}
