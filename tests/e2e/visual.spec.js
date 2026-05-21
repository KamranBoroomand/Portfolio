import { expect, test } from '@playwright/test';

test.describe('Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Keep visual snapshots deterministic by removing dynamic effects.
    await page.route('**/assets/js/effects.bundle.js', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: ''
      });
    });

    await page.route('**/assets/js/effects.bundle.css', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/css',
        body: ''
      });
    });
  });

  test('homepage baseline remains stable', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Visual baseline is captured for chromium only.');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('body')).toHaveClass(/is-loaded/);

    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      animations: 'disabled',
      mask: [page.locator('#effects-root')],
      maxDiffPixels: 1500
    });
  });

  test('projects tab baseline remains stable', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Visual baseline is captured for chromium only.');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#portfolio');
    const projectsTab = page.getByRole('tab', { name: 'Projects' });
    if (!(await projectsTab.getAttribute('aria-selected'))?.includes('true')) {
      await projectsTab.click();
    }

    await expect(page.locator('body')).toHaveClass(/is-loaded/);

    await expect(page).toHaveScreenshot('portfolio-tab.png', {
      fullPage: true,
      animations: 'disabled',
      mask: [page.locator('#effects-root')],
      maxDiffPixels: 200
    });
  });
});
