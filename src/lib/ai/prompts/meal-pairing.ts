/**
 * Meal Pairing Prompts
 *
 * AI prompts for sophisticated multi-course meal planning using flavor science,
 * cultural traditions, and practical cooking wisdom.
 *
 * @version 1.0.0
 * @category meal
 */

import type { PromptTemplate } from './types';

/**
 * Core meal pairing system prompt
 * Uses flavor science and practical heuristics for balanced meal creation
 */
const MEAL_PAIRING_SYSTEM_PROMPT = `You are Joanie's Kitchen meal planning assistant. You create balanced, delicious multi-course meals using flavor science, cultural traditions, and practical cooking wisdom.

CORE PAIRING PRINCIPLES:

1. WEIGHT MATCHING (1-5 scale)
   - Heavy mains (4-5) → Light sides/apps (1-2)
   - Medium mains (3) → Light-medium sides (2-3)
   - Light mains (1-2) → Light sides (1-3)

2. ACID-FAT BALANCE
   - Rich/fatty dishes REQUIRE acidic components
   - Rule: side_acidity >= main_richness - 1

3. TEXTURE CONTRAST (minimum 6 unique textures per meal)
   - Never serve consecutive courses with identical texture
   - Layer opposites: crispy/creamy, crunchy/soft, flaky/smooth

4. TEMPERATURE PROGRESSION
   - Classic: Hot → Cold → Hot → Cold
   - Alternation prevents sensory fatigue

5. FLAVOR INTENSITY MATCHING
   - Match within 1-2 points on 1-5 scale
   - Delicate with delicate, bold with bold
   - Exception: palate cleansers after rich courses

6. CULTURAL COHERENCE
   - Western cuisines: prefer shared flavor compounds
   - East Asian: embrace contrasting flavor profiles
   - Match regional pairing traditions when cuisine specified

7. NUTRITIONAL BALANCE
   - Target: 40% carbs, 30% protein, 30% fats across full meal
   - Minimum 10g fiber across courses
   - Distribute protein: appetizer 15%, main 65%, side 20%

8. COLOR VARIETY
   - Minimum 3 distinct colors per course
   - Avoid monochromatic plates (all beige/brown)

DATABASE INTEGRATION:
- Use semantic search results to find compatible recipes
- Consider ingredient co-occurrence patterns
- Respect seasonal alignment when available
- Prioritize recipes with complementary cooking methods`;

/**
 * Prompt: Generate meal plan from cuisine
 */
export const generateMealByCuisine: PromptTemplate = {
  id: 'meal-pairing-by-cuisine',
  name: 'Cuisine-Based Meal Pairing',
  description: 'Create a complete multi-course meal based on a specific cuisine',
  version: '1.0.0',
  category: 'meal',
  systemPrompt: MEAL_PAIRING_SYSTEM_PROMPT,
  userPromptTemplate: `Create a complete {{cuisine}} meal with appetizer, main course, side dish, and dessert.

CUISINE CONTEXT: {{cuisine}}
Apply appropriate cultural pairing traditions for this cuisine.

CONSTRAINTS:
- Dietary restrictions: {{dietaryRestrictions}}
- Maximum total prep time: {{timeLimit}} minutes
- Servings: {{servings}}
{{databaseContext}}

OUTPUT FORMAT (JSON):
{
  "appetizer": {
    "name": "",
    "description": "",
    "weight_score": 1-5,
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "pairing_rationale": "Why this starts the meal well"
  },
  "main": {
    "name": "",
    "description": "",
    "weight_score": 1-5,
    "richness_score": 1-5,
    "dominant_flavors": [],
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "cuisine_influence": ""
  },
  "side": {
    "name": "",
    "description": "",
    "weight_score": 1-5,
    "acidity_score": 1-5,
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "pairing_rationale": "How this balances the main"
  },
  "dessert": {
    "name": "",
    "description": "",
    "sweetness_level": "light|moderate|rich",
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "pairing_rationale": "Why this concludes the meal"
  },
  "meal_analysis": {
    "total_prep_time": 0,
    "texture_variety_count": 0,
    "color_palette": [],
    "temperature_progression": [],
    "cultural_coherence": "",
    "estimated_macros": {
      "carbs_percent": 0,
      "protein_percent": 0,
      "fat_percent": 0
    },
    "chef_notes": "Overall meal philosophy and any special considerations"
  }
}

CRITICAL: Respond ONLY with valid JSON. No markdown, no backticks, no explanatory text.`,
  variables: ['cuisine', 'dietaryRestrictions', 'timeLimit', 'servings'],
  optionalVariables: ['databaseContext'],
  modelSuggestions: [
    {
      model: 'google/gemini-2.0-flash-exp:free',
      priority: 'primary',
      reason: 'Excellent at structured JSON output, fast, free tier available',
    },
    {
      model: 'anthropic/claude-3.5-sonnet',
      priority: 'alternative',
      reason: 'Superior reasoning for complex pairing logic',
    },
    {
      model: 'openai/gpt-4o',
      priority: 'fallback',
      reason: 'Reliable fallback with good culinary knowledge',
    },
  ],
  temperature: 0.7,
  maxTokens: 3000,
  responseFormat: 'json_object',
  tags: ['meal-planning', 'cuisine', 'multi-course', 'pairing'],
  metadata: {
    costEstimate: '$0.0001-$0.001 per call (free with Gemini)',
    averageLatency: '2-4 seconds',
    author: 'Recipe Manager Team',
    lastUpdated: '2025-01-19',
  },
};

/**
 * Prompt: Generate meal plan from main dish
 */
export const generateMealFromMainDish: PromptTemplate = {
  id: 'meal-pairing-from-main',
  name: 'Main-First Meal Pairing',
  description: 'Create complementary courses around a specified main dish',
  version: '1.0.0',
  category: 'meal',
  systemPrompt: MEAL_PAIRING_SYSTEM_PROMPT,
  userPromptTemplate: `Given this main dish, create complementary appetizer, side dish, and dessert:

MAIN DISH: {{mainDish}}

ANALYSIS REQUIRED:
1. Identify main dish weight/richness (1-5)
2. Determine dominant flavors and textures
3. Assess fat content and acidity needs
4. Note cultural cuisine context

PAIRING STRATEGY:
- Appetizer should stimulate appetite (light, acidic, or hot)
- Side should balance main's richness and provide texture contrast
- Dessert should provide sweet closure without overwhelming

CONSTRAINTS:
- Dietary restrictions: {{dietaryRestrictions}}
- Available ingredients to prioritize: {{availableIngredients}}
- Maximum total prep time: {{timeLimit}} minutes
- Servings: {{servings}}
{{databaseContext}}

OUTPUT FORMAT (JSON):
{
  "appetizer": {
    "name": "",
    "description": "",
    "weight_score": 1-5,
    "acidity_score": 1-5,
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "pairing_rationale": "Why this starts the meal well"
  },
  "main": {
    "name": "{{mainDish}}",
    "description": "",
    "weight_score": 1-5,
    "richness_score": 1-5,
    "dominant_flavors": [],
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "cuisine_influence": ""
  },
  "side": {
    "name": "",
    "description": "",
    "weight_score": 1-5,
    "acidity_score": 1-5,
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "pairing_rationale": "How this balances the main"
  },
  "dessert": {
    "name": "",
    "description": "",
    "sweetness_level": "light|moderate|rich",
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "pairing_rationale": "Why this concludes the meal"
  },
  "meal_analysis": {
    "total_prep_time": 0,
    "texture_variety_count": 0,
    "color_palette": [],
    "temperature_progression": [],
    "cultural_coherence": "",
    "estimated_macros": {
      "carbs_percent": 0,
      "protein_percent": 0,
      "fat_percent": 0
    },
    "chef_notes": "Overall meal philosophy and any special considerations"
  }
}

CRITICAL: Respond ONLY with valid JSON. No markdown, no backticks, no explanatory text.`,
  variables: ['mainDish', 'dietaryRestrictions', 'timeLimit', 'servings'],
  optionalVariables: ['availableIngredients', 'databaseContext'],
  modelSuggestions: [
    {
      model: 'google/gemini-2.0-flash-exp:free',
      priority: 'primary',
      reason: 'Excellent at structured JSON output, fast, free tier available',
    },
    {
      model: 'anthropic/claude-3.5-sonnet',
      priority: 'alternative',
      reason: 'Superior reasoning for complex pairing logic',
    },
  ],
  temperature: 0.7,
  maxTokens: 3000,
  responseFormat: 'json_object',
  tags: ['meal-planning', 'main-dish', 'pairing', 'complementary'],
  metadata: {
    costEstimate: '$0.0001-$0.001 per call (free with Gemini)',
    averageLatency: '2-4 seconds',
    author: 'Recipe Manager Team',
    lastUpdated: '2025-01-19',
  },
};

/**
 * Prompt: Generate meal plan from theme
 */
export const generateMealByTheme: PromptTemplate = {
  id: 'meal-pairing-by-theme',
  name: 'Theme-Based Meal Pairing',
  description: 'Create a cohesive multi-course meal based on a theme or occasion',
  version: '1.0.0',
  category: 'meal',
  systemPrompt: MEAL_PAIRING_SYSTEM_PROMPT,
  userPromptTemplate: `Create a complete meal for the theme: "{{theme}}"
Include appetizer, main course, side dish, and dessert that cohesively express this theme.

THEME INTERPRETATION:
- Consider seasonal associations
- Apply appropriate formality level
- Match occasion expectations

CONSTRAINTS:
- Dietary restrictions: {{dietaryRestrictions}}
- Maximum total prep time: {{timeLimit}} minutes
- Servings: {{servings}}
{{databaseContext}}

OUTPUT FORMAT (JSON):
{
  "appetizer": {
    "name": "",
    "description": "",
    "weight_score": 1-5,
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "pairing_rationale": "How this fits the theme"
  },
  "main": {
    "name": "",
    "description": "",
    "weight_score": 1-5,
    "richness_score": 1-5,
    "dominant_flavors": [],
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "cuisine_influence": ""
  },
  "side": {
    "name": "",
    "description": "",
    "weight_score": 1-5,
    "acidity_score": 1-5,
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "pairing_rationale": "How this balances the main"
  },
  "dessert": {
    "name": "",
    "description": "",
    "sweetness_level": "light|moderate|rich",
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "pairing_rationale": "How this concludes the themed meal"
  },
  "meal_analysis": {
    "total_prep_time": 0,
    "texture_variety_count": 0,
    "color_palette": [],
    "temperature_progression": [],
    "cultural_coherence": "",
    "estimated_macros": {
      "carbs_percent": 0,
      "protein_percent": 0,
      "fat_percent": 0
    },
    "chef_notes": "How the meal expresses the theme"
  }
}

CRITICAL: Respond ONLY with valid JSON. No markdown, no backticks, no explanatory text.`,
  variables: ['theme', 'dietaryRestrictions', 'timeLimit', 'servings'],
  optionalVariables: ['databaseContext'],
  modelSuggestions: [
    {
      model: 'google/gemini-2.0-flash-exp:free',
      priority: 'primary',
      reason: 'Creative theme interpretation with reliable JSON output',
    },
    {
      model: 'anthropic/claude-3.5-sonnet',
      priority: 'alternative',
      reason: 'Excellent at thematic coherence and creative pairing',
    },
  ],
  temperature: 0.8,
  maxTokens: 3000,
  responseFormat: 'json_object',
  tags: ['meal-planning', 'theme', 'occasion', 'creative'],
  metadata: {
    costEstimate: '$0.0001-$0.001 per call (free with Gemini)',
    averageLatency: '2-4 seconds',
    author: 'Recipe Manager Team',
    lastUpdated: '2025-01-19',
  },
};

/**
 * Prompt: Freestyle meal generation
 */
export const generateFreestyleMeal: PromptTemplate = {
  id: 'meal-pairing-freestyle',
  name: 'Freestyle Meal Pairing',
  description: 'Create a balanced multi-course meal with creative freedom',
  version: '1.0.0',
  category: 'meal',
  systemPrompt: MEAL_PAIRING_SYSTEM_PROMPT,
  userPromptTemplate: `Create a balanced, delicious multi-course meal (appetizer, main, side, dessert).

CREATIVE BRIEF:
- Showcase seasonal ingredients when possible
- Balance familiar with unexpected
- Ensure technical feasibility for home cooks

CONSTRAINTS:
- Dietary restrictions: {{dietaryRestrictions}}
- Available ingredients to prioritize: {{availableIngredients}}
- Maximum total prep time: {{timeLimit}} minutes
- Servings: {{servings}}
{{databaseContext}}

OUTPUT FORMAT (JSON):
{
  "appetizer": {
    "name": "",
    "description": "",
    "weight_score": 1-5,
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "pairing_rationale": "Why this starts the meal well"
  },
  "main": {
    "name": "",
    "description": "",
    "weight_score": 1-5,
    "richness_score": 1-5,
    "dominant_flavors": [],
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "cuisine_influence": ""
  },
  "side": {
    "name": "",
    "description": "",
    "weight_score": 1-5,
    "acidity_score": 1-5,
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "pairing_rationale": "How this balances the main"
  },
  "dessert": {
    "name": "",
    "description": "",
    "sweetness_level": "light|moderate|rich",
    "dominant_textures": [],
    "temperature": "hot|cold|room",
    "prep_time_minutes": 0,
    "key_ingredients": [],
    "pairing_rationale": "Why this concludes the meal"
  },
  "meal_analysis": {
    "total_prep_time": 0,
    "texture_variety_count": 0,
    "color_palette": [],
    "temperature_progression": [],
    "cultural_coherence": "",
    "estimated_macros": {
      "carbs_percent": 0,
      "protein_percent": 0,
      "fat_percent": 0
    },
    "chef_notes": "Overall meal philosophy and any special considerations"
  }
}

CRITICAL: Respond ONLY with valid JSON. No markdown, no backticks, no explanatory text.`,
  variables: ['dietaryRestrictions', 'timeLimit', 'servings'],
  optionalVariables: ['availableIngredients', 'databaseContext'],
  modelSuggestions: [
    {
      model: 'google/gemini-2.0-flash-exp:free',
      priority: 'primary',
      reason: 'Creative and reliable, free tier available',
    },
    {
      model: 'anthropic/claude-3.5-sonnet',
      priority: 'alternative',
      reason: 'Excellent creative culinary reasoning',
    },
  ],
  temperature: 0.8,
  maxTokens: 3000,
  responseFormat: 'json_object',
  tags: ['meal-planning', 'creative', 'freestyle', 'balanced'],
  metadata: {
    costEstimate: '$0.0001-$0.001 per call (free with Gemini)',
    averageLatency: '2-4 seconds',
    author: 'Recipe Manager Team',
    lastUpdated: '2025-01-19',
  },
};

/**
 * Export all meal pairing prompts
 */
export const mealPairingPrompts = {
  generateMealByCuisine,
  generateMealFromMainDish,
  generateMealByTheme,
  generateFreestyleMeal,
};

/**
 * Export the system prompt for direct use
 */
export { MEAL_PAIRING_SYSTEM_PROMPT };
