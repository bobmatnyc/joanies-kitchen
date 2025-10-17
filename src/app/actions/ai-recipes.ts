'use server';

import type { ModelName } from '@/lib/ai/openrouter';
import { generateRecipe } from '@/lib/ai/recipe-generator';
import { requireAuth } from '@/lib/auth-guard';
import { createRecipe } from './recipes';

interface DiscoverRecipeOptions {
  query?: string;
  ingredients?: string[];
  cuisine?: string;
  mealType?: string;
  dietaryRestrictions?: string[];
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  model?: ModelName | string;
  useWebSearch?: boolean;
}

export async function discoverRecipe(options: DiscoverRecipeOptions) {
  try {
    // Require authentication for AI recipe generation
    await requireAuth('AI recipe generation');

    if (!process.env.OPENROUTER_API_KEY) {
      return {
        success: false,
        error:
          'OpenRouter API key is not configured. Please add OPENROUTER_API_KEY to your environment variables.',
      };
    }

    // Generate recipe using AI
    const generatedRecipe = await generateRecipe({
      prompt: options.query,
      ingredients: options.ingredients,
      cuisine: options.cuisine,
      mealType: options.mealType,
      dietaryRestrictions: options.dietaryRestrictions,
      servings: options.servings,
      difficulty: options.difficulty,
      model: options.model as ModelName,
      useWebSearch: options.useWebSearch,
    });

    // Return the generated recipe for preview (user must confirm before saving)
    return {
      success: true,
      data: generatedRecipe,
    };
  } catch (error) {
    console.error('Failed to discover recipe:', error);
    return {
      success: false,
      error: 'Failed to generate recipe. Please try again with different parameters.',
    };
  }
}

export async function saveDiscoveredRecipe(recipe: any) {
  try {
    // Require authentication for saving recipes
    await requireAuth('saving AI-generated recipes');

    // Prepare the recipe data for saving
    const recipeData = {
      name: recipe.name,
      description: recipe.description,
      ingredients: JSON.stringify(recipe.ingredients),
      instructions: JSON.stringify(recipe.instructions),
      prep_time: recipe.prepTime || recipe.prep_time || null,
      cook_time: recipe.cookTime || recipe.cook_time || null,
      servings: recipe.servings || null,
      difficulty: recipe.difficulty || null,
      cuisine: recipe.cuisine || null,
      tags: recipe.tags ? JSON.stringify(recipe.tags) : null,
      image_url: recipe.imageUrl || recipe.image_url || null,
      is_ai_generated: true, // Mark as AI generated
      nutrition_info:
        recipe.nutritionInfo || recipe.nutrition_info
          ? JSON.stringify(recipe.nutritionInfo || recipe.nutrition_info)
          : null,
      model_used: recipe.modelUsed || recipe.model_used || null,
      source: recipe.source || null,
      user_id: '', // Will be set by createRecipe
    };

    // Use existing createRecipe action
    return await createRecipe(recipeData);
  } catch (error) {
    console.error('Failed to save discovered recipe:', error);
    return {
      success: false,
      error: 'Failed to save the recipe. Please try again.',
    };
  }
}
