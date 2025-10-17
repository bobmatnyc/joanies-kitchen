/**
 * Tests for Recipe Course Classification
 */

import { describe, expect, it } from 'vitest';
import type { Recipe } from '@/lib/db/schema';
import {
  classifyRecipeCourse,
  deduplicateAcrossCourses,
  getAllMatchingCourses,
} from '../recipe-classification';

// Mock recipe factory
function createMockRecipe(
  id: string,
  name: string,
  tags: string[] = [],
  description: string = ''
): Recipe {
  return {
    id,
    name,
    description,
    tags: JSON.stringify(tags),
    user_id: 'test-user',
    chef_id: null,
    ingredients: '[]',
    instructions: '[]',
    prep_time: 30,
    cook_time: 45,
    servings: 4,
    difficulty: 'medium',
    cuisine: null,
    image_url: null,
    images: null,
    is_ai_generated: false,
    is_public: false,
    is_system_recipe: false,
    nutrition_info: null,
    model_used: null,
    source: null,
    created_at: new Date(),
    updated_at: new Date(),
    created_by: null,
    updated_by: null,
    ai_generated_at: null,
    ai_generation_version: null,
    favorite_count: 0,
    view_count: 0,
    share_count: 0,
    system_rating: null,
    system_rating_reason: null,
    slug: null,
    image_flagged_for_regeneration: false,
    image_regeneration_requested_at: null,
    image_regeneration_requested_by: null,
  } as Recipe;
}

describe('classifyRecipeCourse', () => {
  it('should classify appetizers correctly', () => {
    const recipe = createMockRecipe('1', 'Bruschetta', ['appetizer', 'italian']);
    expect(classifyRecipeCourse(recipe)).toBe('appetizer');
  });

  it('should classify main courses correctly', () => {
    const recipe = createMockRecipe('2', 'Grilled Chicken', ['main', 'entree']);
    expect(classifyRecipeCourse(recipe)).toBe('main');
  });

  it('should classify desserts correctly', () => {
    const recipe = createMockRecipe('3', 'Chocolate Cake', ['dessert', 'sweet']);
    expect(classifyRecipeCourse(recipe)).toBe('dessert');
  });

  it('should classify side dishes correctly', () => {
    const recipe = createMockRecipe('4', 'Roasted Vegetables', ['side dish']);
    expect(classifyRecipeCourse(recipe)).toBe('side');
  });

  it('should classify soups correctly', () => {
    const recipe = createMockRecipe('5', 'Tomato Soup', ['soup']);
    expect(classifyRecipeCourse(recipe)).toBe('soup');
  });

  it('should classify salads correctly', () => {
    const recipe = createMockRecipe('6', 'Caesar Salad', ['salad']);
    expect(classifyRecipeCourse(recipe)).toBe('salad');
  });

  it('should prioritize dessert over main when both match', () => {
    const recipe = createMockRecipe('7', 'Sweet Main Course Pie', ['dessert', 'main']);
    expect(classifyRecipeCourse(recipe)).toBe('dessert');
  });

  it('should prioritize appetizer over main when both match', () => {
    const recipe = createMockRecipe('8', 'Starter Main Dish', ['appetizer', 'main']);
    expect(classifyRecipeCourse(recipe)).toBe('appetizer');
  });

  it('should classify by name when no tags provided', () => {
    const recipe = createMockRecipe('9', 'Bruschetta Appetizer', []);
    expect(classifyRecipeCourse(recipe)).toBe('appetizer');
  });

  it('should classify by description when name and tags are ambiguous', () => {
    const recipe = createMockRecipe(
      '10',
      'Special Dish',
      [],
      'A delicious dessert made with chocolate'
    );
    expect(classifyRecipeCourse(recipe)).toBe('dessert');
  });

  it('should default to main for substantial dishes without tags', () => {
    const recipe = createMockRecipe('11', 'Grilled Chicken with Rice', []);
    expect(classifyRecipeCourse(recipe)).toBe('main');
  });

  it('should default to other for unclassifiable dishes', () => {
    const recipe = createMockRecipe('12', 'Mystery Food', []);
    expect(classifyRecipeCourse(recipe)).toBe('other');
  });
});

describe('deduplicateAcrossCourses', () => {
  it('should remove duplicates and place recipe in best-fit course', () => {
    const bruschetta = createMockRecipe('1', 'Bruschetta', ['appetizer']);
    const pasta = createMockRecipe('2', 'Pasta Carbonara', ['main', 'pasta']);

    const input = {
      appetizer: [bruschetta, pasta], // pasta appears here incorrectly
      main: [pasta], // and here correctly
      side: [],
      salad: [],
      soup: [],
      bread: [],
      dessert: [],
      drink: [],
      other: [],
    };

    const result = deduplicateAcrossCourses(input);

    expect(result.appetizer).toContainEqual(bruschetta);
    expect(result.appetizer).not.toContainEqual(pasta); // Removed from appetizer
    expect(result.main).toContainEqual(pasta); // Kept in main
  });

  it('should handle recipes appearing in multiple courses', () => {
    const dessertPie = createMockRecipe('1', 'Apple Pie', ['dessert', 'sweet']);

    const input = {
      appetizer: [],
      main: [dessertPie], // Incorrectly categorized
      side: [],
      salad: [],
      soup: [],
      bread: [],
      dessert: [dessertPie], // Correctly categorized
      drink: [],
      other: [],
    };

    const result = deduplicateAcrossCourses(input);

    expect(result.main).not.toContainEqual(dessertPie);
    expect(result.dessert).toContainEqual(dessertPie);
  });

  it('should handle empty input', () => {
    const input = {
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

    const result = deduplicateAcrossCourses(input);

    expect(Object.values(result).every((arr) => arr.length === 0)).toBe(true);
  });
});

describe('getAllMatchingCourses', () => {
  it('should return all courses that match a recipe', () => {
    const recipe = createMockRecipe('1', 'Bread Appetizer', ['bread', 'starter']);
    const courses = getAllMatchingCourses(recipe);

    expect(courses).toContain('bread');
    expect(courses).toContain('appetizer');
  });

  it('should return empty array for unmatched recipe', () => {
    const recipe = createMockRecipe('2', 'Mystery Food', []);
    const courses = getAllMatchingCourses(recipe);

    expect(courses).toEqual([]);
  });
});
