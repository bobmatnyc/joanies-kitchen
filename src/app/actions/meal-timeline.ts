'use server';

import { auth } from '@/lib/auth';
import { getMealById } from './meals';

/**
 * Meal Prep Timeline Generator
 *
 * Generates a coordinated timeline for preparing multiple recipes in a meal.
 * Analyzes prep/cook times, identifies parallel tasks, and suggests optimal order.
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface TimelineStep {
  id: string;
  time: string; // Relative time (e.g., "T-120min", "T-60min", "T+0min")
  absoluteMinutes: number; // Minutes from start (negative = before serving)
  action: string;
  recipeId: string;
  recipeName: string;
  type: 'prep' | 'cook' | 'rest' | 'serve' | 'start';
  duration?: number; // Duration in minutes
  canParallelize: boolean;
  equipment?: string; // Required equipment (oven, stove, etc.)
  priority: 'critical' | 'important' | 'optional';
}

export interface TimelineConflict {
  type: 'equipment' | 'timing' | 'complexity';
  message: string;
  affectedSteps: string[]; // Step IDs
  suggestion?: string;
}

export interface MealPrepTimeline {
  steps: TimelineStep[];
  totalTime: number; // Minutes from start to finish
  conflicts: TimelineConflict[];
  summary: {
    earliestStart: string; // e.g., "2 hours before serving"
    peakActivity: string; // e.g., "30-45 minutes before serving"
    parallelTasks: number;
    ovenConflicts: number;
    stoveConflicts: number;
  };
}

// ============================================================================
// Timeline Generation
// ============================================================================

export async function generateMealPrepTimeline(
  mealId: string
): Promise<{ success: boolean; timeline?: MealPrepTimeline; error?: string }> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get meal with recipes
    const mealResult = await getMealById(mealId);
    if (!mealResult.success || !mealResult.data) {
      return { success: false, error: 'Meal not found' };
    }

    const meal = mealResult.data;

    if (meal.recipes.length === 0) {
      return {
        success: false,
        error: 'No recipes in meal',
      };
    }

    // Analyze recipes and build timeline
    const steps: TimelineStep[] = [];
    let stepIdCounter = 0;

    // Sort recipes by total time (longest first for optimal scheduling)
    const sortedRecipes = [...meal.recipes].sort((a, b) => {
      const aTime = (a.recipe.prep_time || 0) + (a.recipe.cook_time || 0);
      const bTime = (b.recipe.prep_time || 0) + (b.recipe.cook_time || 0);
      return bTime - aTime;
    });

    // Build timeline working backwards from serving time (T=0)
    let currentTime = 0;

    for (const { mealRecipe, recipe } of sortedRecipes) {
      const prepTime = recipe.prep_time || 0;
      const cookTime = recipe.cook_time || 0;
      const totalTime = prepTime + cookTime;

      // Determine equipment needs
      const equipment = detectEquipment(recipe.instructions);
      const courseCategory = mealRecipe.course_category;

      // Serving step (T=0)
      if (courseCategory === 'main' || courseCategory === 'side') {
        steps.push({
          id: `step-${stepIdCounter++}`,
          time: 'T+0min',
          absoluteMinutes: 0,
          action: `Serve ${recipe.name}`,
          recipeId: recipe.id,
          recipeName: recipe.name,
          type: 'serve',
          canParallelize: true,
          priority: courseCategory === 'main' ? 'critical' : 'important',
        });
      }

      // Cook step
      if (cookTime > 0) {
        currentTime = -cookTime;
        steps.push({
          id: `step-${stepIdCounter++}`,
          time: formatTime(currentTime),
          absoluteMinutes: currentTime,
          action: `Cook ${recipe.name}`,
          recipeId: recipe.id,
          recipeName: recipe.name,
          type: 'cook',
          duration: cookTime,
          canParallelize: !equipment.oven, // Oven steps harder to parallelize
          equipment: equipment.type,
          priority: courseCategory === 'main' ? 'critical' : 'important',
        });
      }

      // Prep step
      if (prepTime > 0) {
        currentTime = -(prepTime + cookTime);
        steps.push({
          id: `step-${stepIdCounter++}`,
          time: formatTime(currentTime),
          absoluteMinutes: currentTime,
          action: `Prep ${recipe.name}`,
          recipeId: recipe.id,
          recipeName: recipe.name,
          type: 'prep',
          duration: prepTime,
          canParallelize: true,
          priority: courseCategory === 'main' ? 'critical' : 'optional',
        });
      }

      // Start step (for longest recipe)
      if (sortedRecipes[0].recipe.id === recipe.id) {
        currentTime = -(prepTime + cookTime);
        steps.push({
          id: `step-${stepIdCounter++}`,
          time: formatTime(currentTime),
          absoluteMinutes: currentTime,
          action: `Start preparing meal`,
          recipeId: recipe.id,
          recipeName: 'Meal Preparation',
          type: 'start',
          canParallelize: false,
          priority: 'critical',
        });
      }
    }

    // Sort steps by time (earliest first)
    steps.sort((a, b) => a.absoluteMinutes - b.absoluteMinutes);

    // Detect conflicts
    const conflicts = detectConflicts(steps);

    // Calculate summary
    const earliestStep = steps[0];
    const totalTime = Math.abs(earliestStep?.absoluteMinutes || 0);
    const parallelTasks = steps.filter((s) => s.canParallelize).length;
    const ovenSteps = steps.filter((s) => s.equipment === 'oven');
    const stoveSteps = steps.filter((s) => s.equipment === 'stove');

    const timeline: MealPrepTimeline = {
      steps,
      totalTime,
      conflicts,
      summary: {
        earliestStart: formatDuration(totalTime),
        peakActivity: 'Last 30 minutes before serving',
        parallelTasks,
        ovenConflicts: detectEquipmentOverlap(ovenSteps),
        stoveConflicts: detectEquipmentOverlap(stoveSteps),
      },
    };

    return { success: true, timeline };
  } catch (error) {
    console.error('Failed to generate meal prep timeline:', error);
    return { success: false, error: 'Failed to generate timeline' };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTime(minutes: number): string {
  if (minutes === 0) return 'T+0min';
  if (minutes > 0) return `T+${minutes}min`;
  return `T${minutes}min`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  return `${hours} hour${hours > 1 ? 's' : ''} ${mins} min`;
}

function detectEquipment(instructionsJson: string | null): { type: string; oven: boolean; stove: boolean } {
  if (!instructionsJson) return { type: 'none', oven: false, stove: false };

  try {
    const instructions = JSON.parse(instructionsJson) as string[];
    const text = instructions.join(' ').toLowerCase();

    const oven = text.includes('oven') || text.includes('bake') || text.includes('roast');
    const stove = text.includes('stove') || text.includes('pan') || text.includes('sauté') || text.includes('boil');

    if (oven && stove) return { type: 'oven+stove', oven: true, stove: true };
    if (oven) return { type: 'oven', oven: true, stove: false };
    if (stove) return { type: 'stove', oven: false, stove: true };

    return { type: 'none', oven: false, stove: false };
  } catch {
    return { type: 'none', oven: false, stove: false };
  }
}

function detectConflicts(steps: TimelineStep[]): TimelineConflict[] {
  const conflicts: TimelineConflict[] = [];

  // Detect equipment overlaps
  const ovenSteps = steps.filter((s) => s.equipment?.includes('oven'));
  if (ovenSteps.length > 1) {
    // Check for time overlaps
    for (let i = 0; i < ovenSteps.length; i++) {
      for (let j = i + 1; j < ovenSteps.length; j++) {
        const step1 = ovenSteps[i];
        const step2 = ovenSteps[j];

        const overlap = checkTimeOverlap(step1, step2);
        if (overlap) {
          conflicts.push({
            type: 'equipment',
            message: `Oven conflict: ${step1.recipeName} and ${step2.recipeName} both need oven at same time`,
            affectedSteps: [step1.id, step2.id],
            suggestion: 'Consider adjusting start times or using multiple oven racks',
          });
        }
      }
    }
  }

  // Detect complexity issues (too many simultaneous tasks)
  const timeGroups = groupStepsByTime(steps);
  for (const [timeKey, groupSteps] of Object.entries(timeGroups)) {
    if (groupSteps.length > 3) {
      conflicts.push({
        type: 'complexity',
        message: `High activity period: ${groupSteps.length} tasks around ${timeKey}`,
        affectedSteps: groupSteps.map((s) => s.id),
        suggestion: 'Consider doing some prep work earlier',
      });
    }
  }

  return conflicts;
}

function checkTimeOverlap(step1: TimelineStep, step2: TimelineStep): boolean {
  if (!step1.duration || !step2.duration) return false;

  const start1 = step1.absoluteMinutes;
  const end1 = start1 + step1.duration;
  const start2 = step2.absoluteMinutes;
  const end2 = start2 + step2.duration;

  return (start1 < end2 && end1 > start2);
}

function groupStepsByTime(steps: TimelineStep[]): Record<string, TimelineStep[]> {
  const groups: Record<string, TimelineStep[]> = {};

  for (const step of steps) {
    // Group steps within 10-minute windows
    const timeKey = Math.floor(step.absoluteMinutes / 10) * 10;
    const key = formatTime(timeKey);

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(step);
  }

  return groups;
}

function detectEquipmentOverlap(steps: TimelineStep[]): number {
  let conflicts = 0;

  for (let i = 0; i < steps.length; i++) {
    for (let j = i + 1; j < steps.length; j++) {
      if (checkTimeOverlap(steps[i], steps[j])) {
        conflicts++;
      }
    }
  }

  return conflicts;
}
