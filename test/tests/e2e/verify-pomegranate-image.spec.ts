import { expect, test } from '@playwright/test';

test('Verify pomegranate-peach-barbecue-sauce recipe image', async ({ page }) => {
  console.log('Navigating to recipe page...');
  await page.goto('http://localhost:3002/recipes/pomegranate-peach-barbecue-sauce');

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Find the hero image
  const heroImage = page
    .locator('img[alt*="pomegranate" i], img[alt*="barbecue" i], img.object-cover')
    .first();

  // Wait for image to be visible
  await heroImage.waitFor({ state: 'visible', timeout: 10000 });

  // Get image attributes
  const src = await heroImage.getAttribute('src');
  const alt = await heroImage.getAttribute('alt');

  console.log('Image SRC:', src);
  console.log('Image ALT:', alt);

  // Verify image is from Vercel Blob Storage
  expect(src).toContain('vercel-storage.com');
  expect(src).toContain('pomegranate-peach-barbecue-sauce');

  // Take screenshot for visual verification
  await page.screenshot({
    path: '/Users/masa/Projects/joanies-kitchen/tests/pomegranate-recipe-screenshot.png',
    fullPage: true,
  });

  console.log('✅ Image verification complete');
  console.log('Screenshot saved to: tests/pomegranate-recipe-screenshot.png');
});
