'use server';

import { z } from 'zod';
import { getOpenRouterClient, MODELS } from '@/lib/ai/openrouter-server';
import { createRecipe } from './recipes';

// Schema for web search results
const WebRecipeSchema = z.object({
  name: z.string(),
  description: z.string(),
  ingredients: z.array(z.string()),
  instructions: z.array(z.string()),
  prepTime: z.number().optional(),
  cookTime: z.number().optional(),
  servings: z.number().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  cuisine: z.string().optional(),
  tags: z.array(z.string()).optional(),
  nutritionInfo: z
    .object({
      calories: z.number().optional(),
      protein: z.number().optional(),
      carbs: z.number().optional(),
      fat: z.number().optional(),
      fiber: z.number().optional(),
    })
    .optional(),
  sourceUrl: z.string().optional(),
  sourceName: z.string().optional(),
  imageUrl: z.string().optional(),
});

export type WebRecipe = z.infer<typeof WebRecipeSchema>;

interface WebSearchOptions {
  query: string;
  cuisine?: string;
  ingredients?: string[];
  dietaryRestrictions?: string[];
  maxResults?: number;
}

// Search for recipes on the web using Perplexity's web search models
export async function searchWebRecipes(
  options: WebSearchOptions
): Promise<{ success: boolean; data?: WebRecipe[]; error?: string }> {
  const { query, cuisine, ingredients = [], dietaryRestrictions = [], maxResults = 5 } = options;

  if (!process.env.OPENROUTER_API_KEY) {
    return {
      success: false,
      error: 'OpenRouter API key is not configured',
    };
  }

  // Build search query
  let searchQuery = query;
  if (cuisine) {
    searchQuery += ` ${cuisine} cuisine`;
  }
  if (ingredients.length > 0) {
    searchQuery += ` with ${ingredients.join(', ')}`;
  }
  if (dietaryRestrictions.length > 0) {
    searchQuery += ` (${dietaryRestrictions.join(', ')})`;
  }

  const systemPrompt = `You are a recipe search expert with real-time web access. Search for authentic recipes from reputable cooking websites, food blogs, and chef resources.
For each recipe found, extract complete information including ingredients, instructions, and source attribution.
Focus on finding diverse, high-quality recipes that match the search criteria.
Always provide accurate source URLs and names for attribution.`;

  const userPrompt = `Search the web for recipes matching: "${searchQuery}"

Find ${maxResults} different recipes and return them in this exact JSON format:
{
  "recipes": [
    {
      "name": "Recipe Name",
      "description": "Brief description",
      "ingredients": ["ingredient 1 with amount", "ingredient 2"],
      "instructions": ["Step 1", "Step 2"],
      "prepTime": 15,
      "cookTime": 30,
      "servings": 4,
      "difficulty": "easy",
      "cuisine": "Italian",
      "tags": ["vegetarian", "quick"],
      "nutritionInfo": {
        "calories": 350,
        "protein": 20,
        "carbs": 45,
        "fat": 15,
        "fiber": 8
      },
      "sourceUrl": "https://example.com/recipe",
      "sourceName": "Website or Author Name",
      "imageUrl": "https://example.com/image.jpg"
    }
  ]
}

Search for recipes from popular cooking sites, food blogs, and chef websites. Include variety in sources and recipe styles.`;

  try {
    const openrouter = getOpenRouterClient();
    const completion = await openrouter.chat.completions.create({
      model: MODELS.PERPLEXITY_SONAR,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No results from web search');
    }

    // Parse the response
    const parsedResponse = JSON.parse(content);
    const recipes = parsedResponse.recipes || [];

    // Validate each recipe
    const validatedRecipes = recipes
      .map((recipe: any) => {
        try {
          return WebRecipeSchema.parse(recipe);
        } catch (err) {
          console.warn('Invalid recipe format:', err);
          return null;
        }
      })
      .filter(Boolean);

    return {
      success: true,
      data: validatedRecipes,
    };
  } catch (error: any) {
    console.error('Web search error:', error);
    return {
      success: false,
      error: error.message || 'Failed to search for recipes',
    };
  }
}

// Parse a recipe from a specific URL
export async function parseRecipeFromUrl(
  url: string
): Promise<{ success: boolean; data?: WebRecipe; error?: string }> {
  if (!process.env.OPENROUTER_API_KEY) {
    return {
      success: false,
      error: 'OpenRouter API key is not configured',
    };
  }

  const systemPrompt = `You are a recipe extraction expert with web access. Extract complete recipe information from the provided URL.
Parse all recipe details including ingredients, instructions, cooking times, and nutritional information if available.
Always maintain the source attribution.`;

  const userPrompt = `Extract the recipe from this URL: ${url}

Return the recipe in this exact JSON format:
{
  "name": "Recipe Name",
  "description": "Brief description",
  "ingredients": ["ingredient 1 with amount", "ingredient 2"],
  "instructions": ["Step 1", "Step 2"],
  "prepTime": 15,
  "cookTime": 30,
  "servings": 4,
  "difficulty": "easy",
  "cuisine": "Cuisine Type",
  "tags": ["tag1", "tag2"],
  "nutritionInfo": {
    "calories": 350,
    "protein": 20,
    "carbs": 45,
    "fat": 15,
    "fiber": 8
  },
  "sourceUrl": "${url}",
  "sourceName": "Website or Author Name",
  "imageUrl": "image URL if available"
}`;

  try {
    const openrouter = getOpenRouterClient();
    const completion = await openrouter.chat.completions.create({
      model: MODELS.PERPLEXITY_SONAR,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Could not extract recipe from URL');
    }

    const parsedRecipe = JSON.parse(content);
    const validatedRecipe = WebRecipeSchema.parse(parsedRecipe);

    return {
      success: true,
      data: validatedRecipe,
    };
  } catch (error: any) {
    console.error('URL parsing error:', error);
    return {
      success: false,
      error: error.message || 'Failed to parse recipe from URL',
    };
  }
}

// Import a web recipe into the user's collection
export async function importWebRecipe(recipe: WebRecipe) {
  try {
    // Prepare recipe data for database
    const recipeData = {
      name: recipe.name,
      description: recipe.description,
      ingredients: JSON.stringify(recipe.ingredients),
      instructions: JSON.stringify(recipe.instructions),
      prep_time: recipe.prepTime || null,
      cook_time: recipe.cookTime || null,
      servings: recipe.servings || null,
      difficulty: recipe.difficulty || null,
      cuisine: recipe.cuisine || null,
      tags: recipe.tags ? JSON.stringify(recipe.tags) : null,
      image_url: recipe.imageUrl || null,
      is_ai_generated: true,
      nutrition_info: recipe.nutritionInfo ? JSON.stringify(recipe.nutritionInfo) : null,
      source: recipe.sourceUrl
        ? `${recipe.sourceName || 'Web'} - ${recipe.sourceUrl}`
        : recipe.sourceName || null,
    };

    return await createRecipe(recipeData);
  } catch (error) {
    console.error('Import error:', error);
    return {
      success: false,
      error: 'Failed to import recipe',
    };
  }
}

// Bulk import multiple recipes
export async function bulkImportRecipes(recipes: WebRecipe[]) {
  const results = await Promise.allSettled(recipes.map((recipe) => importWebRecipe(recipe)));

  const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.length - successful;

  return {
    success: failed === 0,
    imported: successful,
    failed: failed,
    message: `Imported ${successful} recipes${failed > 0 ? `, ${failed} failed` : ''}`,
  };
}
