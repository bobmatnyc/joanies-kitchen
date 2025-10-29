/**
 * Ingredient Substitution AI Prompts
 *
 * AI-powered ingredient substitution generation for ingredients not in static library
 */

import type { PromptTemplate } from './types';

/**
 * Smart Ingredient Substitution Generator
 *
 * Generates contextually-appropriate ingredient substitutions when static library
 * doesn't have the ingredient. Considers cooking method, recipe type, and dietary needs.
 */
export const INGREDIENT_SUBSTITUTION_GENERATOR: PromptTemplate = {
  id: 'ingredient-substitution-generator',
  name: 'Smart Ingredient Substitution Generator',
  description:
    'Generate practical, tested ingredient substitutions with confidence ratings and cooking adjustments',
  version: '1.0.0',
  category: 'recipe',
  systemPrompt: `You are a professional chef and food scientist with deep expertise in:
- Ingredient chemistry and functional properties
- How ingredients behave in different cooking methods (baking, sautéing, braising, etc.)
- Flavor pairing and substitution impact
- Texture modification in recipes
- Dietary restrictions and allergen-free alternatives
- Regional and seasonal ingredient availability
- Culinary traditions across cultures

Your substitution recommendations must be:
- Practical and accessible (common ingredients, not exotic)
- Functionally sound (maintain structural role in recipe)
- Honest about trade-offs (flavor/texture impact)
- Backed by culinary science
- Tested and proven in real kitchens

Provide 3-5 substitution options ranked by confidence and appropriateness.`,

  userPromptTemplate: `Find practical substitutions for this ingredient:

**Ingredient**: {{ingredient}}

**Recipe Context**:
- Recipe Name: {{recipeName}}
- Cooking Method: {{cookingMethod}}
- Cuisine Type: {{cuisineType}}

**Requirements**:
1. Provide 3-5 substitution options ranked by confidence
2. Each substitution must include:
   - Exact substitute ingredient name
   - Conversion ratio (e.g., "1:1" or "3/4 cup per 1 cup")
   - Confidence level (high/medium/low) and score (0.0-1.0)
   - Clear explanation of WHY this works
   - Impact on flavor (none/minimal/noticeable/significant)
   - Impact on texture (none/minimal/noticeable/significant)
   - Cooking adjustments needed (if any)
   - Best use cases
   - When to avoid this substitution
3. Prioritize common, accessible ingredients
4. Consider the cooking method ({{cookingMethod}}) when recommending
5. Be honest about limitations and trade-offs

Return as JSON:
{
  "ingredient": "{{ingredient}}",
  "ingredient_category": "category (e.g., protein, vegetable, spice, etc.)",
  "substitutions": [
    {
      "substitute_ingredient": "exact name of substitute",
      "ratio": "conversion ratio (e.g., '1:1', '2:3')",
      "substitute_amount": "amount description if different (e.g., '3/4 cup per 1 cup')",
      "confidence": "high" | "medium" | "low",
      "confidence_score": 0.0-1.0,
      "reason": "detailed explanation of why this substitution works - mention similar properties, functional role, flavor profile",
      "cooking_adjustment": "any changes to cooking method, time, or temperature",
      "best_for": ["list", "of", "recipe types or cooking methods this works best in"],
      "avoid_for": ["situations", "where", "this substitution doesn't work well"],
      "flavor_impact": "none" | "minimal" | "noticeable" | "significant",
      "texture_impact": "none" | "minimal" | "noticeable" | "significant"
    }
  ],
  "notes": "additional context, warnings, or tips",
  "confidence": {
    "overall": 0.0-1.0,
    "reasoning": "explanation of overall confidence in these substitutions"
  }
}

**Important Guidelines**:
- High confidence (0.8-1.0): Near-identical properties, widely accepted substitution
- Medium confidence (0.5-0.79): Works well but noticeable differences
- Low confidence (0.3-0.49): Last resort, significant compromises
- If cooking method is baking, emphasize chemical properties (leavening, structure, moisture)
- If cooking method is frying/sautéing, emphasize smoke point and heat tolerance
- If protein substitution, consider cooking time and food safety
- Order substitutions from most recommended to least recommended`,

  variables: ['ingredient'],
  optionalVariables: ['recipeName', 'cookingMethod', 'cuisineType', 'dietaryRestrictions'],
  modelSuggestions: [
    {
      model: 'google/gemini-2.0-flash-exp:free',
      priority: 'primary',
      reason: 'Fast, accurate, and free. Excellent knowledge of ingredients and cooking.',
    },
    {
      model: 'anthropic/claude-3.5-sonnet',
      priority: 'fallback',
      reason: 'Most thorough and accurate for complex substitutions. Higher cost.',
    },
    {
      model: 'openai/gpt-4o',
      priority: 'alternative',
      reason: 'Strong culinary knowledge and reasoning.',
    },
  ],
  temperature: 0.4,
  maxTokens: 2000,
  responseFormat: 'json_object',
  tags: ['substitution', 'ingredients', 'cooking', 'recipe-modification'],
  metadata: {
    costEstimate: '$0.00-$0.003 per call (free with Gemini)',
    averageLatency: '1-3 seconds',
  },
};

/**
 * All ingredient substitution prompts exported as collection
 */
export const ingredientSubstitutionPrompts = {
  INGREDIENT_SUBSTITUTION_GENERATOR,
};
