/**
 * Meal Planning Aggregator
 *
 * Utilities for aggregating multiple recipes into a complete meal plan with:
 * - Consolidated shopping lists
 * - Timeline of tasks across all recipes
 * - Tool/equipment requirements and conflicts
 * - Total time estimates
 */

import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  type Ingredient,
  ingredients,
  type Recipe,
  type RecipeIngredient,
  type RecipeTask,
  type RecipeTool,
  recipeIngredients,
  recipes,
  recipeTasks,
  recipeTools,
  type Tool,
  tools,
} from '@/lib/db/schema';

export interface MealRecipe {
  recipe: Recipe;
  courseType: 'appetizer' | 'main' | 'side' | 'dessert';
  servings: number; // Adjusted servings for this meal
}

export interface ConsolidatedIngredient {
  ingredient: Ingredient;
  totalAmount: number;
  unit: string;
  usedIn: string[]; // Recipe names
  category: string;
}

export interface ConsolidatedTool {
  tool: Tool;
  maxSimultaneousNeeded: number; // Maximum needed at once
  usedIn: string[]; // Recipe names
  conflicts: ToolConflict[];
}

export interface ToolConflict {
  tool: Tool;
  recipe1: string;
  recipe2: string;
  overlappingMinutes: number;
}

export interface TaskTimeline {
  startTime: number; // Minutes from meal start
  endTime: number; // Minutes from meal end
  task: RecipeTask;
  recipe: Recipe;
  role: string;
  canBeParallel: boolean;
  dependencies: string[]; // Task IDs
}

export interface MealPlan {
  recipes: MealRecipe[];
  totalServings: number;
  consolidatedIngredients: ConsolidatedIngredient[];
  consolidatedTools: ConsolidatedTool[];
  taskTimeline: TaskTimeline[];
  estimatedTotalTime: number; // Minutes
  estimatedActiveTime: number; // Minutes
  estimatedPassiveTime: number; // Minutes
  toolConflicts: ToolConflict[];
  estimatedCost: number; // USD
}

/**
 * Aggregate multiple recipes into a complete meal plan
 */
export async function aggregateMealPlan(mealRecipes: MealRecipe[]): Promise<MealPlan> {
  // Fetch all related data
  const recipeIds = mealRecipes.map((mr) => mr.recipe.id);

  const [ingredientsData, toolsData, tasksData] = await Promise.all([
    fetchRecipeIngredients(recipeIds),
    fetchRecipeTools(recipeIds),
    fetchRecipeTasks(recipeIds),
  ]);

  // Calculate total servings
  const totalServings = mealRecipes.reduce((sum, mr) => sum + mr.servings, 0);

  // Consolidate ingredients
  const consolidatedIngredients = consolidateIngredients(ingredientsData, mealRecipes);

  // Consolidate tools and find conflicts
  const consolidatedTools = consolidateTools(toolsData, mealRecipes);
  const toolConflicts = findToolConflicts(tasksData, mealRecipes);

  // Build task timeline
  const taskTimeline = buildTaskTimeline(tasksData, mealRecipes);

  // Calculate time estimates
  const { totalTime, activeTime, passiveTime } = calculateTimeEstimates(taskTimeline);

  // Estimate cost
  const estimatedCost = estimateMealCost(consolidatedIngredients);

  return {
    recipes: mealRecipes,
    totalServings,
    consolidatedIngredients,
    consolidatedTools,
    taskTimeline,
    estimatedTotalTime: totalTime,
    estimatedActiveTime: activeTime,
    estimatedPassiveTime: passiveTime,
    toolConflicts,
    estimatedCost,
  };
}

/**
 * Fetch recipe ingredients with ingredient details
 */
async function fetchRecipeIngredients(recipeIds: string[]) {
  const result = await db
    .select({
      recipeIngredient: recipeIngredients,
      ingredient: ingredients,
      recipe: recipes,
    })
    .from(recipeIngredients)
    .innerJoin(ingredients, eq(recipeIngredients.ingredient_id, ingredients.id))
    .innerJoin(recipes, eq(recipeIngredients.recipe_id, recipes.id))
    .where(inArray(recipeIngredients.recipe_id, recipeIds));

  return result;
}

/**
 * Fetch recipe tools with tool details
 */
async function fetchRecipeTools(recipeIds: string[]) {
  const result = await db
    .select({
      recipeTool: recipeTools,
      tool: tools,
      recipe: recipes,
    })
    .from(recipeTools)
    .innerJoin(tools, eq(recipeTools.tool_id, tools.id))
    .innerJoin(recipes, eq(recipeTools.recipe_id, recipes.id))
    .where(inArray(recipeTools.recipe_id, recipeIds));

  return result;
}

/**
 * Fetch recipe tasks
 */
async function fetchRecipeTasks(recipeIds: string[]) {
  const result = await db
    .select({
      task: recipeTasks,
      recipe: recipes,
    })
    .from(recipeTasks)
    .innerJoin(recipes, eq(recipeTasks.recipe_id, recipes.id))
    .where(inArray(recipeTasks.recipe_id, recipeIds))
    .orderBy(recipeTasks.task_order);

  return result;
}

/**
 * Consolidate ingredients across recipes
 */
function consolidateIngredients(
  ingredientsData: any[],
  mealRecipes: MealRecipe[]
): ConsolidatedIngredient[] {
  const ingredientMap = new Map<string, ConsolidatedIngredient>();

  for (const data of ingredientsData) {
    const { recipeIngredient, ingredient, recipe } = data;

    // Find meal recipe to get serving adjustment
    const mealRecipe = mealRecipes.find((mr) => mr.recipe.id === recipe.id);
    if (!mealRecipe) continue;

    // Calculate amount adjustment based on servings
    const servingMultiplier = mealRecipe.servings / (recipe.servings || 1);
    const adjustedAmount = recipeIngredient.amount
      ? parseFloat(recipeIngredient.amount) * servingMultiplier
      : 0;

    const key = ingredient.id;

    if (ingredientMap.has(key)) {
      const existing = ingredientMap.get(key)!;
      existing.totalAmount += adjustedAmount;
      existing.usedIn.push(recipe.name);
    } else {
      ingredientMap.set(key, {
        ingredient,
        totalAmount: adjustedAmount,
        unit: recipeIngredient.unit || ingredient.standard_unit,
        usedIn: [recipe.name],
        category: ingredient.category,
      });
    }
  }

  // Sort by category for organized shopping
  return Array.from(ingredientMap.values()).sort((a, b) => a.category.localeCompare(b.category));
}

/**
 * Consolidate tools across recipes
 */
function consolidateTools(toolsData: any[], mealRecipes: MealRecipe[]): ConsolidatedTool[] {
  const toolMap = new Map<string, ConsolidatedTool>();

  for (const data of toolsData) {
    const { recipeTool, tool, recipe } = data;

    const key = tool.id;

    if (toolMap.has(key)) {
      const existing = toolMap.get(key)!;
      existing.maxSimultaneousNeeded = Math.max(
        existing.maxSimultaneousNeeded,
        recipeTool.quantity || 1
      );
      existing.usedIn.push(recipe.name);
    } else {
      toolMap.set(key, {
        tool,
        maxSimultaneousNeeded: recipeTool.quantity || 1,
        usedIn: [recipe.name],
        conflicts: [],
      });
    }
  }

  return Array.from(toolMap.values()).sort((a, b) =>
    a.tool.category.localeCompare(b.tool.category)
  );
}

/**
 * Find tool conflicts (same tool needed at overlapping times)
 */
function findToolConflicts(tasksData: any[], mealRecipes: MealRecipe[]): ToolConflict[] {
  const conflicts: ToolConflict[] = [];

  // Group tasks by tool
  const tasksByTool = new Map<string, any[]>();

  for (const data of tasksData) {
    const { task, recipe } = data;

    if (!task.tool_ids) continue;

    try {
      const toolIds: string[] = JSON.parse(task.tool_ids);

      for (const toolId of toolIds) {
        if (!tasksByTool.has(toolId)) {
          tasksByTool.set(toolId, []);
        }
        tasksByTool.get(toolId)!.push({ task, recipe });
      }
    } catch (error) {
      // Skip invalid JSON
    }
  }

  // Check for time overlaps
  for (const [toolId, tasks] of tasksByTool.entries()) {
    for (let i = 0; i < tasks.length; i++) {
      for (let j = i + 1; j < tasks.length; j++) {
        const task1 = tasks[i];
        const task2 = tasks[j];

        // Simple overlap check (can be enhanced with actual timeline)
        if (
          task1.task.task_type === task2.task.task_type &&
          (task1.task.task_type === 'baking' || task1.task.task_type === 'roasting')
        ) {
          // Oven conflict likely
          conflicts.push({
            tool: { id: toolId } as any, // Would fetch full tool details in practice
            recipe1: task1.recipe.name,
            recipe2: task2.recipe.name,
            overlappingMinutes: Math.min(
              task1.task.active_time + task1.task.passive_time,
              task2.task.active_time + task2.task.passive_time
            ),
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Build chronological task timeline
 */
function buildTaskTimeline(tasksData: any[], mealRecipes: MealRecipe[]): TaskTimeline[] {
  const timeline: TaskTimeline[] = [];

  // Sort tasks by role priority and dependencies
  const rolePriority = {
    prep_cook: 1,
    garde_manger: 2,
    line_cook: 3,
    pastry: 4,
    sous_chef: 5,
    expeditor: 6,
  };

  for (const data of tasksData) {
    const { task, recipe } = data;

    timeline.push({
      startTime: 0, // Will calculate based on dependencies
      endTime: task.active_time + task.passive_time,
      task,
      recipe,
      role: task.role,
      canBeParallel: task.can_be_parallel,
      dependencies: task.depends_on_task_ids ? JSON.parse(task.depends_on_task_ids) : [],
    });
  }

  // Sort by role priority, then task order
  timeline.sort((a, b) => {
    const roleA = rolePriority[a.role as keyof typeof rolePriority] || 999;
    const roleB = rolePriority[b.role as keyof typeof rolePriority] || 999;

    if (roleA !== roleB) return roleA - roleB;
    return a.task.task_order - b.task.task_order;
  });

  return timeline;
}

/**
 * Calculate total time estimates
 */
function calculateTimeEstimates(timeline: TaskTimeline[]) {
  let totalTime = 0;
  let activeTime = 0;
  let passiveTime = 0;

  for (const item of timeline) {
    activeTime += item.task.active_time;
    passiveTime += item.task.passive_time ?? 0;
  }

  // Account for parallelization (rough estimate: 30% reduction)
  const parallelizationFactor = 0.7;
  totalTime = (activeTime + passiveTime) * parallelizationFactor;

  return {
    totalTime: Math.round(totalTime),
    activeTime,
    passiveTime,
  };
}

/**
 * Estimate meal cost based on ingredients
 * NOTE: Currently disabled as average_price_usd field is not in ingredients schema
 * TODO: Re-implement when pricing data is available
 */
function estimateMealCost(consolidatedIngredients: ConsolidatedIngredient[]): number {
  // Placeholder: return 0 until pricing data is added to ingredients schema
  return 0;
}

/**
 * Generate shopping list grouped by store section
 */
export function generateShoppingList(
  consolidatedIngredients: ConsolidatedIngredient[]
): Record<string, ConsolidatedIngredient[]> {
  const grouped: Record<string, ConsolidatedIngredient[]> = {
    produce: [],
    meat: [],
    seafood: [],
    dairy: [],
    grains: [],
    baking: [],
    spices: [],
    condiments: [],
    canned: [],
    frozen: [],
    beverages: [],
    other: [],
  };

  for (const item of consolidatedIngredients) {
    const category = item.category || 'other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(item);
  }

  return grouped;
}

/**
 * Generate prep timeline organized by role
 */
export function generatePrepTimeline(timeline: TaskTimeline[]) {
  const byRole: Record<string, TaskTimeline[]> = {
    prep_cook: [],
    garde_manger: [],
    line_cook: [],
    pastry: [],
    sous_chef: [],
    expeditor: [],
  };

  for (const item of timeline) {
    const role = item.role || 'sous_chef';
    if (!byRole[role]) {
      byRole[role] = [];
    }
    byRole[role].push(item);
  }

  return byRole;
}
