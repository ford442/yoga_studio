import { test, expect } from '@playwright/test';

test('practice composition renders through the provider shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SACRED BREATH', exact: true })).toBeVisible();
});
