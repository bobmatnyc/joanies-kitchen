/**
 * Ingredient Substitution System - Type Definitions
 *
 * Comprehensive type system for ingredient substitution recommendations
 * Supports hybrid approach: static library + AI fallback + caching
 */

/**
 * Confidence level for substitution recommendation
 */
export type SubstitutionConfidence = 'high' | 'medium' | 'low';

/**
 * Impact level on recipe characteristics
 */
export type ImpactLevel = 'none' | 'minimal' | 'noticeable' | 'significant';

/**
 * Source of substitution data
 */
export type SubstitutionSource = 'static' | 'ai' | 'cached';

/**
 * Individual ingredient substitution recommendation
 */
export interface IngredientSubstitution {
  /** Original ingredient being substituted */
  original_ingredient: string;

  /** Recommended substitute ingredient */
  substitute_ingredient: string;

  /** Amount of substitute to use (if different from original) */
  substitute_amount?: string;

  /** Conversion ratio (e.g., "1:1", "2:3", "1 cup = 3/4 cup") */
  ratio?: string;

  /** Confidence level in this substitution */
  confidence: SubstitutionConfidence;

  /** Numeric confidence score (0.0-1.0) */
  confidence_score: number;

  /** Explanation of why this substitution works */
  reason: string;

  /** Any cooking method adjustments needed */
  cooking_adjustment?: string;

  /** Recipe types this substitution works best in */
  best_for?: string[];

  /** Recipe types to avoid this substitution in */
  avoid_for?: string[];

  /** Impact on flavor profile */
  flavor_impact?: ImpactLevel;

  /** Impact on texture */
  texture_impact?: ImpactLevel;

  /** Whether user has this substitute in their inventory */
  is_user_available?: boolean;

  /** Source of this substitution data */
  source: SubstitutionSource;
}

/**
 * Complete substitution result for a single ingredient
 */
export interface SubstitutionResult {
  /** Original ingredient requested */
  ingredient: string;

  /** Category of ingredient (e.g., "dairy", "fat", "protein") */
  ingredient_category?: string;

  /** Whether any substitutions are available */
  has_substitutions: boolean;

  /** Array of substitution options */
  substitutions: IngredientSubstitution[];

  /** Additional notes or warnings */
  notes?: string;

  /** Timestamp when this result was generated */
  generated_at: string;

  /** Primary source of substitution data */
  source: SubstitutionSource;
}

/**
 * Context for substitution lookup
 */
export interface SubstitutionContext {
  /** Name of recipe the ingredient is used in */
  recipeName?: string;

  /** Cooking method (baking, frying, sautéing, etc.) */
  cookingMethod?: string;

  /** User's available ingredients for availability marking */
  userIngredients?: string[];

  /** Dietary restrictions to consider */
  dietaryRestrictions?: string[];
}

/**
 * Static library entry format
 */
export interface StaticSubstitutionEntry {
  /** Ingredient name (normalized) */
  ingredient: string;

  /** Alternate names for this ingredient */
  aliases?: string[];

  /** Category this ingredient belongs to */
  category: string;

  /** Array of substitution options */
  substitutions: Omit<
    IngredientSubstitution,
    'original_ingredient' | 'source' | 'is_user_available'
  >[];
}

/**
 * Cached substitution entry (database or in-memory)
 */
export interface CachedSubstitution {
  /** Cache key (normalized ingredient name) */
  key: string;

  /** Full substitution result */
  result: SubstitutionResult;

  /** When this was cached */
  cached_at: string;

  /** When this cache expires (24 hours TTL) */
  expires_at: string;
}
