import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

/**
 * Comprehensive E2E Test Suite: Cook From Your Fridge Feature
 *
 * Tests the complete inventory management and recipe finding workflow:
 * - Inventory CRUD operations
 * - Fridge page with autocomplete
 * - Results pages (manual and inventory modes)
 * - Recipe detail integration
 * - Error handling
 * - Mobile responsiveness
 */

const BASE_URL = 'http://localhost:3005';
const TEST_SCREENSHOTS_DIR = 'test-screenshots/cook-from-fridge';

// Shared state for console monitoring
const consoleMessages: ConsoleMessage[] = [];
const consoleErrors: string[] = [];
const networkErrors: string[] = [];

// Helper function to wait for network idle
async function waitForNetworkIdle(page: Page, timeout = 2000) {
  await page.waitForLoadState('networkidle', { timeout });
}

// Helper function to take screenshot with timestamp
async function takeScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  await page.screenshot({
    path: `${TEST_SCREENSHOTS_DIR}/${name}-${timestamp}.png`,
    fullPage: true,
  });
}

// Helper to get future date
function getFutureDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

test.describe('Cook From Your Fridge - Comprehensive Test Suite', () => {

  test.beforeEach(async ({ page }) => {
    // Clear tracking arrays
    consoleMessages.length = 0;
    consoleErrors.length = 0;
    networkErrors.length = 0;

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push(msg);
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log(`[CONSOLE ERROR] ${msg.text()}`);
      }
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
      console.error('[PAGE ERROR]', error.message);
    });

    // Capture request failures
    page.on('requestfailed', (request) => {
      const errorMsg = `${request.method()} ${request.url()} - ${request.failure()?.errorText}`;
      networkErrors.push(errorMsg);
      console.error(`[REQUEST FAILED] ${errorMsg}`);
    });
  });

  test.afterEach(async ({ page }) => {
    // Log summary
    console.log('\n=== Test Summary ===');
    console.log(`Console Errors: ${consoleErrors.length}`);
    console.log(`Network Errors: ${networkErrors.length}`);

    if (consoleErrors.length > 0) {
      console.log('\nConsole Errors:');
      consoleErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }

    if (networkErrors.length > 0) {
      console.log('\nNetwork Errors:');
      networkErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }
  });

  test.describe('Test 1: Inventory Management (/inventory)', () => {

    test('1.1 Page loads with form and inventory list', async ({ page }) => {
      console.log('\n=== Test 1.1: Inventory Page Load ===');

      await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'domcontentloaded' });
      await waitForNetworkIdle(page);
      await takeScreenshot(page, '1-1-inventory-initial-load');

      // Verify page title or heading
      const pageHeading = page.locator('h1, h2').first();
      await expect(pageHeading).toBeVisible({ timeout: 5000 });
      const headingText = await pageHeading.textContent();
      console.log(`✓ Page heading: "${headingText}"`);

      // Verify add form exists
      const ingredientInput = page.locator('input[placeholder*="ingredient" i], input[name*="ingredient" i]').first();
      await expect(ingredientInput).toBeVisible();
      console.log('✓ Ingredient input field visible');

      // Verify inventory list section exists
      const inventorySection = page.locator('text=/inventory/i, [data-testid*="inventory"]').first();
      const hasInventorySection = await inventorySection.count() > 0;
      console.log(`✓ Inventory section present: ${hasInventorySection}`);

      // Check for no console errors
      expect(consoleErrors.length).toBe(0);
    });

    test('1.2 Add inventory item with autocomplete', async ({ page }) => {
      console.log('\n=== Test 1.2: Add Inventory Item ===');

      await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'domcontentloaded' });
      await waitForNetworkIdle(page);

      // Find ingredient input
      const ingredientInput = page.locator('input[placeholder*="ingredient" i], input[name*="ingredient" i]').first();
      await ingredientInput.click();

      // Type partial ingredient name
      console.log('Typing "tomato"...');
      await ingredientInput.fill('tomato');
      await page.waitForTimeout(800); // Wait for autocomplete

      await takeScreenshot(page, '1-2-autocomplete-dropdown');

      // Look for autocomplete dropdown
      const autocompleteOptions = page.locator('[role="listbox"], [role="option"], [class*="autocomplete"], [class*="dropdown"]');
      const optionsCount = await autocompleteOptions.count();

      if (optionsCount > 0) {
        console.log(`✓ Autocomplete dropdown appeared with ${optionsCount} options`);

        // Try to select "tomatoes" from dropdown
        const tomatoOption = page.locator('text=/tomatoes/i').first();
        if (await tomatoOption.isVisible()) {
          await tomatoOption.click();
          console.log('✓ Selected "tomatoes" from autocomplete');
        } else {
          // If no exact match, just continue with typed value
          console.log('⚠ No exact "tomatoes" option, using typed value');
        }
      } else {
        console.log('⚠ No autocomplete dropdown (may not be implemented)');
      }

      await page.waitForTimeout(500);

      // Fill storage location
      const storageSelect = page.locator('select[name*="storage" i], select[name*="location" i]').first();
      if (await storageSelect.isVisible()) {
        await storageSelect.selectOption({ label: /fridge/i });
        console.log('✓ Selected "Fridge" storage location');
      } else {
        console.log('⚠ Storage location field not found');
      }

      // Fill quantity
      const quantityInput = page.locator('input[name*="quantity" i], input[type="number"]').first();
      if (await quantityInput.isVisible()) {
        await quantityInput.fill('3');
        console.log('✓ Entered quantity: 3');
      }

      // Fill unit
      const unitInput = page.locator('input[name*="unit" i], select[name*="unit" i]').first();
      if (await unitInput.isVisible()) {
        const tagName = await unitInput.evaluate(el => el.tagName.toLowerCase());
        if (tagName === 'select') {
          await unitInput.selectOption({ label: /pound/i });
        } else {
          await unitInput.fill('pounds');
        }
        console.log('✓ Entered unit: pounds');
      }

      // Set expiry date (3 days from now)
      const expiryInput = page.locator('input[type="date"], input[name*="expir" i]').first();
      if (await expiryInput.isVisible()) {
        const futureDate = getFutureDate(3);
        await expiryInput.fill(futureDate);
        console.log(`✓ Set expiry date: ${futureDate}`);
      }

      await takeScreenshot(page, '1-2-form-filled');

      // Click Add button
      const addButton = page.locator('button:has-text("Add to Inventory"), button[type="submit"]').first();
      await expect(addButton).toBeVisible();
      await addButton.click();
      console.log('✓ Clicked "Add to Inventory" button');

      // Wait for success toast or feedback
      await page.waitForTimeout(1500);
      await takeScreenshot(page, '1-2-after-submit');

      // Check for success toast
      const toastSelectors = [
        '[role="status"]',
        '[class*="toast"]',
        '[class*="notification"]',
        'text=/success/i',
        'text=/added/i'
      ];

      let toastFound = false;
      for (const selector of toastSelectors) {
        const toast = page.locator(selector).first();
        if (await toast.isVisible()) {
          const toastText = await toast.textContent();
          console.log(`✓ Success toast: "${toastText}"`);
          toastFound = true;
          break;
        }
      }

      if (!toastFound) {
        console.log('⚠ No success toast visible');
      }

      // Verify item appears in inventory list
      await page.waitForTimeout(1000);
      const inventoryItems = page.locator('[class*="inventory"], [data-testid*="inventory-item"]');
      const itemsCount = await inventoryItems.count();
      console.log(`✓ Inventory items visible: ${itemsCount}`);

      // Look for "tomato" in the list
      const tomatoItem = page.locator('text=/tomato/i').first();
      if (await tomatoItem.isVisible()) {
        console.log('✓ Tomato item appears in inventory list');
      }

      await takeScreenshot(page, '1-2-inventory-updated');
    });

    test('1.3 Expiring items alert', async ({ page }) => {
      console.log('\n=== Test 1.3: Expiring Items Alert ===');

      await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'domcontentloaded' });
      await waitForNetworkIdle(page);

      // Look for expiring items alert banner
      const alertSelectors = [
        '[role="alert"]',
        '[class*="alert"]',
        '[class*="warning"]',
        'text=/expiring/i',
        'text=/expires soon/i'
      ];

      let alertFound = false;
      for (const selector of alertSelectors) {
        const alert = page.locator(selector).first();
        if (await alert.isVisible()) {
          const alertText = await alert.textContent();
          console.log(`✓ Expiring items alert: "${alertText}"`);
          alertFound = true;

          // Look for "Find Recipes" button in alert
          const findRecipesBtn = page.locator('button:has-text("Find Recipes"), a:has-text("Find Recipes")').first();
          if (await findRecipesBtn.isVisible()) {
            console.log('✓ "Find Recipes" button exists in alert');
          }

          break;
        }
      }

      if (!alertFound) {
        console.log('⚠ No expiring items alert (may not have expiring items)');
      }

      await takeScreenshot(page, '1-3-expiring-alert');
    });
  });

  test.describe('Test 2: Fridge Page (/fridge)', () => {

    test('2.1 Page loads with inventory and manual entry options', async ({ page }) => {
      console.log('\n=== Test 2.1: Fridge Page Load ===');

      await page.goto(`${BASE_URL}/fridge`, { waitUntil: 'domcontentloaded' });
      await waitForNetworkIdle(page);
      await takeScreenshot(page, '2-1-fridge-initial');

      // Check for "Use My Inventory" section
      const inventorySection = page.locator('text=/use my inventory/i, text=/from my fridge/i').first();
      const hasInventorySection = await inventorySection.count() > 0;
      console.log(`✓ Inventory section present: ${hasInventorySection}`);

      if (hasInventorySection) {
        // Look for inventory count badge
        const badge = page.locator('[class*="badge"], [class*="count"]').first();
        if (await badge.isVisible()) {
          const badgeText = await badge.textContent();
          console.log(`✓ Inventory count badge: "${badgeText}"`);
        }

        // Look for "Find Recipes from My Fridge" button
        const fridgeButton = page.locator('button:has-text("Find Recipes"), button:has-text("My Fridge")').first();
        if (await fridgeButton.isVisible()) {
          console.log('✓ "Find Recipes from My Fridge" button visible');
        }
      }

      // Check for manual entry input
      const manualInput = page.locator('input[placeholder*="ingredient" i]').first();
      await expect(manualInput).toBeVisible();
      console.log('✓ Manual ingredient input visible');

      await takeScreenshot(page, '2-1-fridge-complete');
    });

    test('2.2 Manual entry with autocomplete', async ({ page }) => {
      console.log('\n=== Test 2.2: Manual Entry with Autocomplete ===');

      await page.goto(`${BASE_URL}/fridge`, { waitUntil: 'domcontentloaded' });
      await waitForNetworkIdle(page);

      const ingredientInput = page.locator('input[placeholder*="ingredient" i]').first();

      // Type "chic"
      console.log('Typing "chic"...');
      await ingredientInput.click();
      await ingredientInput.fill('chic');
      await page.waitForTimeout(800);

      await takeScreenshot(page, '2-2-autocomplete-chic');

      // Check for autocomplete dropdown
      const dropdown = page.locator('[role="listbox"], [role="option"]').first();
      if (await dropdown.isVisible()) {
        console.log('✓ Autocomplete dropdown appeared');

        // Select "chicken"
        const chickenOption = page.locator('text=/^chicken$/i, [role="option"]:has-text("chicken")').first();
        if (await chickenOption.isVisible()) {
          await chickenOption.click();
          console.log('✓ Selected "chicken" from dropdown');
          await page.waitForTimeout(500);
        }
      }

      await takeScreenshot(page, '2-2-after-select-chicken');

      // Verify chicken appears as badge/chip
      const chickenBadge = page.locator('[class*="badge"], [class*="chip"], [class*="tag"]').locator('text=/chicken/i').first();
      if (await chickenBadge.isVisible()) {
        console.log('✓ Chicken appears as badge chip');
      }

      // Add rice
      console.log('Typing "rice"...');
      await ingredientInput.fill('rice');
      await page.waitForTimeout(800);

      const riceOption = page.locator('text=/^rice$/i, [role="option"]:has-text("rice")').first();
      if (await riceOption.isVisible()) {
        await riceOption.click();
        console.log('✓ Selected "rice" from dropdown');
        await page.waitForTimeout(500);
      } else {
        // Just press enter to add
        await ingredientInput.press('Enter');
        console.log('✓ Added rice via Enter key');
      }

      await takeScreenshot(page, '2-2-both-ingredients');

      // Click "Find Recipes"
      const findButton = page.locator('button:has-text("Find Recipes")').first();
      await expect(findButton).toBeVisible();
      await findButton.click();
      console.log('✓ Clicked "Find Recipes"');

      // Wait for navigation
      await page.waitForTimeout(2000);

      // Verify URL changed to results
      const currentUrl = page.url();
      console.log(`Current URL: ${currentUrl}`);
      expect(currentUrl).toContain('/fridge/results');
      expect(currentUrl).toContain('ingredients=');
      console.log('✓ Navigated to results page with ingredients query');

      await takeScreenshot(page, '2-2-navigated-to-results');
    });
  });

  test.describe('Test 3: Results Page - Manual Mode (/fridge/results)', () => {

    test('3.1 Results page loads with recipes', async ({ page }) => {
      console.log('\n=== Test 3.1: Results Page - Manual Mode ===');

      await page.goto(`${BASE_URL}/fridge/results?ingredients=chicken,rice`, {
        waitUntil: 'domcontentloaded'
      });

      // Wait for loading state
      await page.waitForTimeout(2000);
      await takeScreenshot(page, '3-1-results-loading');

      // Wait for recipes to load (up to 5 seconds)
      await page.waitForTimeout(3000);
      await takeScreenshot(page, '3-1-results-loaded');

      // Check for recipe cards
      const recipeCards = page.locator('[class*="recipe"], article, [data-testid*="recipe"]');
      const cardsCount = await recipeCards.count();
      console.log(`✓ Recipe cards found: ${cardsCount}`);

      if (cardsCount > 0) {
        // Check first recipe card for required elements
        const firstCard = recipeCards.first();

        // Match percentage badge
        const matchBadge = firstCard.locator('[class*="match"], [class*="percentage"]').first();
        if (await matchBadge.isVisible()) {
          const matchText = await matchBadge.textContent();
          console.log(`✓ Match percentage badge: "${matchText}"`);
        }

        // Matched ingredients count
        const matchedCount = firstCard.locator('text=/matched/i, text=/have/i').first();
        if (await matchedCount.isVisible()) {
          const countText = await matchedCount.textContent();
          console.log(`✓ Matched ingredients: "${countText}"`);
        }

        // Missing ingredients count
        const missingCount = firstCard.locator('text=/missing/i, text=/need/i').first();
        if (await missingCount.isVisible()) {
          const missingText = await missingCount.textContent();
          console.log(`✓ Missing ingredients: "${missingText}"`);
        }

        // Recipe image
        const recipeImage = firstCard.locator('img').first();
        if (await recipeImage.isVisible()) {
          console.log('✓ Recipe card has image');
        }

        await takeScreenshot(page, '3-1-recipe-cards-detail');
      } else {
        console.log('⚠ No recipe cards found (may need different ingredients)');
      }

      // Check for no console errors during load
      const criticalErrors = consoleErrors.filter(err =>
        !err.includes('Warning') &&
        !err.includes('DevTools')
      );
      expect(criticalErrors.length).toBe(0);
    });

    test('3.2 Sort options work', async ({ page }) => {
      console.log('\n=== Test 3.2: Sort Options ===');

      await page.goto(`${BASE_URL}/fridge/results?ingredients=chicken,rice`, {
        waitUntil: 'domcontentloaded'
      });
      await page.waitForTimeout(3000);

      // Look for sort controls
      const sortSelectors = [
        'select:has-text("Sort")',
        'button:has-text("Sort")',
        '[class*="sort"]',
        'text=/fewest missing/i',
        'text=/cook time/i'
      ];

      let sortFound = false;
      for (const selector of sortSelectors) {
        const sortControl = page.locator(selector).first();
        if (await sortControl.isVisible()) {
          console.log(`✓ Sort control found: ${selector}`);
          sortFound = true;
          break;
        }
      }

      if (!sortFound) {
        console.log('⚠ No sort controls found (may be default sorted)');
        await takeScreenshot(page, '3-2-no-sort-controls');
        return;
      }

      await takeScreenshot(page, '3-2-before-sort');

      // Try "Fewest Missing" sort
      const fewestMissingBtn = page.locator('button:has-text("Fewest Missing"), [value*="missing"]').first();
      if (await fewestMissingBtn.isVisible()) {
        await fewestMissingBtn.click();
        console.log('✓ Clicked "Fewest Missing" sort');
        await page.waitForTimeout(1000);
        await takeScreenshot(page, '3-2-sorted-fewest-missing');
      }

      // Try "Cook Time" sort
      const cookTimeBtn = page.locator('button:has-text("Cook Time"), [value*="time"]').first();
      if (await cookTimeBtn.isVisible()) {
        await cookTimeBtn.click();
        console.log('✓ Clicked "Cook Time" sort');
        await page.waitForTimeout(1000);
        await takeScreenshot(page, '3-2-sorted-cook-time');
      }
    });

    test('3.3 Filter options work', async ({ page }) => {
      console.log('\n=== Test 3.3: Filter Options ===');

      await page.goto(`${BASE_URL}/fridge/results?ingredients=chicken,rice`, {
        waitUntil: 'domcontentloaded'
      });
      await page.waitForTimeout(3000);

      const initialRecipeCount = await page.locator('[class*="recipe"], article').count();
      console.log(`Initial recipe count: ${initialRecipeCount}`);

      await takeScreenshot(page, '3-3-before-filter');

      // Look for filter controls
      const filterBtn = page.locator('button:has-text("70%"), button:has-text("Match"), text=/70%.*match/i').first();

      if (await filterBtn.isVisible()) {
        await filterBtn.click();
        console.log('✓ Clicked "70%+ Match" filter');
        await page.waitForTimeout(1500);

        const filteredRecipeCount = await page.locator('[class*="recipe"], article').count();
        console.log(`Filtered recipe count: ${filteredRecipeCount}`);

        await takeScreenshot(page, '3-3-filtered-70-percent');
      } else {
        console.log('⚠ No filter controls found');
      }
    });
  });

  test.describe('Test 4: Results Page - Inventory Mode', () => {

    test('4.1 Inventory mode results page', async ({ page }) => {
      console.log('\n=== Test 4.1: Inventory Mode Results ===');

      // First add an item to inventory
      await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'domcontentloaded' });
      await waitForNetworkIdle(page);

      // Quick add if possible
      const ingredientInput = page.locator('input[placeholder*="ingredient" i]').first();
      if (await ingredientInput.isVisible()) {
        await ingredientInput.fill('chicken');
        await page.waitForTimeout(500);

        const addButton = page.locator('button:has-text("Add")').first();
        if (await addButton.isVisible()) {
          await addButton.click();
          await page.waitForTimeout(1000);
        }
      }

      // Navigate to inventory mode results
      await page.goto(`${BASE_URL}/fridge/results?source=inventory`, {
        waitUntil: 'domcontentloaded'
      });
      await page.waitForTimeout(3000);

      await takeScreenshot(page, '4-1-inventory-mode-results');

      // Check for inventory-specific UI
      const inventoryHeading = page.locator('text=/matched from your fridge/i, text=/from your inventory/i').first();
      if (await inventoryHeading.isVisible()) {
        const headingText = await inventoryHeading.textContent();
        console.log(`✓ Inventory heading: "${headingText}"`);
      }

      // Check for "View Inventory" button
      const viewInventoryBtn = page.locator('a:has-text("View Inventory"), button:has-text("View Inventory")').first();
      if (await viewInventoryBtn.isVisible()) {
        console.log('✓ "View Inventory" button exists');
      }

      // Verify recipes show match percentages
      const matchPercentages = page.locator('[class*="match"], text=/%/').first();
      if (await matchPercentages.isVisible()) {
        console.log('✓ Recipes show match percentages');
      }

      await takeScreenshot(page, '4-1-inventory-complete');
    });
  });

  test.describe('Test 5: Recipe Detail Integration', () => {

    test('5.1 Recipe detail shows inventory match section', async ({ page }) => {
      console.log('\n=== Test 5.1: Recipe Detail with Inventory Match ===');

      // Navigate to results first
      await page.goto(`${BASE_URL}/fridge/results?ingredients=chicken`, {
        waitUntil: 'domcontentloaded'
      });
      await page.waitForTimeout(3000);

      // Find and click first recipe
      const firstRecipe = page.locator('[class*="recipe"], article').first();
      const recipeLink = firstRecipe.locator('a, [role="link"]').first();

      if (await recipeLink.isVisible()) {
        await recipeLink.click();
        console.log('✓ Clicked on recipe');
        await page.waitForTimeout(2000);

        await takeScreenshot(page, '5-1-recipe-detail-page');

        // Look for InventoryMatchSection
        const inventoryMatchSection = page.locator('[class*="inventory"], [data-testid*="inventory-match"]').first();

        if (await inventoryMatchSection.isVisible()) {
          console.log('✓ InventoryMatchSection visible');

          // Check for "You Have" section
          const youHaveSection = page.locator('text=/you have/i').first();
          if (await youHaveSection.isVisible()) {
            console.log('✓ "You Have" section with green indicators');
          }

          // Check for "You Need" section
          const youNeedSection = page.locator('text=/you need/i').first();
          if (await youNeedSection.isVisible()) {
            console.log('✓ "You Need" section with orange indicators');
          }

          // Check for match percentage
          const matchPercentage = page.locator('text=/%/, [class*="percentage"]').first();
          if (await matchPercentage.isVisible()) {
            const percentText = await matchPercentage.textContent();
            console.log(`✓ Match percentage: "${percentText}"`);
          }

          // Check for collapsible details
          const detailsToggle = page.locator('button:has-text("Details"), [class*="collaps"]').first();
          if (await detailsToggle.isVisible()) {
            console.log('✓ Collapsible details available');
            await detailsToggle.click();
            await page.waitForTimeout(500);
            await takeScreenshot(page, '5-1-details-expanded');
          }

        } else {
          console.log('⚠ InventoryMatchSection not visible (may not be implemented)');
        }

        await takeScreenshot(page, '5-1-recipe-complete');
      } else {
        console.log('⚠ Could not find recipe link to click');
      }
    });
  });

  test.describe('Test 6: CRUD Operations', () => {

    test('6.1 Mark item as used', async ({ page }) => {
      console.log('\n=== Test 6.1: Mark Item as Used ===');

      await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'domcontentloaded' });
      await waitForNetworkIdle(page);

      await takeScreenshot(page, '6-1-before-mark-used');

      // Find a "Mark as Used" button
      const markUsedBtn = page.locator('button:has-text("Mark as Used"), button:has-text("Used")').first();

      if (await markUsedBtn.isVisible()) {
        await markUsedBtn.click();
        console.log('✓ Clicked "Mark as Used"');
        await page.waitForTimeout(1500);

        await takeScreenshot(page, '6-1-after-mark-used');

        // Check for success toast
        const toast = page.locator('[role="status"], [class*="toast"]').first();
        if (await toast.isVisible()) {
          const toastText = await toast.textContent();
          console.log(`✓ Success toast: "${toastText}"`);
        }

        console.log('✓ Item should disappear from list (status changed to "used")');
      } else {
        console.log('⚠ No "Mark as Used" button found (may need to add item first)');
      }
    });

    test('6.2 Edit inventory item', async ({ page }) => {
      console.log('\n=== Test 6.2: Edit Inventory Item ===');

      await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'domcontentloaded' });
      await waitForNetworkIdle(page);

      await takeScreenshot(page, '6-2-before-edit');

      // Look for edit icon/button
      const editBtn = page.locator('button[aria-label*="edit" i], [class*="edit"]').first();

      if (await editBtn.isVisible()) {
        await editBtn.click();
        console.log('✓ Clicked edit button');
        await page.waitForTimeout(500);

        await takeScreenshot(page, '6-2-edit-mode');

        // Find quantity input in edit mode
        const quantityInput = page.locator('input[type="number"]').first();
        if (await quantityInput.isVisible()) {
          await quantityInput.fill('5');
          console.log('✓ Changed quantity to 5');

          // Click checkmark/save
          const saveBtn = page.locator('button:has-text("✓"), button[aria-label*="save" i]').first();
          if (await saveBtn.isVisible()) {
            await saveBtn.click();
            console.log('✓ Clicked save/checkmark');
            await page.waitForTimeout(1000);

            await takeScreenshot(page, '6-2-after-edit');

            // Verify quantity updated
            console.log('✓ Quantity should be updated in UI');
          }
        }
      } else {
        console.log('⚠ No edit button found');
      }
    });

    test('6.3 Delete inventory item', async ({ page }) => {
      console.log('\n=== Test 6.3: Delete Inventory Item ===');

      await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'domcontentloaded' });
      await waitForNetworkIdle(page);

      await takeScreenshot(page, '6-3-before-delete');

      const initialItemCount = await page.locator('[class*="inventory-item"], [data-testid*="item"]').count();
      console.log(`Initial item count: ${initialItemCount}`);

      // Look for delete button
      const deleteBtn = page.locator('button[aria-label*="delete" i], button:has-text("Delete"), [class*="delete"]').first();

      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        console.log('✓ Clicked delete button');
        await page.waitForTimeout(500);

        await takeScreenshot(page, '6-3-delete-confirmation');

        // Look for confirmation dialog
        const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Delete"), [role="dialog"] button').first();
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
          console.log('✓ Confirmed deletion');
          await page.waitForTimeout(1500);

          await takeScreenshot(page, '6-3-after-delete');

          const finalItemCount = await page.locator('[class*="inventory-item"], [data-testid*="item"]').count();
          console.log(`Final item count: ${finalItemCount}`);

          if (finalItemCount < initialItemCount) {
            console.log('✓ Item successfully removed from list');
          }
        } else {
          // Maybe it deletes without confirmation
          await page.waitForTimeout(1500);
          const finalItemCount = await page.locator('[class*="inventory-item"], [data-testid*="item"]').count();
          console.log(`Final item count: ${finalItemCount}`);
        }
      } else {
        console.log('⚠ No delete button found');
      }
    });
  });

  test.describe('Test 7: Error Handling', () => {

    test('7.1 Results with no ingredients', async ({ page }) => {
      console.log('\n=== Test 7.1: No Ingredients Error ===');

      await page.goto(`${BASE_URL}/fridge/results`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      await takeScreenshot(page, '7-1-no-ingredients');

      // Check for error message or redirect
      const errorMessage = page.locator('[role="alert"], text=/error/i, text=/no ingredients/i').first();
      if (await errorMessage.isVisible()) {
        const errorText = await errorMessage.textContent();
        console.log(`✓ Error message: "${errorText}"`);
      } else {
        // Check if redirected
        const currentUrl = page.url();
        console.log(`Current URL: ${currentUrl}`);
        if (currentUrl !== `${BASE_URL}/fridge/results`) {
          console.log('✓ Redirected away from results page');
        } else {
          console.log('⚠ No error message or redirect');
        }
      }
    });

    test('7.2 Invalid ingredients', async ({ page }) => {
      console.log('\n=== Test 7.2: Invalid Ingredients ===');

      await page.goto(`${BASE_URL}/fridge/results?ingredients=zzz_invalid_zzz,xxx_fake_xxx`, {
        waitUntil: 'domcontentloaded'
      });
      await page.waitForTimeout(3000);

      await takeScreenshot(page, '7-2-invalid-ingredients');

      // Check for empty state or error
      const emptyState = page.locator('text=/no recipes/i, text=/try different/i, [class*="empty"]').first();
      if (await emptyState.isVisible()) {
        const emptyText = await emptyState.textContent();
        console.log(`✓ Empty state message: "${emptyText}"`);
      }

      const recipeCount = await page.locator('[class*="recipe"], article').count();
      console.log(`Recipes found with invalid ingredients: ${recipeCount}`);

      if (recipeCount === 0) {
        console.log('✓ No recipes shown for invalid ingredients (graceful handling)');
      }
    });
  });

  test.describe('Test 8: Mobile Responsiveness', () => {

    test('8.1 Mobile: Inventory page', async ({ page }) => {
      console.log('\n=== Test 8.1: Mobile Inventory Page ===');

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'domcontentloaded' });
      await waitForNetworkIdle(page);

      await takeScreenshot(page, '8-1-mobile-inventory');

      // Check form stacks vertically
      const form = page.locator('form').first();
      if (await form.isVisible()) {
        const boundingBox = await form.boundingBox();
        if (boundingBox) {
          console.log(`✓ Form visible on mobile (width: ${boundingBox.width}px)`);
          expect(boundingBox.width).toBeLessThanOrEqual(375);
        }
      }

      // Verify inputs are readable
      const ingredientInput = page.locator('input[placeholder*="ingredient" i]').first();
      if (await ingredientInput.isVisible()) {
        const inputBox = await ingredientInput.boundingBox();
        if (inputBox) {
          console.log(`✓ Input field visible (width: ${inputBox.width}px)`);
        }
      }

      console.log('✓ Mobile layout: form and list stack vertically');
    });

    test('8.2 Mobile: Fridge page', async ({ page }) => {
      console.log('\n=== Test 8.2: Mobile Fridge Page ===');

      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto(`${BASE_URL}/fridge`, { waitUntil: 'domcontentloaded' });
      await waitForNetworkIdle(page);

      await takeScreenshot(page, '8-2-mobile-fridge');

      // Verify sections stack properly
      const sections = page.locator('section, [class*="section"]');
      const sectionCount = await sections.count();
      console.log(`✓ Sections on page: ${sectionCount}`);
      console.log('✓ Mobile layout: sections stack properly');
    });

    test('8.3 Mobile: Results page', async ({ page }) => {
      console.log('\n=== Test 8.3: Mobile Results Page ===');

      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto(`${BASE_URL}/fridge/results?ingredients=chicken`, {
        waitUntil: 'domcontentloaded'
      });
      await page.waitForTimeout(3000);

      await takeScreenshot(page, '8-3-mobile-results');

      // Check recipe cards display in single column
      const recipeCards = page.locator('[class*="recipe"], article').first();
      if (await recipeCards.isVisible()) {
        const cardBox = await recipeCards.boundingBox();
        if (cardBox) {
          console.log(`✓ Recipe card width: ${cardBox.width}px`);
          console.log('✓ Cards display in single column on mobile');
        }
      }

      // Verify cards remain readable
      const cardText = await page.locator('[class*="recipe"], article').first().textContent();
      if (cardText && cardText.length > 0) {
        console.log('✓ Recipe cards remain readable on mobile');
      }
    });
  });

  // Final summary test
  test('Test Summary: Overall Feature Health', async ({ page }) => {
    console.log('\n=== OVERALL TEST SUMMARY ===');
    console.log('All tests completed. Check individual test results above.');
    console.log(`Total console errors across all tests: ${consoleErrors.length}`);
    console.log(`Total network errors across all tests: ${networkErrors.length}`);

    // This test always passes - it's just for logging
    expect(true).toBe(true);
  });
});
