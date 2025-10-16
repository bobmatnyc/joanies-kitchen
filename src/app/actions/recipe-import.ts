'use server';

import { requireAuth } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { recipes, type Recipe } from '@/lib/db/schema';
import { parseMarkdownRecipe } from '@/lib/utils/markdown-parser';

/**
 * Import a single recipe from markdown
 */
export async function importRecipeFromMarkdown(markdownContent: string) {
  const { userId } = await requireAuth('recipe import from markdown');

  try {
    const parsedRecipe = parseMarkdownRecipe(markdownContent);

    // Validate required fields
    if (!parsedRecipe.title) {
      throw new Error('Recipe must have a title');
    }

    if (parsedRecipe.ingredients.length === 0) {
      throw new Error('Recipe must have at least one ingredient');
    }

    if (parsedRecipe.instructions.length === 0) {
      throw new Error('Recipe must have at least one instruction');
    }

    // Create the recipe
    const [newRecipe] = await db
      .insert(recipes)
      .values({
        user_id: userId,
        chef_id: null,
        name: parsedRecipe.title,
        description: parsedRecipe.description,
        prep_time: parsedRecipe.prepTime,
        cook_time: parsedRecipe.cookTime,
        servings: parsedRecipe.servings,
        difficulty: parsedRecipe.difficulty as 'easy' | 'medium' | 'hard' | undefined,
        cuisine: parsedRecipe.cuisine,
        image_url: parsedRecipe.imageUrl,
        ingredients: JSON.stringify(parsedRecipe.ingredients),
        instructions: JSON.stringify(parsedRecipe.instructions),
        tags: parsedRecipe.tags ? JSON.stringify(parsedRecipe.tags) : null,
        nutrition_info: parsedRecipe.nutritionInfo ? JSON.stringify(parsedRecipe.nutritionInfo) : null,
        is_ai_generated: false,
      })
      .returning();

    return {
      success: true,
      recipe: newRecipe,
    };
  } catch (error) {
    console.error('Import error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import recipe',
    };
  }
}

/**
 * Import multiple recipes from markdown files
 */
export async function importRecipesFromMarkdown(markdownFiles: { name: string; content: string }[]) {
  const { userId } = await requireAuth('batch recipe import from markdown');

  const results = [];
  const errors = [];

  for (const file of markdownFiles) {
    try {
      const result = await importRecipeFromMarkdown(file.content);
      if (result.success) {
        results.push({
          filename: file.name,
          recipe: result.recipe,
        });
      } else {
        errors.push({
          filename: file.name,
          error: result.error,
        });
      }
    } catch (error) {
      errors.push({
        filename: file.name,
        error: error instanceof Error ? error.message : 'Import failed',
      });
    }
  }

  return {
    success: results.length > 0,
    imported: results,
    failed: errors,
    summary: {
      total: markdownFiles.length,
      successful: results.length,
      failed: errors.length,
    },
  };
}

/**
 * Preview a recipe from markdown without saving
 */
export async function previewMarkdownRecipe(markdownContent: string) {
  try {
    const parsedRecipe = parseMarkdownRecipe(markdownContent);
    return {
      success: true,
      recipe: parsedRecipe,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse recipe',
    };
  }
}