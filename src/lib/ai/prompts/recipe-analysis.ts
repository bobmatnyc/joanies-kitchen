/**
 * Recipe Analysis Prompts
 *
 * Reusable AI prompts for recipe analysis, improvement, and variation
 */

import type { PromptTemplate } from './types';

/**
 * Recipe Improvement Analyzer - Suggest improvements to existing recipes
 */
export const RECIPE_IMPROVEMENT_ANALYZER: PromptTemplate = {
  id: 'recipe-improvement-analyzer',
  name: 'Recipe Improvement Analyzer',
  description:
    'Analyze a recipe and suggest practical improvements for flavor, technique, or nutrition',
  version: '1.0.0',
  category: 'analysis',
  systemPrompt: `You are a professional chef instructor and recipe developer with expertise in:
- Culinary technique optimization
- Flavor enhancement and balance
- Ingredient quality and substitutions
- Nutritional improvements without sacrificing taste
- Recipe clarity and instruction quality

Provide constructive, actionable feedback that improves recipes while respecting the original intent.`,
  userPromptTemplate: `Analyze this recipe and suggest improvements:

Recipe Name: {{recipeName}}
Cuisine: {{cuisine}}
Difficulty: {{difficulty}}
Ingredients: {{ingredients}}
Instructions: {{instructions}}
Current Tags: {{tags}}

Analyze and provide:
1. Technique improvements (better methods or order of operations)
2. Flavor enhancements (seasonings, aromatics, finishing touches)
3. Ingredient upgrades (quality improvements or better alternatives)
4. Nutritional suggestions (healthier options without compromising taste)
5. Instruction clarity (making steps easier to follow)

Return as JSON:
{
  "overall_assessment": {
    "strengths": ["what the recipe does well"],
    "areas_for_improvement": ["what could be better"],
    "difficulty_rating": "is current difficulty accurate?",
    "confidence_score": 0.0-1.0
  },
  "improvements": [
    {
      "category": "technique" | "flavor" | "ingredient" | "nutrition" | "clarity",
      "current": "what the recipe currently does",
      "suggested": "proposed improvement",
      "rationale": "why this improves the recipe",
      "impact": "low" | "medium" | "high",
      "ease_of_implementation": "easy" | "moderate" | "difficult"
    }
  ],
  "enhanced_recipe_summary": {
    "would_change_difficulty": true | false,
    "estimated_improvement": "brief summary of overall impact",
    "prep_time_change": "increase/decrease/same and by how much",
    "cost_impact": "cheaper/same/more expensive"
  },
  "alternative_approaches": [
    {
      "approach": "different technique or method",
      "when_to_use": "circumstances where this is better",
      "tradeoffs": "pros and cons"
    }
  ]
}`,
  variables: ['recipeName', 'cuisine', 'difficulty', 'ingredients', 'instructions', 'tags'],
  optionalVariables: ['userFeedback', 'commonIssues'],
  modelSuggestions: [
    {
      model: 'anthropic/claude-3.5-sonnet',
      priority: 'primary',
      reason: 'Excellent analytical reasoning and constructive feedback',
    },
    {
      model: 'openai/gpt-4o',
      priority: 'fallback',
      reason: 'Strong culinary knowledge and detailed suggestions',
    },
  ],
  temperature: 0.5,
  maxTokens: 2000,
  responseFormat: 'json_object',
  tags: ['recipe-analysis', 'improvement', 'optimization', 'feedback'],
  metadata: {
    costEstimate: '$0.003-$0.01 per call',
    averageLatency: '3-5 seconds',
  },
};

/**
 * Recipe Variation Generator - Create variations of existing recipes
 */
export const RECIPE_VARIATION_GENERATOR: PromptTemplate = {
  id: 'recipe-variation-generator',
  name: 'Recipe Variation Generator',
  description:
    'Generate creative variations of a recipe (different cuisines, dietary versions, seasonal adaptations)',
  version: '1.0.0',
  category: 'recipe',
  systemPrompt: `You are a creative chef who specializes in recipe adaptation and fusion cuisine.
You understand:
- Cultural cuisine techniques and flavor profiles
- Ingredient substitutions for dietary needs
- Seasonal ingredient swaps
- Flavor chemistry and complementary tastes
- Traditional vs. modern cooking methods

Create variations that honor the original recipe while offering meaningful creative alternatives.`,
  userPromptTemplate: `Create {{count}} variations of this recipe:

Original Recipe: {{recipeName}}
Base Cuisine: {{cuisine}}
Core Technique: {{technique}}
Key Ingredients: {{keyIngredients}}
Dietary Base: {{dietaryBase}}

Variation Types Requested: {{variationTypes}}

For each variation, provide:
1. Clear differentiation from the original
2. Authentic execution if adapting to a different cuisine
3. Proper dietary compliance if that's the variation type
4. Maintained core appeal of the original dish

Return as JSON array:
[
  {
    "variation_type": "cuisine-fusion" | "dietary-adaptation" | "seasonal-variation" | "technique-swap" | "upscale-version" | "budget-version",
    "name": "variation name",
    "description": "what makes this variation unique",
    "key_changes": [
      {
        "original": "what's in the base recipe",
        "variation": "what changes in this version",
        "reason": "why this change works"
      }
    ],
    "difficulty_change": "easier" | "same" | "harder",
    "time_change": "faster" | "same" | "slower",
    "cuisine": "resulting cuisine style",
    "tags": ["vegetarian", "fusion", "seasonal", etc],
    "when_to_make": "best occasions or seasons for this variation"
  }
]

Variation types to consider:
- cuisine-fusion: Adapt to a different cuisine (e.g., Italian → Japanese)
- dietary-adaptation: Make vegan, keto, gluten-free, etc.
- seasonal-variation: Use different seasonal ingredients
- technique-swap: Same dish, different cooking method
- upscale-version: Restaurant-quality refinement
- budget-version: More affordable ingredients/methods`,
  variables: [
    'recipeName',
    'cuisine',
    'technique',
    'keyIngredients',
    'dietaryBase',
    'variationTypes',
    'count',
  ],
  modelSuggestions: [
    {
      model: 'google/gemini-2.0-flash-exp:free',
      priority: 'primary',
      reason: 'Creative and fast for generating variations',
    },
    {
      model: 'anthropic/claude-3.5-sonnet',
      priority: 'alternative',
      reason: 'Better for complex cultural adaptations',
    },
  ],
  temperature: 0.8,
  maxTokens: 2000,
  responseFormat: 'json_object',
  tags: ['variations', 'adaptation', 'creativity', 'fusion'],
  metadata: {
    costEstimate: '$0.001-$0.003 per call',
    averageLatency: '2-4 seconds',
  },
};

/**
 * Missing Ingredient Identifier - Detect what's missing from a recipe
 */
export const MISSING_INGREDIENT_IDENTIFIER: PromptTemplate = {
  id: 'missing-ingredient-identifier',
  name: 'Missing Ingredient Identifier',
  description:
    'Analyze a recipe and identify likely missing ingredients, seasonings, or components',
  version: '1.0.0',
  category: 'analysis',
  systemPrompt: `You are a professional recipe editor and test kitchen chef.
You have extensive experience:
- Identifying incomplete or missing recipe components
- Recognizing when essential aromatics or seasonings are omitted
- Spotting missing garnishes or finishing elements
- Detecting unrealistic ingredient proportions
- Understanding cultural cuisine requirements

Identify what's genuinely missing, not just optional additions.`,
  userPromptTemplate: `Analyze this recipe for missing or forgotten ingredients:

Recipe Name: {{recipeName}}
Cuisine: {{cuisine}}
Dish Type: {{dishType}}
Current Ingredients: {{ingredients}}
Instructions: {{instructions}}

Identify:
1. Essential missing ingredients (the dish won't work without these)
2. Likely forgotten items (commonly needed but not listed)
3. Missing seasonings or aromatics (flavor gaps)
4. Unrealistic proportions (e.g., "needs more salt than '1 pinch'")
5. Missing finishing touches or garnishes

Return as JSON:
{
  "completeness_score": 0.0-1.0,
  "assessment": "overall completeness evaluation",
  "missing_items": [
    {
      "category": "essential" | "likely-forgotten" | "seasoning" | "proportion-issue" | "finishing",
      "item": "what's missing",
      "rationale": "why this is likely needed",
      "where_in_recipe": "prep step X, cooking step Y, or final plating",
      "severity": "critical" | "important" | "nice-to-have",
      "suggested_amount": "recommended quantity"
    }
  ],
  "proportion_warnings": [
    {
      "ingredient": "ingredient name",
      "current_amount": "what's listed",
      "seems": "too-little" | "too-much",
      "suggested_amount": "more realistic quantity",
      "rationale": "why current amount seems off"
    }
  ],
  "cultural_authenticity_notes": "if cuisine-specific ingredients are missing"
}

Focus on GENUINE gaps, not:
- Optional variations ("could add mushrooms")
- Personal preferences
- Expensive upgrades
- Overly pedantic details`,
  variables: ['recipeName', 'cuisine', 'dishType', 'ingredients', 'instructions'],
  modelSuggestions: [
    {
      model: 'anthropic/claude-3.5-sonnet',
      priority: 'primary',
      reason: 'Best reasoning for detecting genuine omissions',
    },
    {
      model: 'openai/gpt-4o',
      priority: 'fallback',
      reason: 'Strong pattern recognition for recipe completeness',
    },
  ],
  temperature: 0.3,
  maxTokens: 1500,
  responseFormat: 'json_object',
  tags: ['analysis', 'validation', 'completeness', 'quality-control'],
  metadata: {
    costEstimate: '$0.003-$0.01 per call',
    averageLatency: '2-4 seconds',
  },
};

/**
 * Cooking Difficulty Estimator - Accurately rate recipe difficulty
 */
export const COOKING_DIFFICULTY_ESTIMATOR: PromptTemplate = {
  id: 'cooking-difficulty-estimator',
  name: 'Cooking Difficulty Estimator',
  description:
    'Accurately estimate the true difficulty level of a recipe based on techniques, timing, and skill requirements',
  version: '1.0.0',
  category: 'analysis',
  systemPrompt: `You are a culinary instructor who teaches cooks from beginner to advanced levels.
You understand:
- Skill progression and learning curves
- Which techniques require practice vs. natural ability
- Time management complexity in recipes
- Equipment requirements and accessibility
- Common beginner mistakes and pain points

Rate difficulty honestly based on realistic home cook capabilities.`,
  userPromptTemplate: `Evaluate the true difficulty of this recipe:

Recipe Name: {{recipeName}}
Current Difficulty Rating: {{currentDifficulty}}
Ingredients: {{ingredients}}
Instructions: {{instructions}}
Prep Time: {{prepTime}} minutes
Cook Time: {{cookTime}} minutes
Equipment Needed: {{equipment}}

Analyze difficulty based on:
1. Technical skills required (knife work, temperature control, timing)
2. Number of simultaneous tasks (multitasking complexity)
3. Specialized equipment needs
4. Ingredient accessibility and prep difficulty
5. Margin for error (is it forgiving or precise?)
6. Time management challenges

Return as JSON:
{
  "difficulty_rating": "beginner" | "intermediate" | "advanced",
  "confidence": 0.0-1.0,
  "current_rating_accurate": true | false,
  "difficulty_factors": [
    {
      "factor": "knife skills" | "timing" | "temperature control" | "multitasking" | "specialized technique" | "equipment" | "ingredient prep",
      "difficulty_level": "beginner" | "intermediate" | "advanced",
      "impact_on_overall": "low" | "medium" | "high",
      "explanation": "why this affects difficulty"
    }
  ],
  "skill_prerequisites": [
    "specific skills needed to succeed"
  ],
  "common_failure_points": [
    {
      "step": "where cooks typically struggle",
      "why_difficult": "what makes this hard",
      "tip_to_succeed": "how to avoid the issue"
    }
  ],
  "time_pressure_rating": "relaxed" | "moderate" | "high",
  "forgiveness_rating": "very forgiving" | "somewhat forgiving" | "precise/unforgiving",
  "beginner_modifications": [
    "suggestions to make it more approachable for beginners"
  ]
}`,
  variables: [
    'recipeName',
    'currentDifficulty',
    'ingredients',
    'instructions',
    'prepTime',
    'cookTime',
    'equipment',
  ],
  modelSuggestions: [
    {
      model: 'anthropic/claude-3.5-sonnet',
      priority: 'primary',
      reason: 'Excellent at nuanced skill assessment',
    },
    {
      model: 'google/gemini-2.0-flash-exp:free',
      priority: 'alternative',
      reason: 'Good for standard difficulty estimation',
    },
  ],
  temperature: 0.4,
  maxTokens: 1800,
  responseFormat: 'json_object',
  tags: ['difficulty', 'skill-assessment', 'analysis', 'education'],
  metadata: {
    costEstimate: '$0.002-$0.008 per call',
    averageLatency: '2-4 seconds',
  },
};

/**
 * Recipe Scaling Optimizer - Optimize ingredient scaling for different serving sizes
 */
export const RECIPE_SCALING_OPTIMIZER: PromptTemplate = {
  id: 'recipe-scaling-optimizer',
  name: 'Recipe Scaling Optimizer',
  description:
    'Intelligently scale recipes up or down while adjusting for non-linear scaling factors',
  version: '1.0.0',
  category: 'analysis',
  systemPrompt: `You are a professional chef and recipe developer who understands:
- Non-linear scaling (not everything doubles/halves perfectly)
- Seasoning adjustments when scaling
- Equipment limitations at different scales
- Cooking time changes with volume
- Yield vs. serving size differences

Provide realistic scaling that accounts for practical kitchen constraints.`,
  userPromptTemplate: `Scale this recipe from {{originalServings}} servings to {{targetServings}} servings:

Recipe Name: {{recipeName}}
Original Servings: {{originalServings}}
Target Servings: {{targetServings}}
Ingredients: {{ingredients}}
Instructions: {{instructions}}
Equipment: {{equipment}}

Provide:
1. Scaled ingredient quantities (accounting for non-linear scaling)
2. Equipment adjustments needed
3. Cooking time modifications
4. Technique changes for different batch size
5. Warnings about scaling limits

Return as JSON:
{
  "scaling_factor": numeric ratio,
  "scaling_feasibility": "ideal" | "acceptable" | "challenging" | "not-recommended",
  "scaled_ingredients": [
    {
      "original": "original quantity and ingredient",
      "scaled": "new quantity (may not be linear)",
      "scaling_note": "why this doesn't scale linearly (if applicable)",
      "practical_amount": "rounded to practical measurements"
    }
  ],
  "equipment_changes": [
    {
      "original_equipment": "what original recipe uses",
      "recommended_equipment": "what's needed for new scale",
      "why": "reason for change"
    }
  ],
  "timing_adjustments": [
    {
      "step": "cooking step",
      "original_time": "original timing",
      "adjusted_time": "new timing",
      "monitoring_tip": "what to watch for"
    }
  ],
  "technique_modifications": [
    "changes in technique needed for different scale"
  ],
  "batch_cooking_recommendation": {
    "should_batch": true | false,
    "approach": "if scaling up significantly, suggest batch approach",
    "rationale": "why batching might be better"
  },
  "warnings": [
    "potential issues with this scaling"
  ]
}

Non-linear scaling considerations:
- Seasonings: Often need less when scaling up, more when scaling down
- Liquids: Evaporation rates change with volume
- Cooking times: Don't scale linearly (especially baking)
- Equipment: May need multiple pans or larger vessels
- Yields: Sometimes better to make multiple batches`,
  variables: [
    'recipeName',
    'originalServings',
    'targetServings',
    'ingredients',
    'instructions',
    'equipment',
  ],
  modelSuggestions: [
    {
      model: 'anthropic/claude-3.5-sonnet',
      priority: 'primary',
      reason: 'Best at understanding non-linear scaling factors',
    },
    {
      model: 'openai/gpt-4o',
      priority: 'fallback',
      reason: 'Strong mathematical and practical reasoning',
    },
  ],
  temperature: 0.3,
  maxTokens: 2000,
  responseFormat: 'json_object',
  tags: ['scaling', 'math', 'analysis', 'batch-cooking'],
  metadata: {
    costEstimate: '$0.003-$0.01 per call',
    averageLatency: '2-4 seconds',
  },
};

/**
 * All recipe analysis prompts exported as a collection
 */
export const recipeAnalysisPrompts = {
  RECIPE_IMPROVEMENT_ANALYZER,
  RECIPE_VARIATION_GENERATOR,
  MISSING_INGREDIENT_IDENTIFIER,
  COOKING_DIFFICULTY_ESTIMATOR,
  RECIPE_SCALING_OPTIMIZER,
};
