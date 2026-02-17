/**
 * Recipe Transformers
 *
 * Transforms recipes from various sources to our database schema
 */

import { randomUUID } from 'node:crypto';

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
 * USDA Recipe Types
 */
export interface USDARecipe {
  name: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  nutrition?: {
    calories?: number;
    protein?: number;
    carbohydrates?: number;
    fat?: number;
    fiber?: number;
    sodium?: number;
  };
  sourceUrl: string;
  sourceName: string;
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

    if (ingredient?.trim()) {
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
      instructions = split.map((s) => s.trim()).filter((s) => s.length > 0);
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

/**
 * Tasty API Recipe Types
 */
export interface TastyRecipe {
  id: number;
  name: string;
  description: string;
  thumbnail_url?: string;
  thumbnail_alt_text?: string;
  video_url?: string;
  original_video_url?: string;
  keywords?: string;
  num_servings?: number;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  total_time_minutes?: number;
  credits?: Array<{
    name?: string;
    type?: string;
  }>;
  sections?: Array<{
    components?: Array<{
      raw_text?: string;
      ingredient?: {
        name?: string;
        display_singular?: string;
      };
      measurements?: Array<{
        quantity?: string;
        unit?: {
          name?: string;
          display_singular?: string;
        };
      }>;
    }>;
  }>;
  instructions?: Array<{
    display_text?: string;
    position?: number;
    start_time?: number;
    end_time?: number;
  }>;
  nutrition?: {
    calories?: number;
    fat?: number;
    carbohydrates?: number;
    protein?: number;
    fiber?: number;
    sugar?: number;
  };
  tags?: Array<{
    name?: string;
    display_name?: string;
    type?: string;
  }>;
  topics?: Array<{
    name?: string;
    slug?: string;
  }>;
  yields?: string;
  user_ratings?: {
    count_positive?: number;
    count_negative?: number;
    score?: number;
  };
}

/**
 * Transform Tasty recipe to our schema
 */
export function transformTastyRecipe(recipe: TastyRecipe, systemUserId: string) {
  // Extract ingredients from sections
  const ingredients: Array<{ item: string; quantity: string }> = [];
  if (recipe.sections) {
    for (const section of recipe.sections) {
      if (section.components) {
        for (const component of section.components) {
          if (component.raw_text) {
            ingredients.push({
              item: component.raw_text,
              quantity: '',
            });
          } else {
            // Build ingredient from structured data
            const ingredientName =
              component.ingredient?.name ||
              component.ingredient?.display_singular ||
              'Unknown ingredient';
            let quantity = '';

            if (component.measurements && component.measurements.length > 0) {
              const measurement = component.measurements[0];
              quantity =
                `${measurement.quantity || ''} ${measurement.unit?.display_singular || measurement.unit?.name || ''}`.trim();
            }

            ingredients.push({
              item: ingredientName,
              quantity,
            });
          }
        }
      }
    }
  }

  // Extract instructions and sort by position
  let instructions: string[] = [];
  if (recipe.instructions) {
    instructions = recipe.instructions
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map((inst) => inst.display_text || '')
      .filter((text) => text.length > 0);
  }

  // Build tags from Tasty tags and topics
  const tags: string[] = [];

  // Add source tag
  tags.push('source.tasty');

  // Process Tasty tags
  if (recipe.tags) {
    for (const tag of recipe.tags) {
      const tagName = tag.name || tag.display_name;
      if (!tagName) continue;

      const lowerTag = tagName.toLowerCase();

      // Map to our tag taxonomy
      if (lowerTag.includes('vegetarian')) tags.push('dietary.vegetarian');
      else if (lowerTag.includes('vegan')) tags.push('dietary.vegan');
      else if (lowerTag.includes('gluten')) tags.push('dietary.gluten-free');
      else if (lowerTag.includes('dairy')) tags.push('dietary.dairy-free');
      else if (lowerTag.includes('keto')) tags.push('dietary.keto');
      else if (lowerTag.includes('paleo')) tags.push('dietary.paleo');
      else if (lowerTag.includes('breakfast')) tags.push('meal-type.breakfast');
      else if (lowerTag.includes('lunch')) tags.push('meal-type.lunch');
      else if (lowerTag.includes('dinner')) tags.push('meal-type.dinner');
      else if (lowerTag.includes('dessert')) tags.push('meal-type.dessert');
      else if (lowerTag.includes('appetizer') || lowerTag.includes('starter'))
        tags.push('meal-type.appetizer');
      else if (lowerTag.includes('snack')) tags.push('meal-type.snack');
      else if (lowerTag.includes('under_30_minutes') || lowerTag.includes('quick'))
        tags.push('time.quick');
      else if (lowerTag.includes('easy')) tags.push('difficulty.easy');
      else if (lowerTag.includes('comfort_food')) tags.push('other.comfort-food');
      else if (lowerTag.includes('healthy')) tags.push('other.healthy');
      else tags.push(`other.${slugify(tagName)}`);
    }
  }

  // Process topics (cuisines and categories)
  if (recipe.topics) {
    for (const topic of recipe.topics) {
      const topicName = topic.name || topic.slug;
      if (!topicName) continue;

      const lowerTopic = topicName.toLowerCase();

      // Map to cuisine tags
      if (
        lowerTopic.includes('italian') ||
        lowerTopic.includes('mexican') ||
        lowerTopic.includes('chinese') ||
        lowerTopic.includes('japanese') ||
        lowerTopic.includes('thai') ||
        lowerTopic.includes('indian') ||
        lowerTopic.includes('french') ||
        lowerTopic.includes('american')
      ) {
        tags.push(`cuisine.${slugify(topicName)}`);
      } else {
        tags.push(`other.${slugify(topicName)}`);
      }
    }
  }

  // Add video tag if video URL exists
  if (recipe.video_url || recipe.original_video_url) {
    tags.push('media.video');
  }

  // Calculate difficulty based on prep time and number of instructions
  let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
  const totalTime = recipe.total_time_minutes || 0;
  const stepCount = instructions.length;

  if (totalTime <= 30 && stepCount <= 5) {
    difficulty = 'easy';
  } else if (totalTime >= 90 || stepCount >= 12) {
    difficulty = 'hard';
  }

  // Build nutrition info
  let nutritionInfo = null;
  if (recipe.nutrition) {
    nutritionInfo = JSON.stringify({
      calories: recipe.nutrition.calories || null,
      fat: recipe.nutrition.fat || null,
      carbohydrates: recipe.nutrition.carbohydrates || null,
      protein: recipe.nutrition.protein || null,
      fiber: recipe.nutrition.fiber || null,
      sugar: recipe.nutrition.sugar || null,
    });
  }

  // Get video URL (prefer video_url over original_video_url)
  const videoUrl = recipe.video_url || recipe.original_video_url || null;

  // Get image URL
  const imageUrl = recipe.thumbnail_url || null;

  // Generate description if not provided
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
    prep_time: recipe.prep_time_minutes || null,
    cook_time: recipe.cook_time_minutes || null,
    servings: recipe.num_servings || null,
    difficulty,
    image_url: imageUrl,
    images: imageUrl ? JSON.stringify([imageUrl]) : null,
    video_url: videoUrl, // NEW: Tasty's unique video URL
    tags: JSON.stringify(tags),
    nutrition_info: nutritionInfo,
    is_system_recipe: true,
    is_public: true,
    is_ai_generated: false,
    license: 'FAIR_USE' as const, // Tasty content used under fair use
    source: `Tasty (BuzzFeed) - ID: ${recipe.id}`,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

/**
 * Transform USDA recipe to our schema
 */
export function transformUSDARecipe(recipe: USDARecipe, systemUserId: string, sourceId: string) {
  // Format ingredients as array of objects with item and quantity
  const ingredients = recipe.ingredients.map((ing) => {
    // USDA ingredients are typically already formatted with measurements
    return { item: ing, quantity: '' };
  });

  // Build tags
  const tags: string[] = ['source.usda', 'license.public-domain'];

  // Add government/educational tag
  tags.push('source.government');

  // Add nutrition-verified tag if nutrition data is present
  if (recipe.nutrition && Object.keys(recipe.nutrition).length > 0) {
    tags.push('quality.nutrition-verified');
  }

  // Generate description if not provided
  const description =
    recipe.description ||
    (recipe.instructions.length > 0
      ? recipe.instructions[0].substring(0, 200) +
        (recipe.instructions[0].length > 200 ? '...' : '')
      : `Recipe from ${recipe.sourceName}`);

  return {
    id: randomUUID(),
    user_id: systemUserId,
    source_id: sourceId,
    name: recipe.name,
    slug: slugify(recipe.name),
    description,
    ingredients: JSON.stringify(ingredients),
    instructions: JSON.stringify(recipe.instructions),
    prep_time: recipe.prepTime || null,
    cook_time: recipe.cookTime || null,
    servings: recipe.servings || null,
    nutrition_info: recipe.nutrition ? JSON.stringify(recipe.nutrition) : null,
    cuisine: null, // USDA recipes typically don't specify cuisine
    tags: JSON.stringify(tags),
    is_system_recipe: true,
    is_public: true,
    is_ai_generated: false,
    license: 'PUBLIC_DOMAIN' as const,
    source: recipe.sourceUrl,
    created_at: new Date(),
    updated_at: new Date(),
  };
}
