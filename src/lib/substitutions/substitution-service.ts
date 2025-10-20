/**
 * Ingredient Substitution Service
 *
 * Hybrid substitution lookup system:
 * 1. Check static library (instant, 30+ ingredients)
 * 2. Check in-memory cache (24-hour TTL)
 * 3. Fall back to AI generation (OpenRouter)
 * 4. Mark available based on user inventory
 */

import 'server-only';
import { getOpenRouterClient } from '@/lib/ai/openrouter-server';
import { renderPrompt } from '@/lib/ai/prompts';
import { INGREDIENT_SUBSTITUTION_GENERATOR } from '@/lib/ai/prompts/ingredient-substitution';
import { STATIC_SUBSTITUTION_LIBRARY } from './static-library';
import type {
  SubstitutionResult,
  SubstitutionContext,
  IngredientSubstitution,
  CachedSubstitution,
} from './types';

/**
 * In-memory cache for AI-generated substitutions (24-hour TTL)
 * In production, this could be Redis or database-backed
 */
const substitutionCache = new Map<string, CachedSubstitution>();

/**
 * Cache TTL: 24 hours in milliseconds
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Normalize ingredient name for consistent matching
 *
 * Examples:
 * - "Butter (unsalted)" → "butter"
 * - "Fresh Basil Leaves" → "basil"
 * - "2 cups All-Purpose Flour" → "all purpose flour"
 */
export function normalizeIngredientName(ingredient: string): string {
  return ingredient
    .toLowerCase()
    .trim()
    // Remove amounts and numbers
    .replace(/\b\d+\/\d+|\b\d+\.?\d*\b/g, '')
    // Remove common units
    .replace(
      /\b(cup|cups|tablespoon|tablespoons|tbsp|teaspoon|teaspoons|tsp|ounce|ounces|oz|pound|pounds|lb|lbs|gram|grams|g|kilogram|kilograms|kg|milliliter|milliliters|ml|liter|liters|l|pinch|dash|handful|clove|cloves|can|cans|package|packages|piece|pieces|slice|slices|sprig|sprigs|stalk|stalks)\b/gi,
      ''
    )
    // Remove common descriptors
    .replace(
      /\b(fresh|dried|frozen|canned|organic|chopped|diced|sliced|minced|grated|shredded|crushed|whole|ground|raw|cooked|large|small|medium|extra|fine|finely|roughly|thinly|thickly|boneless|skinless|peeled|unpeeled|ripe|green|unsalted|salted)\b/gi,
      ''
    )
    // Remove special characters and extra spaces
    .replace(/[,()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get substitutions from static library
 *
 * Checks ingredient name and aliases for exact or fuzzy match
 */
function getStaticSubstitutions(ingredient: string): SubstitutionResult | null {
  const normalized = normalizeIngredientName(ingredient);

  // Find matching entry in static library
  const entry = STATIC_SUBSTITUTION_LIBRARY.find((e) => {
    // Check main ingredient name
    if (normalizeIngredientName(e.ingredient) === normalized) {
      return true;
    }

    // Check aliases
    if (e.aliases) {
      return e.aliases.some(
        (alias) => normalizeIngredientName(alias) === normalized
      );
    }

    // Fuzzy match: check if normalized is contained in entry or vice versa
    const entryNormalized = normalizeIngredientName(e.ingredient);
    return (
      normalized.includes(entryNormalized) ||
      entryNormalized.includes(normalized)
    );
  });

  if (!entry) {
    return null;
  }

  // Convert static entry to SubstitutionResult
  return {
    ingredient,
    ingredient_category: entry.category,
    has_substitutions: entry.substitutions.length > 0,
    substitutions: entry.substitutions.map((sub) => ({
      ...sub,
      original_ingredient: ingredient,
      source: 'static' as const,
    })),
    generated_at: new Date().toISOString(),
    source: 'static',
  };
}

/**
 * Get substitutions from in-memory cache
 *
 * Checks if cached result exists and is not expired
 */
function getCachedSubstitutions(ingredient: string): SubstitutionResult | null {
  const normalized = normalizeIngredientName(ingredient);
  const cached = substitutionCache.get(normalized);

  if (!cached) {
    return null;
  }

  // Check if cache is expired
  const now = new Date().getTime();
  const expiresAt = new Date(cached.expires_at).getTime();

  if (now > expiresAt) {
    // Cache expired, remove it
    substitutionCache.delete(normalized);
    return null;
  }

  // Return cached result with updated source
  return {
    ...cached.result,
    source: 'cached',
    substitutions: cached.result.substitutions.map((sub) => ({
      ...sub,
      source: 'cached' as const,
    })),
  };
}

/**
 * Cache a substitution result
 */
function cacheSubstitutionResult(ingredient: string, result: SubstitutionResult): void {
  const normalized = normalizeIngredientName(ingredient);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);

  const cached: CachedSubstitution = {
    key: normalized,
    result,
    cached_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  substitutionCache.set(normalized, cached);
}

/**
 * Generate substitutions using AI (OpenRouter)
 *
 * Falls back to this when static library and cache don't have the ingredient
 */
async function generateAISubstitutions(
  ingredient: string,
  context?: SubstitutionContext
): Promise<SubstitutionResult> {
  try {
    const client = getOpenRouterClient();

    // Prepare prompt variables
    const variables: Record<string, string> = {
      ingredient,
      recipeName: context?.recipeName || 'unknown recipe',
      cookingMethod: context?.cookingMethod || 'general cooking',
      cuisineType: context?.recipeName ? 'based on recipe' : 'any',
    };

    // Render the prompt
    const rendered = renderPrompt(INGREDIENT_SUBSTITUTION_GENERATOR, { variables });

    // Call OpenRouter
    const response = await client.chat.completions.create({
      model: rendered.config.model,
      messages: [
        { role: 'system', content: rendered.system },
        { role: 'user', content: rendered.user },
      ],
      temperature: rendered.config.temperature,
      max_tokens: rendered.config.maxTokens,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse AI response
    const aiResult = JSON.parse(content);

    // Convert to SubstitutionResult format
    const result: SubstitutionResult = {
      ingredient,
      ingredient_category: aiResult.ingredient_category,
      has_substitutions: aiResult.substitutions?.length > 0,
      substitutions: (aiResult.substitutions || []).map((sub: any) => ({
        original_ingredient: ingredient,
        substitute_ingredient: sub.substitute_ingredient,
        substitute_amount: sub.substitute_amount,
        ratio: sub.ratio,
        confidence: sub.confidence,
        confidence_score: sub.confidence_score,
        reason: sub.reason,
        cooking_adjustment: sub.cooking_adjustment,
        best_for: sub.best_for,
        avoid_for: sub.avoid_for,
        flavor_impact: sub.flavor_impact,
        texture_impact: sub.texture_impact,
        source: 'ai' as const,
      })),
      notes: aiResult.notes,
      generated_at: new Date().toISOString(),
      source: 'ai',
    };

    // Cache the AI-generated result
    cacheSubstitutionResult(ingredient, result);

    return result;
  } catch (error) {
    console.error('AI substitution generation failed:', error);

    // Return empty result on error
    return {
      ingredient,
      has_substitutions: false,
      substitutions: [],
      notes: 'Unable to generate substitutions at this time. Please try again later.',
      generated_at: new Date().toISOString(),
      source: 'ai',
    };
  }
}

/**
 * Mark substitutions as user-available based on inventory
 *
 * Fuzzy matches substitute ingredients against user's inventory
 */
function markAsUserAvailable(
  result: SubstitutionResult,
  userInventory?: string[]
): SubstitutionResult {
  if (!userInventory || userInventory.length === 0) {
    return result;
  }

  // Normalize user inventory
  const normalizedInventory = userInventory.map(normalizeIngredientName);

  // Mark each substitution
  const updatedSubstitutions = result.substitutions.map((sub) => {
    const normalizedSub = normalizeIngredientName(sub.substitute_ingredient);

    // Check if user has this ingredient (fuzzy match)
    const isAvailable = normalizedInventory.some(
      (inv) => inv.includes(normalizedSub) || normalizedSub.includes(inv)
    );

    return {
      ...sub,
      is_user_available: isAvailable,
    };
  });

  // Sort substitutions: user-available first, then by confidence
  const sortedSubstitutions = [...updatedSubstitutions].sort((a, b) => {
    // First, prioritize user-available
    if (a.is_user_available && !b.is_user_available) return -1;
    if (!a.is_user_available && b.is_user_available) return 1;

    // Then by confidence score
    return b.confidence_score - a.confidence_score;
  });

  return {
    ...result,
    substitutions: sortedSubstitutions,
  };
}

/**
 * Main substitution lookup function (HYBRID APPROACH)
 *
 * 1. Check static library (instant)
 * 2. Check cache (fast)
 * 3. Generate with AI (slower, fallback)
 * 4. Mark user-available items
 *
 * @param ingredient - Ingredient to find substitutions for
 * @param context - Optional recipe context for better AI suggestions
 * @returns SubstitutionResult with 0-5 substitution options
 */
export async function getSubstitutions(
  ingredient: string,
  context?: SubstitutionContext
): Promise<SubstitutionResult> {
  // Step 1: Check static library
  const staticResult = getStaticSubstitutions(ingredient);
  if (staticResult) {
    return markAsUserAvailable(staticResult, context?.userIngredients);
  }

  // Step 2: Check cache
  const cachedResult = getCachedSubstitutions(ingredient);
  if (cachedResult) {
    return markAsUserAvailable(cachedResult, context?.userIngredients);
  }

  // Step 3: Generate with AI (fallback)
  const aiResult = await generateAISubstitutions(ingredient, context);
  return markAsUserAvailable(aiResult, context?.userIngredients);
}

/**
 * Batch substitution lookup for multiple ingredients
 *
 * Efficiently looks up substitutions for multiple ingredients
 */
export async function getBatchSubstitutions(
  ingredients: string[],
  context?: SubstitutionContext
): Promise<SubstitutionResult[]> {
  const results = await Promise.all(
    ingredients.map((ingredient) => getSubstitutions(ingredient, context))
  );

  return results;
}

/**
 * Clear expired cache entries (maintenance function)
 */
export function clearExpiredCache(): number {
  const now = new Date().getTime();
  let cleared = 0;

  const entries = Array.from(substitutionCache.entries());
  for (const [key, cached] of entries) {
    const expiresAt = new Date(cached.expires_at).getTime();
    if (now > expiresAt) {
      substitutionCache.delete(key);
      cleared++;
    }
  }

  return cleared;
}

/**
 * Get cache statistics (for monitoring)
 */
export function getCacheStats() {
  const now = new Date().getTime();
  let expired = 0;
  let valid = 0;

  const values = Array.from(substitutionCache.values());
  for (const cached of values) {
    const expiresAt = new Date(cached.expires_at).getTime();
    if (now > expiresAt) {
      expired++;
    } else {
      valid++;
    }
  }

  return {
    total: substitutionCache.size,
    valid,
    expired,
    hitRate: valid / (valid + expired || 1),
  };
}
