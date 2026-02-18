import { expect, test } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('homepage baseline remains stable', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Visual baseline is captured for chromium only.');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('body')).toHaveClass(/is-loaded/);

    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      animations: 'disabled',
      mask: [page.locator('#effects-root')],
      maxDiffPixels: 200
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
