'use server';

import { getOpenRouterClient } from '@/lib/ai/openrouter-server';
import { deduplicateAcrossCourses } from '@/lib/meals/recipe-classification';
import { type RecipeWithSimilarity, semanticSearchRecipes } from './semantic-search';

/**
 * Smart Meal Suggestions
 *
 * Advanced AI-powered recipe suggestions for meal planning with:
 * - Dietary preference filtering
 * - Nutritional balance scoring
 * - Cuisine coherence detection
 * - Budget awareness
 * - Seasonal ingredient boosting
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface MealSuggestionsParams {
  description: string;
  tags?: string[];

  // Dietary preferences
  dietary?: {
    vegetarian?: boolean;
    vegan?: boolean;
    glutenFree?: boolean;
    dairyFree?: boolean;
    nutFree?: boolean;
    lowCarb?: boolean;
    keto?: boolean;
    paleo?: boolean;
  };

  // Budget constraints
  budget?: {
    max?: number; // Maximum estimated cost per meal
    preferBudgetFriendly?: boolean;
  };

  // Nutritional goals
  nutrition?: {
    balanceProtein?: boolean;
    balanceVegetables?: boolean;
    lowCalorie?: boolean;
    highProtein?: boolean;
  };

  // Cuisine preferences
  cuisine?: string; // e.g., "Italian", "Mexican", "Asian"
  enforceCuisineCoherence?: boolean;

  // Seasonal preferences
  preferSeasonal?: boolean;
  currentSeason?: 'spring' | 'summer' | 'fall' | 'winter';

  // Search parameters
  limit?: number;
  minSimilarity?: number;
}

export interface EnhancedRecipeSuggestion extends RecipeWithSimilarity {
  score: number; // Combined relevance score (0-1)
  badges: string[]; // "Seasonal", "Budget-Friendly", "High Protein", etc.
  warnings?: string[]; // "Contains dairy", "High calories", etc.
  nutritionalMatch?: number; // How well it fits nutritional goals (0-1)
  cuisineMatch?: number; // How well it fits cuisine preference (0-1)
  budgetMatch?: number; // How well it fits budget (0-1)
}

export interface CourseSuggestions {
  appetizer: EnhancedRecipeSuggestion[];
  main: EnhancedRecipeSuggestion[];
  side: EnhancedRecipeSuggestion[];
  dessert: EnhancedRecipeSuggestion[];
}

// ============================================================================
// Main Suggestion Function
// ============================================================================

export async function getSmartMealSuggestions(
  params: MealSuggestionsParams
): Promise<{ success: boolean; suggestions?: CourseSuggestions; error?: string }> {
  try {
    const {
      description,
      tags = [],
      dietary,
      budget,
      nutrition,
      cuisine,
      enforceCuisineCoherence = false,
      preferSeasonal = false,
      currentSeason,
      limit = 3,
      minSimilarity = 0.4,
    } = params;

    if (!description.trim()) {
      return { success: false, error: 'Description is required' };
    }

    // Build enhanced search query
    const searchQuery = buildEnhancedSearchQuery(description, tags, dietary, cuisine);

    // Fetch suggestions for each course
    const [appetizerResult, mainResult, sideResult, dessertResult] = await Promise.all([
      semanticSearchRecipes(`${searchQuery} appetizer starter`, {
        limit: limit * 2, // Get more results for filtering
        minSimilarity,
        includePrivate: true,
      }),
      semanticSearchRecipes(`${searchQuery} main dish entree`, {
        limit: limit * 2,
        minSimilarity,
        includePrivate: true,
      }),
      semanticSearchRecipes(`${searchQuery} side dish`, {
        limit: limit * 2,
        minSimilarity,
        includePrivate: true,
      }),
      semanticSearchRecipes(`${searchQuery} dessert sweet`, {
        limit: limit * 2,
        minSimilarity,
        includePrivate: true,
      }),
    ]);

    // Combine and enhance results
    const rawSuggestions = {
      appetizer: appetizerResult.success ? appetizerResult.recipes : [],
      main: mainResult.success ? mainResult.recipes : [],
      side: sideResult.success ? sideResult.recipes : [],
      dessert: dessertResult.success ? dessertResult.recipes : [],
      salad: [],
      soup: [],
      bread: [],
      drink: [],
      other: [],
    };

    // Deduplicate across courses
    const deduplicated = deduplicateAcrossCourses(rawSuggestions);

    // Enhance each recipe with scoring and badges
    const enhancedSuggestions: CourseSuggestions = {
      appetizer: await enhanceRecipes(deduplicated.appetizer, params),
      main: await enhanceRecipes(deduplicated.main, params),
      side: await enhanceRecipes(deduplicated.side, params),
      dessert: await enhanceRecipes(deduplicated.dessert, params),
    };

    // Filter by dietary restrictions (strict filtering)
    const filteredSuggestions = filterByDietaryRestrictions(enhancedSuggestions, dietary);

    // Sort by combined score and limit
    const sortedAndLimited: CourseSuggestions = {
      appetizer: filteredSuggestions.appetizer.sort((a, b) => b.score - a.score).slice(0, limit),
      main: filteredSuggestions.main.sort((a, b) => b.score - a.score).slice(0, limit),
      side: filteredSuggestions.side.sort((a, b) => b.score - a.score).slice(0, limit),
      dessert: filteredSuggestions.dessert.sort((a, b) => b.score - a.score).slice(0, limit),
    };

    return { success: true, suggestions: sortedAndLimited };
  } catch (error) {
    console.error('Failed to get smart meal suggestions:', error);
    return { success: false, error: 'Failed to generate suggestions' };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildEnhancedSearchQuery(
  description: string,
  tags: string[],
  dietary?: MealSuggestionsParams['dietary'],
  cuisine?: string
): string {
  const parts = [description];

  // Add tags
  if (tags.length > 0) {
    parts.push(tags.join(' '));
  }

  // Add dietary keywords
  if (dietary) {
    if (dietary.vegetarian) parts.push('vegetarian');
    if (dietary.vegan) parts.push('vegan');
    if (dietary.glutenFree) parts.push('gluten-free');
    if (dietary.dairyFree) parts.push('dairy-free');
    if (dietary.nutFree) parts.push('nut-free');
    if (dietary.lowCarb) parts.push('low-carb');
    if (dietary.keto) parts.push('keto ketogenic');
    if (dietary.paleo) parts.push('paleo');
  }

  // Add cuisine
  if (cuisine) {
    parts.push(cuisine);
  }

  return parts.join(' ');
}

async function enhanceRecipes(
  recipes: RecipeWithSimilarity[],
  params: MealSuggestionsParams
): Promise<EnhancedRecipeSuggestion[]> {
  return recipes.map((recipe) => {
    const badges: string[] = [];
    const warnings: string[] = [];
    let score = recipe.similarity || 0.5;

    // Cuisine matching
    const cuisineMatch = params.cuisine ? calculateCuisineMatch(recipe, params.cuisine) : 1.0;
    if (cuisineMatch > 0.8 && params.cuisine) {
      badges.push('Perfect Cuisine Match');
    }

    // Budget analysis (basic - can be enhanced with LLM price estimation)
    const budgetMatch = params.budget?.max ? calculateBudgetMatch(recipe, params.budget.max) : 1.0;
    if (budgetMatch > 0.8) {
      badges.push('Budget-Friendly');
    }

    // Nutritional analysis (basic - can be enhanced with detailed nutrient data)
    const nutritionalMatch = params.nutrition
      ? calculateNutritionalMatch(recipe, params.nutrition)
      : 1.0;
    if (nutritionalMatch > 0.8 && params.nutrition?.highProtein) {
      badges.push('High Protein');
    }
    if (nutritionalMatch > 0.8 && params.nutrition?.balanceVegetables) {
      badges.push('Vegetable-Rich');
    }

    // Seasonal detection
    if (params.preferSeasonal && params.currentSeason) {
      const isSeasonal = checkSeasonal(recipe, params.currentSeason);
      if (isSeasonal) {
        badges.push('Seasonal');
        score *= 1.1; // Boost seasonal recipes
      }
    }

    // Quick recipe boost
    const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);
    if (totalTime <= 30) {
      badges.push('Quick & Easy');
    }

    // Dietary warnings
    if (params.dietary) {
      const dietaryWarnings = getDietaryWarnings(recipe, params.dietary);
      warnings.push(...dietaryWarnings);
    }

    // Combined score (weighted average)
    const combinedScore =
      score * 0.5 + // Similarity (50%)
      cuisineMatch * 0.2 + // Cuisine match (20%)
      nutritionalMatch * 0.2 + // Nutritional match (20%)
      budgetMatch * 0.1; // Budget match (10%)

    return {
      ...recipe,
      score: Math.min(combinedScore, 1.0),
      badges,
      warnings: warnings.length > 0 ? warnings : undefined,
      nutritionalMatch,
      cuisineMatch,
      budgetMatch,
    };
  });
}

function calculateCuisineMatch(recipe: RecipeWithSimilarity, targetCuisine: string): number {
  const recipeCuisine = recipe.cuisine?.toLowerCase() || '';
  const target = targetCuisine.toLowerCase();

  // Parse tags for cuisine keywords
  const tags = parseTags(recipe.tags);
  const tagCuisines = tags.filter((tag) =>
    [
      'italian',
      'mexican',
      'asian',
      'chinese',
      'japanese',
      'thai',
      'indian',
      'french',
      'greek',
      'mediterranean',
    ].includes(tag.toLowerCase())
  );

  // Direct match
  if (recipeCuisine === target) return 1.0;

  // Tag match
  if (tagCuisines.some((tc) => tc.toLowerCase().includes(target))) return 0.9;

  // Partial match
  if (recipeCuisine.includes(target) || target.includes(recipeCuisine)) return 0.7;

  // Check description
  const description = recipe.description?.toLowerCase() || '';
  if (description.includes(target)) return 0.6;

  return 0.3; // Default low match
}

function calculateBudgetMatch(recipe: RecipeWithSimilarity, maxBudget: number): number {
  // Estimate recipe cost based on ingredients (simplified)
  const ingredients = parseIngredients(recipe.ingredients);
  const estimatedCost = ingredients.length * 2.5; // Rough estimate: $2.50 per ingredient

  if (estimatedCost <= maxBudget * 0.7) return 1.0; // Well under budget
  if (estimatedCost <= maxBudget) return 0.8; // Within budget
  if (estimatedCost <= maxBudget * 1.2) return 0.5; // Slightly over
  return 0.2; // Too expensive
}

function calculateNutritionalMatch(
  recipe: RecipeWithSimilarity,
  goals: NonNullable<MealSuggestionsParams['nutrition']>
): number {
  let score = 0.5; // Neutral baseline
  const ingredients = parseIngredients(recipe.ingredients);
  const name = recipe.name.toLowerCase();
  const description = recipe.description?.toLowerCase() || '';

  // High protein detection
  if (goals.highProtein) {
    const proteinKeywords = ['chicken', 'beef', 'pork', 'fish', 'tofu', 'eggs', 'protein'];
    const hasProtein = ingredients.some((ing) =>
      proteinKeywords.some((kw) => ing.toLowerCase().includes(kw))
    );
    if (hasProtein) score += 0.2;
  }

  // Balance vegetables
  if (goals.balanceVegetables) {
    const vegetableKeywords = [
      'tomato',
      'onion',
      'carrot',
      'broccoli',
      'spinach',
      'lettuce',
      'pepper',
      'vegetable',
    ];
    const vegetableCount = ingredients.filter((ing) =>
      vegetableKeywords.some((kw) => ing.toLowerCase().includes(kw))
    ).length;
    score += Math.min(vegetableCount * 0.1, 0.3);
  }

  // Low calorie detection
  if (goals.lowCalorie) {
    const lowCalKeywords = ['grilled', 'baked', 'steamed', 'salad', 'light'];
    const isLowCal = lowCalKeywords.some((kw) => name.includes(kw) || description.includes(kw));
    if (isLowCal) score += 0.2;
  }

  return Math.min(score, 1.0);
}

function checkSeasonal(recipe: RecipeWithSimilarity, season: string): boolean {
  const ingredients = parseIngredients(recipe.ingredients);
  const seasonalIngredients = getSeasonalIngredients(season);

  return ingredients.some((ing) =>
    seasonalIngredients.some((seasonal) => ing.toLowerCase().includes(seasonal))
  );
}

function getSeasonalIngredients(season: string): string[] {
  const seasonal: Record<string, string[]> = {
    spring: ['asparagus', 'peas', 'strawberry', 'artichoke', 'rhubarb', 'spring onion'],
    summer: ['tomato', 'zucchini', 'corn', 'peach', 'watermelon', 'berry', 'cucumber'],
    fall: ['pumpkin', 'squash', 'apple', 'pear', 'brussels sprouts', 'sweet potato'],
    winter: ['root vegetables', 'cabbage', 'kale', 'citrus', 'pomegranate', 'winter squash'],
  };

  return seasonal[season] || [];
}

function filterByDietaryRestrictions(
  suggestions: CourseSuggestions,
  dietary?: MealSuggestionsParams['dietary']
): CourseSuggestions {
  if (!dietary) return suggestions;

  const filterRecipes = (recipes: EnhancedRecipeSuggestion[]) => {
    return recipes.filter((recipe) => {
      const ingredients = parseIngredients(recipe.ingredients).join(' ').toLowerCase();
      const name = recipe.name.toLowerCase();
      const description = recipe.description?.toLowerCase() || '';
      const text = `${ingredients} ${name} ${description}`;

      // Vegetarian check
      if (dietary.vegetarian) {
        const meatKeywords = [
          'chicken',
          'beef',
          'pork',
          'lamb',
          'turkey',
          'fish',
          'seafood',
          'meat',
        ];
        if (meatKeywords.some((kw) => text.includes(kw))) return false;
      }

      // Vegan check (includes vegetarian restrictions)
      if (dietary.vegan) {
        const animalKeywords = [
          'chicken',
          'beef',
          'pork',
          'lamb',
          'turkey',
          'fish',
          'seafood',
          'meat',
          'milk',
          'cheese',
          'butter',
          'cream',
          'egg',
          'honey',
          'yogurt',
        ];
        if (animalKeywords.some((kw) => text.includes(kw))) return false;
      }

      // Gluten-free check
      if (dietary.glutenFree) {
        const glutenKeywords = ['wheat', 'flour', 'bread', 'pasta', 'barley', 'rye'];
        if (glutenKeywords.some((kw) => text.includes(kw))) return false;
      }

      // Dairy-free check
      if (dietary.dairyFree) {
        const dairyKeywords = ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'dairy'];
        if (dairyKeywords.some((kw) => text.includes(kw))) return false;
      }

      // Nut-free check
      if (dietary.nutFree) {
        const nutKeywords = ['almond', 'peanut', 'walnut', 'cashew', 'pecan', 'hazelnut', 'nut'];
        if (nutKeywords.some((kw) => text.includes(kw))) return false;
      }

      return true;
    });
  };

  return {
    appetizer: filterRecipes(suggestions.appetizer),
    main: filterRecipes(suggestions.main),
    side: filterRecipes(suggestions.side),
    dessert: filterRecipes(suggestions.dessert),
  };
}

function getDietaryWarnings(
  recipe: RecipeWithSimilarity,
  dietary: NonNullable<MealSuggestionsParams['dietary']>
): string[] {
  const warnings: string[] = [];
  const ingredients = parseIngredients(recipe.ingredients).join(' ').toLowerCase();

  if (dietary.vegetarian || dietary.vegan) {
    if (
      ingredients.includes('chicken') ||
      ingredients.includes('beef') ||
      ingredients.includes('pork')
    ) {
      warnings.push('Contains meat');
    }
  }

  if (dietary.vegan) {
    if (
      ingredients.includes('milk') ||
      ingredients.includes('cheese') ||
      ingredients.includes('egg')
    ) {
      warnings.push('Contains dairy/eggs');
    }
  }

  if (dietary.glutenFree) {
    if (
      ingredients.includes('flour') ||
      ingredients.includes('bread') ||
      ingredients.includes('pasta')
    ) {
      warnings.push('Contains gluten');
    }
  }

  if (dietary.nutFree) {
    if (
      ingredients.includes('nut') ||
      ingredients.includes('almond') ||
      ingredients.includes('peanut')
    ) {
      warnings.push('Contains nuts');
    }
  }

  return warnings;
}

// ============================================================================
// Utility Functions
// ============================================================================

function parseIngredients(ingredientsJson: string | null): string[] {
  if (!ingredientsJson) return [];
  try {
    return JSON.parse(ingredientsJson) as string[];
  } catch {
    return [];
  }
}

function parseTags(tagsJson: string | null): string[] {
  if (!tagsJson) return [];
  try {
    return JSON.parse(tagsJson) as string[];
  } catch {
    return [];
  }
}

// ============================================================================
// LLM-Powered Price Estimation (Advanced Feature)
// ============================================================================

export async function estimateRecipePrice(
  _recipeId: string,
  ingredients: string[]
): Promise<{
  success: boolean;
  estimatedCost?: number;
  breakdown?: Record<string, number>;
  error?: string;
}> {
  try {
    const client = getOpenRouterClient();

    const prompt = `Estimate the total cost of these ingredients for a recipe. Provide prices in USD.

Ingredients:
${ingredients.map((ing, i) => `${i + 1}. ${ing}`).join('\n')}

Respond in this JSON format:
{
  "total_cost": 25.50,
  "breakdown": {
    "ingredient_name": price_in_dollars
  }
}`;

    const completion = await client.chat.completions.create({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that estimates grocery prices accurately.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: 'No response from AI' };
    }

    const result = JSON.parse(content);
    return {
      success: true,
      estimatedCost: result.total_cost,
      breakdown: result.breakdown,
    };
  } catch (error) {
    console.error('Failed to estimate recipe price:', error);
    return { success: false, error: 'Failed to estimate price' };
  }
}
