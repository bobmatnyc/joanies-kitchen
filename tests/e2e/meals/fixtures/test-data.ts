/**
 * Test Data Fixtures for Meals E2E Tests
 *
 * Reusable test data for meal creation, templates, and shopping lists
 */

export const TEST_MEAL_DATA = {
  thanksgiving: {
    name: 'Thanksgiving Dinner 2025',
    mealType: 'dinner',
    serves: 8,
    description: 'Traditional Thanksgiving feast with turkey and all the fixings',
    occasion: 'Holiday',
    recipes: [
      {
        searchTerm: 'turkey',
        course: 'main',
        expectedName: 'Roasted Turkey',
      },
      {
        searchTerm: 'mashed potatoes',
        course: 'side',
        expectedName: 'Mashed Potatoes',
      },
      {
        searchTerm: 'pumpkin pie',
        course: 'dessert',
        expectedName: 'Pumpkin Pie',
      },
    ],
  },
  quickBreakfast: {
    name: 'Weekend Brunch',
    mealType: 'brunch',
    serves: 4,
    description: 'Simple weekend brunch for the family',
    recipes: [
      {
        searchTerm: 'scrambled eggs',
        course: 'main',
        expectedName: 'Scrambled Eggs',
      },
      {
        searchTerm: 'toast',
        course: 'side',
        expectedName: 'Toast',
      },
    ],
  },
  italianDinner: {
    name: 'Italian Night',
    mealType: 'dinner',
    serves: 6,
    description: 'Classic Italian pasta dinner',
    occasion: 'Date Night',
    recipes: [
      {
        searchTerm: 'spaghetti',
        course: 'main',
        expectedName: 'Spaghetti Carbonara',
      },
      {
        searchTerm: 'caesar salad',
        course: 'salad',
        expectedName: 'Caesar Salad',
      },
      {
        searchTerm: 'tiramisu',
        course: 'dessert',
        expectedName: 'Tiramisu',
      },
    ],
  },
};

export const TEST_TEMPLATE_DATA = {
  quickBreakfast: {
    name: 'Quick Breakfast Template',
    mealType: 'breakfast',
    serves: 2,
  },
  weeknightDinner: {
    name: 'Weeknight Dinner Template',
    mealType: 'dinner',
    serves: 4,
  },
};

export const MEAL_TYPES = [
  'breakfast',
  'brunch',
  'lunch',
  'dinner',
  'snack',
  'dessert',
  'party',
  'holiday',
  'custom',
] as const;

export const COURSE_CATEGORIES = [
  'appetizer',
  'soup',
  'salad',
  'main',
  'side',
  'bread',
  'dessert',
  'drink',
  'other',
] as const;

export const SHOPPING_LIST_CATEGORIES = [
  'proteins',
  'dairy',
  'vegetables',
  'fruits',
  'grains',
  'spices',
  'condiments',
  'other',
] as const;

/**
 * Generate a unique meal name for testing
 */
export function generateUniqueMealName(baseName: string): string {
  const timestamp = Date.now();
  return `${baseName} - ${timestamp}`;
}

/**
 * Wait for form submission and navigation
 */
export async function waitForFormSubmission(page: any, expectedUrl?: RegExp) {
  await page.waitForLoadState('networkidle');
  if (expectedUrl) {
    await page.waitForURL(expectedUrl);
  }
}

/**
 * Fill meal form with basic information
 */
export async function fillMealBasicInfo(
  page: any,
  data: { name: string; mealType: string; serves: number; description?: string; occasion?: string }
) {
  await page.fill('input[name="name"]', data.name);
  await page.selectOption('select[name="mealType"], select[name="meal_type"]', data.mealType);
  await page.fill('input[name="serves"]', data.serves.toString());

  if (data.description) {
    const descriptionField = page.locator('textarea[name="description"]');
    if (await descriptionField.isVisible()) {
      await descriptionField.fill(data.description);
    }
  }

  if (data.occasion) {
    const occasionField = page.locator('input[name="occasion"]');
    if (await occasionField.isVisible()) {
      await occasionField.fill(data.occasion);
    }
  }
}

/**
 * Search and add recipe to meal
 */
export async function addRecipeToMeal(page: any, searchTerm: string, course: string) {
  // Click "Add Recipe" button
  await page.click('button:has-text("Add Recipe"), button:has-text("Search Recipes")');

  // Wait for search dialog to appear
  await page.waitForSelector('input[placeholder*="Search"], input[placeholder*="search"]');

  // Search for recipe
  await page.fill('input[placeholder*="Search"], input[placeholder*="search"]', searchTerm);
  await page.waitForTimeout(1000); // Wait for search results

  // Click first search result
  const firstResult = page
    .locator('[data-testid="recipe-search-result"], .recipe-search-result')
    .first();
  await firstResult.click();

  // Assign to course (if course selector exists)
  const courseSelect = page.locator(`select[name*="course"], select[name*="category"]`).last();
  if (await courseSelect.isVisible()) {
    await courseSelect.selectOption(course);
  }

  // Confirm selection
  const confirmButton = page.locator('button:has-text("Add"), button:has-text("Confirm")');
  if (await confirmButton.isVisible()) {
    await confirmButton.click();
  }
}

/**
 * Clean up test meals created during tests
 */
export async function cleanupTestMeals(page: any, mealNames: string[]) {
  for (const name of mealNames) {
    try {
      await page.goto('/meals');
      await page.waitForLoadState('networkidle');

      const mealCard = page.locator(`text="${name}"`).first();
      if (await mealCard.isVisible()) {
        await mealCard.click();
        await page.waitForLoadState('networkidle');

        const deleteButton = page.locator('button:has-text("Delete")');
        if (await deleteButton.isVisible()) {
          await deleteButton.click();
          await page.locator('button:has-text("Confirm"), button:has-text("Yes")').click();
          await page.waitForLoadState('networkidle');
        }
      }
    } catch (error) {
      console.log(`Failed to clean up meal: ${name}`, error);
    }
  }
}
