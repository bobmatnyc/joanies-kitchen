/**
 * AI Meal Generator
 *
 * High-level functions for meal generation using the centralized prompt store
 */

import { getOpenRouterClient } from './openrouter-server';
import { renderPromptById, getPrompt, type PromptRenderOptions } from './prompts';
import { z } from 'zod';

// ============================================================================
// Response Schemas
// ============================================================================

const DishSchema = z.object({
  type: z.enum(['main', 'side', 'appetizer', 'dessert']),
  name: z.string(),
  description: z.string(),
  pairing_rationale: z.string().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  prep_time: z.number(),
  cook_time: z.number(),
  key_ingredients: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  cuisine: z.string().optional(),
});

const CompleteMealSchema = z.array(DishSchema);

export type Dish = z.infer<typeof DishSchema>;
export type CompleteMeal = z.infer<typeof CompleteMealSchema>;

// ============================================================================
// Main Meal Generation Functions
// ============================================================================

/**
 * Generate a complete meal (main, sides, appetizer, dessert)
 */
export async function generateCompleteMeal(params: {
  mainDish?: string;
  cuisine?: string;
  dietaryRestrictions?: string;
  servings?: number;
  occasion?: string;
  modelOverride?: string;
}): Promise<CompleteMeal> {
  const template = getPrompt('meal-builder-complete');
  if (!template) {
    throw new Error('Prompt template not found: meal-builder-complete');
  }

  const rendered = renderPromptById('meal-builder-complete', {
    variables: {
      mainDish: params.mainDish || 'surprise me with something delicious',
      cuisine: params.cuisine || 'any cuisine',
      dietaryRestrictions: params.dietaryRestrictions || 'none',
      servings: String(params.servings || 4),
      occasion: params.occasion || 'casual dinner',
    },
    modelOverride: params.modelOverride,
  });

  const client = getOpenRouterClient();
  const response = await client.chat.completions.create({
    model: rendered.config.model,
    messages: [
      { role: 'system', content: rendered.system },
      { role: 'user', content: rendered.user },
    ],
    temperature: rendered.config.temperature,
    max_tokens: rendered.config.maxTokens,
    response_format:
      rendered.config.responseFormat === 'json_object'
        ? { type: 'json_object' }
        : undefined,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI model');
  }

  try {
    const parsed = JSON.parse(content);
    return CompleteMealSchema.parse(parsed);
  } catch (error) {
    console.error('Failed to parse meal response:', error);
    console.error('Raw response:', content);
    throw new Error('Invalid meal response format from AI');
  }
}

/**
 * Generate complementary side dishes for a main dish
 */
export async function generateComplementarySides(params: {
  mainDish: string;
  mainDescription: string;
  cuisine: string;
  cookingMethod: string;
  servings: number;
  count?: number;
  dietaryRestrictions?: string;
  modelOverride?: string;
}): Promise<Dish[]> {
  const rendered = renderPromptById('complementary-sides', {
    variables: {
      mainDish: params.mainDish,
      mainDescription: params.mainDescription,
      cuisine: params.cuisine,
      cookingMethod: params.cookingMethod,
      servings: String(params.servings),
      count: String(params.count || 2),
      dietaryRestrictions: params.dietaryRestrictions || 'none',
    },
    modelOverride: params.modelOverride,
  });

  const client = getOpenRouterClient();
  const response = await client.chat.completions.create({
    model: rendered.config.model,
    messages: [
      { role: 'system', content: rendered.system },
      { role: 'user', content: rendered.user },
    ],
    temperature: rendered.config.temperature,
    max_tokens: rendered.config.maxTokens,
    response_format:
      rendered.config.responseFormat === 'json_object'
        ? { type: 'json_object' }
        : undefined,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI model');
  }

  try {
    const parsed = JSON.parse(content);
    // Response is an array of sides
    return z.array(DishSchema).parse(parsed);
  } catch (error) {
    console.error('Failed to parse sides response:', error);
    console.error('Raw response:', content);
    throw new Error('Invalid sides response format from AI');
  }
}

/**
 * Generate a themed meal for a specific occasion
 */
export async function generateThemedMeal(params: {
  theme: string;
  cuisine: string;
  servings: number;
  dietaryRestrictions: string;
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  budget: 'budget' | 'moderate' | 'premium';
  modelOverride?: string;
}): Promise<{
  theme_description: string;
  total_prep_time: number;
  total_cook_time: number;
  courses: Dish[];
  cooking_sequence: string;
  presentation_tips: string;
}> {
  const rendered = renderPromptById('themed-meal', {
    variables: {
      theme: params.theme,
      cuisine: params.cuisine,
      servings: String(params.servings),
      dietaryRestrictions: params.dietaryRestrictions,
      skillLevel: params.skillLevel,
      budget: params.budget,
    },
    modelOverride: params.modelOverride,
  });

  const client = getOpenRouterClient();
  const response = await client.chat.completions.create({
    model: rendered.config.model,
    messages: [
      { role: 'system', content: rendered.system },
      { role: 'user', content: rendered.user },
    ],
    temperature: rendered.config.temperature,
    max_tokens: rendered.config.maxTokens,
    response_format:
      rendered.config.responseFormat === 'json_object'
        ? { type: 'json_object' }
        : undefined,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI model');
  }

  try {
    const parsed = JSON.parse(content);
    return {
      theme_description: parsed.theme_description,
      total_prep_time: parsed.total_prep_time,
      total_cook_time: parsed.total_cook_time,
      courses: z.array(DishSchema).parse(parsed.courses),
      cooking_sequence: parsed.cooking_sequence,
      presentation_tips: parsed.presentation_tips,
    };
  } catch (error) {
    console.error('Failed to parse themed meal response:', error);
    console.error('Raw response:', content);
    throw new Error('Invalid themed meal response format from AI');
  }
}

/**
 * Generate a dietary-compliant meal
 */
export async function generateDietaryMeal(params: {
  dietType: string;
  restrictions: string;
  allergies: string;
  nutritionalGoals: string;
  servings: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  modelOverride?: string;
}): Promise<{
  nutritional_summary: {
    total_calories: number;
    protein_grams: number;
    carbs_grams: number;
    fat_grams: number;
    fiber_grams: number;
  };
  compliance_verification: {
    diet_type: string;
    all_restrictions_met: boolean;
    allergen_free: string[];
    notes: string;
  };
  dishes: Dish[];
  shopping_notes: string;
  preparation_warnings: string;
}> {
  const rendered = renderPromptById('dietary-meal-builder', {
    variables: {
      dietType: params.dietType,
      restrictions: params.restrictions,
      allergies: params.allergies,
      nutritionalGoals: params.nutritionalGoals,
      servings: String(params.servings),
      mealType: params.mealType,
    },
    modelOverride: params.modelOverride,
  });

  const client = getOpenRouterClient();
  const response = await client.chat.completions.create({
    model: rendered.config.model,
    messages: [
      { role: 'system', content: rendered.system },
      { role: 'user', content: rendered.user },
    ],
    temperature: rendered.config.temperature,
    max_tokens: rendered.config.maxTokens,
    response_format:
      rendered.config.responseFormat === 'json_object'
        ? { type: 'json_object' }
        : undefined,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI model');
  }

  try {
    const parsed = JSON.parse(content);
    return {
      nutritional_summary: parsed.nutritional_summary,
      compliance_verification: parsed.compliance_verification,
      dishes: z.array(DishSchema).parse(parsed.dishes),
      shopping_notes: parsed.shopping_notes,
      preparation_warnings: parsed.preparation_warnings,
    };
  } catch (error) {
    console.error('Failed to parse dietary meal response:', error);
    console.error('Raw response:', content);
    throw new Error('Invalid dietary meal response format from AI');
  }
}

/**
 * Generate a seasonal meal
 */
export async function generateSeasonalMeal(params: {
  season: 'spring' | 'summer' | 'fall' | 'winter';
  region: string;
  cuisine: string;
  dietaryRestrictions: string;
  servings: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'brunch';
  modelOverride?: string;
}): Promise<{
  seasonal_theme: string;
  peak_ingredients: Array<{
    ingredient: string;
    why_seasonal: string;
    selection_tips: string;
  }>;
  dishes: Dish[];
  sourcing_recommendations: string;
  preservation_options: string;
}> {
  const rendered = renderPromptById('seasonal-meal', {
    variables: {
      season: params.season,
      region: params.region,
      cuisine: params.cuisine,
      dietaryRestrictions: params.dietaryRestrictions,
      servings: String(params.servings),
      mealType: params.mealType,
    },
    modelOverride: params.modelOverride,
  });

  const client = getOpenRouterClient();
  const response = await client.chat.completions.create({
    model: rendered.config.model,
    messages: [
      { role: 'system', content: rendered.system },
      { role: 'user', content: rendered.user },
    ],
    temperature: rendered.config.temperature,
    max_tokens: rendered.config.maxTokens,
    response_format:
      rendered.config.responseFormat === 'json_object'
        ? { type: 'json_object' }
        : undefined,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI model');
  }

  try {
    const parsed = JSON.parse(content);
    return {
      seasonal_theme: parsed.seasonal_theme,
      peak_ingredients: parsed.peak_ingredients,
      dishes: z.array(DishSchema).parse(parsed.dishes),
      sourcing_recommendations: parsed.sourcing_recommendations,
      preservation_options: parsed.preservation_options,
    };
  } catch (error) {
    console.error('Failed to parse seasonal meal response:', error);
    console.error('Raw response:', content);
    throw new Error('Invalid seasonal meal response format from AI');
  }
}

/**
 * Generate a budget-friendly meal
 */
export async function generateBudgetMeal(params: {
  budgetPerServing: string;
  servings: number;
  dietaryRestrictions: string;
  pantryStaples: string;
  cuisine: string;
  modelOverride?: string;
}): Promise<{
  cost_breakdown: {
    estimated_cost_per_serving: number;
    total_meal_cost: number;
    cost_saving_tips: string;
  };
  dishes: Dish[];
  shopping_strategy: string;
  meal_prep_instructions: string;
  storage_instructions: string;
}> {
  const rendered = renderPromptById('budget-meal-planner', {
    variables: {
      budgetPerServing: params.budgetPerServing,
      servings: String(params.servings),
      dietaryRestrictions: params.dietaryRestrictions,
      pantryStaples: params.pantryStaples,
      cuisine: params.cuisine,
    },
    modelOverride: params.modelOverride,
  });

  const client = getOpenRouterClient();
  const response = await client.chat.completions.create({
    model: rendered.config.model,
    messages: [
      { role: 'system', content: rendered.system },
      { role: 'user', content: rendered.user },
    ],
    temperature: rendered.config.temperature,
    max_tokens: rendered.config.maxTokens,
    response_format:
      rendered.config.responseFormat === 'json_object'
        ? { type: 'json_object' }
        : undefined,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI model');
  }

  try {
    const parsed = JSON.parse(content);
    return {
      cost_breakdown: parsed.cost_breakdown,
      dishes: z.array(DishSchema).parse(parsed.dishes),
      shopping_strategy: parsed.shopping_strategy,
      meal_prep_instructions: parsed.meal_prep_instructions,
      storage_instructions: parsed.storage_instructions,
    };
  } catch (error) {
    console.error('Failed to parse budget meal response:', error);
    console.error('Raw response:', content);
    throw new Error('Invalid budget meal response format from AI');
  }
}

// ============================================================================
// Generic Helper for Any Prompt
// ============================================================================

/**
 * Generic function to call any prompt in the store
 */
export async function callPrompt<T = any>(
  promptId: string,
  variables: Record<string, string>,
  options?: {
    modelOverride?: string;
    temperatureOverride?: number;
    maxTokensOverride?: number;
    zodSchema?: z.ZodSchema<T>;
  }
): Promise<T> {
  const rendered = renderPromptById(promptId, {
    variables,
    modelOverride: options?.modelOverride,
    temperatureOverride: options?.temperatureOverride,
    maxTokensOverride: options?.maxTokensOverride,
  });

  const client = getOpenRouterClient();
  const response = await client.chat.completions.create({
    model: rendered.config.model,
    messages: [
      { role: 'system', content: rendered.system },
      { role: 'user', content: rendered.user },
    ],
    temperature: rendered.config.temperature,
    max_tokens: rendered.config.maxTokens,
    response_format:
      rendered.config.responseFormat === 'json_object'
        ? { type: 'json_object' }
        : undefined,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI model');
  }

  try {
    const parsed = JSON.parse(content);
    if (options?.zodSchema) {
      return options.zodSchema.parse(parsed);
    }
    return parsed as T;
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    console.error('Raw response:', content);
    throw new Error('Invalid response format from AI');
  }
}
