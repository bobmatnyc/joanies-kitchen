/**
 * Ingredient Consolidation Map
 *
 * Defines canonical mappings for ingredient variants to ensure consistency.
 * When users search for or add ingredients using variant names, they are
 * automatically consolidated to the canonical form.
 *
 * Structure:
 * - Key: Variant name (lowercase, normalized)
 * - Value: Canonical ingredient name (lowercase, normalized)
 *
 * @module lib/ingredients/consolidation-map
 */

/**
 * Consolidation mapping for ingredient variants
 *
 * Rules for adding mappings:
 * 1. Map common variants to the most specific canonical form
 * 2. Use lowercase for all keys and values
 * 3. The canonical form should match the 'name' field in the ingredients table
 * 4. Document the rationale for non-obvious mappings
 *
 * @example
 * // "basil" searches will return "basil leaves" results
 * consolidationMap.get('basil') // => 'basil leaves'
 */
export const INGREDIENT_CONSOLIDATION_MAP = new Map<string, string>([
  // ============================================================================
  // HERBS: Standalone herb names should consolidate to "leaves" form
  // ============================================================================

  /**
   * Basil consolidation
   * Rationale: When users search "basil", they almost always mean "basil leaves"
   * (the edible part). "Basil" standalone is ambiguous and less specific.
   * Database stats: "basil leaves" (30 uses), "basil" (232 uses), "basil leaf" (2 uses)
   * Action: Consolidate all to "basil leaves" as canonical form
   */
  ['basil', 'basil leaves'],
  ['basil leaf', 'basil leaves'],

  // Add more herb consolidations as needed:
  // ['cilantro', 'cilantro leaves'],
  // ['parsley', 'parsley leaves'],
  // ['mint', 'mint leaves'],

  // ============================================================================
  // VEGETABLES: Common variants (add as needed)
  // ============================================================================

  // Example: ['green onion', 'scallions'],

  // ============================================================================
  // PROTEINS: Common variants (add as needed)
  // ============================================================================

  // Example: ['ground beef', 'beef ground'],
]);

/**
 * Apply ingredient consolidation mapping
 *
 * @param ingredientName - Ingredient name to consolidate (case-insensitive)
 * @returns Canonical ingredient name if mapping exists, otherwise original name
 *
 * @example
 * applyConsolidation('Basil') // => 'basil leaves'
 * applyConsolidation('BASIL LEAF') // => 'basil leaves'
 * applyConsolidation('tomato') // => 'tomato' (no mapping exists)
 */
export function applyConsolidation(ingredientName: string): string {
  const normalized = ingredientName.toLowerCase().trim();
  const canonical = INGREDIENT_CONSOLIDATION_MAP.get(normalized);

  return canonical || normalized;
}

/**
 * Check if an ingredient name has a consolidation mapping
 *
 * @param ingredientName - Ingredient name to check
 * @returns True if a consolidation mapping exists
 */
export function hasConsolidationMapping(ingredientName: string): boolean {
  const normalized = ingredientName.toLowerCase().trim();
  return INGREDIENT_CONSOLIDATION_MAP.has(normalized);
}

/**
 * Get all variants that map to a specific canonical ingredient
 *
 * @param canonicalName - Canonical ingredient name
 * @returns Array of variant names that consolidate to this canonical name
 *
 * @example
 * getVariantsForCanonical('basil leaves') // => ['basil', 'basil leaf']
 */
export function getVariantsForCanonical(canonicalName: string): string[] {
  const normalized = canonicalName.toLowerCase().trim();
  const variants: string[] = [];

  for (const [variant, canonical] of INGREDIENT_CONSOLIDATION_MAP.entries()) {
    if (canonical === normalized) {
      variants.push(variant);
    }
  }

  return variants;
}

/**
 * Get consolidation statistics
 *
 * @returns Object with consolidation map statistics
 */
export function getConsolidationStats() {
  const totalMappings = INGREDIENT_CONSOLIDATION_MAP.size;
  const canonicalIngredients = new Set(INGREDIENT_CONSOLIDATION_MAP.values());

  return {
    totalMappings,
    uniqueCanonicalIngredients: canonicalIngredients.size,
    averageVariantsPerCanonical: totalMappings / canonicalIngredients.size,
  };
}
