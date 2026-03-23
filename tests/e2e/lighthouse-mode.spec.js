import { expect, test } from '@playwright/test';

test.describe('Lighthouse Audit Mode', () => {
  test('skips decorative effects and live GitHub fetches', async ({ page }) => {
    let effectsBundleRequests = 0;
    let credibilityRequests = 0;

    await page.route('**/assets/js/effects.bundle.js', (route) => {
      effectsBundleRequests += 1;
      route.abort();
    });

    await page.route(
      'https://api.github.com/repos/KamranBoroomand/Portfolio/commits**',
      (route) => {
        credibilityRequests += 1;
        route.abort();
      }
    );

    await page.goto('/?lhci=1#about', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toHaveClass(/is-loaded/);
    await page.waitForTimeout(500);

    expect(effectsBundleRequests).toBe(0);
    expect(credibilityRequests).toBe(0);
    await expect(page.locator('.avatar-box')).not.toHaveClass(/egg-avatar-trigger/);
  });
});
