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

/**
 * #300: what one extraction tier saw when it returned no viable recipe.
 * - `no_recipe`: it read the page and found no recipe schema, ingredients or instructions;
 * - `recipe_partial`: it saw a schema.org Recipe, or some ingredients or instructions;
 * - `empty`: it got no content, or too little to judge;
 * - `error`: the fetch or the LLM structuring step threw (network, HTTP status, rate limit).
 */
export type ExtractionTierResult = 'no_recipe' | 'recipe_partial' | 'empty' | 'error';

/** #300: one tier's miss, in the order the tiers ran. */
export interface ExtractionTierAttempt {
  tier: 'firecrawl' | 'jina' | 'tavily_extract';
  result: ExtractionTierResult;
}

/** #300: filled by `extractRecipe` with each configured tier that ran and missed. */
export interface ExtractionReport {
  attempts: ExtractionTierAttempt[];
}
