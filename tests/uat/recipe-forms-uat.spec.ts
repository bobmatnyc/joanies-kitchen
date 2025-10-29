/**
 * UAT Test Suite for Recipe Creation Forms
 *
 * Testing both AI Upload Form and Detailed Form
 * Focus: User acceptance, business requirements, UX validation
 *
 * Test Pages:
 * - Simple Form (AI Upload): http://localhost:3002/recipes/new (tab: "AI Upload (Quick)")
 * - Detailed Form: http://localhost:3002/recipes/new (tab: "Detailed Form")
 */

import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const BASE_URL = 'http://localhost:3002';
const SCREENSHOTS_DIR = path.join(__dirname, '../../tmp/uat-screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

test.describe('UAT: Recipe Creation Forms - Business Requirements', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to recipe creation page
    await page.goto(`${BASE_URL}/recipes/new`);
    await page.waitForLoadState('networkidle');
  });

  test.describe('UAT Scenario 1: AI Upload Form - Text/Markdown Upload', () => {
    test('should display AI Upload tab as default and show clear instructions', async ({
      page,
    }) => {
      // Verify default tab is AI Upload
      const aiTab = page.locator('button[role="tab"]:has-text("AI Upload (Quick)")');
      await expect(aiTab).toHaveAttribute('data-state', 'active');

      // Verify informational content exists
      const infoBox = page.locator('text=AI Powered');
      await expect(infoBox).toBeVisible();

      // Screenshot
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '01-ai-upload-default.png'),
        fullPage: true,
      });
    });

    test('should successfully parse and create recipe from text', async ({ page }) => {
      const testRecipe = `
Chocolate Chip Cookies

Ingredients:
- 2 cups all-purpose flour
- 1 cup butter, softened
- 1 cup granulated sugar
- 2 large eggs
- 2 cups chocolate chips
- 1 tsp vanilla extract

Instructions:
1. Preheat oven to 350°F (175°C)
2. Mix butter and sugar until creamy
3. Add eggs and vanilla, mix well
4. Gradually add flour
5. Fold in chocolate chips
6. Bake for 12 minutes
`;

      // Enter recipe text
      const textarea = page.locator('textarea[placeholder*="Paste your recipe here"]');
      await textarea.fill(testRecipe);

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '02-ai-upload-text-entered.png'),
        fullPage: true,
      });

      // Click parse button
      const parseButton = page.locator('button:has-text("Parse & Create Recipe")');
      await expect(parseButton).toBeEnabled();
      await parseButton.click();

      // Wait for AI processing
      await expect(page.locator('text=Parsing with AI')).toBeVisible({ timeout: 5000 });
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '03-ai-upload-processing.png'),
        fullPage: true,
      });

      // Wait for success or error (30 second timeout for AI)
      await page
        .waitForSelector('text=Recipe parsed successfully', { timeout: 30000 })
        .catch(async (e) => {
          // Capture error state if it fails
          await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, '04-ai-upload-error.png'),
            fullPage: true,
          });
          throw e;
        });

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '05-ai-upload-success.png'),
        fullPage: true,
      });

      // Verify redirect to recipe page
      await page.waitForURL(/\/recipes\/[a-z0-9-]+/, { timeout: 10000 });
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '06-ai-upload-recipe-created.png'),
        fullPage: true,
      });
    });

    test('should validate empty text submission', async ({ page }) => {
      const parseButton = page.locator('button:has-text("Parse & Create Recipe")');

      // Button should be disabled when textarea is empty
      await expect(parseButton).toBeDisabled();

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '07-ai-upload-validation-empty.png'),
        fullPage: true,
      });
    });

    test('should provide helpful placeholder text and examples', async ({ page }) => {
      const textarea = page.locator('textarea[placeholder*="Paste your recipe here"]');
      const placeholder = await textarea.getAttribute('placeholder');

      // Verify placeholder contains examples
      expect(placeholder).toContain('Example');
      expect(placeholder).toContain('Ingredients');
      expect(placeholder).toContain('Instructions');

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '08-ai-upload-placeholder.png'),
        fullPage: true,
      });
    });
  });

  test.describe('UAT Scenario 2: AI Upload Form - URL Import', () => {
    test('should switch to URL tab and show URL input', async ({ page }) => {
      // Click URL tab
      const urlTab = page.locator('button[role="tab"]:has-text("From URL")');
      await urlTab.click();

      // Verify URL input is visible
      const urlInput = page.locator('input[type="url"]');
      await expect(urlInput).toBeVisible();
      await expect(urlInput).toHaveAttribute('placeholder', 'https://example.com/recipe');

      // Verify helpful text
      await expect(page.locator('text=Supports most recipe websites')).toBeVisible();

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '09-ai-upload-url-tab.png'),
        fullPage: true,
      });
    });

    test('should validate URL format', async ({ page }) => {
      // Switch to URL tab
      await page.locator('button[role="tab"]:has-text("From URL")').click();

      const importButton = page.locator('button:has-text("Import Recipe")');

      // Button should be disabled when empty
      await expect(importButton).toBeDisabled();

      // Enter invalid URL
      const urlInput = page.locator('input[type="url"]');
      await urlInput.fill('invalid-url');

      // Button should be enabled (browser validates on submit)
      await expect(importButton).toBeEnabled();

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '10-ai-upload-url-validation.png'),
        fullPage: true,
      });
    });
  });

  test.describe('UAT Scenario 3: Detailed Form - Basic Recipe Creation', () => {
    test('should display all required fields with clear labels', async ({ page }) => {
      // Switch to Detailed Form tab
      await page.locator('button[role="tab"]:has-text("Detailed Form")').click();
      await page.waitForTimeout(500);

      // Verify required fields are present
      await expect(page.locator('label:has-text("Recipe Name")')).toBeVisible();
      await expect(page.locator('label:has-text("Ingredients")')).toBeVisible();
      await expect(page.locator('label:has-text("Instructions")')).toBeVisible();

      // Verify optional fields
      await expect(page.locator('label:has-text("Description")')).toBeVisible();
      await expect(page.locator('label:has-text("Cuisine")')).toBeVisible();
      await expect(page.locator('label:has-text("Difficulty")')).toBeVisible();

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '11-detailed-form-layout.png'),
        fullPage: true,
      });
    });

    test('should create recipe with minimum required fields', async ({ page }) => {
      // Switch to Detailed Form
      await page.locator('button[role="tab"]:has-text("Detailed Form")').click();
      await page.waitForTimeout(500);

      // Fill in required fields
      await page.locator('input#name').fill('UAT Test Recipe - Minimum Fields');

      // Add ingredient
      const ingredientInputs = page.locator('input[placeholder*="e.g., 2 cups flour"]');
      await ingredientInputs.first().fill('1 cup test ingredient');

      // Add instruction
      const instructionInputs = page.locator('input[placeholder*="Describe this step"]');
      await instructionInputs.first().fill('Test instruction step 1');

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '12-detailed-form-minimum-filled.png'),
        fullPage: true,
      });

      // Submit form
      const submitButton = page.locator('button:has-text("Create Recipe")');
      await submitButton.click();

      // Wait for success and redirect
      await page.waitForURL(/\/recipes\/[a-z0-9-]+/, { timeout: 10000 });
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '13-detailed-form-recipe-created.png'),
        fullPage: true,
      });
    });

    test('should validate required field: Recipe Name', async ({ page }) => {
      await page.locator('button[role="tab"]:has-text("Detailed Form")').click();
      await page.waitForTimeout(500);

      // Leave name empty, fill other required fields
      await page
        .locator('input[placeholder*="e.g., 2 cups flour"]')
        .first()
        .fill('Test ingredient');
      await page.locator('input[placeholder*="Describe this step"]').first().fill('Test step');

      // Submit button should be disabled
      const submitButton = page.locator('button:has-text("Create Recipe")');
      await expect(submitButton).toBeDisabled();

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '14-detailed-form-validation-name.png'),
        fullPage: true,
      });
    });

    test('should validate required field: Ingredients', async ({ page }) => {
      await page.locator('button[role="tab"]:has-text("Detailed Form")').click();
      await page.waitForTimeout(500);

      // Fill name and instruction, leave ingredient empty
      await page.locator('input#name').fill('Test Recipe');
      await page.locator('input[placeholder*="Describe this step"]').first().fill('Test step');

      const submitButton = page.locator('button:has-text("Create Recipe")');
      await submitButton.click();

      // Should show error toast
      await page.waitForSelector('text=Please add at least one ingredient', { timeout: 3000 });
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '15-detailed-form-validation-ingredients.png'),
        fullPage: true,
      });
    });

    test('should validate required field: Instructions', async ({ page }) => {
      await page.locator('button[role="tab"]:has-text("Detailed Form")').click();
      await page.waitForTimeout(500);

      // Fill name and ingredient, leave instruction empty
      await page.locator('input#name').fill('Test Recipe');
      await page
        .locator('input[placeholder*="e.g., 2 cups flour"]')
        .first()
        .fill('Test ingredient');

      const submitButton = page.locator('button:has-text("Create Recipe")');
      await submitButton.click();

      // Should show error toast
      await page.waitForSelector('text=Please add at least one instruction', { timeout: 3000 });
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '16-detailed-form-validation-instructions.png'),
        fullPage: true,
      });
    });
  });

  test.describe('UAT Scenario 4: Detailed Form - Add/Remove Functionality', () => {
    test('should add and remove ingredients dynamically', async ({ page }) => {
      await page.locator('button[role="tab"]:has-text("Detailed Form")').click();
      await page.waitForTimeout(500);

      // Count initial ingredient fields
      const initialCount = await page.locator('input[placeholder*="e.g., 2 cups flour"]').count();

      // Click "Add Ingredient" button
      await page.locator('button:has-text("Add Ingredient")').click();

      // Verify count increased
      const newCount = await page.locator('input[placeholder*="e.g., 2 cups flour"]').count();
      expect(newCount).toBe(initialCount + 1);

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '17-detailed-form-add-ingredient.png'),
        fullPage: true,
      });

      // Fill in multiple ingredients
      const ingredientInputs = page.locator('input[placeholder*="e.g., 2 cups flour"]');
      await ingredientInputs.nth(0).fill('2 cups flour');
      await ingredientInputs.nth(1).fill('1 cup sugar');

      // Remove second ingredient
      const removeButtons = page
        .locator('button[aria-label=""]')
        .filter({ has: page.locator('svg.lucide-x') });
      await removeButtons.nth(1).click();

      // Verify count decreased
      const finalCount = await page.locator('input[placeholder*="e.g., 2 cups flour"]').count();
      expect(finalCount).toBe(initialCount);

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '18-detailed-form-remove-ingredient.png'),
        fullPage: true,
      });
    });

    test('should add and remove instructions dynamically', async ({ page }) => {
      await page.locator('button[role="tab"]:has-text("Detailed Form")').click();
      await page.waitForTimeout(500);

      // Scroll to instructions section
      await page.locator('text=Instructions *').scrollIntoViewIfNeeded();

      // Count initial instruction fields
      const initialCount = await page.locator('input[placeholder*="Describe this step"]').count();

      // Click "Add Step" button
      await page.locator('button:has-text("Add Step")').click();

      // Verify count increased
      const newCount = await page.locator('input[placeholder*="Describe this step"]').count();
      expect(newCount).toBe(initialCount + 1);

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '19-detailed-form-add-instruction.png'),
        fullPage: true,
      });

      // Verify step numbers update correctly
      const stepNumbers = page.locator('div.flex-shrink-0:has-text(".")');
      const firstStep = await stepNumbers.first().textContent();
      const secondStep = await stepNumbers.nth(1).textContent();

      expect(firstStep?.trim()).toBe('1.');
      expect(secondStep?.trim()).toBe('2.');
    });

    test('should prevent removing last ingredient', async ({ page }) => {
      await page.locator('button[role="tab"]:has-text("Detailed Form")').click();
      await page.waitForTimeout(500);

      // Find remove button for first ingredient
      const removeButton = page
        .locator('button')
        .filter({ has: page.locator('svg.lucide-x') })
        .first();

      // Should be disabled when only one ingredient exists
      await expect(removeButton).toBeDisabled();

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '20-detailed-form-prevent-remove-last.png'),
        fullPage: true,
      });
    });
  });

  test.describe('UAT Scenario 5: Detailed Form - Advanced Fields', () => {
    test('should accept and display all time and serving fields', async ({ page }) => {
      await page.locator('button[role="tab"]:has-text("Detailed Form")').click();
      await page.waitForTimeout(500);

      // Fill in time fields
      await page.locator('input#prepTime').fill('15');
      await page.locator('input#cookTime').fill('30');
      await page.locator('input#servings').fill('6');

      // Verify values
      await expect(page.locator('input#prepTime')).toHaveValue('15');
      await expect(page.locator('input#cookTime')).toHaveValue('30');
      await expect(page.locator('input#servings')).toHaveValue('6');

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '21-detailed-form-time-servings.png'),
        fullPage: true,
      });
    });

    test('should select difficulty levels', async ({ page }) => {
      await page.locator('button[role="tab"]:has-text("Detailed Form")').click();
      await page.waitForTimeout(500);

      // Open difficulty dropdown
      await page.locator('button#difficulty').click();
      await page.waitForTimeout(300);

      // Verify all options are present
      await expect(page.locator('text=Easy')).toBeVisible();
      await expect(page.locator('text=Medium')).toBeVisible();
      await expect(page.locator('text=Hard')).toBeVisible();

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '22-detailed-form-difficulty-options.png'),
        fullPage: true,
      });

      // Select "Hard"
      await page.locator('text=Hard').click();

      // Verify selection
      await expect(page.locator('button#difficulty')).toContainText('Hard');

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '23-detailed-form-difficulty-selected.png'),
        fullPage: true,
      });
    });

    test('should accept cuisine input', async ({ page }) => {
      await page.locator('button[role="tab"]:has-text("Detailed Form")').click();
      await page.waitForTimeout(500);

      // Fill cuisine
      await page.locator('input#cuisine').fill('Italian');

      // Verify value
      await expect(page.locator('input#cuisine')).toHaveValue('Italian');

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '24-detailed-form-cuisine.png'),
        fullPage: true,
      });
    });
  });

  test.describe('UAT Scenario 6: Edge Cases and Special Characters', () => {
    test('should handle very long recipe names', async ({ page }) => {
      await page.locator('button[role="tab"]:has-text("Detailed Form")').click();
      await page.waitForTimeout(500);

      const longName = 'A'.repeat(200);
      await page.locator('input#name').fill(longName);

      // Verify input accepted
      const value = await page.locator('input#name').inputValue();
      expect(value.length).toBe(200);

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '25-detailed-form-long-name.png'),
        fullPage: true,
      });
    });

    test('should handle special characters in inputs', async ({ page }) => {
      await page.locator('button[role="tab"]:has-text("Detailed Form")').click();
      await page.waitForTimeout(500);

      const specialChars = 'Recipe with émojis 🍕 & spëcial çharacters!';
      await page.locator('input#name').fill(specialChars);

      // Verify input accepted
      await expect(page.locator('input#name')).toHaveValue(specialChars);

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '26-detailed-form-special-chars.png'),
        fullPage: true,
      });
    });

    test('should handle many ingredients (20+)', async ({ page }) => {
      await page.locator('button[role="tab"]:has-text("Detailed Form")').click();
      await page.waitForTimeout(500);

      // Add 20 ingredients
      for (let i = 0; i < 19; i++) {
        await page.locator('button:has-text("Add Ingredient")').click();
      }

      // Count ingredients
      const count = await page.locator('input[placeholder*="e.g., 2 cups flour"]').count();
      expect(count).toBeGreaterThanOrEqual(20);

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '27-detailed-form-many-ingredients.png'),
        fullPage: true,
      });
    });

    test('should handle many instructions (15+)', async ({ page }) => {
      await page.locator('button[role="tab"]:has-text("Detailed Form")').click();
      await page.waitForTimeout(500);

      // Scroll to instructions
      await page.locator('text=Instructions *').scrollIntoViewIfNeeded();

      // Add 15 instructions
      for (let i = 0; i < 14; i++) {
        await page.locator('button:has-text("Add Step")').click();
      }

      // Count instructions
      const count = await page.locator('input[placeholder*="Describe this step"]').count();
      expect(count).toBeGreaterThanOrEqual(15);

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '28-detailed-form-many-instructions.png'),
        fullPage: true,
      });
    });
  });

  test.describe('UAT Scenario 7: Form Switching and Data Persistence', () => {
    test('should preserve data when switching between tabs', async ({ page }) => {
      // Start with AI Upload, enter some text
      const testText = 'Test Recipe Text';
      await page.locator('textarea[placeholder*="Paste your recipe here"]').fill(testText);

      // Switch to Detailed Form
      await page.locator('button[role="tab"]:has-text("Detailed Form")').click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '29-form-switch-to-detailed.png'),
        fullPage: true,
      });

      // Switch back to AI Upload
      await page.locator('button[role="tab"]:has-text("AI Upload (Quick)")').click();
      await page.waitForTimeout(500);

      // Verify text is preserved
      const textarea = page.locator('textarea[placeholder*="Paste your recipe here"]');
      await expect(textarea).toHaveValue(testText);

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '30-form-switch-data-preserved.png'),
        fullPage: true,
      });
    });
  });

  test.describe('UAT Scenario 8: UX and Accessibility', () => {
    test('should have clear visual hierarchy', async ({ page }) => {
      // Check for heading
      const heading = page.locator('h1:has-text("Create New Recipe")');
      await expect(heading).toBeVisible();

      // Check for back button
      const backButton = page.locator('text=Back to Recipes');
      await expect(backButton).toBeVisible();

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '31-ux-visual-hierarchy.png'),
        fullPage: true,
      });
    });

    test('should have accessible labels for all inputs', async ({ page }) => {
      await page.locator('button[role="tab"]:has-text("Detailed Form")').click();
      await page.waitForTimeout(500);

      // Verify all inputs have labels
      const _nameInput = page.locator('input#name');
      const nameLabel = page.locator('label[for="name"]');
      await expect(nameLabel).toBeVisible();

      const _descInput = page.locator('input#description');
      const descLabel = page.locator('label[for="description"]');
      await expect(descLabel).toBeVisible();

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '32-ux-accessible-labels.png'),
        fullPage: true,
      });
    });

    test('should have clear button states', async ({ page }) => {
      // AI Upload button should be disabled when empty
      const aiButton = page.locator('button:has-text("Parse & Create Recipe")');
      await expect(aiButton).toBeDisabled();

      // Button should be enabled when text is entered
      await page.locator('textarea[placeholder*="Paste your recipe here"]').fill('Test');
      await expect(aiButton).toBeEnabled();

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '33-ux-button-states.png'),
        fullPage: true,
      });
    });

    test('should have responsive layout on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Verify page is still usable
      await expect(page.locator('h1:has-text("Create New Recipe")')).toBeVisible();
      await expect(page.locator('button[role="tab"]').first()).toBeVisible();

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '34-ux-mobile-viewport.png'),
        fullPage: true,
      });
    });
  });

  test.describe('UAT Scenario 9: Performance and Loading States', () => {
    test('should show loading state during AI parsing', async ({ page }) => {
      const testRecipe = 'Simple Test Recipe\nIngredients:\n- Test\nInstructions:\n1. Test';

      await page.locator('textarea[placeholder*="Paste your recipe here"]').fill(testRecipe);

      // Click parse button
      await page.locator('button:has-text("Parse & Create Recipe")').click();

      // Verify loading state appears
      const loadingText = page.locator('text=Parsing with AI');
      await expect(loadingText).toBeVisible({ timeout: 2000 });

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '35-performance-loading-state.png'),
        fullPage: true,
      });
    });

    test('should measure form submission performance', async ({ page }) => {
      await page.locator('button[role="tab"]:has-text("Detailed Form")').click();
      await page.waitForTimeout(500);

      // Fill minimum required fields
      await page.locator('input#name').fill('Performance Test Recipe');
      await page
        .locator('input[placeholder*="e.g., 2 cups flour"]')
        .first()
        .fill('Test ingredient');
      await page
        .locator('input[placeholder*="Describe this step"]')
        .first()
        .fill('Test instruction');

      // Measure submission time
      const startTime = Date.now();
      await page.locator('button:has-text("Create Recipe")').click();

      // Wait for redirect
      await page.waitForURL(/\/recipes\/[a-z0-9-]+/, { timeout: 10000 });
      const endTime = Date.now();

      const submitTime = endTime - startTime;
      console.log(`Form submission time: ${submitTime}ms`);

      // Assert reasonable submission time (< 3 seconds)
      expect(submitTime).toBeLessThan(3000);

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '36-performance-submission.png'),
        fullPage: true,
      });
    });
  });
});

test.describe('UAT: Post-Submission Verification', () => {
  test('should display created recipe with all data correctly', async ({ page }) => {
    // First, create a recipe
    await page.goto(`${BASE_URL}/recipes/new`);
    await page.locator('button[role="tab"]:has-text("Detailed Form")').click();
    await page.waitForTimeout(500);

    const recipeName = 'UAT Verification Test Recipe';
    const ingredient1 = '2 cups flour';
    const ingredient2 = '1 cup sugar';
    const instruction1 = 'Mix all ingredients';
    const instruction2 = 'Bake for 30 minutes';

    // Fill form
    await page.locator('input#name').fill(recipeName);
    await page.locator('input#description').fill('Test description for UAT');
    await page.locator('input#cuisine').fill('Test Cuisine');
    await page.locator('input#prepTime').fill('15');
    await page.locator('input#cookTime').fill('30');
    await page.locator('input#servings').fill('4');

    // Add ingredients
    await page.locator('input[placeholder*="e.g., 2 cups flour"]').first().fill(ingredient1);
    await page.locator('button:has-text("Add Ingredient")').click();
    await page.locator('input[placeholder*="e.g., 2 cups flour"]').nth(1).fill(ingredient2);

    // Add instructions
    await page.locator('input[placeholder*="Describe this step"]').first().fill(instruction1);
    await page.locator('button:has-text("Add Step")').click();
    await page.locator('input[placeholder*="Describe this step"]').nth(1).fill(instruction2);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '37-post-submit-filled-form.png'),
      fullPage: true,
    });

    // Submit
    await page.locator('button:has-text("Create Recipe")').click();
    await page.waitForURL(/\/recipes\/[a-z0-9-]+/, { timeout: 10000 });

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '38-post-submit-recipe-page.png'),
      fullPage: true,
    });

    // Verify recipe name displayed
    await expect(page.locator(`text=${recipeName}`)).toBeVisible();

    // Verify ingredients displayed
    await expect(page.locator(`text=${ingredient1}`)).toBeVisible();
    await expect(page.locator(`text=${ingredient2}`)).toBeVisible();

    // Verify instructions displayed
    await expect(page.locator(`text=${instruction1}`)).toBeVisible();
    await expect(page.locator(`text=${instruction2}`)).toBeVisible();

    // Verify metadata displayed
    await expect(page.locator('text=15')).toBeVisible(); // prep time
    await expect(page.locator('text=30')).toBeVisible(); // cook time
    await expect(page.locator('text=4')).toBeVisible(); // servings
  });
});
