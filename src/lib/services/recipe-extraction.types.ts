/**
 * Recipe extraction types (#298: moved from recipe-extraction.service.ts).
 */

export interface ScrapedRecipe {
  url: string;
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  prep_time?: number;
  cook_time?: number;
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  cuisine?: string;
  tags: string[];
  image_url?: string;
  chef_name?: string;
  extraction_method: 'firecrawl' | 'jina' | 'tavily_extract' | 'claude_structured';
}

/**
 * Parsed recipe data from Firecrawl schema.org extraction
 */
export interface FirecrawlRecipeSchema {
  name?: string;
  title?: string;
  description?: string;
  recipeIngredient?: string[];
  ingredients?: string[];
  recipeInstructions?: Array<string | { text?: string; name?: string }>;
  instructions?: string[];
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeYield?: string | number;
  servings?: number;
  recipeCuisine?: string;
  recipeCategory?: string;
  keywords?: string | string[];
  image?: string | { url?: string };
  author?: string | { name?: string };
  difficulty?: string;
}
