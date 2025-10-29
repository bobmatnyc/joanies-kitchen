'use server';

import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { generateMeal, type MealPlan, type SimpleMealRequest } from '@/lib/ai/meal-pairing-engine';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { mealRecipes, meals, type NewMeal, type NewMealRecipe } from '@/lib/db/schema';

// ============================================================================
// Input Validation Schemas
// ============================================================================

/**
 * Zod schema for validating meal generation requests
 */
const simpleMealRequestSchema = z.object({
  cuisine: z.string().optional(),
  theme: z.string().optional(),
  mainDish: z.string().optional(),
  dietary: z.array(z.string()).optional(),
  ingredients: z.array(z.string()).optional(),
  maxTime: z.number().min(15).max(480).optional(), // 15 minutes to 8 hours
  servings: z.number().min(1).max(50).optional(), // 1-50 servings
});

/**
 * Zod schema for saving meal plans
 */
const saveMealPlanSchema = z.object({
  name: z.string().min(1).max(200),
  mealPlan: z.object({
    appetizer: z.object({
      name: z.string(),
      recipe_id: z.string().optional(),
    }),
    main: z.object({
      name: z.string(),
      recipe_id: z.string().optional(),
    }),
    side: z.object({
      name: z.string(),
      recipe_id: z.string().optional(),
    }),
    dessert: z.object({
      name: z.string(),
      recipe_id: z.string().optional(),
    }),
    meal_analysis: z.object({
      total_prep_time: z.number(),
    }),
  }),
  occasion: z.string().optional(),
});

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Generate a balanced meal plan using AI
 *
 * @param request - Meal generation parameters (cuisine, theme, mainDish, etc.)
 * @returns { success: boolean, data?: MealPlan, error?: string }
 *
 * @example
 * ```typescript
 * const result = await generateBalancedMeal({
 *   cuisine: "Italian",
 *   servings: 4,
 *   maxTime: 90
 * });
 *
 * if (result.success) {
 *   console.log("Generated meal:", result.data);
 * }
 * ```
 */
export async function generateBalancedMeal(request: SimpleMealRequest) {
  try {
    // 1. Authentication check
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: 'Authentication required to generate meal plans',
      };
    }

    // 2. Input validation
    const validationResult = simpleMealRequestSchema.safeParse(request);
    if (!validationResult.success) {
      return {
        success: false,
        error: `Invalid request: ${validationResult.error.errors.map((e) => e.message).join(', ')}`,
      };
    }

    // 3. Validate that at least one of cuisine, theme, or mainDish is provided
    if (!request.cuisine && !request.theme && !request.mainDish) {
      return {
        success: false,
        error: 'Please provide at least one of: cuisine, theme, or main dish',
      };
    }

    // 4. Rate limiting check (simple time-based check)
    // TODO: Implement proper rate limiting with Redis or similar
    // For now, we'll rely on OpenRouter's rate limiting

    // 5. Call meal pairing engine
    const result = await generateMeal(validationResult.data);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to generate meal plan',
      };
    }

    // 6. Return successful result
    return {
      success: true,
      data: result.mealPlan,
    };
  } catch (error: any) {
    console.error('Error in generateBalancedMeal:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred while generating the meal plan',
    };
  }
}

/**
 * Save a generated meal plan to the database
 *
 * Creates entries in meals and meal_recipes tables.
 * Links to existing recipes where recipe_id is available.
 *
 * @param mealPlan - The generated meal plan from generateBalancedMeal
 * @param name - Name for the saved meal plan
 * @param occasion - Optional occasion/theme (e.g., "Date Night", "Family Dinner")
 * @returns { success: boolean, data?: string (meal_id), error?: string }
 *
 * @example
 * ```typescript
 * const result = await saveMealPlanFromPairing(
 *   generatedMealPlan,
 *   "Italian Date Night",
 *   "date night"
 * );
 *
 * if (result.success) {
 *   console.log("Saved meal ID:", result.data);
 * }
 * ```
 */
export async function saveMealPlanFromPairing(mealPlan: MealPlan, name: string, occasion?: string) {
  try {
    // 1. Authentication check
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: 'Authentication required to save meal plans',
      };
    }

    // 2. Input validation
    const validationResult = saveMealPlanSchema.safeParse({
      name,
      mealPlan,
      occasion,
    });

    if (!validationResult.success) {
      return {
        success: false,
        error: `Invalid meal plan data: ${validationResult.error.errors.map((e) => e.message).join(', ')}`,
      };
    }

    // 3. Extract meal analysis data
    const mealAnalysis = mealPlan.meal_analysis;
    const totalPrepTime = mealAnalysis.total_prep_time;

    // 4. Insert meal record
    const mealData: NewMeal = {
      user_id: userId,
      name: name.trim(),
      description: mealAnalysis.chef_notes || undefined,
      meal_type: 'dinner', // Default to dinner, can be customized later
      occasion: occasion?.trim() || undefined,
      serves: 4, // Default, matches typical meal plan servings
      tags: JSON.stringify([mealAnalysis.cultural_coherence, ...mealAnalysis.color_palette]),
      total_prep_time: totalPrepTime,
      is_template: false,
      is_public: false,
    };

    const [createdMeal] = await db.insert(meals).values(mealData).returning();

    if (!createdMeal?.id) {
      return {
        success: false,
        error: 'Failed to create meal record',
      };
    }

    // 5. Insert meal recipe records for each course
    const courses = [
      { course: 'appetizer', data: mealPlan.appetizer, order: 1 },
      { course: 'main', data: mealPlan.main, order: 2 },
      { course: 'side', data: mealPlan.side, order: 3 },
      { course: 'dessert', data: mealPlan.dessert, order: 4 },
    ];

    const mealRecipeData: NewMealRecipe[] = courses
      .filter((course) => course.data.recipe_id) // Only include courses with linked recipes
      .map((course) => ({
        meal_id: createdMeal.id,
        recipe_id: course.data.recipe_id!,
        course_category: course.course as 'appetizer' | 'main' | 'side' | 'dessert',
        display_order: course.order,
        serving_multiplier: '1.00', // Default 1:1 serving ratio
        preparation_notes: course.data.pairing_rationale || undefined,
      }));

    // 6. Insert meal recipe records (if any have recipe_ids)
    if (mealRecipeData.length > 0) {
      await db.insert(mealRecipes).values(mealRecipeData);
    }

    // 7. Revalidate relevant pages
    revalidatePath('/meals');
    revalidatePath('/meal-plans');

    // 8. Return success with meal ID
    return {
      success: true,
      data: createdMeal.id,
      message: `Meal plan "${name}" saved successfully`,
    };
  } catch (error: any) {
    console.error('Error in saveMealPlanFromPairing:', error);
    return {
      success: false,
      error: error.message || 'Failed to save meal plan',
    };
  }
}

/**
 * Get user's meal pairing history
 *
 * Retrieves previously generated/saved meal plans with linked recipes.
 * Results are paginated and sorted by creation date (most recent first).
 *
 * @param userId - Clerk user ID (optional, defaults to current user)
 * @param limit - Maximum number of results (default: 20, max: 100)
 * @param offset - Pagination offset (default: 0)
 * @returns { success: boolean, data?: Meal[], error?: string, pagination?: object }
 *
 * @example
 * ```typescript
 * const result = await getMealPairingHistory();
 *
 * if (result.success) {
 *   result.data.forEach(meal => {
 *     console.log(`${meal.name}: ${meal.recipes?.length || 0} recipes`);
 *   });
 * }
 * ```
 */
export async function getMealPairingHistory(
  userId?: string,
  limit: number = 20,
  offset: number = 0
) {
  try {
    // 1. Authentication check
    const { userId: currentUserId } = await auth();
    if (!currentUserId) {
      return {
        success: false,
        error: 'Authentication required to view meal plans',
      };
    }

    // 2. Use provided userId or current user (validate ownership)
    const targetUserId = userId || currentUserId;
    if (userId && userId !== currentUserId) {
      // TODO: Add admin role check here if needed
      return {
        success: false,
        error: "You do not have permission to view this user's meal plans",
      };
    }

    // 3. Validate pagination parameters
    const validLimit = Math.min(Math.max(1, limit), 100); // Clamp between 1-100
    const validOffset = Math.max(0, offset);

    // 4. Query meals using Drizzle select
    const userMeals = await db
      .select()
      .from(meals)
      .where(eq(meals.user_id, targetUserId))
      .orderBy(desc(meals.created_at))
      .limit(validLimit)
      .offset(validOffset);

    // 5. Get total count for pagination metadata
    const allUserMeals = await db.select().from(meals).where(eq(meals.user_id, targetUserId));

    // 6. Return results with pagination info
    return {
      success: true,
      data: userMeals,
      pagination: {
        limit: validLimit,
        offset: validOffset,
        total: allUserMeals.length,
        hasMore: validOffset + validLimit < allUserMeals.length,
      },
    };
  } catch (error: any) {
    console.error('Error in getMealPairingHistory:', error);
    return {
      success: false,
      error: error.message || 'Failed to retrieve meal plan history',
    };
  }
}

/**
 * Delete a meal plan
 *
 * Removes a meal plan and all associated meal_recipes records.
 * Only the owner can delete their meal plans.
 *
 * @param mealId - UUID of the meal to delete
 * @returns { success: boolean, error?: string }
 */
export async function deleteMealPlan(mealId: string) {
  try {
    // 1. Authentication check
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: 'Authentication required to delete meal plans',
      };
    }

    // 2. Validate meal ID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(mealId)) {
      return {
        success: false,
        error: 'Invalid meal ID format',
      };
    }

    // 3. Verify ownership
    const mealResults = await db.select().from(meals).where(eq(meals.id, mealId)).limit(1);

    if (mealResults.length === 0) {
      return {
        success: false,
        error: 'Meal plan not found',
      };
    }

    const meal = mealResults[0];

    if (meal.user_id !== userId) {
      return {
        success: false,
        error: 'You do not have permission to delete this meal plan',
      };
    }

    // 4. Delete meal (cascades to meal_recipes)
    await db.delete(meals).where(eq(meals.id, mealId));

    // 5. Revalidate pages
    revalidatePath('/meals');
    revalidatePath('/meal-plans');

    return {
      success: true,
      message: 'Meal plan deleted successfully',
    };
  } catch (error: any) {
    console.error('Error in deleteMealPlan:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete meal plan',
    };
  }
}

// ============================================================================
// Export Aliases (for backward compatibility)
// ============================================================================

/**
 * Alias for generateBalancedMeal
 * @deprecated Use generateBalancedMeal instead
 */
export const generateMealPairing = generateBalancedMeal;
