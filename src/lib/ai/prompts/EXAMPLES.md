# AI Prompt Store - Practical Examples

Real-world integration examples for the Recipe Manager application.

## Table of Contents

1. [Server Action Integration](#server-action-integration)
2. [Recipe Enhancement Workflow](#recipe-enhancement-workflow)
3. [Meal Planning Integration](#meal-planning-integration)
4. [Nutritional Analysis Pipeline](#nutritional-analysis-pipeline)
5. [Error Handling Patterns](#error-handling-patterns)
6. [Caching Strategies](#caching-strategies)

---

## Server Action Integration

### Example 1: Complete Meal Generation Server Action

```typescript
// src/app/actions/meal-planning.ts
'use server';

import { auth } from '@clerk/nextjs';
import { generateCompleteMeal } from '@/lib/ai/meal-generator';
import { db } from '@/lib/db';
import { mealPlans, mealPlanRecipes, recipes } from '@/lib/db/schema';

export async function generateMealPlanFromAI(params: {
  mainDish?: string;
  cuisine?: string;
  dietaryRestrictions?: string;
  servings?: number;
  occasion?: string;
  saveToDB?: boolean;
}) {
  const { userId } = auth();
  if (!userId) {
    throw new Error('Unauthorized');
  }

  try {
    // Generate meal using prompt store
    const meal = await generateCompleteMeal({
      mainDish: params.mainDish,
      cuisine: params.cuisine,
      dietaryRestrictions: params.dietaryRestrictions,
      servings: params.servings,
      occasion: params.occasion,
    });

    // Optionally save to database
    if (params.saveToDB) {
      // Create meal plan
      const [mealPlan] = await db
        .insert(mealPlans)
        .values({
          userId,
          name: `${params.cuisine || 'Mixed'} ${params.occasion || 'Meal'}`,
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
        })
        .returning();

      // Save each dish as a recipe (simplified)
      for (const dish of meal) {
        const [savedRecipe] = await db
          .insert(recipes)
          .values({
            userId,
            name: dish.name,
            description: dish.description,
            ingredients: [], // Would need to generate full recipe
            instructions: [],
            prepTime: dish.prep_time,
            cookTime: dish.cook_time,
            servings: params.servings || 4,
            difficulty: dish.difficulty,
            cuisine: dish.cuisine || params.cuisine || 'Mixed',
            tags: dish.tags || [],
            isAiGenerated: true,
            isPublic: false,
          })
          .returning();

        // Link to meal plan
        await db.insert(mealPlanRecipes).values({
          mealPlanId: mealPlan.id,
          recipeId: savedRecipe.id,
          dayOfWeek: 0, // Sunday (would be smarter in real implementation)
          mealType: dish.type === 'main' ? 'dinner' : 'snack',
        });
      }

      return { meal, mealPlan };
    }

    return { meal };
  } catch (error) {
    console.error('Failed to generate meal plan:', error);
    throw new Error('Failed to generate meal. Please try again.');
  }
}
```

---

## Recipe Enhancement Workflow

### Example 2: Recipe Improvement Analysis

```typescript
// src/app/actions/recipe-enhancement.ts
'use server';

import { auth } from '@clerk/nextjs';
import { callPrompt } from '@/lib/ai/meal-generator';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const ImprovementSchema = z.object({
  overall_assessment: z.object({
    strengths: z.array(z.string()),
    areas_for_improvement: z.array(z.string()),
    difficulty_rating: z.string(),
    confidence_score: z.number(),
  }),
  improvements: z.array(
    z.object({
      category: z.string(),
      current: z.string(),
      suggested: z.string(),
      rationale: z.string(),
      impact: z.enum(['low', 'medium', 'high']),
      ease_of_implementation: z.enum(['easy', 'moderate', 'difficult']),
    })
  ),
  enhanced_recipe_summary: z.object({
    would_change_difficulty: z.boolean(),
    estimated_improvement: z.string(),
    prep_time_change: z.string(),
    cost_impact: z.string(),
  }),
});

export async function analyzeAndImproveRecipe(recipeId: string) {
  const { userId } = auth();
  if (!userId) {
    throw new Error('Unauthorized');
  }

  // Fetch recipe from database
  const [recipe] = await db
    .select()
    .from(recipes)
    .where(eq(recipes.id, recipeId));

  if (!recipe) {
    throw new Error('Recipe not found');
  }

  // Ensure user owns the recipe or it's public
  if (recipe.userId !== userId && !recipe.isPublic) {
    throw new Error('Unauthorized to analyze this recipe');
  }

  try {
    // Call improvement analyzer prompt
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
        zodSchema: ImprovementSchema,
        modelOverride: 'anthropic/claude-3.5-sonnet', // Use best model for analysis
      }
    );

    // Store analysis results (you could save to a separate table)
    return {
      recipeId: recipe.id,
      recipeName: recipe.name,
      analysis,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to analyze recipe:', error);
    throw new Error('Failed to analyze recipe. Please try again.');
  }
}
```

---

## Meal Planning Integration

### Example 3: Smart Side Dish Recommendation

```typescript
// src/app/recipes/[slug]/complementary-sides.tsx
'use client';

import { useState } from 'react';
import { generateComplementarySides, type Dish } from '@/lib/ai/meal-generator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Recipe {
  id: string;
  name: string;
  description: string;
  cuisine: string;
  servings: number;
}

export function ComplementarySidesRecommendation({ recipe }: { recipe: Recipe }) {
  const [sides, setSides] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateSides = async () => {
    setLoading(true);
    setError(null);

    try {
      const generatedSides = await generateComplementarySides({
        mainDish: recipe.name,
        mainDescription: recipe.description,
        cuisine: recipe.cuisine,
        cookingMethod: 'mixed', // Could extract from recipe
        servings: recipe.servings,
        count: 3,
      });

      setSides(generatedSides);
    } catch (err) {
      console.error('Failed to generate sides:', err);
      setError('Failed to generate side dish recommendations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button onClick={handleGenerateSides} disabled={loading}>
        {loading ? 'Generating Sides...' : 'Get Side Dish Recommendations'}
      </Button>

      {error && (
        <div className="p-4 bg-red-50 text-red-800 rounded-md">{error}</div>
      )}

      {sides.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sides.map((side, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle>{side.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-gray-600">{side.description}</p>
                {side.pairing_rationale && (
                  <div className="text-xs text-gray-500 border-l-2 border-blue-300 pl-2">
                    <strong>Why it pairs well:</strong> {side.pairing_rationale}
                  </div>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Prep: {side.prep_time} min</span>
                  <span>Cook: {side.cook_time} min</span>
                  <span className="capitalize">{side.difficulty}</span>
                </div>
                {side.tags && side.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {side.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Nutritional Analysis Pipeline

### Example 4: Comprehensive Nutrition Calculation

```typescript
// src/app/actions/nutrition.ts
'use server';

import { auth } from '@clerk/nextjs';
import { callPrompt } from '@/lib/ai/meal-generator';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const NutritionSchema = z.object({
  serving_size: z.string(),
  servings: z.number(),
  macronutrients: z.object({
    calories: z.number(),
    protein_g: z.number(),
    carbohydrates_g: z.number(),
    fiber_g: z.number(),
    sugar_g: z.number(),
    total_fat_g: z.number(),
    saturated_fat_g: z.number(),
    trans_fat_g: z.number(),
    cholesterol_mg: z.number(),
    sodium_mg: z.number(),
  }),
  dietary_flags: z.object({
    vegetarian: z.boolean(),
    vegan: z.boolean(),
    gluten_free: z.boolean(),
    dairy_free: z.boolean(),
    nut_free: z.boolean(),
  }),
  allergens: z.array(z.string()),
  nutritional_highlights: z.array(z.string()),
  nutritional_concerns: z.array(z.string()),
});

export async function calculateRecipeNutrition(recipeId: string) {
  const { userId } = auth();
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const [recipe] = await db
    .select()
    .from(recipes)
    .where(eq(recipes.id, recipeId));

  if (!recipe) {
    throw new Error('Recipe not found');
  }

  try {
    const nutrition = await callPrompt(
      'comprehensive-nutrition-calculator',
      {
        recipeName: recipe.name,
        servings: String(recipe.servings),
        ingredients: JSON.stringify(recipe.ingredients),
      },
      {
        zodSchema: NutritionSchema,
        modelOverride: 'anthropic/claude-3.5-sonnet', // Most accurate for nutrition
      }
    );

    // Update recipe with nutrition info
    await db
      .update(recipes)
      .set({
        nutritionInfo: JSON.stringify(nutrition.macronutrients),
        tags: [
          ...new Set([
            ...(recipe.tags || []),
            ...Object.entries(nutrition.dietary_flags)
              .filter(([, value]) => value)
              .map(([key]) => key.replace('_', '-')),
          ]),
        ],
        updatedAt: new Date(),
      })
      .where(eq(recipes.id, recipeId));

    return nutrition;
  } catch (error) {
    console.error('Failed to calculate nutrition:', error);
    throw new Error('Failed to calculate nutritional information. Please try again.');
  }
}
```

---

## Error Handling Patterns

### Example 5: Robust Error Handling with Fallbacks

```typescript
// src/lib/ai/prompt-caller-with-retry.ts
import { callPrompt } from '@/lib/ai/meal-generator';
import { getPrompt, getFallbackModels } from '@/lib/ai/prompts';

interface RetryOptions {
  maxRetries?: number;
  fallbackModels?: boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function callPromptWithRetry<T>(
  promptId: string,
  variables: Record<string, string>,
  options?: RetryOptions & {
    zodSchema?: any;
    modelOverride?: string;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 2;
  const useFallbacks = options?.fallbackModels ?? true;

  // Get primary and fallback models
  const template = getPrompt(promptId);
  if (!template) {
    throw new Error(`Prompt not found: ${promptId}`);
  }

  const primaryModel =
    options?.modelOverride ||
    template.modelSuggestions.find((s) => s.priority === 'primary')?.model;

  const fallbackModelsList = useFallbacks ? getFallbackModels(promptId) : [];

  const modelsToTry = [primaryModel, ...fallbackModelsList].filter(Boolean);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const modelIndex = Math.min(attempt, modelsToTry.length - 1);
    const currentModel = modelsToTry[modelIndex];

    try {
      const result = await callPrompt<T>(promptId, variables, {
        ...options,
        modelOverride: currentModel,
      });

      return result;
    } catch (error) {
      lastError = error as Error;
      console.error(
        `Attempt ${attempt + 1}/${maxRetries} failed with model ${currentModel}:`,
        error
      );

      if (options?.onRetry) {
        options.onRetry(attempt + 1, error as Error);
      }

      // Don't retry on the last attempt
      if (attempt === maxRetries - 1) {
        break;
      }

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }

  throw new Error(
    `Failed after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`
  );
}

// Usage example
export async function generateMealWithRetry(params: any) {
  return callPromptWithRetry(
    'meal-builder-complete',
    {
      mainDish: params.mainDish || 'surprise me',
      cuisine: params.cuisine || 'any',
      dietaryRestrictions: params.dietaryRestrictions || 'none',
      servings: String(params.servings || 4),
      occasion: params.occasion || 'casual dinner',
    },
    {
      maxRetries: 3,
      fallbackModels: true,
      onRetry: (attempt, error) => {
        console.log(`Retry attempt ${attempt} due to:`, error.message);
      },
    }
  );
}
```

---

## Caching Strategies

### Example 6: Redis-Based Prompt Response Caching

```typescript
// src/lib/ai/prompt-cache.ts
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface CacheOptions {
  ttl?: number; // Time to live in seconds (default: 1 hour)
  skipCache?: boolean;
}

/**
 * Generate a cache key from prompt ID and variables
 */
function generateCacheKey(promptId: string, variables: Record<string, string>): string {
  const sortedVars = Object.keys(variables)
    .sort()
    .map((key) => `${key}:${variables[key]}`)
    .join('|');
  return `prompt:${promptId}:${Buffer.from(sortedVars).toString('base64')}`;
}

/**
 * Call a prompt with caching
 */
export async function callPromptCached<T>(
  promptId: string,
  variables: Record<string, string>,
  options?: CacheOptions & {
    zodSchema?: any;
    modelOverride?: string;
  }
): Promise<T> {
  const skipCache = options?.skipCache ?? false;
  const ttl = options?.ttl ?? 3600; // 1 hour default

  const cacheKey = generateCacheKey(promptId, variables);

  // Try to get from cache first
  if (!skipCache) {
    try {
      const cached = await redis.get<T>(cacheKey);
      if (cached) {
        console.log(`Cache hit for prompt ${promptId}`);
        return cached;
      }
    } catch (error) {
      console.error('Cache read error:', error);
      // Continue to generate if cache fails
    }
  }

  // Generate new result
  const result = await callPrompt<T>(promptId, variables, options);

  // Cache the result
  try {
    await redis.set(cacheKey, result, { ex: ttl });
    console.log(`Cached result for prompt ${promptId} (TTL: ${ttl}s)`);
  } catch (error) {
    console.error('Cache write error:', error);
    // Don't fail the request if caching fails
  }

  return result;
}

// Usage example
export async function getCachedSeasonalMeal(params: {
  season: string;
  region: string;
  cuisine: string;
}) {
  return callPromptCached(
    'seasonal-meal',
    {
      season: params.season,
      region: params.region,
      cuisine: params.cuisine,
      dietaryRestrictions: 'none',
      servings: '4',
      mealType: 'dinner',
    },
    {
      ttl: 86400, // Cache for 24 hours (seasonal data doesn't change often)
    }
  );
}
```

---

## Integration with Existing Recipe Generator

### Example 7: Migrating from Old to New Prompt System

```typescript
// Before (old system)
import { generateRecipe } from '@/lib/ai/recipe-generator';

const recipe = await generateRecipe({
  ingredients: ['chicken', 'garlic', 'lemon'],
  cuisine: 'Mediterranean',
  difficulty: 'medium',
});

// After (new prompt store system)
import { callPrompt } from '@/lib/ai/meal-generator';
import { z } from 'zod';

const RecipeSchema = z.object({
  name: z.string(),
  description: z.string(),
  ingredients: z.array(z.string()),
  instructions: z.array(z.string()),
  // ... rest of schema
});

// If you have a recipe generation prompt in the store:
const recipe = await callPrompt(
  'recipe-from-ingredients', // You'd need to add this prompt
  {
    ingredients: 'chicken, garlic, lemon',
    cuisine: 'Mediterranean',
    difficulty: 'medium',
    servings: '4',
  },
  { zodSchema: RecipeSchema }
);

// Or continue using the existing recipe-generator.ts
// alongside the new prompt store for specialized tasks
```

---

## Performance Optimization

### Example 8: Batch Processing with Rate Limiting

```typescript
// src/lib/ai/batch-processor.ts
import pLimit from 'p-limit';
import { callPrompt } from '@/lib/ai/meal-generator';

interface BatchItem {
  promptId: string;
  variables: Record<string, string>;
}

/**
 * Process multiple prompts with rate limiting
 */
export async function batchProcessPrompts<T>(
  items: BatchItem[],
  options?: {
    concurrency?: number;
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<T[]> {
  const limit = pLimit(options?.concurrency ?? 3); // Max 3 concurrent requests
  let completed = 0;

  const promises = items.map((item) =>
    limit(async () => {
      const result = await callPrompt<T>(item.promptId, item.variables);
      completed++;
      if (options?.onProgress) {
        options.onProgress(completed, items.length);
      }
      return result;
    })
  );

  return Promise.all(promises);
}

// Usage: Analyze multiple recipes in batch
export async function analyzeRecipesBatch(recipeIds: string[]) {
  const recipes = await db
    .select()
    .from(recipes)
    .where(inArray(recipes.id, recipeIds));

  const batchItems: BatchItem[] = recipes.map((recipe) => ({
    promptId: 'recipe-improvement-analyzer',
    variables: {
      recipeName: recipe.name,
      cuisine: recipe.cuisine || 'Unknown',
      difficulty: recipe.difficulty,
      ingredients: JSON.stringify(recipe.ingredients),
      instructions: JSON.stringify(recipe.instructions),
      tags: JSON.stringify(recipe.tags),
    },
  }));

  const results = await batchProcessPrompts(batchItems, {
    concurrency: 2, // Conservative to avoid rate limits
    onProgress: (completed, total) => {
      console.log(`Analyzed ${completed}/${total} recipes`);
    },
  });

  return results;
}
```

---

## Testing

### Example 9: Unit Testing Prompt Rendering

```typescript
// src/lib/ai/prompts/__tests__/prompt-rendering.test.ts
import { describe, it, expect } from 'vitest';
import {
  getPrompt,
  renderPrompt,
  validatePromptVariables,
} from '@/lib/ai/prompts';

describe('Prompt Rendering', () => {
  it('should render meal-builder-complete correctly', () => {
    const template = getPrompt('meal-builder-complete');
    expect(template).toBeDefined();

    const variables = {
      mainDish: 'Grilled Salmon',
      cuisine: 'Mediterranean',
      dietaryRestrictions: 'none',
      servings: '4',
      occasion: 'dinner',
    };

    const rendered = renderPrompt(template!, { variables });

    expect(rendered.system).toContain('expert chef');
    expect(rendered.user).toContain('Grilled Salmon');
    expect(rendered.user).toContain('Mediterranean');
    expect(rendered.user).not.toContain('{{');
    expect(rendered.config.model).toBe('google/gemini-2.0-flash-exp:free');
  });

  it('should validate required variables', () => {
    const template = getPrompt('meal-builder-complete');
    const incompleteVars = {
      mainDish: 'Salmon',
      cuisine: 'Mediterranean',
      // Missing: dietaryRestrictions, servings, occasion
    };

    const validation = validatePromptVariables(template!, incompleteVars);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toHaveLength(3);
    expect(validation.errors[0]).toContain('dietaryRestrictions');
  });

  it('should warn about extraneous variables', () => {
    const template = getPrompt('meal-builder-complete');
    const variables = {
      mainDish: 'Salmon',
      cuisine: 'Mediterranean',
      dietaryRestrictions: 'none',
      servings: '4',
      occasion: 'dinner',
      extraVar: 'should warn',
    };

    const validation = validatePromptVariables(template!, variables);

    expect(validation.valid).toBe(true);
    expect(validation.warnings).toContain('Unused variable provided: extraVar');
  });
});
```

---

These examples demonstrate real-world integration patterns for the AI Prompt Store in the Recipe Manager application. Adapt them to your specific use cases and extend as needed!
