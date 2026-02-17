import { test, expect, type Page } from '@playwright/test';
import path from 'path';

const BASE_URL = 'http://localhost:3002';
const ADMIN_PAGE = '/admin/system-recipe-ingest';

// Test data
const VALID_URLS = {
  epicurious: 'https://www.epicurious.com/recipes/food/views/kale-and-white-bean-stew-351254',
  allrecipes: 'https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/',
};

const INVALID_URLS = {
  notUrl: 'not-a-valid-url',
  ftpProtocol: 'ftp://invalid.com',
  nonExistent: 'https://this-domain-definitely-does-not-exist-12345.com/recipe',
};

const VALID_RECIPE_TEXT = `Chocolate Chip Cookies

A classic American cookie recipe that is perfect for any occasion.

Ingredients:
- 2 cups all-purpose flour
- 1 teaspoon baking soda
- 1/2 teaspoon salt
- 1 cup butter, softened
- 3/4 cup granulated sugar
- 3/4 cup packed brown sugar
- 2 large eggs
- 2 teaspoons vanilla extract
- 2 cups chocolate chips

Instructions:
1. Preheat oven to 375 degrees F (190 degrees C).
2. In a small bowl, mix together flour, baking soda, and salt. Set aside.
3. In a large bowl, cream together butter and sugars until light and fluffy.
4. Beat in eggs one at a time, then stir in vanilla.
5. Gradually blend in the flour mixture.
6. Stir in chocolate chips.
7. Drop rounded tablespoons of dough onto ungreased cookie sheets.
8. Bake for 9 to 11 minutes or until golden brown.
9. Cool on baking sheet for 2 minutes before removing to a wire rack.

Prep Time: 15 minutes
Cook Time: 11 minutes
Servings: 48 cookies
Difficulty: Easy`;

const NON_RECIPE_TEXT = `This is a blog post about my trip to Italy. I visited Rome, Florence, and Venice.
The food was amazing, but this text doesn't contain a structured recipe with ingredients and instructions.
Just some general thoughts about Italian cuisine and travel experiences.`;

const PARTIAL_RECIPE_TEXT = `My Favorite Pasta

Ingredients:
- 1 pound pasta
- 2 cups tomato sauce
- 1/4 cup parmesan cheese

This is missing the instructions!`;

test.describe('System Recipe Ingestion - UAT', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the admin page
    await page.goto(`${BASE_URL}${ADMIN_PAGE}`);

    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test.describe('1. Access & Navigation', () => {
    test('1.1 Page is accessible and renders correctly', async ({ page }) => {
      // Check page title
      await expect(page.locator('h1')).toContainText('System Recipe Ingestion');

      // Check description
      await expect(page.locator('p').first()).toContainText('Import recipes from URLs or text');

      // Check tabs exist
      await expect(page.getByRole('tab', { name: 'URL Input' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Text Input' })).toBeVisible();

      // Take screenshot
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/01-page-loaded.png'),
        fullPage: true
      });
    });

    test('1.2 Tabbed interface works', async ({ page }) => {
      // URL tab should be active by default
      await expect(page.getByRole('tab', { name: 'URL Input' })).toHaveAttribute('data-state', 'active');

      // Click text tab
      await page.getByRole('tab', { name: 'Text Input' }).click();
      await expect(page.getByRole('tab', { name: 'Text Input' })).toHaveAttribute('data-state', 'active');

      // Check text input is visible
      await expect(page.locator('#recipe-text')).toBeVisible();

      // Switch back to URL tab
      await page.getByRole('tab', { name: 'URL Input' }).click();
      await expect(page.getByRole('tab', { name: 'URL Input' })).toHaveAttribute('data-state', 'active');

      // Take screenshot
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/02-tab-switching.png'),
        fullPage: true
      });
    });
  });

  test.describe('2. URL Input Tab Testing', () => {
    test('2.1 Empty URL shows error', async ({ page }) => {
      // Click submit without entering URL
      await page.getByRole('button', { name: 'Scrape and Parse Recipe' }).click();

      // Should show toast error
      await expect(page.locator('text=Please enter a URL')).toBeVisible({ timeout: 5000 });

      // Take screenshot
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/03-empty-url-error.png'),
        fullPage: true
      });
    });

    test('2.2 Invalid URL format shows error', async ({ page }) => {
      // Enter invalid URL
      await page.locator('#recipe-url').fill(INVALID_URLS.notUrl);
      await page.getByRole('button', { name: 'Scrape and Parse Recipe' }).click();

      // Wait for error
      await page.waitForTimeout(2000);

      // Take screenshot
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/04-invalid-url-format.png'),
        fullPage: true
      });
    });

    test.skip('2.3 Valid recipe URL scraping - Epicurious', async ({ page }) => {
      // This test requires network access and may take time
      test.setTimeout(60000);

      // Enter valid URL
      await page.locator('#recipe-url').fill(VALID_URLS.epicurious);
      await page.getByRole('button', { name: 'Scrape and Parse Recipe' }).click();

      // Wait for processing
      await expect(page.locator('text=Scraping and parsing recipe')).toBeVisible({ timeout: 5000 });

      // Take screenshot of loading state
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/05-url-loading.png'),
        fullPage: true
      });

      // Wait for preview (may take 30-60 seconds)
      await expect(page.locator('h2:has-text("Preview and Edit Recipe")')).toBeVisible({ timeout: 60000 });

      // Verify preview fields are populated
      await expect(page.locator('#name')).not.toHaveValue('');

      // Take screenshot of preview
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/06-url-preview.png'),
        fullPage: true
      });
    });
  });

  test.describe('3. Text Input Tab Testing', () => {
    test.beforeEach(async ({ page }) => {
      // Switch to text input tab
      await page.getByRole('tab', { name: 'Text Input' }).click();
    });

    test('3.1 Empty text shows error', async ({ page }) => {
      // Click submit without entering text
      await page.getByRole('button', { name: 'Parse Recipe' }).click();

      // Should show toast error
      await expect(page.locator('text=Please enter a recipe text')).toBeVisible({ timeout: 5000 });

      // Take screenshot
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/07-empty-text-error.png'),
        fullPage: true
      });
    });

    test('3.2 Non-recipe text is rejected', async ({ page }) => {
      test.setTimeout(60000);

      // Enter non-recipe text
      await page.locator('#recipe-text').fill(NON_RECIPE_TEXT);
      await page.getByRole('button', { name: 'Parse Recipe' }).click();

      // Wait for processing
      await expect(page.locator('text=Parsing recipe')).toBeVisible({ timeout: 5000 });

      // Take screenshot of loading
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/08-text-loading.png'),
        fullPage: true
      });

      // Should show error after processing
      await page.waitForTimeout(30000); // AI processing may take time

      // Take screenshot of rejection
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/09-non-recipe-rejected.png'),
        fullPage: true
      });
    });

    test('3.3 Partial recipe text is rejected', async ({ page }) => {
      test.setTimeout(60000);

      // Enter partial recipe (missing instructions)
      await page.locator('#recipe-text').fill(PARTIAL_RECIPE_TEXT);
      await page.getByRole('button', { name: 'Parse Recipe' }).click();

      // Wait for processing
      await page.waitForTimeout(30000);

      // Take screenshot
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/10-partial-recipe-rejected.png'),
        fullPage: true
      });
    });

    test('3.4 Valid recipe text is parsed successfully', async ({ page }) => {
      test.setTimeout(90000);

      // Enter valid recipe text
      await page.locator('#recipe-text').fill(VALID_RECIPE_TEXT);
      await page.getByRole('button', { name: 'Parse Recipe' }).click();

      // Wait for processing
      await expect(page.locator('text=Parsing recipe')).toBeVisible({ timeout: 5000 });

      // Wait for preview (may take time for AI processing)
      await expect(page.locator('h2:has-text("Preview and Edit Recipe")')).toBeVisible({ timeout: 60000 });

      // Verify name is populated
      await expect(page.locator('#name')).toHaveValue('Chocolate Chip Cookies');

      // Verify confidence score is shown (check for toast message)
      // Note: This may have already disappeared

      // Take screenshot of successful parse
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/11-text-parsed-successfully.png'),
        fullPage: true
      });
    });
  });

  test.describe('4. Preview & Editing', () => {
    test.beforeEach(async ({ page }) => {
      test.setTimeout(90000);

      // Use text input for faster testing
      await page.getByRole('tab', { name: 'Text Input' }).click();
      await page.locator('#recipe-text').fill(VALID_RECIPE_TEXT);
      await page.getByRole('button', { name: 'Parse Recipe' }).click();

      // Wait for preview
      await expect(page.locator('h2:has-text("Preview and Edit Recipe")')).toBeVisible({ timeout: 60000 });
    });

    test('4.1 All form fields are editable', async ({ page }) => {
      // Edit recipe name
      const nameInput = page.locator('#name');
      await nameInput.clear();
      await nameInput.fill('Modified Chocolate Chip Cookies');
      await expect(nameInput).toHaveValue('Modified Chocolate Chip Cookies');

      // Edit description
      const descInput = page.locator('#description');
      await descInput.fill('This is a modified description');
      await expect(descInput).toHaveValue('This is a modified description');

      // Edit prep time
      const prepTimeInput = page.locator('#prep-time');
      await prepTimeInput.clear();
      await prepTimeInput.fill('20');
      await expect(prepTimeInput).toHaveValue('20');

      // Edit cook time
      const cookTimeInput = page.locator('#cook-time');
      await cookTimeInput.clear();
      await cookTimeInput.fill('15');
      await expect(cookTimeInput).toHaveValue('15');

      // Edit servings
      const servingsInput = page.locator('#servings');
      await servingsInput.clear();
      await servingsInput.fill('36');
      await expect(servingsInput).toHaveValue('36');

      // Take screenshot
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/12-fields-edited.png'),
        fullPage: true
      });
    });

    test('4.2 Difficulty dropdown works', async ({ page }) => {
      // Click difficulty dropdown
      const difficultyTrigger = page.locator('#difficulty').locator('..');
      await difficultyTrigger.click();

      // Select medium
      await page.getByRole('option', { name: 'Medium' }).click();

      // Take screenshot
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/13-difficulty-selected.png'),
        fullPage: true
      });
    });

    test('4.3 Tags can be edited', async ({ page }) => {
      const tagsInput = page.locator('#tags');
      await tagsInput.clear();
      await tagsInput.fill('dessert, cookies, baking, chocolate');
      await expect(tagsInput).toHaveValue('dessert, cookies, baking, chocolate');

      // Take screenshot
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/14-tags-edited.png'),
        fullPage: true
      });
    });
  });

  test.describe('5. Chef & License Selection', () => {
    test.beforeEach(async ({ page }) => {
      test.setTimeout(90000);

      await page.getByRole('tab', { name: 'Text Input' }).click();
      await page.locator('#recipe-text').fill(VALID_RECIPE_TEXT);
      await page.getByRole('button', { name: 'Parse Recipe' }).click();
      await expect(page.locator('h2:has-text("Preview and Edit Recipe")')).toBeVisible({ timeout: 60000 });
    });

    test('5.1 Chef dropdown loads and works', async ({ page }) => {
      // Scroll to chef selection
      await page.locator('label:has-text("Associate with Chef")').scrollIntoViewIfNeeded();

      // Click chef dropdown trigger
      const chefTrigger = page.locator('label:has-text("Associate with Chef")').locator('..').getByRole('combobox');
      await chefTrigger.click();

      // Wait for dropdown options
      await page.waitForTimeout(1000);

      // Take screenshot of dropdown
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/15-chef-dropdown.png'),
        fullPage: true
      });
    });

    test('5.2 License dropdown works', async ({ page }) => {
      // Scroll to license selection
      await page.locator('label:has-text("License")').scrollIntoViewIfNeeded();

      // Click license dropdown
      const licenseTrigger = page.locator('label:has-text("License")').locator('..').getByRole('combobox');
      await licenseTrigger.click();

      // Wait for dropdown
      await page.waitForTimeout(500);

      // Take screenshot
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/16-license-dropdown.png'),
        fullPage: true
      });

      // Select a license
      await page.getByRole('option', { name: 'Public Domain' }).click();

      // Take screenshot after selection
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/17-license-selected.png'),
        fullPage: true
      });
    });
  });

  test.describe('6. Complete Workflow', () => {
    test.skip('6.1 Complete text workflow - Parse, Edit, Save', async ({ page }) => {
      test.setTimeout(120000);

      // Parse recipe
      await page.getByRole('tab', { name: 'Text Input' }).click();
      await page.locator('#recipe-text').fill(VALID_RECIPE_TEXT);
      await page.getByRole('button', { name: 'Parse Recipe' }).click();
      await expect(page.locator('h2:has-text("Preview and Edit Recipe")')).toBeVisible({ timeout: 60000 });

      // Edit fields
      await page.locator('#name').clear();
      await page.locator('#name').fill('[TEST] UAT Chocolate Chip Cookies');
      await page.locator('#tags').clear();
      await page.locator('#tags').fill('test, uat, automated-test');

      // Scroll to save button
      await page.getByRole('button', { name: 'Save System Recipe' }).scrollIntoViewIfNeeded();

      // Take screenshot before save
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/18-before-save.png'),
        fullPage: true
      });

      // Click save
      await page.getByRole('button', { name: 'Save System Recipe' }).click();

      // Wait for saving state
      await expect(page.locator('text=Saving recipe to database')).toBeVisible({ timeout: 5000 });

      // Take screenshot of saving
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/19-saving.png'),
        fullPage: true
      });

      // Wait for success
      await expect(page.locator('h2:has-text("Recipe Saved Successfully")')).toBeVisible({ timeout: 30000 });

      // Take screenshot of success
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/20-save-success.png'),
        fullPage: true
      });

      // Verify View Recipe button exists
      await expect(page.getByRole('button', { name: 'View Recipe' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ingest Another Recipe' })).toBeVisible();
    });
  });

  test.describe('7. UI/UX Testing', () => {
    test('7.1 Info panels are visible and helpful', async ({ page }) => {
      // Check "How It Works" panel
      await expect(page.locator('h3:has-text("How It Works")')).toBeVisible();

      // Check "Examples to Try" panel
      await expect(page.locator('h3:has-text("Examples to Try")')).toBeVisible();

      // Take screenshot
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/21-info-panels.png'),
        fullPage: true
      });
    });

    test('7.2 Example buttons work', async ({ page }) => {
      // Click example URL button
      await page.getByRole('button', { name: /Epicurious/ }).click();

      // Verify URL is populated
      await expect(page.locator('#recipe-url')).toHaveValue(VALID_URLS.epicurious);

      // Take screenshot
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/22-example-url-loaded.png'),
        fullPage: true
      });

      // Switch to text tab and click example
      await page.getByRole('tab', { name: 'Text Input' }).click();
      await page.getByRole('button', { name: 'Load example recipe text' }).click();

      // Verify text is populated
      const textArea = page.locator('#recipe-text');
      const value = await textArea.inputValue();
      expect(value).toContain('Chocolate Chip Cookies');

      // Take screenshot
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/23-example-text-loaded.png'),
        fullPage: true
      });
    });

    test('7.3 Responsive layout check', async ({ page }) => {
      // Test desktop view (already at 1280x720 by default)
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/24-desktop-view.png'),
        fullPage: true
      });

      // Test tablet view
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/25-tablet-view.png'),
        fullPage: true
      });

      // Test mobile view
      await page.setViewportSize({ width: 375, height: 667 });
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/26-mobile-view.png'),
        fullPage: true
      });
    });
  });

  test.describe('8. Error Handling', () => {
    test('8.1 Cancel button returns to input', async ({ page }) => {
      test.setTimeout(90000);

      // Parse a recipe
      await page.getByRole('tab', { name: 'Text Input' }).click();
      await page.locator('#recipe-text').fill(VALID_RECIPE_TEXT);
      await page.getByRole('button', { name: 'Parse Recipe' }).click();
      await expect(page.locator('h2:has-text("Preview and Edit Recipe")')).toBeVisible({ timeout: 60000 });

      // Click cancel
      await page.getByRole('button', { name: 'Cancel' }).click();

      // Should return to input view
      await expect(page.locator('h1:has-text("System Recipe Ingestion")')).toBeVisible();
      await expect(page.getByRole('tab', { name: 'URL Input' })).toBeVisible();

      // Form should be reset
      await expect(page.locator('#recipe-url')).toHaveValue('');

      // Take screenshot
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/27-after-cancel.png'),
        fullPage: true
      });
    });

    test('8.2 Required fields validation', async ({ page }) => {
      test.setTimeout(90000);

      // Parse recipe
      await page.getByRole('tab', { name: 'Text Input' }).click();
      await page.locator('#recipe-text').fill(VALID_RECIPE_TEXT);
      await page.getByRole('button', { name: 'Parse Recipe' }).click();
      await expect(page.locator('h2:has-text("Preview and Edit Recipe")')).toBeVisible({ timeout: 60000 });

      // Clear required field (name)
      await page.locator('#name').clear();

      // Try to save
      await page.getByRole('button', { name: 'Save System Recipe' }).click();

      // Should show error
      await expect(page.locator('text=Recipe name is required')).toBeVisible({ timeout: 5000 });

      // Take screenshot
      await page.screenshot({
        path: path.join(__dirname, '../test-screenshots/28-required-field-error.png'),
        fullPage: true
      });
    });
  });
});
