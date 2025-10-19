/**
 * Recipe Transformers
 *
 * Transforms recipes from various sources to our database schema
 */

import { randomUUID } from 'crypto';

/**
 * Create SEO-friendly slug from recipe name
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * TheMealDB API Response Types
 */
export interface TheMealDBRecipe {
  idMeal: string;
  strMeal: string;
  strCategory: string;
  strArea: string;
  strInstructions: string;
  strMealThumb: string;
  strYoutube?: string;
  strTags?: string;
  [key: `strIngredient${number}`]: string | null;
  [key: `strMeasure${number}`]: string | null;
}

/**
 * Open Recipe DB Types
 */
export interface OpenRecipeDBRecipe {
  id: string;
  name: string;
  description?: string;
  ingredients?: Array<{ item: string; quantity?: string }> | string[];
  instructions?: string | string[];
  prep_time?: number;
  cook_time?: number;
  total_time?: number;
  servings?: number;
  cuisine?: string;
  category?: string;
  tags?: string[];
  image?: string;
  images?: string[];
  source_url?: string;
  author?: string;
}

/**
 * Cuisine mapping for TheMealDB
 */
const CUISINE_MAP: Record<string, string> = {
  American: 'cuisine.american',
  British: 'cuisine.british',
  Canadian: 'cuisine.canadian',
  Chinese: 'cuisine.chinese',
  Croatian: 'cuisine.croatian',
  Dutch: 'cuisine.dutch',
  Egyptian: 'cuisine.egyptian',
  Filipino: 'cuisine.filipino',
  French: 'cuisine.french',
  Greek: 'cuisine.greek',
  Indian: 'cuisine.indian',
  Irish: 'cuisine.irish',
  Italian: 'cuisine.italian',
  Jamaican: 'cuisine.jamaican',
  Japanese: 'cuisine.japanese',
  Kenyan: 'cuisine.kenyan',
  Malaysian: 'cuisine.malaysian',
  Mexican: 'cuisine.mexican',
  Moroccan: 'cuisine.moroccan',
  Polish: 'cuisine.polish',
  Portuguese: 'cuisine.portuguese',
  Russian: 'cuisine.russian',
  Spanish: 'cuisine.spanish',
  Thai: 'cuisine.thai',
  Tunisian: 'cuisine.tunisian',
  Turkish: 'cuisine.turkish',
  Ukrainian: 'cuisine.ukrainian',
  Vietnamese: 'cuisine.vietnamese',
};

/**
 * Category/meal type mapping for TheMealDB
 */
const CATEGORY_MAP: Record<string, string> = {
  Beef: 'main-ingredient.beef',
  Chicken: 'main-ingredient.chicken',
  Dessert: 'meal-type.dessert',
  Lamb: 'main-ingredient.lamb',
  Miscellaneous: 'other',
  Pasta: 'main-ingredient.pasta',
  Pork: 'main-ingredient.pork',
  Seafood: 'main-ingredient.seafood',
  Side: 'meal-type.side',
  Starter: 'meal-type.appetizer',
  Vegan: 'dietary.vegan',
  Vegetarian: 'dietary.vegetarian',
  Breakfast: 'meal-type.breakfast',
  Goat: 'main-ingredient.goat',
};

/**
 * Transform TheMealDB recipe to our schema
 */
export function transformTheMealDBRecipe(meal: TheMealDBRecipe, systemUserId: string) {
  // Extract ingredients and measures
  const ingredients: Array<{ item: string; quantity: string }> = [];
  for (let i = 1; i <= 20; i++) {
    const ingredient = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];

    if (ingredient && ingredient.trim()) {
      ingredients.push({
        item: ingredient.trim(),
        quantity: measure?.trim() || '',
      });
    }
  }

  // Parse instructions - split by newlines or numbered steps
  let instructions: string[] = [];
  if (meal.strInstructions) {
    // Try to split by STEP or numbered steps first
    const stepPattern = /(?:STEP \d+|^\d+\.|\r?\n\r?\n)/gi;
    const split = meal.strInstructions.split(stepPattern);

    if (split.length > 1) {
      instructions = split
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else {
      // Fallback: split by newlines
      instructions = meal.strInstructions
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s !== '.' && s !== ',');
    }
  }

  // Build tags
  const tags: string[] = [];

  // Add cuisine tag
  if (meal.strArea) {
    tags.push(CUISINE_MAP[meal.strArea] || `cuisine.${slugify(meal.strArea)}`);
  }

  // Add category tag
  if (meal.strCategory) {
    tags.push(CATEGORY_MAP[meal.strCategory] || `meal-type.${slugify(meal.strCategory)}`);
  }

  // Add individual tags from strTags
  if (meal.strTags) {
    const recipeTags = meal.strTags.split(',').map((t) => t.trim().toLowerCase());
    recipeTags.forEach((tag) => {
      if (tag === 'vegan') tags.push('dietary.vegan');
      else if (tag === 'vegetarian') tags.push('dietary.vegetarian');
      else if (tag === 'pasta') tags.push('main-ingredient.pasta');
      else if (tag === 'breakfast') tags.push('meal-type.breakfast');
      else if (tag === 'cake') tags.push('meal-type.dessert');
      else if (tag === 'baking') tags.push('cooking-method.baked');
      else if (tag === 'spicy') tags.push('flavor.spicy');
      else tags.push(`other.${slugify(tag)}`);
    });
  }

  // Generate description from instructions if not available
  const description =
    instructions.length > 0
      ? instructions[0].substring(0, 200) + (instructions[0].length > 200 ? '...' : '')
      : `${meal.strArea || ''} ${meal.strCategory || ''} recipe`.trim();

  return {
    id: randomUUID(),
    user_id: systemUserId,
    name: meal.strMeal,
    slug: slugify(meal.strMeal),
    description,
    ingredients: JSON.stringify(ingredients),
    instructions: JSON.stringify(instructions),
    image_url: meal.strMealThumb,
    images: JSON.stringify([meal.strMealThumb]),
    cuisine: meal.strArea || null,
    tags: JSON.stringify(tags),
    is_system_recipe: true,
    is_public: true,
    is_ai_generated: false,
    source: `TheMealDB (ID: ${meal.idMeal})`,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

/**
 * Calculate quality score for Open Recipe DB recipe
 */
export function calculateQualityScore(recipe: OpenRecipeDBRecipe): number {
  let score = 0;

  // Has complete instructions (not just list)
  const instructions = Array.isArray(recipe.instructions)
    ? recipe.instructions.join(' ')
    : recipe.instructions || '';

  if (instructions.length > 100) {
    score += 30;
  }

  // Has timing information
  if (recipe.prep_time && recipe.cook_time) {
    score += 20;
  } else if (recipe.total_time || recipe.prep_time || recipe.cook_time) {
    score += 10;
  }

  // Has sufficient ingredients
  const ingredientCount = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0;
  if (ingredientCount >= 5) {
    score += 15;
  } else if (ingredientCount >= 3) {
    score += 10;
  }

  // Has detailed steps
  const steps = Array.isArray(recipe.instructions)
    ? recipe.instructions
    : instructions.split(/\n|\./).filter((s) => s.trim());

  if (steps.length >= 3) {
    score += 20;
  } else if (steps.length >= 2) {
    score += 10;
  }

  // Has cuisine/category
  if (recipe.cuisine || recipe.category) {
    score += 10;
  }

  // Has image
  if (recipe.image || (recipe.images && recipe.images.length > 0)) {
    score += 5;
  }

  return score;
}

/**
 * Transform Open Recipe DB recipe to our schema
 */
export function transformOpenRecipeDBRecipe(
  recipe: OpenRecipeDBRecipe,
  systemUserId: string,
  qualityThreshold = 70
) {
  // Calculate quality score
  const qualityScore = calculateQualityScore(recipe);

  // Filter out low-quality recipes
  if (qualityScore < qualityThreshold) {
    return null;
  }

  // Normalize ingredients
  let ingredients: Array<{ item: string; quantity: string }> = [];
  if (Array.isArray(recipe.ingredients)) {
    if (recipe.ingredients.length > 0) {
      if (typeof recipe.ingredients[0] === 'string') {
        // String array format
        ingredients = (recipe.ingredients as string[]).map((ing) => ({
          item: ing,
          quantity: '',
        }));
      } else {
        // Object array format
        ingredients = (recipe.ingredients as Array<{ item: string; quantity?: string }>).map(
          (ing) => ({
            item: ing.item,
            quantity: ing.quantity || '',
          })
        );
      }
    }
  }

  // Normalize instructions
  let instructions: string[] = [];
  if (Array.isArray(recipe.instructions)) {
    instructions = recipe.instructions;
  } else if (typeof recipe.instructions === 'string') {
    instructions = recipe.instructions
      .split(/\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  // Build tags
  const tags: string[] = [];

  if (recipe.cuisine) {
    tags.push(CUISINE_MAP[recipe.cuisine] || `cuisine.${slugify(recipe.cuisine)}`);
  }

  if (recipe.category) {
    tags.push(CATEGORY_MAP[recipe.category] || `meal-type.${slugify(recipe.category)}`);
  }

  if (recipe.tags && Array.isArray(recipe.tags)) {
    recipe.tags.forEach((tag) => {
      tags.push(`other.${slugify(tag)}`);
    });
  }

  // Get images
  const images: string[] = [];
  if (recipe.image) {
    images.push(recipe.image);
  } else if (recipe.images && recipe.images.length > 0) {
    images.push(...recipe.images.slice(0, 6)); // Max 6 images
  }

  // Generate description
  const description =
    recipe.description ||
    (instructions.length > 0
      ? instructions[0].substring(0, 200) + (instructions[0].length > 200 ? '...' : '')
      : '');

  return {
    id: randomUUID(),
    user_id: systemUserId,
    name: recipe.name,
    slug: slugify(recipe.name),
    description,
    ingredients: JSON.stringify(ingredients),
    instructions: JSON.stringify(instructions),
    prep_time: recipe.prep_time || null,
    cook_time: recipe.cook_time || null,
    servings: recipe.servings || null,
    image_url: images[0] || null,
    images: images.length > 0 ? JSON.stringify(images) : null,
    cuisine: recipe.cuisine || null,
    tags: JSON.stringify(tags),
    is_system_recipe: true,
    is_public: true,
    is_ai_generated: false,
    source: recipe.source_url || `Open Recipe DB (ID: ${recipe.id})`,
    created_at: new Date(),
    updated_at: new Date(),
  };
}
