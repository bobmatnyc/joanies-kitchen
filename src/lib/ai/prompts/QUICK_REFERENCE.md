# AI Prompt Store - Quick Reference Card

**One-page reference for developers**

---

## Import Statements

```typescript
// High-level helpers (recommended)
import {
  generateCompleteMeal,
  generateComplementarySides,
  generateThemedMeal,
  generateDietaryMeal,
  generateSeasonalMeal,
  generateBudgetMeal,
  callPrompt,
} from '@/lib/ai/meal-generator';

// Low-level prompt store access
import {
  getPrompt,
  renderPromptById,
  listPromptsWithInfo,
  getPromptsByCategory,
} from '@/lib/ai/prompts';
```

---

## Most Common Use Cases

### 1. Generate Complete Meal (Most Popular)

```typescript
const meal = await generateCompleteMeal({
  mainDish: 'Grilled Salmon',           // or 'surprise me'
  cuisine: 'Mediterranean',             // or 'any'
  dietaryRestrictions: 'gluten-free',   // or 'none'
  servings: 4,
  occasion: 'dinner party',             // or 'weeknight'
});
// Returns: Array of 5 dishes [main, side1, side2, appetizer, dessert]
```

### 2. Get Side Dish Recommendations

```typescript
const sides = await generateComplementarySides({
  mainDish: 'Grilled Ribeye Steak',
  mainDescription: 'Medium-rare ribeye with herb butter',
  cuisine: 'American',
  cookingMethod: 'grilled',
  servings: 4,
  count: 3,  // Number of sides to generate
});
// Returns: Array of 3 side dishes
```

### 3. Calculate Nutrition Info

```typescript
const nutrition = await callPrompt(
  'comprehensive-nutrition-calculator',
  {
    recipeName: recipe.name,
    servings: String(recipe.servings),
    ingredients: JSON.stringify(recipe.ingredients),
  }
);
// Returns: { macronutrients, dietary_flags, allergens, ... }
```

### 4. Analyze Recipe for Improvements

```typescript
const analysis = await callPrompt(
  'recipe-improvement-analyzer',
  {
    recipeName: recipe.name,
    cuisine: recipe.cuisine || 'Unknown',
    difficulty: recipe.difficulty,
    ingredients: JSON.stringify(recipe.ingredients),
    instructions: JSON.stringify(recipe.instructions),
    tags: JSON.stringify(recipe.tags),
  },
  {
    modelOverride: 'anthropic/claude-3.5-sonnet',  // Best for analysis
  }
);
```

---

## All 15 Prompts at a Glance

| Prompt ID | Category | Use Case | Best Model |
|-----------|----------|----------|------------|
| `meal-builder-complete` | Meal | Full multi-course meal | Gemini Flash |
| `complementary-sides` | Meal | Side dish pairing | Gemini Flash |
| `themed-meal` | Meal | Occasion/cultural meals | Claude Sonnet |
| `dietary-meal-builder` | Meal | Strict dietary compliance | Claude Sonnet |
| `seasonal-meal` | Meal | Seasonal ingredients | Gemini Flash |
| `budget-meal-planner` | Meal | Cost-effective meals | Gemini Flash |
| `recipe-improvement-analyzer` | Analysis | Suggest improvements | Claude Sonnet |
| `recipe-variation-generator` | Recipe | Create variations | Gemini Flash |
| `missing-ingredient-identifier` | Analysis | Find missing items | Claude Sonnet |
| `cooking-difficulty-estimator` | Analysis | Rate difficulty | Claude Sonnet |
| `recipe-scaling-optimizer` | Analysis | Scale recipes | Claude Sonnet |
| `comprehensive-nutrition-calculator` | Nutrition | Full nutrition info | Claude Sonnet |
| `healthier-substitution-suggester` | Nutrition | Healthier swaps | Claude Sonnet |
| `allergen-detector` | Nutrition | Find allergens | Claude Sonnet |
| `macro-friendly-optimizer` | Nutrition | Hit macro targets | Claude Sonnet |

---

## Model Selection Cheat Sheet

**Use Google Gemini 2.0 Flash when**:
- Creative meal generation ✓
- Recipe variations ✓
- Budget is tight ✓
- Speed is important ✓

**Use Claude 3.5 Sonnet when**:
- Dietary compliance (safety-critical) ✓
- Nutritional accuracy matters ✓
- Complex reasoning needed ✓
- Recipe analysis/improvements ✓

**Use GPT-4o/GPT-4o-mini when**:
- Claude fails (fallback) ✓
- Cultural/world knowledge needed ✓

---

## Temperature Guide

| Task Type | Temperature | Example |
|-----------|------------|---------|
| Factual/Math | 0.1-0.3 | Nutrition calculation, allergen detection |
| Analysis | 0.4-0.6 | Recipe improvements, difficulty rating |
| Creative | 0.7-0.9 | Meal generation, recipe variations |

---

## Error Handling Pattern

```typescript
try {
  const result = await generateCompleteMeal(params);
  return result;
} catch (error) {
  console.error('AI generation failed:', error);
  // Fallback or user-friendly error
  throw new Error('Unable to generate meal. Please try again.');
}
```

---

## Variable Substitution

Prompts use `{{variable}}` placeholders:

```typescript
// In prompt template:
"Generate a meal for {{servings}} people with {{cuisine}} cuisine."

// Gets rendered as:
"Generate a meal for 4 people with Italian cuisine."
```

---

## Cost Estimates (per call)

| Model | Cost Range | Best For |
|-------|------------|----------|
| Gemini Flash | Free - $0.003 | Most tasks |
| Claude Sonnet | $0.003 - $0.015 | Critical accuracy |
| GPT-4o-mini | $0.002 - $0.005 | General purpose |
| GPT-4o | $0.005 - $0.015 | Complex tasks |

**Average cost per prompt call**: ~$0.002-$0.005

---

## Common Patterns

### Pattern 1: Override Default Model
```typescript
const result = await callPrompt(
  'meal-builder-complete',
  variables,
  {
    modelOverride: 'anthropic/claude-3.5-sonnet',  // Force different model
  }
);
```

### Pattern 2: Validate with Zod
```typescript
import { z } from 'zod';

const MealSchema = z.array(
  z.object({
    name: z.string(),
    type: z.enum(['main', 'side', 'appetizer', 'dessert']),
    // ... more fields
  })
);

const meal = await callPrompt('meal-builder-complete', variables, {
  zodSchema: MealSchema,  // Automatic validation
});
```

### Pattern 3: List All Available Prompts
```typescript
import { listPromptsWithInfo } from '@/lib/ai/prompts';

const prompts = listPromptsWithInfo();
prompts.forEach((p) => {
  console.log(`${p.id}: ${p.name} (${p.category})`);
});
```

---

## Server Action Template

```typescript
'use server';

import { auth } from '@clerk/nextjs';
import { generateCompleteMeal } from '@/lib/ai/meal-generator';

export async function createMealPlanAction(params: {
  cuisine: string;
  servings: number;
}) {
  const { userId } = auth();
  if (!userId) throw new Error('Unauthorized');

  try {
    const meal = await generateCompleteMeal({
      mainDish: 'surprise me',
      cuisine: params.cuisine,
      dietaryRestrictions: 'none',
      servings: params.servings,
      occasion: 'weeknight',
    });

    // Save to database...
    return { success: true, meal };
  } catch (error) {
    console.error('Failed:', error);
    return { success: false, error: 'Failed to generate meal' };
  }
}
```

---

## Debug Tips

### Check Available Prompts
```typescript
import { promptStore } from '@/lib/ai/prompts';
console.log('Available prompts:', Object.keys(promptStore));
```

### Inspect Rendered Prompt
```typescript
import { renderPromptById } from '@/lib/ai/prompts';

const rendered = renderPromptById('meal-builder-complete', {
  variables: { /* ... */ },
});

console.log('System:', rendered.system);
console.log('User:', rendered.user);
console.log('Model:', rendered.config.model);
```

### Validate Variables Before Calling
```typescript
import { getPrompt, validatePromptVariables } from '@/lib/ai/prompts';

const template = getPrompt('meal-builder-complete');
const validation = validatePromptVariables(template, variables);

if (!validation.valid) {
  console.error('Errors:', validation.errors);
  console.warn('Warnings:', validation.warnings);
}
```

---

## Best Practices Checklist

- ✅ Always wrap AI calls in try-catch
- ✅ Use type-safe helpers (`generateCompleteMeal`) over raw `callPrompt` when available
- ✅ Validate responses with Zod schemas
- ✅ Choose appropriate model for task (see Model Selection)
- ✅ Set reasonable temperature (0.3 for facts, 0.7 for creativity)
- ✅ Provide user-friendly error messages
- ✅ Log errors for debugging but don't expose AI internals to users
- ✅ Consider caching for expensive/repeated calls
- ✅ Use batch processing for multiple recipes

---

## Common Gotchas

❌ **Don't stringify numbers**: `servings: String(4)` not `servings: 4`
❌ **Don't forget to JSON.stringify arrays**: `ingredients: JSON.stringify(arr)`
❌ **Don't use `{{variable}}` in your code**: That's for templates only
❌ **Don't hardcode models**: Use prompt recommendations or override
❌ **Don't skip error handling**: Always wrap in try-catch

✅ **Do use helper functions**: They handle edge cases
✅ **Do check validation results**: Catch errors early
✅ **Do read the README**: Full docs with examples
✅ **Do use TypeScript**: Full type safety available

---

## Getting Help

1. **README.md**: Comprehensive documentation
2. **EXAMPLES.md**: Real-world integration patterns
3. **Types**: IntelliSense shows all available options
4. **Console logs**: Debug rendered prompts before calling

---

**Last Updated**: 2025-10-19
**Version**: 1.0.0
**Total Prompts**: 15
