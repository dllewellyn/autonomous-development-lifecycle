import { test, expect } from '@playwright/test';

test('basic scraper test', async ({ page }) => {
  // This is a placeholder test.
  // Replace with actual scraper E2E tests once the scraper is implemented.
  await page.goto('https://www.wikipedia.org/');
  await expect(page).toHaveTitle(/Wikipedia/);
});
