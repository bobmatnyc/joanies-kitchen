/**
 * Meal Pairing Engine
 *
 * Production-ready meal pairing system that integrates:
 * - OpenRouter AI (Recipe Manager's AI provider)
 * - pgvector semantic search (production-ready)
 * - Pairing metadata schema (weight, richness, acidity, textures, etc.)
 *
 * @version 1.0.0
 */

import 'server-only';
import { getOpenRouterClient } from './openrouter-server';
import { semanticSearchRecipes, type RecipeWithSimilarity } from '@/app/actions/semantic-search';
import { renderPrompt } from './prompts';
import {
  generateMealByCuisine,
  generateMealFromMainDish,
  generateMealByTheme,
  generateFreestyleMeal,
} from './prompts/meal-pairing';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Meal pairing input modes
 */
export type MealPairingMode = 'cuisine' | 'theme' | 'main-first' | 'freestyle';

/**
 * Input for meal pairing generation
 */
export interface MealPairingInput {
  mode: MealPairingMode;
  cuisine?: string;
  theme?: string;
  mainDish?: string;
  dietaryRestrictions?: string[];
  availableIngredients?: string[];
  timeLimit?: number; // minutes
  servings?: number;
}

/**
 * Individual course in a meal plan
 */
export interface MealPlanCourse {
  name: string;
  description: string;
  weight_score?: number;
  richness_score?: number;
  acidity_score?: number;
  sweetness_level?: 'light' | 'moderate' | 'rich';
  dominant_textures: string[];
  dominant_flavors?: string[];
  temperature: 'hot' | 'cold' | 'room';
  prep_time_minutes: number;
  key_ingredients: string[];
  pairing_rationale: string;
  cuisine_influence?: string;
  recipe_id?: string; // Link to existing recipe in database
}

/**
 * Complete meal plan with analysis
 */
export interface MealPlan {
  appetizer: MealPlanCourse;
  main: MealPlanCourse;
  side: MealPlanCourse;
  dessert: MealPlanCourse;
  meal_analysis: {
    total_prep_time: number;
    texture_variety_count: number;
    color_palette: string[];
    temperature_progression: string[];
    cultural_coherence: string;
    estimated_macros: {
      carbs_percent: number;
      protein_percent: number;
      fat_percent: number;
    };
    chef_notes: string;
  };
}

/**
 * Simplified meal request interface
 */
export interface SimpleMealRequest {
  cuisine?: string;
  theme?: string;
  mainDish?: string;
  dietary?: string[];
  ingredients?: string[];
  maxTime?: number;
  servings?: number;
}

/**
 * Result from meal generation
 */
export interface MealGenerationResult {
  success: boolean;
  mealPlan?: MealPlan;
  error?: string;
}

// ============================================================================
// Semantic Search Integration
// ============================================================================

/**
 * Search for recipes using semantic search with course-specific context
 */
async function searchRecipesByCourse(
  query: string,
  course: 'appetizer' | 'main' | 'side' | 'dessert',
  options: {
    dietary?: string[];
    limit?: number;
  } = {}
): Promise<RecipeWithSimilarity[]> {
  try {
    // Build course-specific search query
    let enhancedQuery = query;

    switch (course) {
      case 'appetizer':
        enhancedQuery = `${query} light appetizer starter`;
        break;
      case 'main':
        enhancedQuery = `${query} main dish entree`;
        break;
      case 'side':
        enhancedQuery = `${query} side dish accompaniment`;
        break;
      case 'dessert':
        enhancedQuery = `${query} dessert sweet`;
        break;
    }

    // Use Recipe Manager's semantic search
    const result = await semanticSearchRecipes(enhancedQuery, {
      limit: options.limit || 5,
      minSimilarity: 0.5,
      includePrivate: false, // Only search public/system recipes
    });

    if (!result.success) {
      console.warn(`Semantic search failed for ${course}:`, result.error);
      return [];
    }

    return result.recipes;
  } catch (error) {
    console.error(`Error searching recipes for ${course}:`, error);
    return [];
  }
}

/**
 * Build database context from semantic search results
 */
function buildDatabaseContext(
  appetizerCandidates: RecipeWithSimilarity[],
  mainCandidates: RecipeWithSimilarity[],
  sideCandidates: RecipeWithSimilarity[],
  dessertCandidates: RecipeWithSimilarity[]
): string {
  let context = '\n\nDATABASE CONTEXT (prioritize these existing recipes when appropriate):\n';

  if (mainCandidates.length > 0) {
    context += '\nRELATED MAIN DISHES IN DATABASE:\n';
    context += mainCandidates
      .slice(0, 3)
      .map(
        (r) =>
          `- ${r.name} (similarity: ${r.similarity.toFixed(2)}): ${r.description || 'No description'}`
      )
      .join('\n');
  }

  if (appetizerCandidates.length > 0) {
    context += '\n\nAVAILABLE APPETIZERS IN DATABASE:\n';
    context += appetizerCandidates
      .slice(0, 3)
      .map((r) => `- ${r.name}: ${r.description || 'No description'}`)
      .join('\n');
  }

  if (sideCandidates.length > 0) {
    context += '\n\nAVAILABLE SIDES IN DATABASE:\n';
    context += sideCandidates
      .slice(0, 3)
      .map((r) => `- ${r.name}: ${r.description || 'No description'}`)
      .join('\n');
  }

  if (dessertCandidates.length > 0) {
    context += '\n\nAVAILABLE DESSERTS IN DATABASE:\n';
    context += dessertCandidates
      .slice(0, 3)
      .map((r) => `- ${r.name}: ${r.description || 'No description'}`)
      .join('\n');
  }

  context +=
    '\n\nYou may suggest existing recipes from the database OR create new pairings if database options don\'t meet pairing principles.';

  return context;
}

/**
 * Enrich meal plan with links to actual recipes in database
 * Uses semantic similarity matching instead of simple name matching
 */
function enrichWithRecipeLinks(
  mealPlan: MealPlan,
  candidates: {
    appetizerCandidates: RecipeWithSimilarity[];
    sideCandidates: RecipeWithSimilarity[];
    dessertCandidates: RecipeWithSimilarity[];
  }
): MealPlan {
  // Find best match based on semantic similarity and name matching
  const findMatch = (courseName: string, candidates: RecipeWithSimilarity[]): string | undefined => {
    if (candidates.length === 0) return undefined;

    // Try exact name match first
    const exactMatch = candidates.find(
      (c) =>
        c.name.toLowerCase().trim() === courseName.toLowerCase().trim()
    );
    if (exactMatch) return exactMatch.id;

    // Try partial name match with high similarity
    const partialMatch = candidates.find(
      (c) =>
        c.similarity >= 0.7 &&
        (c.name.toLowerCase().includes(courseName.toLowerCase()) ||
          courseName.toLowerCase().includes(c.name.toLowerCase()))
    );
    if (partialMatch) return partialMatch.id;

    // Return highest similarity match if above threshold
    const topMatch = candidates[0]; // Already sorted by similarity
    if (topMatch && topMatch.similarity >= 0.6) {
      return topMatch.id;
    }

    return undefined;
  };

  return {
    ...mealPlan,
    appetizer: {
      ...mealPlan.appetizer,
      recipe_id: findMatch(mealPlan.appetizer.name, candidates.appetizerCandidates),
    },
    side: {
      ...mealPlan.side,
      recipe_id: findMatch(mealPlan.side.name, candidates.sideCandidates),
    },
    dessert: {
      ...mealPlan.dessert,
      recipe_id: findMatch(mealPlan.dessert.name, candidates.dessertCandidates),
    },
  };
}

// ============================================================================
// AI Generation with OpenRouter
// ============================================================================

/**
 * Generate meal plan using OpenRouter AI with semantic search integration
 */
async function generateMealWithSemanticSearch(
  input: MealPairingInput
): Promise<MealGenerationResult> {
  try {
    // Step 1: Determine which prompt to use based on mode
    let promptTemplate;
    let variables: Record<string, string> = {};

    const servings = (input.servings || 4).toString();
    const timeLimit = (input.timeLimit || 120).toString();
    const dietaryRestrictions = (input.dietaryRestrictions || []).join(', ') || 'None';

    switch (input.mode) {
      case 'cuisine':
        if (!input.cuisine) {
          return { success: false, error: 'Cuisine is required for cuisine mode' };
        }
        promptTemplate = generateMealByCuisine;
        variables = {
          cuisine: input.cuisine,
          dietaryRestrictions,
          timeLimit,
          servings,
        };
        break;

      case 'theme':
        if (!input.theme) {
          return { success: false, error: 'Theme is required for theme mode' };
        }
        promptTemplate = generateMealByTheme;
        variables = {
          theme: input.theme,
          dietaryRestrictions,
          timeLimit,
          servings,
        };
        break;

      case 'main-first':
        if (!input.mainDish) {
          return { success: false, error: 'Main dish is required for main-first mode' };
        }
        promptTemplate = generateMealFromMainDish;
        variables = {
          mainDish: input.mainDish,
          dietaryRestrictions,
          timeLimit,
          servings,
          availableIngredients: (input.availableIngredients || []).join(', ') || 'None',
        };
        break;

      case 'freestyle':
        promptTemplate = generateFreestyleMeal;
        variables = {
          dietaryRestrictions,
          timeLimit,
          servings,
          availableIngredients: (input.availableIngredients || []).join(', ') || 'None',
        };
        break;

      default:
        return { success: false, error: `Unknown mode: ${input.mode}` };
    }

    // Step 2: Perform semantic searches for each course
    const cuisine = input.cuisine || '';
    const dietary = input.dietaryRestrictions || [];

    const [appetizerCandidates, mainCandidates, sideCandidates, dessertCandidates] =
      await Promise.all([
        searchRecipesByCourse(`light appetizer ${cuisine} acidic fresh`, 'appetizer', {
          dietary,
          limit: 5,
        }),
        input.mainDish
          ? searchRecipesByCourse(input.mainDish, 'main', { dietary, limit: 5 })
          : Promise.resolve([]),
        searchRecipesByCourse(`light side dish ${cuisine} vegetables crisp`, 'side', {
          dietary,
          limit: 5,
        }),
        searchRecipesByCourse(`dessert ${cuisine} sweet`, 'dessert', { dietary, limit: 5 }),
      ]);

    // Step 3: Build database context
    const databaseContext = buildDatabaseContext(
      appetizerCandidates,
      mainCandidates,
      sideCandidates,
      dessertCandidates
    );

    // Add database context to variables
    variables.databaseContext = databaseContext;

    // Step 4: Render prompt with variables
    const renderedPrompt = renderPrompt(promptTemplate, { variables });

    // Step 5: Call OpenRouter using Recipe Manager's client
    const client = getOpenRouterClient();

    const response = await client.chat.completions.create({
      model: renderedPrompt.config.model,
      messages: [
        { role: 'system', content: renderedPrompt.system },
        { role: 'user', content: renderedPrompt.user },
      ],
      temperature: renderedPrompt.config.temperature,
      max_tokens: renderedPrompt.config.maxTokens,
      response_format: { type: 'json_object' },
    });

    const responseText = response.choices[0]?.message?.content;

    if (!responseText) {
      return { success: false, error: 'No response from AI' };
    }

    // Step 6: Parse JSON response
    // Handle potential markdown wrapping (some models still do this)
    const cleanedJson = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const mealPlan: MealPlan = JSON.parse(cleanedJson);

    // Step 7: Enrich with recipe IDs from semantic matches
    const enrichedMealPlan = enrichWithRecipeLinks(mealPlan, {
      appetizerCandidates,
      sideCandidates,
      dessertCandidates,
    });

    return {
      success: true,
      mealPlan: enrichedMealPlan,
    };
  } catch (error: any) {
    console.error('Meal generation failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate meal plan',
    };
  }
}

// ============================================================================
// Simplified API Interface
// ============================================================================

/**
 * Main entry point for meal generation
 * Converts simple request to full input and generates meal
 *
 * @example
 * ```typescript
 * // Cuisine-based
 * const italianMeal = await generateMeal({ cuisine: "Italian", servings: 6 });
 *
 * // Main-first
 * const steakMeal = await generateMeal({
 *   mainDish: "Pan-seared ribeye steak",
 *   dietary: ["gluten-free"],
 *   maxTime: 90
 * });
 *
 * // Theme-based
 * const springParty = await generateMeal({
 *   theme: "Spring garden party",
 *   ingredients: ["asparagus", "peas", "mint"],
 *   servings: 8
 * });
 * ```
 */
export async function generateMeal(request: SimpleMealRequest): Promise<MealGenerationResult> {
  // Determine mode based on what's provided
  let mode: MealPairingMode = 'freestyle';

  if (request.mainDish) {
    mode = 'main-first';
  } else if (request.cuisine) {
    mode = 'cuisine';
  } else if (request.theme) {
    mode = 'theme';
  }

  const input: MealPairingInput = {
    mode,
    cuisine: request.cuisine,
    theme: request.theme,
    mainDish: request.mainDish,
    dietaryRestrictions: request.dietary,
    availableIngredients: request.ingredients,
    timeLimit: request.maxTime,
    servings: request.servings || 4,
  };

  return generateMealWithSemanticSearch(input);
}

// ============================================================================
// Exports
// ============================================================================

export {
  generateMealWithSemanticSearch,
  searchRecipesByCourse,
  buildDatabaseContext,
  enrichWithRecipeLinks,
};
