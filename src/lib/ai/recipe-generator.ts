import { z } from 'zod';
import { getOpenRouterClient, MODELS, type ModelName } from './openrouter-server';

// Schema for generated recipe
const GeneratedRecipeSchema = z.object({
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
  modelUsed: z.string().optional(),
  nutritionInfo: z
    .object({
      calories: z.number().optional(),
      protein: z.number().optional(),
      carbs: z.number().optional(),
      fat: z.number().optional(),
      fiber: z.number().optional(),
    })
    .optional(),
  source: z.string().optional(),
});

export type GeneratedRecipe = z.infer<typeof GeneratedRecipeSchema>;

interface GenerateRecipeOptions {
  ingredients?: string[];
  cuisine?: string;
  mealType?: string;
  dietaryRestrictions?: string[];
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  prompt?: string;
  model?: ModelName;
  useWebSearch?: boolean;
}

export async function generateRecipe(options: GenerateRecipeOptions): Promise<GeneratedRecipe> {
  const {
    ingredients = [],
    cuisine,
    mealType,
    dietaryRestrictions = [],
    servings,
    difficulty,
    prompt,
    model = MODELS.LLAMA_3_8B,
    useWebSearch = false,
  } = options;

  // Check if model has web search capabilities
  const isWebSearchModel = model.includes('sonar');

  // Build the prompt with web search enhancements if applicable
  const systemPrompt = isWebSearchModel
    ? `You are a professional chef with access to current web information. Use your web search capabilities to find authentic, trending, or chef-verified recipes.
Search for recipes from famous chefs, restaurants, or culinary websites when appropriate.
Include nutritional information from reliable sources when possible.
Always respond with valid JSON matching the exact schema provided.`
    : `You are a professional chef and recipe creator. Generate detailed, practical recipes that are easy to follow.
Always respond with valid JSON matching the exact schema provided.`;

  let userPrompt = prompt || 'Generate a delicious recipe';

  // Add web search directives for capable models
  if (isWebSearchModel && useWebSearch) {
    userPrompt = `Search the web for: ${userPrompt}\n\nPlease find authentic recipes from reputable culinary sources, famous chefs, or trending recipes.\nInclude nutritional information if available from reliable sources.`;
  }

  if (ingredients.length > 0) {
    userPrompt += `\nUse these ingredients: ${ingredients.join(', ')}`;
  }
  if (cuisine) {
    userPrompt += `\nCuisine type: ${cuisine}`;
  }
  if (mealType) {
    userPrompt += `\nMeal type: ${mealType}`;
  }
  if (dietaryRestrictions.length > 0) {
    userPrompt += `\nDietary restrictions: ${dietaryRestrictions.join(', ')}`;
  }
  if (servings) {
    userPrompt += `\nServings: ${servings}`;
  }
  if (difficulty) {
    userPrompt += `\nDifficulty level: ${difficulty}`;
  }

  userPrompt += `\n\nProvide the recipe in this JSON format:
{
  "name": "Recipe Name",
  "description": "Brief description of the dish",
  "ingredients": [
    "2 cups all-purpose flour",
    "1 tablespoon olive oil",
    "Salt, to taste",
    "Black pepper, to taste",
    "Fresh herbs, as needed"
  ],
  "instructions": ["Step 1", "Step 2"],
  "prepTime": 15, // in minutes
  "cookTime": 30, // in minutes
  "servings": 4,
  "difficulty": "easy", // easy, medium, or hard
  "cuisine": "Italian",
  "tags": ["vegetarian", "quick", "healthy"],
  "modelUsed": "${model}",
  "nutritionInfo": {
    "calories": 350,
    "protein": 20,
    "carbs": 45,
    "fat": 15,
    "fiber": 8
  },
  "source": "URL or chef name if from web search"
}

IMPORTANT: For ingredients without specific amounts, use qualifiers like:
- "Salt, to taste"
- "Black pepper, to taste"
- "Fresh herbs, as needed"
- "Garnish, optional"
Do NOT just list ingredient names without amounts or qualifiers.`;

  try {
    // Perplexity models don't support response_format parameter
    const completionParams: any = {
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: isWebSearchModel ? 0.5 : 0.7, // Lower temp for web search models
      max_tokens: 2000, // Increased for more detailed recipes
    };

    // Only add response_format for models that support it
    if (!model.includes('perplexity')) {
      completionParams.response_format = { type: 'json_object' };
    }

    const openrouter = getOpenRouterClient();
    const completion = await openrouter.chat.completions.create(completionParams);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No recipe generated');
    }

    const parsedRecipe = JSON.parse(content);
    // Ensure model used is recorded
    parsedRecipe.modelUsed = model;
    return GeneratedRecipeSchema.parse(parsedRecipe);
  } catch (error: any) {
    console.error('Error generating recipe:', error);
    console.error('Error details:', error.error);
    console.error('Error message:', error.message);
    throw new Error(`Failed to generate recipe: ${error.message || 'Unknown error'}`);
  }
}

export async function parseRecipeFromUrl(url: string): Promise<GeneratedRecipe> {
  const systemPrompt = `You are a recipe parser. Extract recipe information from the provided URL content.
Always respond with valid JSON matching the exact schema provided.`;

  const userPrompt = `Parse the recipe from this URL: ${url}

Extract and provide the recipe in this JSON format:
{
  "name": "Recipe Name",
  "description": "Brief description",
  "ingredients": [
    "2 cups all-purpose flour",
    "1 tablespoon olive oil",
    "Salt, to taste",
    "Black pepper, to taste"
  ],
  "instructions": ["Step 1", "Step 2"],
  "prepTime": 15, // in minutes
  "cookTime": 30, // in minutes
  "servings": 4,
  "difficulty": "easy", // easy, medium, or hard
  "cuisine": "Cuisine Type",
  "tags": ["tag1", "tag2"]
}

IMPORTANT: For seasonings without specific amounts, use qualifiers like "to taste", "as needed", or "optional".`;

  try {
    const openrouter = getOpenRouterClient();
    const completion = await openrouter.chat.completions.create({
      model: MODELS.LLAMA_3_8B,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3, // Lower temperature for more accurate parsing
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No recipe parsed');
    }

    const parsedRecipe = JSON.parse(content);
    return GeneratedRecipeSchema.parse(parsedRecipe);
  } catch (error) {
    console.error('Error parsing recipe:', error);
    throw new Error('Failed to parse recipe from URL');
  }
}
