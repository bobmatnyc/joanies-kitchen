/**
 * Fuzzy Matching Utilities for Ingredient Deduplication
 *
 * Provides similarity algorithms and duplicate detection for ingredient consolidation.
 * Uses Levenshtein distance and other heuristics.
 *
 * @module lib/ingredients/fuzzy-matching
 */

import type { Ingredient } from '../db/ingredients-schema';

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of edits (insertions, deletions, substitutions) needed
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Edit distance (0 = identical)
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create 2D array for dynamic programming
  const matrix: number[][] = Array.from({ length: len1 + 1 }, () =>
    Array.from({ length: len2 + 1 }, () => 0)
  );

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // Deletion
        matrix[i][j - 1] + 1, // Insertion
        matrix[i - 1][j - 1] + cost // Substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity percentage between two strings
 * 1.0 = identical, 0.0 = completely different
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity score (0.0 to 1.0)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;

  const lower1 = str1.toLowerCase();
  const lower2 = str2.toLowerCase();

  if (lower1 === lower2) return 0.99; // Case difference only

  const maxLen = Math.max(lower1.length, lower2.length);
  if (maxLen === 0) return 1.0;

  const distance = levenshteinDistance(lower1, lower2);
  return 1.0 - distance / maxLen;
}

/**
 * Find similar ingredients using fuzzy matching
 *
 * @param ingredients - Array of ingredients to search
 * @param targetName - Name to find matches for
 * @param threshold - Minimum similarity score (0.0 to 1.0)
 * @returns Array of similar ingredients with similarity scores
 */
export function findSimilarIngredients(
  ingredients: Ingredient[],
  targetName: string,
  threshold: number = 0.85
): Array<{ ingredient: Ingredient; similarity: number }> {
  const results: Array<{ ingredient: Ingredient; similarity: number }> = [];

  for (const ingredient of ingredients) {
    // Skip self
    if (ingredient.name === targetName) continue;

    const similarity = calculateSimilarity(targetName, ingredient.name);

    if (similarity >= threshold) {
      results.push({ ingredient, similarity });
    }
  }

  // Sort by similarity (highest first)
  return results.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Detect if two ingredient names are variants (same ingredient, different formatting)
 *
 * Checks for:
 * - Hyphen vs underscore vs space differences
 * - Apostrophe differences
 * - Word order differences
 * - Very high similarity (>95%)
 *
 * @param name1 - First ingredient name
 * @param name2 - Second ingredient name
 * @returns True if likely variants
 */
export function areVariants(name1: string, name2: string): boolean {
  if (name1 === name2) return false; // Not variants if identical

  // Normalize for comparison
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[-_\s]/g, '') // Remove separators
      .replace(/['']/g, ''); // Remove apostrophes

  const norm1 = normalize(name1);
  const norm2 = normalize(name2);

  // Exact match after normalization = variants
  if (norm1 === norm2) return true;

  // Check if words are same but in different order
  const words1 = name1.toLowerCase().split(/[\s-_]+/).sort();
  const words2 = name2.toLowerCase().split(/[\s-_]+/).sort();

  if (words1.length === words2.length && words1.join('') === words2.join('')) {
    return true;
  }

  // Very high similarity (>95%) = likely variants
  const similarity = calculateSimilarity(norm1, norm2);
  if (similarity > 0.95) return true;

  return false;
}

/**
 * Group ingredients into clusters of variants
 *
 * @param ingredients - Array of ingredients to cluster
 * @param threshold - Similarity threshold for grouping
 * @returns Array of clusters (each cluster is an array of ingredients)
 */
export function clusterVariants(
  ingredients: Ingredient[],
  threshold: number = 0.85
): Ingredient[][] {
  const clusters: Ingredient[][] = [];
  const processed = new Set<string>();

  for (const ingredient of ingredients) {
    if (processed.has(ingredient.id)) continue;

    const cluster: Ingredient[] = [ingredient];
    processed.add(ingredient.id);

    // Find all variants of this ingredient
    for (const other of ingredients) {
      if (processed.has(other.id)) continue;

      if (areVariants(ingredient.name, other.name)) {
        cluster.push(other);
        processed.add(other.id);
      }
    }

    // Only add clusters with more than 1 ingredient
    if (cluster.length > 1) {
      clusters.push(cluster);
    }
  }

  return clusters;
}

/**
 * Select the canonical (best) ingredient from a group of variants
 *
 * Prefers:
 * 1. Higher usage count
 * 2. Has slug defined
 * 3. Shorter name
 * 4. Spaces over hyphens/underscores
 * 5. Alphabetically first
 *
 * @param variants - Array of variant ingredients
 * @returns Canonical ingredient
 */
export function selectCanonicalIngredient(variants: Ingredient[]): Ingredient {
  if (variants.length === 0) {
    throw new Error('Cannot select canonical from empty array');
  }
  if (variants.length === 1) return variants[0];

  // Sort by preference
  const sorted = [...variants].sort((a, b) => {
    // 1. Prefer higher usage count
    if (a.usage_count !== b.usage_count) {
      return b.usage_count - a.usage_count;
    }

    // 2. Prefer has slug
    if (a.slug && !b.slug) return -1;
    if (!a.slug && b.slug) return 1;

    // 3. Prefer shorter name
    if (a.name.length !== b.name.length) {
      return a.name.length - b.name.length;
    }

    // 4. Prefer spaces over special characters
    const hasSpace1 = a.name.includes(' ');
    const hasSpace2 = b.name.includes(' ');
    const hasSpecial1 = a.name.includes('_') || a.name.includes('-');
    const hasSpecial2 = b.name.includes('_') || b.name.includes('-');

    if (hasSpace1 && hasSpecial1 && !hasSpecial2) return 1;
    if (hasSpace2 && hasSpecial2 && !hasSpecial1) return -1;

    // 5. Alphabetically first
    return a.name.localeCompare(b.name);
  });

  return sorted[0];
}

/**
 * Calculate similarity between two ingredients based on multiple factors
 *
 * @param ing1 - First ingredient
 * @param ing2 - Second ingredient
 * @returns Similarity score (0.0 to 1.0)
 */
export function calculateIngredientSimilarity(ing1: Ingredient, ing2: Ingredient): number {
  // Name similarity (80% weight)
  const nameSim = calculateSimilarity(ing1.name, ing2.name) * 0.8;

  // Category similarity (10% weight)
  const categorySim = ing1.category === ing2.category ? 0.1 : 0.0;

  // Display name similarity (10% weight)
  const displaySim = ing1.display_name
    ? calculateSimilarity(ing1.display_name, ing2.display_name || '') * 0.1
    : 0.0;

  return nameSim + categorySim + displaySim;
}

/**
 * Find exact duplicates (same name, different IDs)
 *
 * @param ingredients - Array of ingredients
 * @returns Map of name to array of duplicate ingredients
 */
export function findExactDuplicates(ingredients: Ingredient[]): Map<string, Ingredient[]> {
  const nameMap = new Map<string, Ingredient[]>();

  for (const ingredient of ingredients) {
    const existing = nameMap.get(ingredient.name) || [];
    existing.push(ingredient);
    nameMap.set(ingredient.name, existing);
  }

  // Filter to only duplicates (more than 1 ingredient with same name)
  const duplicates = new Map<string, Ingredient[]>();
  for (const [name, ings] of nameMap.entries()) {
    if (ings.length > 1) {
      duplicates.set(name, ings);
    }
  }

  return duplicates;
}

/**
 * Merge aliases from multiple ingredients
 *
 * @param ingredients - Array of ingredients to merge aliases from
 * @returns Unique array of aliases
 */
export function mergeAliases(ingredients: Ingredient[]): string[] {
  const aliasSet = new Set<string>();

  for (const ingredient of ingredients) {
    if (ingredient.aliases) {
      try {
        const aliases = JSON.parse(ingredient.aliases);
        if (Array.isArray(aliases)) {
          aliases.forEach((alias) => aliasSet.add(alias));
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Add the ingredient's own name as an alias (if not canonical)
    aliasSet.add(ingredient.name);
    if (ingredient.display_name) {
      aliasSet.add(ingredient.display_name);
    }
  }

  return Array.from(aliasSet);
}
