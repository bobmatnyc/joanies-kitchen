/**
 * Recipe Course Classification Utility
 *
 * Maps recipe tags to appropriate course categories for meal planning.
 * Ensures recipes appear in the most relevant course section.
 */

import type { Recipe } from '@/lib/db/schema';
import type { CourseCategory } from './type-guards';

/**
 * Course classification rules based on recipe tags and metadata
 * Using word boundary matching for precise classification
 */
const COURSE_TAG_MAPPING: Record<CourseCategory, string[]> = {
  appetizer: [
    'appetizer',
    'starter',
    "hors d'oeuvre",
    'finger food',
    'dip',
    'bruschetta',
    'crostini',
    'tapas',
    'mezze',
    'antipasto',
    'amuse-bouche',
  ],
  main: ['main course', 'main dish', 'main', 'entree', 'entrée', 'casserole'],
  side: ['side dish', 'side', 'accompaniment'],
  salad: ['salad', 'coleslaw', 'greens'],
  soup: ['soup', 'broth', 'bisque', 'chowder', 'gazpacho', 'consommé'],
  bread: ['bread', 'roll', 'biscuit', 'muffin', 'scone', 'baguette', 'flatbread', 'naan', 'pita'],
  dessert: [
    'dessert',
    'sweet',
    'cake',
    'pie',
    'tart',
    'cookie',
    'brownie',
    'ice cream',
    'pudding',
    'mousse',
    'pastry',
  ],
  drink: ['drink', 'beverage', 'cocktail', 'smoothie', 'juice'],
  other: [],
};

/**
 * Priority order for course classification (higher priority = more specific)
 * When a recipe matches multiple courses, assign it to the highest priority match
 */
const COURSE_PRIORITY: CourseCategory[] = [
  'dessert', // Most specific - clearly distinct
  'appetizer', // High specificity - clear starters
  'soup', // High specificity - clear liquid dishes
  'salad', // High specificity - clear greens
  'bread', // High specificity - baked goods
  'drink', // High specificity - beverages
  'side', // Medium specificity - accompaniments
  'main', // Lower specificity - catch most dishes
  'other', // Lowest - fallback
];

/**
 * Parse recipe tags from JSON string or array
 */
function parseRecipeTags(recipe: Recipe): string[] {
  if (!recipe.tags) return [];

  try {
    const tags = typeof recipe.tags === 'string' ? JSON.parse(recipe.tags) : recipe.tags;
    if (!Array.isArray(tags)) return [];
    return tags.map((tag) => tag.toLowerCase());
  } catch (_error) {
    return [];
  }
}

/**
 * Check if a keyword matches in the text (uses word boundaries for precision)
 */
function keywordMatches(text: string, keyword: string): boolean {
  // For multi-word phrases, use exact phrase matching
  if (keyword.includes(' ')) {
    return text.includes(keyword);
  }

  // For single words, use word boundary matching
  const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return regex.test(text);
}

/**
 * Classify a recipe into the most appropriate course category
 *
 * @param recipe - Recipe to classify
 * @returns Most appropriate course category
 *
 * @example
 * const course = classifyRecipeCourse(recipe);
 * console.log(course); // 'appetizer', 'main', 'dessert', etc.
 */
export function classifyRecipeCourse(recipe: Recipe): CourseCategory {
  const recipeTags = parseRecipeTags(recipe);
  const recipeName = recipe.name.toLowerCase();
  const recipeDescription = recipe.description?.toLowerCase() || '';

  // Combine all searchable text
  const searchableText = [recipeName, recipeDescription, ...recipeTags].join(' ');

  // Find all matching courses (prioritize exact tag matches)
  const matchingCourses = new Set<CourseCategory>();

  // First pass: check tags (highest priority)
  for (const [course, keywords] of Object.entries(COURSE_TAG_MAPPING)) {
    for (const keyword of keywords) {
      if (recipeTags.some((tag) => tag === keyword || tag.includes(keyword))) {
        matchingCourses.add(course as CourseCategory);
        break;
      }
    }
  }

  // Second pass: check name and description if no tag matches
  if (matchingCourses.size === 0) {
    for (const [course, keywords] of Object.entries(COURSE_TAG_MAPPING)) {
      for (const keyword of keywords) {
        if (keywordMatches(searchableText, keyword)) {
          matchingCourses.add(course as CourseCategory);
          break;
        }
      }
    }
  }

  // If no matches, use heuristics to infer course
  if (matchingCourses.size === 0) {
    // Check for protein-centric dishes (likely main courses)
    const mainIndicators = [
      'chicken',
      'beef',
      'pork',
      'fish',
      'salmon',
      'tuna',
      'lamb',
      'turkey',
      'tofu',
      'tempeh',
      'seitan',
      'steak',
      'chops',
      'roast',
    ];
    const hasMainProtein = mainIndicators.some((indicator) =>
      keywordMatches(searchableText, indicator)
    );

    if (hasMainProtein) {
      return 'main';
    }

    // Check for dessert indicators
    const dessertIndicators = ['chocolate', 'vanilla', 'caramel', 'frosting'];
    const hasDessertIndicator = dessertIndicators.some((indicator) =>
      keywordMatches(searchableText, indicator)
    );

    if (hasDessertIndicator) {
      return 'dessert';
    }

    return 'other';
  }

  // Return highest priority matching course
  for (const course of COURSE_PRIORITY) {
    if (matchingCourses.has(course)) {
      return course;
    }
  }

  return 'other'; // Fallback
}

/**
 * Filter recipes to ensure they only appear in their most appropriate course
 * Removes duplicates across course categories
 *
 * @param courseSuggestions - Map of course categories to recipe arrays
 * @returns Deduplicated course suggestions with recipes in correct categories
 *
 * @example
 * const filtered = deduplicateAcrossCourses({
 *   appetizer: [recipe1, recipe2],
 *   main: [recipe2, recipe3], // recipe2 appears in both
 *   dessert: [recipe4]
 * });
 * // Returns: { appetizer: [recipe1, recipe2], main: [recipe3], dessert: [recipe4] }
 */
export function deduplicateAcrossCourses<T extends Recipe>(
  courseSuggestions: Record<CourseCategory, T[]>
): Record<CourseCategory, T[]> {
  // Track which recipes we've seen and their assigned course
  const recipeAssignments = new Map<string, CourseCategory>();

  // First pass: classify all recipes and assign to their best course
  for (const [_course, recipes] of Object.entries(courseSuggestions)) {
    for (const recipe of recipes as T[]) {
      const bestCourse = classifyRecipeCourse(recipe);

      // If recipe not seen yet, or this course has higher priority
      if (!recipeAssignments.has(recipe.id)) {
        recipeAssignments.set(recipe.id, bestCourse);
      } else {
        // Compare priority - keep highest priority assignment
        const currentCourse = recipeAssignments.get(recipe.id)!;
        const currentPriority = COURSE_PRIORITY.indexOf(currentCourse);
        const newPriority = COURSE_PRIORITY.indexOf(bestCourse);

        if (newPriority < currentPriority) {
          recipeAssignments.set(recipe.id, bestCourse);
        }
      }
    }
  }

  // Second pass: rebuild course arrays with deduplicated recipes
  const result: Record<CourseCategory, T[]> = {
    appetizer: [],
    main: [],
    side: [],
    salad: [],
    soup: [],
    bread: [],
    dessert: [],
    drink: [],
    other: [],
  };

  for (const [course, recipes] of Object.entries(courseSuggestions)) {
    for (const recipe of recipes as T[]) {
      const assignedCourse = recipeAssignments.get(recipe.id);
      // Only include recipe if it's assigned to this course
      if (assignedCourse === course) {
        result[assignedCourse as CourseCategory].push(recipe);
      }
    }
  }

  return result;
}

/**
 * Get all possible course categories for a recipe (for debugging/display)
 *
 * @param recipe - Recipe to analyze
 * @returns Array of all matching course categories
 */
export function getAllMatchingCourses(recipe: Recipe): CourseCategory[] {
  const recipeTags = parseRecipeTags(recipe);
  const recipeName = recipe.name.toLowerCase();
  const recipeDescription = recipe.description?.toLowerCase() || '';
  const searchableText = [recipeName, recipeDescription, ...recipeTags].join(' ');

  const matchingCourses: CourseCategory[] = [];

  for (const [course, keywords] of Object.entries(COURSE_TAG_MAPPING)) {
    for (const keyword of keywords) {
      if (searchableText.includes(keyword)) {
        matchingCourses.push(course as CourseCategory);
        break;
      }
    }
  }

  return matchingCourses;
}
