'use server';

import { generateRecipe } from '@/lib/ai/recipe-generator';
import { createRecipe } from './recipes';
import { ModelName } from '@/lib/ai/openrouter';
import { requireAuth } from '@/lib/auth-guard';

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
        error: 'OpenRouter API key is not configured. Please add OPENROUTER_API_KEY to your environment variables.'
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
      error: 'Failed to generate recipe. Please try again with different parameters.'
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
      prepTime: recipe.prepTime || null,
      cookTime: recipe.cookTime || null,
      servings: recipe.servings || null,
      difficulty: recipe.difficulty || null,
      cuisine: recipe.cuisine || null,
      tags: recipe.tags ? JSON.stringify(recipe.tags) : null,
      imageUrl: recipe.imageUrl || null,
      isAiGenerated: true, // Mark as AI generated
      nutritionInfo: recipe.nutritionInfo ? JSON.stringify(recipe.nutritionInfo) : null,
      modelUsed: recipe.modelUsed || null,
      source: recipe.source || null,
    };

    // Use existing createRecipe action
    return await createRecipe(recipeData);
  } catch (error) {
    console.error('Failed to save discovered recipe:', error);
    return {
      success: false,
      error: 'Failed to save the recipe. Please try again.'
    };
  }
}