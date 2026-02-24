import { expect, test } from '@playwright/test';

test.describe('Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Keep visual snapshots deterministic by removing dynamic effects and live API drift.
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

    await page.route(
      'https://api.github.com/repos/KamranBoroomand/Portfolio/commits**',
      (route) => {
        const requestUrl = route.request().url();
        const isLatestCommitRequest = requestUrl.includes('per_page=1');
        const payload = isLatestCommitRequest
          ? [
              {
                commit: {
                  committer: {
                    date: '2026-02-01T00:00:00Z'
                  }
                }
              }
            ]
          : Array.from({ length: 7 }, (_, index) => ({
              sha: `mock-sha-${index}`,
              commit: {
                committer: {
                  date: '2026-01-01T00:00:00Z'
                }
              }
            }));

        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(payload)
        });
      }
    );
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
