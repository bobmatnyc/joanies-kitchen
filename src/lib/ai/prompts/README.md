# AI Prompt Store

Centralized, reusable, and versioned AI prompts for recipe-related tasks in the Recipe Manager application.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Prompt Categories](#prompt-categories)
- [Available Prompts](#available-prompts)
- [Usage Examples](#usage-examples)
- [Adding New Prompts](#adding-new-prompts)
- [Best Practices](#best-practices)
- [Model Selection Guide](#model-selection-guide)
- [API Reference](#api-reference)

---

## Overview

The AI Prompt Store provides a centralized system for managing AI prompts across the Recipe Manager application. Instead of hardcoding prompts throughout the codebase, we maintain them in a structured, versioned format with:

- **Variable Substitution**: Template-based prompts with `{{variable}}` placeholders
- **Model Recommendations**: Suggested LLM models for each prompt
- **Type Safety**: Full TypeScript support with Zod validation
- **Versioning**: Semantic versioning for prompt evolution
- **Metadata**: Cost estimates, latency expectations, and usage notes

**Current Stats**:
- **Total Prompts**: 15
- **Categories**: 4 (Meal, Recipe, Nutrition, Analysis)
- **Average Cost**: $0.001-$0.01 per call

---

## Quick Start

### Basic Usage

```typescript
import { generateCompleteMeal } from '@/lib/ai/meal-generator';

// Generate a complete meal
const meal = await generateCompleteMeal({
  mainDish: 'Grilled Salmon',
  cuisine: 'Mediterranean',
  dietaryRestrictions: 'gluten-free',
  servings: 4,
  occasion: 'dinner party',
});

console.log(meal);
// [
//   { type: 'main', name: 'Grilled Salmon with Lemon', ... },
//   { type: 'side', name: 'Greek Salad', ... },
//   { type: 'side', name: 'Roasted Vegetables', ... },
//   { type: 'appetizer', name: 'Hummus with Vegetables', ... },
//   { type: 'dessert', name: 'Olive Oil Cake', ... }
// ]
```

### Using the Prompt Store Directly

```typescript
import { renderPromptById, getOpenRouterClient } from '@/lib/ai/prompts';

// Render a prompt with variables
const rendered = renderPromptById('meal-builder-complete', {
  variables: {
    mainDish: 'Grilled Salmon',
    cuisine: 'Mediterranean',
    dietaryRestrictions: 'none',
    servings: '4',
    occasion: 'casual dinner',
  },
});

// Call OpenRouter
const client = getOpenRouterClient();
const response = await client.chat.completions.create({
  model: rendered.config.model,
  messages: [
    { role: 'system', content: rendered.system },
    { role: 'user', content: rendered.user },
  ],
  temperature: rendered.config.temperature,
  max_tokens: rendered.config.maxTokens,
});
```

---

## Prompt Categories

### 1. **Meal** (`category: 'meal'`)
Prompts for meal planning and generation:
- Complete meal building
- Complementary side dish generation
- Themed/occasion-based meals
- Dietary-compliant meals
- Seasonal meal planning
- Budget-friendly meals

### 2. **Recipe** (`category: 'recipe'`)
Prompts for recipe creation and modification:
- Recipe variation generation
- (More to be added)

### 3. **Nutrition** (`category: 'nutrition'`)
Prompts for nutritional analysis:
- Comprehensive nutrition calculation
- Healthier substitution suggestions
- Allergen detection
- Macro-friendly optimization

### 4. **Analysis** (`category: 'analysis'`)
Prompts for recipe analysis and improvement:
- Recipe improvement suggestions
- Missing ingredient detection
- Difficulty estimation
- Recipe scaling optimization

---

## Available Prompts

### Meal Generation Prompts

#### 1. `meal-builder-complete`
**Generate a complete multi-course meal**

**Variables**:
- `mainDish` (required): Main dish name or "surprise me"
- `cuisine` (required): Cuisine type (e.g., "Italian", "Mexican")
- `dietaryRestrictions` (required): Restrictions or "none"
- `servings` (required): Number of servings
- `occasion` (required): Occasion (e.g., "dinner party", "weeknight")

**Returns**: Array of dishes (main, 2 sides, appetizer, dessert)

**Model**: Google Gemini 2.0 Flash (primary)

**Example**:
```typescript
const meal = await generateCompleteMeal({
  mainDish: 'Beef Wellington',
  cuisine: 'British',
  dietaryRestrictions: 'none',
  servings: 6,
  occasion: 'special occasion',
});
```

---

#### 2. `complementary-sides`
**Generate side dishes that complement a main dish**

**Variables**:
- `mainDish` (required): Name of main dish
- `mainDescription` (required): Description of main dish
- `cuisine` (required): Cuisine type
- `cookingMethod` (required): How main is cooked (e.g., "grilled", "roasted")
- `servings` (required): Number of servings
- `count` (required): Number of sides to generate
- `dietaryRestrictions` (optional): Any restrictions

**Returns**: Array of side dish recommendations

**Model**: Google Gemini 2.0 Flash (primary)

**Example**:
```typescript
const sides = await generateComplementarySides({
  mainDish: 'Grilled Ribeye Steak',
  mainDescription: 'Medium-rare ribeye with herb butter',
  cuisine: 'American',
  cookingMethod: 'grilled',
  servings: 4,
  count: 3,
});
```

---

#### 3. `themed-meal`
**Create meals based on themes or cultural events**

**Variables**:
- `theme` (required): Theme or occasion (e.g., "Thanksgiving", "Italian Night")
- `cuisine` (required): Cuisine/culture
- `servings` (required): Number of guests
- `dietaryRestrictions` (required): Restrictions
- `skillLevel` (required): "beginner", "intermediate", or "advanced"
- `budget` (required): "budget", "moderate", or "premium"

**Returns**: Themed meal with cultural significance notes

**Model**: Claude 3.5 Sonnet (primary) - better cultural knowledge

**Example**:
```typescript
const themedMeal = await generateThemedMeal({
  theme: 'Día de los Muertos celebration',
  cuisine: 'Mexican',
  servings: 8,
  dietaryRestrictions: 'vegetarian options needed',
  skillLevel: 'intermediate',
  budget: 'moderate',
});
```

---

#### 4. `dietary-meal-builder`
**Build meals adhering to strict dietary requirements**

**Variables**:
- `dietType` (required): Primary diet (e.g., "vegan", "keto", "paleo")
- `restrictions` (required): Additional restrictions
- `allergies` (required): Allergen list or "none"
- `nutritionalGoals` (required): Goals (e.g., "high protein, low carb")
- `servings` (required): Servings
- `mealType` (required): "breakfast", "lunch", "dinner", or "snack"

**Returns**: Dietary-compliant meal with nutrition info

**Model**: Claude 3.5 Sonnet (primary) - most accurate for compliance

**Example**:
```typescript
const dietaryMeal = await generateDietaryMeal({
  dietType: 'vegan',
  restrictions: 'gluten-free, soy-free',
  allergies: 'tree nuts',
  nutritionalGoals: 'high protein (30g+), fiber-rich',
  servings: 2,
  mealType: 'dinner',
});
```

---

#### 5. `seasonal-meal`
**Generate meals using peak seasonal ingredients**

**Variables**:
- `season` (required): "spring", "summer", "fall", or "winter"
- `region` (required): Geographic region (e.g., "Pacific Northwest", "Mediterranean")
- `cuisine` (required): Preferred cuisine
- `dietaryRestrictions` (required): Restrictions
- `servings` (required): Servings
- `mealType` (required): Meal type

**Returns**: Seasonal meal with ingredient sourcing tips

**Model**: Google Gemini 2.0 Flash (primary)

**Example**:
```typescript
const seasonalMeal = await generateSeasonalMeal({
  season: 'fall',
  region: 'New England',
  cuisine: 'American',
  dietaryRestrictions: 'none',
  servings: 4,
  mealType: 'dinner',
});
```

---

#### 6. `budget-meal-planner`
**Create cost-effective meals**

**Variables**:
- `budgetPerServing` (required): Budget (e.g., "$3", "$5")
- `servings` (required): Servings
- `dietaryRestrictions` (required): Restrictions
- `pantryStaples` (required): Available staples (e.g., "rice, beans, spices")
- `cuisine` (required): Cuisine preference

**Returns**: Budget-friendly meal with cost breakdown

**Model**: Google Gemini 2.0 Flash (primary) - cost-effective choice

**Example**:
```typescript
const budgetMeal = await generateBudgetMeal({
  budgetPerServing: '$4',
  servings: 4,
  dietaryRestrictions: 'none',
  pantryStaples: 'rice, pasta, canned tomatoes, olive oil, garlic, onions',
  cuisine: 'Italian',
});
```

---

### Recipe Analysis Prompts

#### 7. `recipe-improvement-analyzer`
**Suggest improvements to existing recipes**

**Variables**:
- `recipeName`, `cuisine`, `difficulty`
- `ingredients`, `instructions`, `tags`
- `userFeedback` (optional), `commonIssues` (optional)

**Model**: Claude 3.5 Sonnet (primary)

---

#### 8. `recipe-variation-generator`
**Create creative variations of recipes**

**Variables**:
- `recipeName`, `cuisine`, `technique`
- `keyIngredients`, `dietaryBase`
- `variationTypes` (e.g., "cuisine-fusion, dietary-adaptation")
- `count` (number of variations)

**Model**: Google Gemini 2.0 Flash (primary)

---

#### 9. `missing-ingredient-identifier`
**Detect missing or forgotten ingredients**

**Variables**:
- `recipeName`, `cuisine`, `dishType`
- `ingredients`, `instructions`

**Model**: Claude 3.5 Sonnet (primary)

---

#### 10. `cooking-difficulty-estimator`
**Accurately rate recipe difficulty**

**Variables**:
- `recipeName`, `currentDifficulty`
- `ingredients`, `instructions`
- `prepTime`, `cookTime`, `equipment`

**Model**: Claude 3.5 Sonnet (primary)

---

#### 11. `recipe-scaling-optimizer`
**Scale recipes intelligently**

**Variables**:
- `recipeName`, `originalServings`, `targetServings`
- `ingredients`, `instructions`, `equipment`

**Model**: Claude 3.5 Sonnet (primary)

---

### Nutritional Estimation Prompts

#### 12. `comprehensive-nutrition-calculator`
**Estimate complete nutritional profile**

**Variables**:
- `recipeName`, `servings`, `ingredients`
- `cookingMethod` (optional), `prepMethod` (optional)

**Model**: Claude 3.5 Sonnet (primary)

---

#### 13. `healthier-substitution-suggester`
**Suggest healthier ingredient swaps**

**Variables**:
- `recipeName`, `ingredients`
- `healthGoals` (e.g., "lower fat, increase fiber")
- `mustMaintain` (e.g., "creamy texture, rich flavor")

**Model**: Claude 3.5 Sonnet (primary)

---

#### 14. `allergen-detector`
**Identify all allergens including hidden sources**

**Variables**:
- `recipeName`, `ingredients`, `processedIngredients`
- `preparationEnvironment` (optional)

**Model**: Claude 3.5 Sonnet (primary)

---

#### 15. `macro-friendly-optimizer`
**Optimize recipes for specific macro targets**

**Variables**:
- `recipeName`, `ingredients`, `currentMacros`
- `targetCalories`, `targetProtein`, `targetCarbs`, `targetFat`
- `dietPreference`, `mustKeepIngredients`

**Model**: Claude 3.5 Sonnet (primary)

---

## Usage Examples

### Example 1: Complete Meal Generation

```typescript
import { generateCompleteMeal } from '@/lib/ai/meal-generator';

async function planDinnerParty() {
  try {
    const meal = await generateCompleteMeal({
      mainDish: 'Roasted Chicken',
      cuisine: 'French',
      dietaryRestrictions: 'one guest is vegetarian',
      servings: 6,
      occasion: 'dinner party',
    });

    console.log('Dinner Party Menu:');
    meal.forEach((dish) => {
      console.log(`\n${dish.type.toUpperCase()}: ${dish.name}`);
      console.log(`Description: ${dish.description}`);
      console.log(`Prep: ${dish.prep_time} min | Cook: ${dish.cook_time} min`);
    });
  } catch (error) {
    console.error('Failed to generate meal:', error);
  }
}
```

### Example 2: Using Generic Prompt Caller

```typescript
import { callPrompt } from '@/lib/ai/meal-generator';
import { z } from 'zod';

// Define expected response schema
const ImprovementSchema = z.object({
  overall_assessment: z.object({
    strengths: z.array(z.string()),
    areas_for_improvement: z.array(z.string()),
  }),
  improvements: z.array(z.any()),
});

async function analyzeRecipe(recipe) {
  const analysis = await callPrompt(
    'recipe-improvement-analyzer',
    {
      recipeName: recipe.name,
      cuisine: recipe.cuisine,
      difficulty: recipe.difficulty,
      ingredients: JSON.stringify(recipe.ingredients),
      instructions: JSON.stringify(recipe.instructions),
      tags: JSON.stringify(recipe.tags),
    },
    {
      zodSchema: ImprovementSchema,
      modelOverride: 'anthropic/claude-3.5-sonnet', // Override default model
    }
  );

  return analysis;
}
```

### Example 3: Low-Level Prompt Store Access

```typescript
import {
  getPrompt,
  renderPrompt,
  validatePromptVariables,
  listPromptsWithInfo,
} from '@/lib/ai/prompts';

// List all available prompts
const prompts = listPromptsWithInfo();
console.log('Available prompts:', prompts);

// Get a specific prompt
const template = getPrompt('meal-builder-complete');
console.log('Prompt:', template.name);
console.log('Required variables:', template.variables);

// Validate variables before rendering
const variables = {
  mainDish: 'Grilled Salmon',
  cuisine: 'Mediterranean',
  dietaryRestrictions: 'none',
  servings: '4',
  occasion: 'weeknight dinner',
};

const validation = validatePromptVariables(template, variables);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
} else {
  const rendered = renderPrompt(template, { variables });
  console.log('System:', rendered.system);
  console.log('User:', rendered.user);
  console.log('Config:', rendered.config);
}
```

---

## Adding New Prompts

### Step 1: Create Prompt Template

Add your prompt to the appropriate file (`meal-generation.ts`, `recipe-analysis.ts`, `nutritional-estimation.ts`, or create a new category file):

```typescript
export const MY_NEW_PROMPT: PromptTemplate = {
  id: 'my-new-prompt',
  name: 'My New Prompt',
  description: 'Brief description of what this prompt does',
  version: '1.0.0',
  category: 'meal', // or 'recipe', 'nutrition', 'analysis'
  systemPrompt: `You are an expert in...`,
  userPromptTemplate: `Given the following parameters:

Parameter 1: {{param1}}
Parameter 2: {{param2}}

Generate...

Return as JSON:
{
  "field1": "...",
  "field2": "..."
}`,
  variables: ['param1', 'param2'],
  optionalVariables: ['optionalParam'],
  modelSuggestions: [
    {
      model: 'google/gemini-2.0-flash-exp:free',
      priority: 'primary',
      reason: 'Fast and cost-effective',
    },
  ],
  temperature: 0.7,
  maxTokens: 2000,
  responseFormat: 'json_object',
  tags: ['tag1', 'tag2'],
  metadata: {
    costEstimate: '$0.001-$0.003 per call',
    averageLatency: '2-3 seconds',
  },
};
```

### Step 2: Export in Collection

```typescript
export const myPromptCategory = {
  MY_NEW_PROMPT,
  // ... other prompts
};
```

### Step 3: Register in Index

In `index.ts`, import and add to the prompt store:

```typescript
import { myPromptCategory } from './my-prompt-category';

export const promptStore: Record<string, PromptTemplate> = {
  // ... existing prompts
  ...Object.fromEntries(
    Object.entries(myPromptCategory).map(([, prompt]) => [prompt.id, prompt])
  ),
};
```

### Step 4: Create Helper Function (Optional)

In `meal-generator.ts` or create a new helper file:

```typescript
export async function myNewFunction(params: {
  param1: string;
  param2: string;
  modelOverride?: string;
}): Promise<MyResponseType> {
  const rendered = renderPromptById('my-new-prompt', {
    variables: {
      param1: params.param1,
      param2: params.param2,
    },
    modelOverride: params.modelOverride,
  });

  const client = getOpenRouterClient();
  const response = await client.chat.completions.create({
    model: rendered.config.model,
    messages: [
      { role: 'system', content: rendered.system },
      { role: 'user', content: rendered.user },
    ],
    temperature: rendered.config.temperature,
    max_tokens: rendered.config.maxTokens,
    response_format: rendered.config.responseFormat === 'json_object'
      ? { type: 'json_object' }
      : undefined,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from AI model');

  return JSON.parse(content);
}
```

---

## Best Practices

### 1. **Prompt Engineering**

- **Be Specific**: Clearly define what you want in the system and user prompts
- **Provide Examples**: Include example inputs/outputs in the prompt when possible
- **Use Structured Output**: Always request JSON for programmatic use
- **Set Context**: Give the AI a clear role (e.g., "You are a professional chef...")

### 2. **Variable Naming**

- Use `camelCase` for variable names
- Be descriptive: `dietaryRestrictions` not `diet`
- Required vs. optional: Clearly separate in `variables` vs. `optionalVariables`

### 3. **Model Selection**

- **Google Gemini 2.0 Flash**: Fast, cheap, good for creative tasks ($0.0003/call)
- **Claude 3.5 Sonnet**: Best reasoning, accuracy, safety-critical tasks ($0.003-$0.015/call)
- **GPT-4o/GPT-4o-mini**: Strong general knowledge, good fallback ($0.002-$0.01/call)

### 4. **Temperature Settings**

- **0.1-0.3**: Factual, deterministic (nutritional calculations, allergen detection)
- **0.4-0.6**: Balanced (analysis, improvements, scaling)
- **0.7-0.9**: Creative (meal generation, variations, themes)

### 5. **Error Handling**

Always wrap AI calls in try-catch and provide fallbacks:

```typescript
try {
  const result = await generateCompleteMeal(params);
  return result;
} catch (error) {
  console.error('AI generation failed:', error);
  // Fallback or user-friendly error message
  throw new Error('Unable to generate meal. Please try again.');
}
```

### 6. **Cost Optimization**

- Use cheaper models (Gemini Flash) for non-critical tasks
- Cache results when appropriate
- Batch similar requests when possible
- Set reasonable `max_tokens` limits

### 7. **Versioning**

When updating prompts:
- Increment patch version (1.0.0 → 1.0.1) for minor wording changes
- Increment minor version (1.0.0 → 1.1.0) for new variables or significant improvements
- Increment major version (1.0.0 → 2.0.0) for breaking changes

---

## Model Selection Guide

### Google Gemini 2.0 Flash (Free)
**Best For**: High-volume, creative tasks, budget-conscious operations

- **Pros**: Free, fast, good creative output, handles JSON well
- **Cons**: Occasional hallucinations, less accurate for complex reasoning
- **Use Cases**: Meal generation, recipe variations, initial drafts
- **Cost**: Free (with rate limits)

### Anthropic Claude 3.5 Sonnet
**Best For**: Accuracy-critical, safety-sensitive, complex reasoning

- **Pros**: Most accurate, excellent reasoning, very safe outputs, best for nuanced tasks
- **Cons**: More expensive, slightly slower
- **Use Cases**: Allergen detection, dietary compliance, detailed analysis, recipe improvements
- **Cost**: ~$0.003-$0.015 per call

### OpenAI GPT-4o / GPT-4o-mini
**Best For**: General-purpose tasks, strong world knowledge

- **Pros**: Excellent general knowledge, good at creative and analytical tasks, reliable
- **Cons**: Mid-tier pricing
- **Use Cases**: Fallback for most tasks, cultural knowledge, themed meals
- **Cost**: ~$0.002-$0.01 per call

---

## API Reference

### Core Functions

#### `getPrompt(id: string): PromptTemplate | undefined`
Get a prompt template by ID.

#### `getPromptsByCategory(category: PromptCategory): PromptTemplate[]`
Get all prompts in a category.

#### `searchPromptsByTag(tag: string): PromptTemplate[]`
Search prompts by tag.

#### `renderPrompt(template: PromptTemplate, options: PromptRenderOptions): RenderedPrompt`
Render a prompt with variable substitution.

#### `renderPromptById(promptId: string, options: PromptRenderOptions): RenderedPrompt`
Render a prompt by ID.

#### `validatePromptVariables(template: PromptTemplate, variables: Record<string, string>): PromptValidationResult`
Validate that all required variables are provided.

#### `listPromptIds(): string[]`
List all prompt IDs.

#### `listPromptsWithInfo(): Array<{id, name, description, category, version}>`
List all prompts with metadata.

### Meal Generator Functions

See [Available Prompts](#available-prompts) section for detailed parameter lists:

- `generateCompleteMeal(params): Promise<CompleteMeal>`
- `generateComplementarySides(params): Promise<Dish[]>`
- `generateThemedMeal(params): Promise<ThemedMealResponse>`
- `generateDietaryMeal(params): Promise<DietaryMealResponse>`
- `generateSeasonalMeal(params): Promise<SeasonalMealResponse>`
- `generateBudgetMeal(params): Promise<BudgetMealResponse>`

### Generic Caller

#### `callPrompt<T>(promptId, variables, options?): Promise<T>`
Generic function to call any prompt with optional Zod validation.

---

## Support & Contributing

### Reporting Issues
If a prompt is producing poor results:
1. Note the prompt ID and version
2. Provide example inputs and outputs
3. Describe expected vs. actual behavior
4. Suggest prompt improvements

### Contributing New Prompts
1. Follow the template structure in [Adding New Prompts](#adding-new-prompts)
2. Test with multiple models and scenarios
3. Document expected inputs/outputs
4. Include cost/latency estimates
5. Add tags for discoverability

---

**Last Updated**: 2025-10-19
**Version**: 1.0.0
**Total Prompts**: 15
**Maintained By**: Recipe Manager AI Team
