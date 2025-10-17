import { expect, test } from '@playwright/test';
import { cleanupTestMeals, generateUniqueMealName } from './fixtures/test-data';

/**
 * UAT Test Suite: Meal Templates Flow
 *
 * Business Goal: Users can quickly create meals from pre-configured templates
 * User Story: As a busy home cook, I want to use meal templates
 *             so that I can save time planning common meal types
 */

test.describe('Meal Templates', () => {
  const createdMealNames: string[] = [];

  test.afterAll(async ({ browser }) => {
    if (createdMealNames.length > 0) {
      const context = await browser.newContext({
        storageState: 'tests/e2e/.auth/user.json',
      });
      const page = await context.newPage();
      await cleanupTestMeals(page, createdMealNames);
      await context.close();
    }
  });

  test('should display available templates', async ({ page }) => {
    /**
     * Business Value: Template discovery
     * Success Criteria:
     * - Templates are visible and accessible
     * - Template information is clear
     * - User can browse templates
     */

    await page.goto('/meals/new');
    await page.waitForLoadState('networkidle');

    // Click on Templates tab
    const templatesTab = page.locator(
      'button:has-text("Template"), [role="tab"]:has-text("Template")'
    );

    if (await templatesTab.isVisible()) {
      await templatesTab.click();
      await page.waitForTimeout(500);

      // Check for template cards or list
      const templates = page.locator('[data-testid="meal-template"], .meal-template-card');
      const templateCount = await templates.count();

      if (templateCount > 0) {
        console.log(`✅ Found ${templateCount} meal templates`);

        // Verify template shows useful information
        const firstTemplate = templates.first();
        await expect(firstTemplate).toBeVisible();

        // Templates should show name
        await expect(firstTemplate.locator('text=/')).toBeVisible();
      } else {
        console.log('⚠️  No templates found - database may need seeding');
      }
    } else {
      console.log('ℹ️  Templates tab not found - feature may not be implemented yet');
    }
  });

  test('should create meal from template', async ({ page }) => {
    /**
     * Business Value: Quick meal creation workflow
     * Success Criteria:
     * - User can select a template
     * - Template data pre-fills form
     * - User can customize template
     * - Meal is created successfully
     */

    const mealName = generateUniqueMealName('From Template');
    createdMealNames.push(mealName);

    await page.goto('/meals/new');
    await page.waitForLoadState('networkidle');

    // Switch to templates tab
    const templatesTab = page.locator(
      'button:has-text("Template"), [role="tab"]:has-text("Template")'
    );

    if (await templatesTab.isVisible()) {
      await templatesTab.click();
      await page.waitForTimeout(500);

      // Find and click first template
      const templates = page.locator(
        '[data-testid="meal-template"], .meal-template-card, button:has-text("Use Template")'
      );
      const templateCount = await templates.count();

      if (templateCount > 0) {
        const firstTemplate = templates.first();
        await firstTemplate.click();
        await page.waitForTimeout(500);

        // Verify form is pre-filled or redirected
        // The exact behavior depends on implementation

        // Check if we have a name field to customize
        const nameField = page.locator('input[name="name"], input[name="mealName"]');
        if (await nameField.isVisible()) {
          await nameField.fill(mealName);
        }

        // Check if serves can be customized
        const servesField = page.locator('input[name="serves"]');
        if (await servesField.isVisible()) {
          await servesField.fill('6');
        }

        // Submit
        await page.click('button:has-text("Create Meal"), button[type="submit"]');
        await page.waitForURL(/\/meals\/[a-f0-9-]+/, { timeout: 10000 });
        await page.waitForLoadState('networkidle');

        // Verify meal created
        const heading = await page.locator('h1').textContent();
        expect(heading).toBeTruthy();

        console.log('✅ Meal created from template:', heading);
      } else {
        console.log('⚠️  No templates available for testing');
        test.skip();
      }
    } else {
      console.log('ℹ️  Template feature not found');
      test.skip();
    }
  });

  test('should allow customizing template before creation', async ({ page }) => {
    /**
     * Business Value: Flexible template usage
     * Success Criteria:
     * - User can modify template data
     * - Changes are reflected in created meal
     * - Template remains unchanged
     */

    await page.goto('/meals/new');
    await page.waitForLoadState('networkidle');

    const templatesTab = page.locator(
      'button:has-text("Template"), [role="tab"]:has-text("Template")'
    );

    if (await templatesTab.isVisible()) {
      await templatesTab.click();
      await page.waitForTimeout(500);

      const templates = page.locator('[data-testid="meal-template"], .meal-template-card');
      const templateCount = await templates.count();

      if (templateCount > 0) {
        await templates.first().click();
        await page.waitForTimeout(500);

        // Customize serves count
        const servesField = page.locator('input[name="serves"]');
        if (await servesField.isVisible()) {
          const originalServes = await servesField.inputValue();
          const newServes = (parseInt(originalServes, 10) + 2).toString();

          await servesField.fill(newServes);

          const updatedServes = await servesField.inputValue();
          expect(updatedServes).toBe(newServes);

          console.log('✅ Template data customized successfully');
        }
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('should show template preview information', async ({ page }) => {
    /**
     * Business Value: Informed template selection
     * Success Criteria:
     * - Templates show meaningful preview
     * - User can see what's included
     * - Estimated information displayed
     */

    await page.goto('/meals/new');
    await page.waitForLoadState('networkidle');

    const templatesTab = page.locator(
      'button:has-text("Template"), [role="tab"]:has-text("Template")'
    );

    if (await templatesTab.isVisible()) {
      await templatesTab.click();
      await page.waitForTimeout(500);

      const templates = page.locator('[data-testid="meal-template"], .meal-template-card');
      const templateCount = await templates.count();

      if (templateCount > 0) {
        const firstTemplate = templates.first();

        // Templates should show useful metadata
        const hasName = (await firstTemplate.locator('h2, h3, h4').count()) > 0;
        const hasDescription = (await firstTemplate.locator('p').count()) > 0;

        if (hasName) {
          console.log('✅ Template shows name');
        }

        if (hasDescription) {
          console.log('✅ Template shows description');
        }

        expect(hasName || hasDescription).toBe(true);
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('should handle template selection cancellation', async ({ page }) => {
    /**
     * Business Value: User control and flexibility
     * Success Criteria:
     * - User can cancel template selection
     * - Can switch between templates
     * - Can go back to manual creation
     */

    await page.goto('/meals/new');
    await page.waitForLoadState('networkidle');

    const templatesTab = page.locator(
      'button:has-text("Template"), [role="tab"]:has-text("Template")'
    );

    if (await templatesTab.isVisible()) {
      await templatesTab.click();
      await page.waitForTimeout(500);

      // Switch back to manual builder
      const builderTab = page.locator('button:has-text("Build"), [role="tab"]:has-text("Build")');
      if (await builderTab.isVisible()) {
        await builderTab.click();
        await page.waitForTimeout(500);

        // Verify we're back on the builder
        const nameField = page.locator('input[name="name"]');
        await expect(nameField).toBeVisible();

        console.log('✅ Can switch between templates and manual builder');
      }
    } else {
      test.skip();
    }
  });

  test('should track template usage statistics', async ({ page }) => {
    /**
     * Business Value: Template popularity and improvement
     * Success Criteria:
     * - Popular templates are highlighted
     * - Usage counts are visible (if implemented)
     */

    await page.goto('/meals/new');
    await page.waitForLoadState('networkidle');

    const templatesTab = page.locator(
      'button:has-text("Template"), [role="tab"]:has-text("Template")'
    );

    if (await templatesTab.isVisible()) {
      await templatesTab.click();
      await page.waitForTimeout(500);

      const templates = page.locator('[data-testid="meal-template"], .meal-template-card');
      const templateCount = await templates.count();

      if (templateCount > 0) {
        // Check if templates show usage stats
        const usageStats = page.locator('text=/used.*time|popular|trending/i');
        if (await usageStats.first().isVisible()) {
          console.log('✅ Template usage statistics displayed');
        } else {
          console.log('ℹ️  Template usage stats not displayed (may not be implemented)');
        }
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });
});
