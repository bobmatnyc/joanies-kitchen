/**
 * Nutritional Estimation Prompts
 *
 * Reusable AI prompts for nutritional analysis and dietary recommendations
 */

import type { PromptTemplate } from './types';

/**
 * Comprehensive Nutrition Calculator - Estimate complete nutritional profile
 */
export const COMPREHENSIVE_NUTRITION_CALCULATOR: PromptTemplate = {
  id: 'comprehensive-nutrition-calculator',
  name: 'Comprehensive Nutrition Calculator',
  description: 'Estimate detailed nutritional information for a recipe including macros, micros, and dietary flags',
  version: '1.0.0',
  category: 'nutrition',
  systemPrompt: `You are a registered dietitian and nutritionist with expertise in:
- Macronutrient calculation and food composition
- Micronutrient content of ingredients
- Dietary restriction identification
- Allergen detection
- Nutritional density assessment
- USDA FoodData Central database knowledge

Provide accurate, research-based nutritional estimates with appropriate disclaimers.`,
  userPromptTemplate: `Calculate comprehensive nutritional information for this recipe:

Recipe Name: {{recipeName}}
Servings: {{servings}}
Ingredients with Quantities: {{ingredients}}

Provide per-serving estimates for:
1. Macronutrients (calories, protein, carbs, fat, fiber, sugar)
2. Key micronutrients (vitamins, minerals)
3. Dietary flags (vegan, gluten-free, dairy-free, etc.)
4. Allergen warnings
5. Nutritional highlights and concerns

Return as JSON:
{
  "serving_size": "description of one serving",
  "servings": {{servings}},
  "macronutrients": {
    "calories": number,
    "protein_g": number,
    "carbohydrates_g": number,
    "fiber_g": number,
    "sugar_g": number,
    "total_fat_g": number,
    "saturated_fat_g": number,
    "trans_fat_g": number,
    "cholesterol_mg": number,
    "sodium_mg": number
  },
  "micronutrients": {
    "vitamin_a_mcg": number,
    "vitamin_c_mg": number,
    "vitamin_d_mcg": number,
    "calcium_mg": number,
    "iron_mg": number,
    "potassium_mg": number
  },
  "dietary_flags": {
    "vegetarian": true | false,
    "vegan": true | false,
    "gluten_free": true | false,
    "dairy_free": true | false,
    "nut_free": true | false,
    "egg_free": true | false,
    "soy_free": true | false,
    "low_carb": true | false,
    "keto_friendly": true | false,
    "paleo": true | false
  },
  "allergens": [
    "list of common allergens present: dairy, eggs, fish, shellfish, tree nuts, peanuts, wheat, soy"
  ],
  "nutritional_highlights": [
    "positive nutritional aspects (e.g., high protein, good source of fiber)"
  ],
  "nutritional_concerns": [
    "potential concerns (e.g., high sodium, high saturated fat)"
  ],
  "confidence": {
    "overall": 0.0-1.0,
    "notes": "explanation of estimation accuracy and limitations"
  },
  "disclaimer": "Standard disclaimer about estimates vs. precise measurements"
}

Estimation approach:
- Use USDA FoodData Central values as reference
- Account for cooking losses (water, fat reduction, etc.)
- Consider bioavailability of nutrients
- Note when ingredients have high variability
- Be conservative with estimates when uncertain`,
  variables: ['recipeName', 'servings', 'ingredients'],
  optionalVariables: ['cookingMethod', 'prepMethod'],
  modelSuggestions: [
    {
      model: 'anthropic/claude-3.5-sonnet',
      priority: 'primary',
      reason: 'Most accurate for detailed nutritional calculations',
    },
    {
      model: 'openai/gpt-4o',
      priority: 'fallback',
      reason: 'Strong nutritional database knowledge',
    },
  ],
  temperature: 0.2,
  maxTokens: 2000,
  responseFormat: 'json_object',
  tags: ['nutrition', 'macros', 'allergens', 'dietary-flags'],
  metadata: {
    costEstimate: '$0.003-$0.015 per call',
    averageLatency: '3-5 seconds',
  },
};

/**
 * Healthier Substitution Suggester - Suggest healthier ingredient swaps
 */
export const HEALTHIER_SUBSTITUTION_SUGGESTER: PromptTemplate = {
  id: 'healthier-substitution-suggester',
  name: 'Healthier Substitution Suggester',
  description: 'Suggest healthier ingredient substitutions that maintain flavor and texture',
  version: '1.0.0',
  category: 'nutrition',
  systemPrompt: `You are a nutritionist and chef who specializes in healthy cooking modifications.
You understand:
- Ingredient functionality in recipes (binding, moisture, structure, flavor)
- Health impact of different ingredients
- Practical substitutions that actually work
- Trade-offs between health and taste/texture
- When substitutions don't work well

Suggest realistic, practical swaps that improve nutrition without ruining the dish.`,
  userPromptTemplate: `Suggest healthier substitutions for this recipe:

Recipe Name: {{recipeName}}
Current Ingredients: {{ingredients}}
Health Goals: {{healthGoals}}
Must Maintain: {{mustMaintain}}

For each suggested substitution, explain:
1. What to replace and with what
2. Health benefit gained
3. Impact on flavor and texture
4. Conversion ratio (if different from 1:1)
5. When NOT to make this substitution

Return as JSON:
{
  "overall_health_improvement": "summary of cumulative health benefits",
  "substitutions": [
    {
      "original_ingredient": "what to replace",
      "substitute": "healthier alternative",
      "health_benefit": "nutritional improvement (e.g., reduced saturated fat, added fiber)",
      "conversion_ratio": "how much substitute per original amount",
      "impact_on_flavor": "how taste changes (minimal, slight, moderate, significant)",
      "impact_on_texture": "how texture changes",
      "works_best_when": "conditions where this substitution excels",
      "avoid_if": "when not to use this substitution",
      "difficulty": "easy" | "moderate" | "advanced",
      "priority": "high" | "medium" | "low"
    }
  ],
  "combined_substitutions": [
    {
      "recipe_section": "e.g., sauce, batter, topping",
      "multiple_swaps": ["if doing multiple swaps in same section"],
      "compatibility_notes": "how these substitutions work together",
      "cumulative_impact": "overall effect of combined changes"
    }
  ],
  "nutritional_comparison": {
    "before": {
      "calories": estimate,
      "fat_g": estimate,
      "sugar_g": estimate,
      "fiber_g": estimate
    },
    "after": {
      "calories": estimate,
      "fat_g": estimate,
      "sugar_g": estimate,
      "fiber_g": estimate
    },
    "improvement_summary": "quantified health gains"
  },
  "taste_preservation_tips": [
    "techniques to maintain flavor when using healthier ingredients"
  ]
}

Common health goals to address:
- Lower calories/fat: Use low-fat dairy, reduce oil, lean proteins
- Reduce sugar: Natural sweeteners, fruit purees, less total sugar
- Increase fiber: Whole grains, add vegetables, use beans
- Lower sodium: Herbs/spices, reduce salt, use acid for brightness
- Add protein: Greek yogurt, protein powder, lean meats
- Reduce processed ingredients: Whole foods, make from scratch`,
  variables: ['recipeName', 'ingredients', 'healthGoals', 'mustMaintain'],
  modelSuggestions: [
    {
      model: 'anthropic/claude-3.5-sonnet',
      priority: 'primary',
      reason: 'Best at understanding substitution chemistry and impacts',
    },
    {
      model: 'google/gemini-2.0-flash-exp:free',
      priority: 'alternative',
      reason: 'Good for common substitutions, cost-effective',
    },
  ],
  temperature: 0.5,
  maxTokens: 2000,
  responseFormat: 'json_object',
  tags: ['nutrition', 'healthy-cooking', 'substitutions', 'wellness'],
  metadata: {
    costEstimate: '$0.002-$0.008 per call',
    averageLatency: '2-4 seconds',
  },
};

/**
 * Allergen Detector - Identify all potential allergens in a recipe
 */
export const ALLERGEN_DETECTOR: PromptTemplate = {
  id: 'allergen-detector',
  name: 'Allergen Detector',
  description: 'Comprehensively identify all allergens including hidden and cross-contamination risks',
  version: '1.0.0',
  category: 'nutrition',
  systemPrompt: `You are a food safety specialist and allergen expert with knowledge of:
- FDA major allergen categories (Big 8 + sesame)
- Hidden allergen sources in processed ingredients
- Cross-contamination risks
- Ingredient derivatives and alternative names
- International allergen labeling standards

Be thorough and conservative - err on the side of caution for allergen identification.`,
  userPromptTemplate: `Identify all allergens in this recipe:

Recipe Name: {{recipeName}}
Ingredients: {{ingredients}}
Processed Ingredients: {{processedIngredients}}

Analyze for:
1. Major allergens (milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, soy, sesame)
2. Hidden allergen sources in processed ingredients
3. Cross-contamination risks
4. Alternative names for allergens

Return as JSON:
{
  "allergen_summary": {
    "total_allergens_detected": number,
    "severity_level": "none" | "low" | "moderate" | "high",
    "safe_for": ["dietary groups this is safe for"],
    "unsafe_for": ["who should avoid this recipe"]
  },
  "allergens_detected": [
    {
      "allergen": "milk" | "eggs" | "fish" | "shellfish" | "tree_nuts" | "peanuts" | "wheat" | "soy" | "sesame" | "other",
      "source_ingredients": ["which ingredients contain this allergen"],
      "certainty": "confirmed" | "likely" | "possible",
      "hidden": true | false,
      "notes": "additional context or warnings"
    }
  ],
  "processed_ingredients_warnings": [
    {
      "ingredient": "processed ingredient name",
      "potential_allergens": ["allergens that may be present"],
      "recommendation": "check label or contact manufacturer"
    }
  ],
  "cross_contamination_risks": [
    {
      "risk": "description of contamination risk",
      "allergen": "which allergen",
      "mitigation": "how to reduce risk"
    }
  ],
  "alternative_names": [
    {
      "allergen": "standard allergen name",
      "found_as": ["alternative names used in this recipe"]
    }
  ],
  "substitution_recommendations": [
    {
      "allergen_ingredient": "what contains allergen",
      "allergen_free_substitute": "safe alternative",
      "notes": "impact on recipe"
    }
  ],
  "confidence_score": 0.0-1.0
}

Be especially vigilant for:
- Hidden dairy: whey, casein, lactose in processed foods
- Hidden wheat: modified food starch, malt, some soy sauces
- Hidden soy: lecithin, vegetable broth, some oils
- Tree nuts vs. peanuts (different allergens)
- Sesame in spice blends and tahini
- Shellfish in fish sauce, Worcestershire sauce`,
  variables: ['recipeName', 'ingredients', 'processedIngredients'],
  optionalVariables: ['preparationEnvironment'],
  modelSuggestions: [
    {
      model: 'anthropic/claude-3.5-sonnet',
      priority: 'primary',
      reason: 'Most thorough and safety-conscious allergen detection',
    },
    {
      model: 'openai/gpt-4o',
      priority: 'fallback',
      reason: 'Strong knowledge of ingredient derivatives',
    },
  ],
  temperature: 0.2,
  maxTokens: 1800,
  responseFormat: 'json_object',
  tags: ['allergens', 'food-safety', 'dietary-restrictions', 'health'],
  metadata: {
    costEstimate: '$0.003-$0.01 per call',
    averageLatency: '2-4 seconds',
  },
};

/**
 * Macro-Friendly Recipe Optimizer - Optimize recipes for specific macro targets
 */
export const MACRO_FRIENDLY_OPTIMIZER: PromptTemplate = {
  id: 'macro-friendly-optimizer',
  name: 'Macro-Friendly Recipe Optimizer',
  description: 'Modify recipes to hit specific macronutrient targets (high protein, low carb, etc.)',
  version: '1.0.0',
  category: 'nutrition',
  systemPrompt: `You are a sports nutritionist and recipe developer who creates macro-optimized meals.
You understand:
- Macronutrient ratios for different fitness goals
- High-protein ingredient swaps
- Low-carb alternatives that satisfy
- Healthy fat sources
- Maintaining satiety while hitting macros
- Practical meal prep for macro tracking

Create delicious recipes that meet macro targets without feeling like "diet food".`,
  userPromptTemplate: `Optimize this recipe to hit these macro targets:

Recipe Name: {{recipeName}}
Current Ingredients: {{ingredients}}
Current Macros (estimated): {{currentMacros}}

Target Macros per Serving:
- Calories: {{targetCalories}}
- Protein: {{targetProtein}}g
- Carbs: {{targetCarbs}}g
- Fat: {{targetFat}}g

Dietary Preference: {{dietPreference}}
Must Keep: {{mustKeepIngredients}}

Modify the recipe to:
1. Hit macro targets as closely as possible
2. Maintain flavor and satisfaction
3. Keep the dish recognizable and appealing
4. Use practical, accessible ingredients

Return as JSON:
{
  "macro_achievement": {
    "target_met": true | false,
    "actual_macros": {
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "fiber_g": number
    },
    "variance_from_target": {
      "calories": "+/- number",
      "protein_g": "+/- number",
      "carbs_g": "+/- number",
      "fat_g": "+/- number"
    },
    "optimization_quality": "excellent" | "good" | "acceptable" | "challenging"
  },
  "ingredient_modifications": [
    {
      "original": "ingredient to replace",
      "optimized": "macro-friendly replacement",
      "macro_impact": {
        "calories": "+/- number",
        "protein_g": "+/- number",
        "carbs_g": "+/- number",
        "fat_g": "+/- number"
      },
      "quantity": "how much of new ingredient",
      "rationale": "why this swap helps hit macros",
      "taste_impact": "how it affects flavor"
    }
  ],
  "portion_adjustment": {
    "original_serving_size": "description",
    "optimized_serving_size": "description",
    "size_change_reason": "why portion changed to hit macros"
  },
  "preparation_notes": [
    "tips for maintaining flavor with macro-optimized ingredients"
  ],
  "meal_timing_suggestion": "pre-workout" | "post-workout" | "anytime" | "pre-sleep",
  "satiety_rating": "very filling" | "moderately filling" | "light",
  "tracking_notes": "important info for macro tracking apps"
}

Macro optimization strategies:
- High protein: Greek yogurt, lean meats, egg whites, protein powder, cottage cheese
- Low carb: Cauliflower rice, zucchini noodles, almond flour, reduce sugar
- Healthy fats: Avocado, nuts, olive oil, fatty fish
- Volume eating: High-fiber vegetables, lean proteins, low-calorie density
- Satisfaction: Strategic use of fats and fiber for fullness`,
  variables: [
    'recipeName',
    'ingredients',
    'currentMacros',
    'targetCalories',
    'targetProtein',
    'targetCarbs',
    'targetFat',
    'dietPreference',
    'mustKeepIngredients',
  ],
  modelSuggestions: [
    {
      model: 'anthropic/claude-3.5-sonnet',
      priority: 'primary',
      reason: 'Best mathematical precision for macro calculations',
    },
    {
      model: 'openai/gpt-4o',
      priority: 'fallback',
      reason: 'Strong nutritional optimization reasoning',
    },
  ],
  temperature: 0.4,
  maxTokens: 2000,
  responseFormat: 'json_object',
  tags: ['macros', 'fitness', 'nutrition-tracking', 'optimization'],
  metadata: {
    costEstimate: '$0.003-$0.012 per call',
    averageLatency: '3-5 seconds',
  },
};

/**
 * All nutritional estimation prompts exported as a collection
 */
export const nutritionalEstimationPrompts = {
  COMPREHENSIVE_NUTRITION_CALCULATOR,
  HEALTHIER_SUBSTITUTION_SUGGESTER,
  ALLERGEN_DETECTOR,
  MACRO_FRIENDLY_OPTIMIZER,
};
