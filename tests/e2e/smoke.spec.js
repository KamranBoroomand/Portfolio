import { expect, test } from '@playwright/test';

test.describe('Portfolio Smoke Flow', () => {
  test('switches between tabs and syncs URL hash', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('body')).toHaveClass(/is-loaded/);
    await expect(page.locator('.icon-box .ui-icon').first()).toBeVisible();

    const aboutPanel = page.locator('#about-page');
    const resumePanel = page.locator('#resume-page');
    const projectsPanel = page.locator('#portfolio-page');

    await expect(aboutPanel).toBeVisible();
    await expect(page).toHaveURL(/#about$/);

    await page.getByRole('tab', { name: 'Resume' }).click();
    await expect(resumePanel).toBeVisible();
    await expect(page).toHaveURL(/#resume$/);

    await page.getByRole('tab', { name: 'Projects' }).click();
    await expect(projectsPanel).toBeVisible();
    await expect(page).toHaveURL(/#portfolio$/);
  });

  test('applies project filters', async ({ page }) => {
    await page.goto('/#portfolio');

    const projectsTab = page.getByRole('tab', { name: 'Projects' });
    if (!(await projectsTab.getAttribute('aria-selected'))?.includes('true')) {
      await projectsTab.click();
    }

    const visibleProjectItems = page.locator('.project-item:not([hidden])');

    await expect(visibleProjectItems).toHaveCount(3);

    await page.getByRole('tab', { name: 'Security' }).click();
    await expect(visibleProjectItems).toHaveCount(1);
    await expect(page.locator('.project-item:not([hidden]) .project-title')).toHaveText(['NullID']);

    await page.getByRole('tab', { name: 'Automation' }).click();
    await expect(visibleProjectItems).toHaveCount(1);
    await expect(page.locator('.project-item:not([hidden]) .project-title')).toHaveText([
      'NullCal'
    ]);

    await page.getByRole('tab', { name: 'All' }).click();
    await expect(visibleProjectItems).toHaveCount(3);
  });

  test('exposes key outbound links with hardened rel attributes', async ({ page }) => {
    await page.goto('/#portfolio');

    const projectsTab = page.getByRole('tab', { name: 'Projects' });
    if (!(await projectsTab.getAttribute('aria-selected'))?.includes('true')) {
      await projectsTab.click();
    }

    const expectedLinks = [
      'https://nullid.kamranboroomand.ir',
      'https://nullcal.kamranboroomand.ir',
      'https://pacman.kamranboroomand.ir',
      'https://github.com/KamranBoroomand/NullID',
      'https://github.com/KamranBoroomand/NullCal'
    ];

    for (const href of expectedLinks) {
      const link = page.locator(`a[href="${href}"]`).first();
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('target', '_blank');
      const relValue = await link.getAttribute('rel');
      expect(relValue).toContain('noopener');
      expect(relValue).toContain('noreferrer');
    }
  });
});
