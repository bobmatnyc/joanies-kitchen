/**
 * Zod Validation Schemas for Meals Feature
 *
 * Comprehensive runtime validation for all meal-related server actions.
 * These schemas provide type safety, input validation, and user-friendly error messages.
 */

import { z } from 'zod';

// ============================================================================
// Common Validation Patterns
// ============================================================================

/**
 * UUID validation with custom error message
 */
export const uuidSchema = z.string().uuid({ message: 'Invalid ID format' });

/**
 * Non-empty string with length constraints
 */
const nonEmptyString = (fieldName: string, maxLength: number = 500) =>
  z
    .string()
    .min(1, { message: `${fieldName} is required` })
    .max(maxLength, { message: `${fieldName} must be ${maxLength} characters or less` });

/**
 * Optional string that can be empty
 */
const optionalString = (maxLength: number = 1000) =>
  z
    .string()
    .max(maxLength, { message: `Text must be ${maxLength} characters or less` })
    .optional()
    .or(z.literal(''));

/**
 * Positive integer with range validation
 */
const positiveInt = (fieldName: string, min: number = 1, max: number = 1000) =>
  z
    .number()
    .int({ message: `${fieldName} must be a whole number` })
    .min(min, { message: `${fieldName} must be at least ${min}` })
    .max(max, { message: `${fieldName} must be ${max} or less` });

/**
 * Decimal string for monetary values (e.g., "12.50")
 */
const decimalString = (precision: number = 10, scale: number = 2) =>
  z.string().regex(new RegExp(`^\\d{1,${precision - scale}}(\\.\\d{1,${scale}})?$`), {
    message: `Invalid decimal format (max ${precision - scale} digits, ${scale} decimals)`,
  });

// ============================================================================
// Meal Type Enums
// ============================================================================

/**
 * Meal type categories
 */
export const mealTypeEnum = z.enum([
  'breakfast',
  'brunch',
  'lunch',
  'dinner',
  'snack',
  'dessert',
  'party',
  'holiday',
  'custom',
]);

/**
 * Course categories for recipes within a meal
 */
export const courseCategoryEnum = z.enum([
  'appetizer',
  'main',
  'side',
  'dessert',
  'drink',
  'bread',
  'salad',
  'soup',
  'other',
]);

/**
 * Shopping list status
 */
export const shoppingListStatusEnum = z.enum([
  'draft',
  'active',
  'shopping',
  'completed',
  'archived',
]);

// ============================================================================
// Meal Schemas
// ============================================================================

/**
 * Schema for creating a new meal
 *
 * Validates user input for meal creation forms.
 * All user_id fields are handled server-side and excluded from input.
 */
export const createMealSchema = z.object({
  name: nonEmptyString('Meal name', 200),
  description: nonEmptyString('Description', 1000), // Made required
  meal_type: mealTypeEnum.optional(),
  occasion: optionalString(200),
  serves: positiveInt('Number of servings', 1, 100).default(4),
  tags: z.string().optional(), // JSON string of tags
  is_template: z.boolean().default(false),
  is_public: z.boolean().default(false),
  estimated_total_cost: decimalString(10, 2).optional(),
  estimated_cost_per_serving: decimalString(10, 2).optional(),
});

/**
 * Schema for updating an existing meal
 *
 * All fields are optional (partial update).
 */
export const updateMealSchema = createMealSchema.partial();

/**
 * Schema for meal ID parameter validation
 */
export const mealIdSchema = z.object({
  id: uuidSchema,
});

/**
 * Schema for deleting a meal
 */
export const deleteMealSchema = mealIdSchema;

// ============================================================================
// Meal Recipe Schemas
// ============================================================================

/**
 * Schema for adding a recipe to a meal
 *
 * Validates the relationship between meals and recipes.
 */
export const addRecipeToMealSchema = z.object({
  meal_id: uuidSchema,
  recipe_id: z.string().min(1, { message: 'Recipe ID is required' }),
  course_category: courseCategoryEnum.default('main'),
  serving_multiplier: decimalString(4, 2).default('1.00'),
  display_order: z
    .number()
    .int()
    .nonnegative({ message: 'Display order cannot be negative' })
    .optional()
    .default(0),
  preparation_notes: optionalString(500),
});

/**
 * Schema for updating a meal recipe relationship
 *
 * Allows partial updates to serving multiplier, course category, etc.
 */
export const updateMealRecipeSchema = z.object({
  course_category: courseCategoryEnum.optional(),
  serving_multiplier: decimalString(4, 2).optional(),
  display_order: z
    .number()
    .int()
    .nonnegative({ message: 'Display order cannot be negative' })
    .optional(),
  preparation_notes: optionalString(500),
});

/**
 * Schema for meal recipe ID validation
 */
export const mealRecipeIdSchema = z.object({
  id: uuidSchema,
});

/**
 * Schema for removing a recipe from a meal
 */
export const removeMealRecipeSchema = mealRecipeIdSchema;

// ============================================================================
// Shopping List Schemas
// ============================================================================

/**
 * Schema for a single shopping list item
 */
export const shoppingListItemSchema = z.object({
  ingredient_id: z.string().optional(),
  name: nonEmptyString('Item name', 200),
  quantity: z.number().nonnegative({ message: 'Quantity cannot be negative' }).default(0),
  unit: z.string().max(50, { message: 'Unit must be 50 characters or less' }).default(''),
  category: z.string().max(50).default('other'),
  estimated_price: decimalString(10, 2).optional(),
  checked: z.boolean().default(false),
  from_recipes: z.array(z.string()).default([]),
  notes: optionalString(500),
});

/**
 * Schema for updating shopping list items
 */
export const updateShoppingListItemsSchema = z.object({
  items: z.array(shoppingListItemSchema),
});

/**
 * Schema for creating a shopping list
 */
export const createShoppingListSchema = z.object({
  name: nonEmptyString('Shopping list name', 200),
  notes: optionalString(1000),
  meal_id: uuidSchema.optional(),
  items: z.string().default('[]'), // JSON string
  status: shoppingListStatusEnum.default('draft'),
  estimated_total_cost: decimalString(10, 2).optional(),
});

/**
 * Schema for updating a shopping list
 */
export const updateShoppingListSchema = z.object({
  name: nonEmptyString('Shopping list name', 200).optional(),
  notes: optionalString(1000),
  items: z.string().optional(), // JSON string
  status: shoppingListStatusEnum.optional(),
  estimated_total_cost: decimalString(10, 2).optional(),
});

/**
 * Schema for shopping list ID validation
 */
export const shoppingListIdSchema = z.object({
  id: uuidSchema,
});

/**
 * Schema for generating a shopping list from a meal
 */
export const generateShoppingListSchema = z.object({
  mealId: uuidSchema,
});

// ============================================================================
// Query Parameter Schemas
// ============================================================================

/**
 * Schema for filtering user meals
 */
export const getUserMealsSchema = z.object({
  mealType: z
    .enum([
      'all',
      'breakfast',
      'brunch',
      'lunch',
      'dinner',
      'snack',
      'dessert',
      'party',
      'holiday',
      'custom',
    ])
    .default('all'),
  isTemplate: z.boolean().optional(),
  limit: positiveInt('Limit', 1, 100).default(20).optional(),
  offset: z
    .number()
    .int()
    .nonnegative({ message: 'Offset cannot be negative' })
    .default(0)
    .optional(),
});

/**
 * Schema for filtering meal templates
 */
export const getMealTemplatesSchema = z.object({
  mealType: z
    .enum([
      'all',
      'breakfast',
      'brunch',
      'lunch',
      'dinner',
      'snack',
      'dessert',
      'party',
      'holiday',
      'custom',
    ])
    .default('all')
    .optional(),
});

// ============================================================================
// Template Schemas
// ============================================================================

/**
 * Schema for creating a meal from a template
 */
export const createMealFromTemplateSchema = z.object({
  templateId: uuidSchema,
  mealName: nonEmptyString('Meal name', 200),
});

// ============================================================================
// Type Exports
// ============================================================================

// Infer TypeScript types from Zod schemas
export type CreateMealInput = z.infer<typeof createMealSchema>;
export type UpdateMealInput = z.infer<typeof updateMealSchema>;
export type AddRecipeToMealInput = z.infer<typeof addRecipeToMealSchema>;
export type UpdateMealRecipeInput = z.infer<typeof updateMealRecipeSchema>;
export type ShoppingListItem = z.infer<typeof shoppingListItemSchema>;
export type UpdateShoppingListItemsInput = z.infer<typeof updateShoppingListItemsSchema>;
export type CreateShoppingListInput = z.infer<typeof createShoppingListSchema>;
export type UpdateShoppingListInput = z.infer<typeof updateShoppingListSchema>;
export type GetUserMealsInput = z.infer<typeof getUserMealsSchema>;
export type GetMealTemplatesInput = z.infer<typeof getMealTemplatesSchema>;
export type CreateMealFromTemplateInput = z.infer<typeof createMealFromTemplateSchema>;

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Validate input and return user-friendly error messages
 *
 * @param schema - Zod schema to validate against
 * @param data - Input data to validate
 * @returns Parsed data or throws error with formatted message
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map((e) => {
        const path = e.path.length > 0 ? `${e.path.join('.')}: ` : '';
        return `${path}${e.message}`;
      });
      throw new Error(`Validation failed: ${errorMessages.join(', ')}`);
    }
    throw error;
  }
}

/**
 * Safe parse that returns result object instead of throwing
 *
 * @param schema - Zod schema to validate against
 * @param data - Input data to validate
 * @returns Object with success flag and data/error
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    const errorMessages = result.error.issues.map((e) => {
      const path = e.path.length > 0 ? `${e.path.join('.')}: ` : '';
      return `${path}${e.message}`;
    });
    return { success: false, error: errorMessages.join(', ') };
  }
}
