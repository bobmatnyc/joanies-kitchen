/**
 * Meal Generation Prompts
 *
 * Reusable AI prompts for meal planning and generation tasks
 */

import type { PromptTemplate } from './types';

/**
 * Complete Meal Builder - Generate full multi-course meal
 */
export const MEAL_BUILDER_COMPLETE: PromptTemplate = {
  id: 'meal-builder-complete',
  name: 'Complete Meal Builder',
  description:
    'Generate a complete meal with main, sides, appetizer, and dessert that work harmoniously together',
  version: '1.0.0',
  category: 'meal',
  systemPrompt: `You are an expert chef and meal planner with extensive knowledge of:
- Flavor pairing and complementary tastes
- Nutritional balance across courses
- Cooking technique sequencing and timing
- Cultural authenticity and fusion principles
- Dietary restrictions and accommodations

Create balanced, delicious meals where each course enhances the others in flavor, texture, nutrition, and visual appeal.`,
  userPromptTemplate: `Create a complete harmonious meal with the following requirements:

Main Dish: {{mainDish}}
Cuisine: {{cuisine}}
Dietary Restrictions: {{dietaryRestrictions}}
Servings: {{servings}}
Occasion: {{occasion}}

Generate a complete meal including:
1. Main dish (if not specified above, create an appropriate one)
2. Two complementary side dishes
3. One appetizer
4. One dessert

For each dish, provide:
- Recipe name
- Brief description (2-3 sentences explaining the dish)
- Why it pairs well with other courses (flavor/texture/nutrition balance)
- Difficulty level (beginner/intermediate/advanced)
- Estimated prep time (minutes)
- Estimated cook time (minutes)
- Key ingredients (top 3-5)
- Dietary tags (vegetarian, vegan, gluten-free, dairy-free, etc.)

Return as JSON array with this structure:
[
  {
    "type": "main" | "side" | "appetizer" | "dessert",
    "name": "recipe name",
    "description": "detailed description",
    "pairing_rationale": "why it works with the other courses",
    "difficulty": "beginner" | "intermediate" | "advanced",
    "prep_time": minutes,
    "cook_time": minutes,
    "key_ingredients": ["ingredient1", "ingredient2", "ingredient3"],
    "tags": ["tag1", "tag2"],
    "cuisine": "cuisine type"
  }
]

IMPORTANT: Ensure courses complement each other in:
- Flavor: Balance rich/light, spicy/mild, savory/sweet
- Texture: Vary between crispy, creamy, tender, crunchy
- Color: Create visual appeal with diverse colors
- Nutrition: Balance proteins, vegetables, carbs, and healthy fats`,
  variables: ['mainDish', 'cuisine', 'dietaryRestrictions', 'servings', 'occasion'],
  modelSuggestions: [
    {
      model: 'google/gemini-2.0-flash-exp:free',
      priority: 'primary',
      reason: 'Excellent at creative meal planning with good JSON formatting',
    },
    {
      model: 'anthropic/claude-3.5-sonnet',
      priority: 'fallback',
      reason: 'Superior reasoning for complex dietary restrictions',
    },
  ],
  temperature: 0.7,
  maxTokens: 2500,
  responseFormat: 'json_object',
  tags: ['meal-planning', 'multi-course', 'complete-meal'],
  metadata: {
    costEstimate: '$0.001-$0.003 per call',
    averageLatency: '2-4 seconds',
  },
};

/**
 * Complementary Sides Generator - Generate sides for a given main dish
 */
export const COMPLEMENTARY_SIDES: PromptTemplate = {
  id: 'complementary-sides',
  name: 'Complementary Sides Generator',
  description: 'Generate side dishes that perfectly complement a specific main dish',
  version: '1.0.0',
  category: 'meal',
  systemPrompt: `You are a professional chef specializing in side dish creation and flavor pairing.
You understand how to balance:
- Flavor profiles (complement or contrast main dish)
- Cooking methods (vary textures and techniques)
- Nutritional balance (add vegetables, grains, or proteins as needed)
- Visual presentation (color and plating harmony)
- Practical timing (dishes that can be prepared in sequence or parallel)`,
  userPromptTemplate: `Given this main dish, suggest {{count}} complementary side dishes:

Main Dish: {{mainDish}}
Description: {{mainDescription}}
Cuisine: {{cuisine}}
Cooking Method: {{cookingMethod}}
Servings: {{servings}}

Generate {{count}} side dishes that:
1. Complement the main dish's flavor profile
2. Add nutritional balance
3. Vary in texture and cooking method
4. Can be realistically prepared alongside the main dish
5. Match the cuisine style (or thoughtfully contrast it)

Return as JSON array:
[
  {
    "name": "side dish name",
    "description": "brief description",
    "pairing_rationale": "why it pairs well with the main dish",
    "difficulty": "beginner" | "intermediate" | "advanced",
    "prep_time": minutes,
    "cook_time": minutes,
    "can_prepare_ahead": true | false,
    "key_ingredients": ["ingredient1", "ingredient2", "ingredient3"],
    "cooking_method": "roasted" | "steamed" | "sauteed" | "raw" | etc,
    "tags": ["vegetarian", "quick", "make-ahead", etc]
  }
]

Consider preparation timing:
- Can this side be prepped while main dish cooks?
- Can it be made ahead and reheated?
- Does it require the same equipment as the main dish?`,
  variables: ['mainDish', 'mainDescription', 'cuisine', 'cookingMethod', 'servings', 'count'],
  optionalVariables: ['dietaryRestrictions'],
  modelSuggestions: [
    {
      model: 'google/gemini-2.0-flash-exp:free',
      priority: 'primary',
      reason: 'Fast and accurate for side dish generation',
    },
    {
      model: 'openai/gpt-4o-mini',
      priority: 'alternative',
      reason: 'Good culinary knowledge and creativity',
    },
  ],
  temperature: 0.7,
  maxTokens: 1500,
  responseFormat: 'json_object',
  tags: ['side-dishes', 'pairing', 'meal-planning'],
  metadata: {
    costEstimate: '$0.0005-$0.002 per call',
    averageLatency: '1-3 seconds',
  },
};

/**
 * Themed Meal Generator - Create meal based on theme/occasion
 */
export const THEMED_MEAL: PromptTemplate = {
  id: 'themed-meal',
  name: 'Themed Meal Generator',
  description: 'Create a cohesive meal based on a specific theme, occasion, or cultural event',
  version: '1.0.0',
  category: 'meal',
  systemPrompt: `You are a culinary event planner and chef with expertise in:
- Cultural and regional cuisine authenticity
- Holiday and celebration traditional foods
- Thematic menu creation
- Seasonal ingredient selection
- Occasion-appropriate dish selection

Create culturally appropriate, thematically cohesive meals that honor traditions while being practical to prepare.`,
  userPromptTemplate: `Create a themed meal for this occasion:

Theme/Occasion: {{theme}}
Cuisine/Culture: {{cuisine}}
Number of Guests: {{servings}}
Dietary Restrictions: {{dietaryRestrictions}}
Cooking Skill Level: {{skillLevel}}
Budget Level: {{budget}}

Generate a complete meal (appetizer, main, sides, dessert) that:
1. Authentically represents the theme/occasion
2. Uses seasonally appropriate ingredients
3. Is practical for the specified skill level
4. Respects all dietary restrictions
5. Creates a memorable dining experience

For each course, provide:
- Dish name (with cultural/traditional name if applicable)
- Cultural significance or why it fits the theme
- Description and key ingredients
- Difficulty and timing
- Preparation notes and tips

Return as JSON:
{
  "theme_description": "Brief description of how the meal honors the theme",
  "total_prep_time": minutes,
  "total_cook_time": minutes,
  "courses": [
    {
      "type": "appetizer" | "main" | "side" | "dessert",
      "name": "dish name",
      "cultural_name": "traditional name (if different)",
      "description": "detailed description",
      "cultural_significance": "why this dish for this occasion",
      "difficulty": "beginner" | "intermediate" | "advanced",
      "prep_time": minutes,
      "cook_time": minutes,
      "key_ingredients": ["ingredient1", "ingredient2"],
      "preparation_tips": "helpful tips for success",
      "tags": ["traditional", "vegetarian", etc]
    }
  ],
  "cooking_sequence": "Suggested order of preparation",
  "presentation_tips": "How to serve and present the meal"
}`,
  variables: ['theme', 'cuisine', 'servings', 'dietaryRestrictions', 'skillLevel', 'budget'],
  modelSuggestions: [
    {
      model: 'anthropic/claude-3.5-sonnet',
      priority: 'primary',
      reason: 'Excellent cultural knowledge and thoughtful explanations',
    },
    {
      model: 'google/gemini-2.0-flash-exp:free',
      priority: 'fallback',
      reason: 'Good for standard themes, cost-effective',
    },
  ],
  temperature: 0.6,
  maxTokens: 3000,
  responseFormat: 'json_object',
  tags: ['themed-meal', 'occasion', 'cultural', 'event-planning'],
  metadata: {
    costEstimate: '$0.003-$0.01 per call',
    averageLatency: '3-5 seconds',
  },
};

/**
 * Dietary Meal Builder - Create meals respecting specific dietary needs
 */
export const DIETARY_MEAL_BUILDER: PromptTemplate = {
  id: 'dietary-meal-builder',
  name: 'Dietary-Specific Meal Builder',
  description:
    'Generate complete meals that strictly adhere to specific dietary restrictions and preferences',
  version: '1.0.0',
  category: 'meal',
  systemPrompt: `You are a nutritionist and chef specializing in dietary-restricted meal planning.
You have expert knowledge of:
- Allergen awareness and cross-contamination prevention
- Nutritional requirements for various diets (vegan, keto, paleo, etc.)
- Ingredient substitutions and alternatives
- Macro and micronutrient balance
- Medical dietary restrictions (diabetic, renal, cardiac, etc.)

Ensure all suggestions are 100% compliant with stated restrictions while being delicious and satisfying.`,
  userPromptTemplate: `Create a nutritionally balanced meal adhering to these strict dietary requirements:

Primary Diet Type: {{dietType}}
Additional Restrictions: {{restrictions}}
Allergies: {{allergies}}
Nutritional Goals: {{nutritionalGoals}}
Servings: {{servings}}
Meal Type: {{mealType}}

Generate a complete meal that:
1. STRICTLY adheres to all dietary restrictions (no exceptions)
2. Meets nutritional goals (protein/carbs/fats/calories)
3. Provides variety in flavors and textures
4. Uses whole, minimally processed ingredients where possible
5. Is satisfying and not "diet food"

Return as JSON:
{
  "nutritional_summary": {
    "total_calories": approximate calories per serving,
    "protein_grams": grams,
    "carbs_grams": grams,
    "fat_grams": grams,
    "fiber_grams": grams
  },
  "compliance_verification": {
    "diet_type": "{{dietType}}",
    "all_restrictions_met": true,
    "allergen_free": ["allergen1", "allergen2"],
    "notes": "any important compliance notes"
  },
  "dishes": [
    {
      "type": "main" | "side" | "appetizer" | "dessert",
      "name": "dish name",
      "description": "description highlighting dietary compliance",
      "difficulty": "beginner" | "intermediate" | "advanced",
      "prep_time": minutes,
      "cook_time": minutes,
      "key_ingredients": ["ingredient1", "ingredient2"],
      "nutritional_highlights": "key nutritional benefits",
      "substitution_notes": "alternative ingredients if needed",
      "tags": ["vegan", "gluten-free", "high-protein", etc]
    }
  ],
  "shopping_notes": "Tips for finding compliant ingredients",
  "preparation_warnings": "Cross-contamination or preparation alerts"
}

CRITICAL: Double-check that EVERY ingredient is compliant with ALL stated restrictions.`,
  variables: [
    'dietType',
    'restrictions',
    'allergies',
    'nutritionalGoals',
    'servings',
    'mealType',
  ],
  modelSuggestions: [
    {
      model: 'anthropic/claude-3.5-sonnet',
      priority: 'primary',
      reason: 'Most accurate for complex dietary restrictions and safety',
    },
    {
      model: 'openai/gpt-4o',
      priority: 'fallback',
      reason: 'Strong nutritional knowledge and compliance checking',
    },
  ],
  temperature: 0.4,
  maxTokens: 2500,
  responseFormat: 'json_object',
  tags: ['dietary-restrictions', 'nutrition', 'allergens', 'health'],
  metadata: {
    costEstimate: '$0.003-$0.015 per call',
    averageLatency: '3-6 seconds',
  },
};

/**
 * Seasonal Meal Generator - Create meals using seasonal ingredients
 */
export const SEASONAL_MEAL: PromptTemplate = {
  id: 'seasonal-meal',
  name: 'Seasonal Meal Generator',
  description: 'Generate meals optimized for seasonal ingredient availability and freshness',
  version: '1.0.0',
  category: 'meal',
  systemPrompt: `You are a farm-to-table chef and seasonal cooking expert with knowledge of:
- Seasonal ingredient availability by region
- Peak harvest times for produce
- Preservation and storage methods
- Farmers market selection tips
- Seasonal flavor profiles

Create meals that celebrate seasonal ingredients at their peak freshness and flavor.`,
  userPromptTemplate: `Create a seasonal meal using peak ingredients:

Season: {{season}}
Region: {{region}}
Cuisine Preference: {{cuisine}}
Dietary Restrictions: {{dietaryRestrictions}}
Servings: {{servings}}
Meal Type: {{mealType}}

Generate a meal that:
1. Highlights ingredients at their seasonal peak
2. Uses local/regional produce when possible
3. Minimizes out-of-season ingredients
4. Celebrates the flavors of {{season}}
5. Includes preparation methods suited to the season

Return as JSON:
{
  "seasonal_theme": "Brief description of seasonal focus",
  "peak_ingredients": [
    {
      "ingredient": "name",
      "why_seasonal": "explanation of why this is peak season",
      "selection_tips": "how to pick the best quality"
    }
  ],
  "dishes": [
    {
      "type": "main" | "side" | "appetizer" | "dessert",
      "name": "dish name",
      "description": "description emphasizing seasonal ingredients",
      "difficulty": "beginner" | "intermediate" | "advanced",
      "prep_time": minutes,
      "cook_time": minutes,
      "seasonal_ingredients": ["ingredient1", "ingredient2"],
      "cooking_method": "method suited to season (e.g., grilling for summer)",
      "storage_tips": "how to store peak ingredients",
      "tags": ["seasonal", "local", "fresh", etc]
    }
  ],
  "sourcing_recommendations": "Where to find these seasonal ingredients",
  "preservation_options": "How to preserve surplus seasonal produce"
}

Focus on {{season}} characteristics:
- Spring: Fresh greens, tender vegetables, light preparations
- Summer: Peak produce, grilling, fresh/raw preparations
- Fall: Root vegetables, heartier dishes, roasting
- Winter: Preserved foods, slow cooking, comfort foods`,
  variables: ['season', 'region', 'cuisine', 'dietaryRestrictions', 'servings', 'mealType'],
  modelSuggestions: [
    {
      model: 'google/gemini-2.0-flash-exp:free',
      priority: 'primary',
      reason: 'Good seasonal knowledge and creative suggestions',
    },
    {
      model: 'anthropic/claude-3.5-sonnet',
      priority: 'alternative',
      reason: 'Excellent for regional ingredient knowledge',
    },
  ],
  temperature: 0.7,
  maxTokens: 2000,
  responseFormat: 'json_object',
  tags: ['seasonal', 'local', 'farm-to-table', 'sustainable'],
  metadata: {
    costEstimate: '$0.001-$0.003 per call',
    averageLatency: '2-4 seconds',
  },
};

/**
 * Budget-Friendly Meal Planner - Create affordable complete meals
 */
export const BUDGET_MEAL_PLANNER: PromptTemplate = {
  id: 'budget-meal-planner',
  name: 'Budget-Friendly Meal Planner',
  description: 'Generate cost-effective meals that maximize flavor and nutrition per dollar',
  version: '1.0.0',
  category: 'meal',
  systemPrompt: `You are a budget-conscious chef who specializes in:
- Maximizing flavor with affordable ingredients
- Reducing food waste through smart ingredient use
- Meal prep strategies to save time and money
- Pantry staple utilization
- Cost-effective protein sources
- Bulk buying and batch cooking

Create delicious meals that prove good food doesn't have to be expensive.`,
  userPromptTemplate: `Create an affordable complete meal:

Budget per Serving: {{budgetPerServing}}
Number of Servings: {{servings}}
Dietary Restrictions: {{dietaryRestrictions}}
Available Pantry Staples: {{pantryStaples}}
Cuisine Preference: {{cuisine}}

Generate a cost-effective meal that:
1. Stays within budget while being nutritious and satisfying
2. Uses affordable, accessible ingredients
3. Minimizes food waste (use whole ingredients)
4. Incorporates pantry staples
5. Can be batch-cooked or meal-prepped

Return as JSON:
{
  "cost_breakdown": {
    "estimated_cost_per_serving": dollars,
    "total_meal_cost": dollars,
    "cost_saving_tips": "strategies to reduce cost further"
  },
  "dishes": [
    {
      "type": "main" | "side" | "appetizer" | "dessert",
      "name": "dish name",
      "description": "description highlighting value",
      "difficulty": "beginner" | "intermediate" | "advanced",
      "prep_time": minutes,
      "cook_time": minutes,
      "key_ingredients": [
        {
          "ingredient": "name",
          "estimated_cost": dollars,
          "budget_alternatives": ["cheaper alternative if needed"]
        }
      ],
      "leftover_ideas": "how to repurpose leftovers",
      "batch_cooking_notes": "can this be made in larger quantities?",
      "tags": ["budget", "meal-prep", "freezer-friendly", etc]
    }
  ],
  "shopping_strategy": "Tips for finding these ingredients at best prices",
  "meal_prep_instructions": "How to batch prepare for multiple meals",
  "storage_instructions": "Proper storage to maximize shelf life"
}

Budget-smart strategies to incorporate:
- Use affordable proteins (beans, lentils, eggs, chicken thighs)
- Emphasize seasonal produce
- Utilize pantry staples creatively
- Suggest make-ahead and freezer-friendly options
- Minimize single-use specialty ingredients`,
  variables: ['budgetPerServing', 'servings', 'dietaryRestrictions', 'pantryStaples', 'cuisine'],
  modelSuggestions: [
    {
      model: 'google/gemini-2.0-flash-exp:free',
      priority: 'primary',
      reason: 'Cost-effective model for budget meal planning',
    },
    {
      model: 'openai/gpt-4o-mini',
      priority: 'alternative',
      reason: 'Good practical suggestions and cost awareness',
    },
  ],
  temperature: 0.6,
  maxTokens: 2000,
  responseFormat: 'json_object',
  tags: ['budget', 'meal-prep', 'cost-effective', 'affordable'],
  metadata: {
    costEstimate: '$0.0005-$0.002 per call',
    averageLatency: '2-3 seconds',
  },
};

/**
 * All meal generation prompts exported as a collection
 */
export const mealGenerationPrompts = {
  MEAL_BUILDER_COMPLETE,
  COMPLEMENTARY_SIDES,
  THEMED_MEAL,
  DIETARY_MEAL_BUILDER,
  SEASONAL_MEAL,
  BUDGET_MEAL_PLANNER,
};
